import Foundation

/// On-device scam scoring for texts from unknown senders.
/// Runs inside the Message Filter extension: no network, no logging, nothing stored.
/// Keep in step with supabase/functions/_shared/url-checks.ts (the server/Safari version).
struct ScamVerdict {
    let score: Int
    let reasons: [String]
    var isScam: Bool { score >= ScamRules.junkThreshold }
}

enum ScamRules {
    static let junkThreshold = 4

    static let shorteners: Set<String> = [
        "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly",
        "cutt.ly", "shorturl.at", "rb.gy", "tiny.cc", "s.id", "v.gd", "qrco.de",
    ]

    static let riskyTLDs: Set<String> = [
        "top", "xyz", "icu", "click", "cfd", "sbs", "buzz", "rest", "zip", "mov", "cyou",
        "shop", "online", "site", "live", "vip", "win", "bond", "info", "today", "lol",
    ]

    /// Brands scammers impersonate most → domains they really use (incl. their own short links).
    static let brands: [String: [String]] = [
        "usps": ["usps.com"], "ups": ["ups.com"], "fedex": ["fedex.com"], "dhl": ["dhl.com"],
        "amazon": ["amazon.com", "amzn.to", "a.co", "amzn.com"], "apple": ["apple.com", "apple.co"],
        "icloud": ["icloud.com", "apple.com"], "paypal": ["paypal.com"], "venmo": ["venmo.com"],
        "zelle": ["zellepay.com"], "cashapp": ["cash.app"], "netflix": ["netflix.com"],
        "microsoft": ["microsoft.com", "live.com", "office.com"], "chase": ["chase.com"],
        "wellsfargo": ["wellsfargo.com"], "bankofamerica": ["bankofamerica.com"], "coinbase": ["coinbase.com"],
        "irs": ["irs.gov"], "ezpass": ["e-zpassny.com", "ezpassnj.com", "e-zpassiag.com"],
    ]

    /// How each brand is written in a message body (matched as whole words).
    static let brandWords: [String: [String]] = [
        "usps": ["usps", "postal service"], "ups": ["ups"], "fedex": ["fedex"], "dhl": ["dhl"],
        "amazon": ["amazon"], "apple": ["apple id", "apple account"], "icloud": ["icloud"],
        "paypal": ["paypal"], "venmo": ["venmo"], "zelle": ["zelle"], "cashapp": ["cash app", "cashapp"],
        "netflix": ["netflix"], "microsoft": ["microsoft"], "chase": ["chase bank", "chase account"],
        "wellsfargo": ["wells fargo"], "bankofamerica": ["bank of america"], "coinbase": ["coinbase"],
        "irs": ["irs"], "ezpass": ["e-zpass", "ezpass", "toll services"],
    ]

    static let urgency = [
        "urgent", "immediately", "within 24", "within 48", "final notice", "last notice", "act now",
        "suspended", "locked", "will be closed", "expire", "unpaid", "overdue", "on hold", "verify your",
        "confirm your", "failed delivery", "redelivery", "re-delivery", "avoid penalty", "late fee",
    ]

    static let money = [
        "fee", "pay ", "payment", "$", "gift card", "bitcoin", "crypto", "wire transfer", "refund",
        "toll", "you owe", "prize", "you won", "winner", "claim your", "reward",
    ]

    static func score(sender: String?, body: String?) -> ScamVerdict {
        guard let raw = body, !raw.isEmpty else { return ScamVerdict(score: 0, reasons: []) }
        let text = raw.lowercased()
        var score = 0
        var reasons: [String] = []
        func add(_ points: Int, _ why: String) {
            score += points
            reasons.append(why)
        }

        let urls = extractURLs(raw)
        if !urls.isEmpty { add(1, "contains a link") }

        for url in urls.prefix(3) {
            guard let host = url.host?.lowercased() else { continue }
            let reg = registrable(host)
            let tld = host.split(separator: ".").last.map(String.init) ?? ""
            let official = brands.values.contains { $0.contains(reg) }

            if !official && (shorteners.contains(host) || looksShortened(url)) { add(2, "shortened link") }
            if riskyTLDs.contains(tld) { add(2, "risky web address ending") }
            if host.contains("xn--") || isIP(host) { add(3, "disguised web address") }
            if url.scheme == "http" { add(1, "unencrypted link") }
            if hasDigitSwap(reg) { add(1, "numbers swapped for letters") }

            let labels = host.split(whereSeparator: { $0 == "." || $0 == "-" }).map(String.init)
            for (brand, domains) in brands {
                let inAddress = labels.contains { $0 == brand || (brand.count >= 6 && $0.contains(brand)) }
                if inAddress && !domains.contains(reg) {
                    add(3, "fake \(brand) web address")
                    break
                }
            }
            for (brand, words) in brandWords where words.contains(where: { containsWord($0, in: text) }) {
                if let domains = brands[brand], !domains.contains(reg) {
                    add(2, "claims to be \(brand) but links elsewhere")
                    break
                }
            }
        }

        if urgency.contains(where: { text.contains($0) }) { add(1, "pressure to act fast") }
        if money.contains(where: { text.contains($0) }) { add(1, "asks about money") }
        if let s = sender, s.contains("@") { add(1, "sent from an email address") }
        // Real businesses mostly text from 5–6 digit short codes; scammers rarely can.
        if let s = sender, isShortCode(s) { score -= 2 }

        return ScamVerdict(score: score, reasons: reasons)
    }

    // MARK: helpers

    static func extractURLs(_ text: String) -> [URL] {
        guard let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue) else { return [] }
        let range = NSRange(text.startIndex..., in: text)
        return detector.matches(in: text, options: [], range: range).compactMap { match in
            guard let url = match.url, let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https" else {
                return nil
            }
            return url
        }
    }

    static func registrable(_ host: String) -> String {
        let parts = host.split(separator: ".").map(String.init)
        guard parts.count >= 2 else { return host }
        let lastTwo = parts.suffix(2).joined(separator: ".")
        let twoPart: Set<String> = ["co.uk", "com.au", "co.nz", "co.jp", "com.br", "co.in", "org.uk"]
        return twoPart.contains(lastTwo) && parts.count >= 3 ? parts.suffix(3).joined(separator: ".") : lastTwo
    }

    /// Unknown shorteners: tiny domain + one random-looking path token (e.g. n0w.us/-9NBVC).
    static func looksShortened(_ url: URL) -> Bool {
        let name = registrable(url.host?.lowercased() ?? "").split(separator: ".").first.map(String.init) ?? ""
        let segs = url.pathComponents.filter { $0 != "/" }
        guard name.count <= 4, segs.count == 1, url.query == nil, let token = segs.first else { return false }
        guard matches("^[A-Za-z0-9_-]{4,12}$", token) else { return false }
        let rest = String(token.dropFirst())
        return matches("[0-9]", token) || (matches("[A-Z]", rest) && matches("[a-z]", token)) || matches("^[-_]", token)
    }

    static func hasDigitSwap(_ registrableDomain: String) -> Bool {
        let name = registrableDomain.split(separator: ".").first.map(String.init) ?? ""
        return matches("[a-z][01][a-z]|^[01][a-z]{2,}|[a-z]{2,}[01]$", name)
    }

    static func isIP(_ host: String) -> Bool { matches("^\\d{1,3}(\\.\\d{1,3}){3}$", host) || host.hasPrefix("[") }

    static func isShortCode(_ sender: String) -> Bool {
        let digits = sender.filter(\.isNumber)
        return digits.count == sender.count && (5...6).contains(digits.count)
    }

    static func containsWord(_ word: String, in text: String) -> Bool {
        let escaped = NSRegularExpression.escapedPattern(for: word)
        return matches("(^|[^a-z])\(escaped)([^a-z]|$)", text)
    }

    static func matches(_ pattern: String, _ text: String) -> Bool {
        text.range(of: pattern, options: .regularExpression) != nil
    }
}

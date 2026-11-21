import Foundation
import SafariServices

/// Receives the extension's "I'm running" heartbeat and records the time in the shared
/// App Group, so the Wary app can show Safari protection as switched on automatically.
/// No page content or browsing data is ever sent here.
class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    static let appGroup = "group.com.brendanmccormack.lens"

    func beginRequest(with context: NSExtensionContext) {
        UserDefaults(suiteName: Self.appGroup)?.set(Date().timeIntervalSince1970, forKey: "safari.lastSeen")
        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: ["ok": true]]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}

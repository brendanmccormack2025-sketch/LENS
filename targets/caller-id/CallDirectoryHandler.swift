import CallKit
import Foundation

/// Wary Caller ID — labels incoming calls from numbers people have reported to the FTC.
///
/// The app downloads the list and writes it to the shared App Group as `calllist.bin`:
/// fixed 9-byte records [8-byte big-endian E.164 number][1-byte label index], sorted ascending.
/// The file is memory-mapped so even large lists stay inside the extension's ~6 MB limit.
final class CallDirectoryHandler: CXCallDirectoryProvider {
    static let appGroup = "group.com.brendanmccormack.lens"
    static let fileName = "calllist.bin"
    /// Index must match LABELS in supabase/functions/CallList.
    static let labels = [
        "Wary: Reported spam caller",
        "Wary: Reported robocall / silent call",
        "Wary: Reported impostor scam",
    ]

    override func beginRequest(with context: CXCallDirectoryExtensionContext) {
        context.delegate = self
        // Always rebuild from the latest file. Removing everything first is the
        // only removal allowed during an incremental request.
        if context.isIncremental {
            context.removeAllIdentificationEntries()
        }
        addEntries(to: context)
        context.completeRequest()
    }

    private func addEntries(to context: CXCallDirectoryExtensionContext) {
        guard
            let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Self.appGroup),
            let data = try? Data(contentsOf: dir.appendingPathComponent(Self.fileName), options: .alwaysMapped)
        else { return }

        let recordSize = 9
        let count = data.count / recordSize
        data.withUnsafeBytes { (raw: UnsafeRawBufferPointer) in
            var previous: Int64 = 0
            for i in 0..<count {
                let offset = i * recordSize
                var value: UInt64 = 0
                for b in 0..<8 {
                    value = (value << 8) | UInt64(raw[offset + b])
                }
                let number = Int64(bitPattern: value)
                // Entries must be strictly ascending or iOS rejects the whole load.
                guard number > previous else { continue }
                previous = number
                let index = Int(raw[offset + 8])
                let label = index < Self.labels.count ? Self.labels[index] : Self.labels[0]
                context.addIdentificationEntry(withNextSequentialPhoneNumber: number, label: label)
            }
        }
    }
}

extension CallDirectoryHandler: CXCallDirectoryExtensionContextDelegate {
    func requestFailed(for extensionContext: CXCallDirectoryExtensionContext, withError error: Error) {
        // Nothing to recover here; the app shows status from CXCallDirectoryManager.
    }
}

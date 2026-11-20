import SafariServices

// LENS's Safari extension runs entirely in its content script (assets/content.js).
// This native handler is required by Safari but currently has nothing to do.
class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        context.completeRequest(returningItems: [], completionHandler: nil)
    }
}

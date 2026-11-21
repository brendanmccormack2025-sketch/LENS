import CallKit
import ExpoModulesCore
import LocalAuthentication

public class WaryNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WaryNative")

    /// Decodes base64 and writes it into the shared App Group container,
    /// where the Call Directory extension can read it. Returns bytes written.
    AsyncFunction("writeSharedFile") { (group: String, name: String, base64: String, promise: Promise) in
      guard let dir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else {
        promise.reject("ERR_APP_GROUP", "App group \(group) is not available")
        return
      }
      guard let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters) else {
        promise.reject("ERR_BASE64", "Could not decode data")
        return
      }
      do {
        try data.write(to: dir.appendingPathComponent(name), options: .atomic)
        promise.resolve(data.count)
      } catch {
        promise.reject("ERR_WRITE", error.localizedDescription)
      }
    }

    AsyncFunction("reloadCallDirectory") { (identifier: String, promise: Promise) in
      CXCallDirectoryManager.sharedInstance.reloadExtension(withIdentifier: identifier) { error in
        if let error = error {
          promise.reject("ERR_RELOAD", error.localizedDescription)
        } else {
          promise.resolve(nil)
        }
      }
    }

    AsyncFunction("callDirectoryStatus") { (identifier: String, promise: Promise) in
      CXCallDirectoryManager.sharedInstance.getEnabledStatusForExtension(withIdentifier: identifier) { status, error in
        if error != nil {
          promise.resolve("unknown")
          return
        }
        switch status {
        case .enabled: promise.resolve("enabled")
        case .disabled: promise.resolve("disabled")
        default: promise.resolve("unknown")
        }
      }
    }

    /// Opens Settings → Phone → Call Blocking & Identification (iOS 13.4+).
    AsyncFunction("openCallSettings") { (promise: Promise) in
      CXCallDirectoryManager.sharedInstance.openSettings { _ in
        promise.resolve(nil)
      }
    }

    /// True if the iPhone has a passcode (or Face ID / Touch ID backed by one).
    Function("isPasscodeSet") { () -> Bool in
      LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: nil)
    }
  }
}

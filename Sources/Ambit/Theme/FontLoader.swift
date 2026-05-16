import CoreText
import Foundation

/// Registers bundled fonts at app launch so they're addressable via `Font.custom(_:size:)`.
/// Without this, SwiftUI silently falls back to the system font.
enum FontLoader {
    static func registerAll() {
        let fontNames = [
            "Zodiak-Bold",
            "PlusJakartaSans-Regular",
        ]
        for name in fontNames {
            register(name: name, extension: "otf")
        }
    }

    private static func register(name: String, extension ext: String) {
        guard let url = Bundle.main.url(forResource: name, withExtension: ext) else {
            assertionFailure("Font missing from bundle: \(name).\(ext)")
            return
        }
        var error: Unmanaged<CFError>?
        if !CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error) {
            // Already registered is OK; other errors warrant attention.
            if let err = error?.takeRetainedValue() {
                let code = CFErrorGetCode(err)
                if code != CTFontManagerError.alreadyRegistered.rawValue {
                    print("Font registration failed for \(name): \(err)")
                }
            }
        }
    }
}

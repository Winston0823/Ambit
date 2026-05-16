import SwiftUI

/// Ambit type ramp. Pairs Zodiak Bold (display) with Plus Jakarta Sans (body).
/// Bundled fonts are registered at launch in `FontLoader.registerAll()`.
enum AmbitFont {
    // Family names match the PostScript names of the bundled OTFs
    static let display = "Zodiak-Bold"
    static let body    = "PlusJakartaSans-Regular"
}

extension Font {
    /// Display (Zodiak Bold). Use for screen headlines: "What's your vibe?"
    static func display(_ size: CGFloat) -> Font {
        .custom(AmbitFont.display, size: size)
    }
    /// Body (Plus Jakarta Sans Regular). Use for everything else.
    static func body(_ size: CGFloat) -> Font {
        .custom(AmbitFont.body, size: size)
    }
}

/// Canonical type ramp per spec § 5 / design tokens.
enum TypeScale {
    static let h1     = Font.display(30)            // screen headlines
    static let title  = Font.body(16).weight(.semibold)  // option-card titles
    static let lead   = Font.body(17)               // primary CTA label
    static let body   = Font.body(15)               // long-form body
    static let input  = Font.body(14)               // input fields
    static let helper = Font.body(13)               // subtitles / helper copy
    static let chip   = Font.body(13)               // skill chips
    static let label  = Font.body(11)               // section labels (UPPERCASE)
    static let nav    = Font.body(10).weight(.semibold) // tab bar labels
}

import SwiftUI

/// Ambit brand tokens.
/// Source of truth: Figma file `AMBIT` (Style And References page) + iColorpalette reference #504727.
enum Brand {
    // Brand
    static let primary    = Color(hex: 0xD4B490)  // warm tan — CTAs, selected states
    static let accent     = Color(hex: 0xB48045)  // deeper tan — coaching copy, link accents
    static let warmTan    = Color(hex: 0xE0C9AF)  // lighter tan — active selection pill
    static let seekerSand = Color(hex: 0xF2E8DD)  // seeker card surface
    static let seekerInk  = Color(hex: 0x4D361D)  // seeker title ink (AA on sand)

    // Surface
    static let canvas      = Color(hex: 0xFFFFFF)
    static let surface1    = Color(hex: 0xF6F6F6)
    static let surface2    = Color(hex: 0xEFEFEF)
    static let cream       = Color(hex: 0xDED8D3)
    static let warmGray    = Color(hex: 0x918C86)

    // Ink (text)
    static let inkPrimary     = Color(hex: 0x000000)
    static let inkHigh        = Color(hex: 0x141414)
    static let inkBody        = Color(hex: 0x212121)
    static let inkLabel       = Color(hex: 0x737373)
    static let inkMuted       = Color(hex: 0x8C8C8C)
    static let inkPlaceholder = Color(hex: 0xB8B8B8)
    static let inkDisabled    = Color(hex: 0xE0E0E0)
    static let inkOnBrand     = Color(hex: 0xFFFFFF)
    static let inkDeep        = Color(hex: 0x1F1A14)  // for icons/labels on cream glass

    // Border
    static let border = Color(hex: 0xE0E0E0)

    // Liquid Glass
    static let glassCreamTint = Color(hex: 0xDED8D3).opacity(0.62)
    static let glassDarkTint  = Color.black.opacity(0.78)
}

private extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        let r = Double((hex >> 16) & 0xFF) / 255
        let g = Double((hex >>  8) & 0xFF) / 255
        let b = Double( hex        & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: opacity)
    }
}

enum Radii {
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let pill: CGFloat = 100
}

enum Space {
    static let xs:  CGFloat = 4
    static let sm:  CGFloat = 8
    static let md:  CGFloat = 16
    static let lg:  CGFloat = 24
    static let xl:  CGFloat = 32
    static let xxl: CGFloat = 50
    static let screenH: CGFloat = 24
}

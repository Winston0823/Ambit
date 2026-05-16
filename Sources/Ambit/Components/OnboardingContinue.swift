import SwiftUI

/// Primary CTA used across onboarding. Spec § design tokens: 354×52, warm-tan fill,
/// 12pt radius, 17pt Plus Jakarta Sans Regular white label + arrow icon.
struct OnboardingContinue: View {
    let title: String
    let action: () -> Void
    var isEnabled: Bool = true

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Text(title)
                    .font(.custom(AmbitFont.body, size: 17))
                    .foregroundStyle(Brand.inkOnBrand)
                Image(systemName: "arrow.right")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Brand.inkOnBrand)
            }
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Brand.primary)
            )
            .opacity(isEnabled ? 1.0 : 0.45)
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .sensoryFeedback(.impact(weight: .light), trigger: isEnabled)
    }
}

/// Back chevron used at the top-left of every onboarding screen.
/// Glyph `‹` rendered in Plus Jakarta Sans Regular 28pt, ink-muted.
struct BackChevron: View {
    let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text("‹")
                .font(.custom(AmbitFont.body, size: 28))
                .foregroundStyle(Brand.inkMuted)
                .frame(width: 32, height: 32, alignment: .leading)
        }
        .buttonStyle(.plain)
    }
}

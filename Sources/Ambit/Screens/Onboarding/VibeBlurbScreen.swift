import SwiftUI

/// S-007 Vibe Blurb Composer. Per Figma node 18:365. Uses Fraunces WONK for the headline
/// (falls back to Zodiak since FontshareKit only ships Zodiak Bold for now).
struct VibeBlurbScreen: View {
    @Binding var blurb: String
    let onBack: () -> Void
    let onContinue: () -> Void

    private let maxLength = 280
    private var charCount: Int { blurb.count }
    private var isValid: Bool { charCount >= 50 && charCount <= maxLength }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            BackChevron(action: onBack)
                .padding(.leading, 16)
                .padding(.top, 8)

            Spacer().frame(height: 28)

            VStack(alignment: .leading, spacing: 8) {
                Text("What’s your vibe?")
                    .font(.custom(AmbitFont.display, size: 30))
                    .foregroundStyle(Brand.inkPrimary)

                Text("This will be shown on your profile.")
                    .font(.custom(AmbitFont.body, size: 14))
                    .foregroundStyle(Brand.inkMuted)
            }
            .padding(.horizontal, 25)

            Spacer().frame(height: 16)

            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Brand.surface1)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(Brand.border, lineWidth: 1.5)
                    )
                    .frame(height: 114)

                if blurb.isEmpty {
                    Text("I’m a pretty easygoing guy, but I’m honest about my feelings towards a product/feature. I’m passionate about the projects I join :D")
                        .font(.custom(AmbitFont.body, size: 15))
                        .foregroundStyle(Brand.inkPlaceholder)
                        .padding(.horizontal, 15)
                        .padding(.vertical, 5)
                        .frame(maxWidth: 322, alignment: .leading)
                        .allowsHitTesting(false)
                }

                TextEditor(text: $blurb)
                    .font(.custom(AmbitFont.body, size: 15))
                    .foregroundStyle(Brand.inkBody)
                    .scrollContentBackground(.hidden)
                    .padding(.horizontal, 11)
                    .padding(.vertical, 0)
                    .frame(height: 114)
            }
            .padding(.horizontal, 25)

            Spacer().frame(height: 12)

            HStack(alignment: .firstTextBaseline) {
                Text("Be honest. The best teams know and like each other for who they actually are.")
                    .font(.custom(AmbitFont.body, size: 13))
                    .foregroundStyle(Brand.accent)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text("\(charCount) / \(maxLength)")
                    .font(.custom(AmbitFont.body, size: 12))
                    .foregroundStyle(charCount == 0 ? Brand.inkDisabled : Brand.inkMuted)
            }
            .padding(.horizontal, 26)

            Spacer()

            OnboardingContinue(title: "Continue", action: onContinue, isEnabled: isValid)
                .padding(.horizontal, 25)
                .padding(.bottom, 60)
        }
    }
}

#Preview {
    VibeBlurbScreen(blurb: .constant(""), onBack: {}, onContinue: {})
}

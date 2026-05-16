import SwiftUI

/// S-009 Role Declaration. Per Figma node 18:403. Three option cards: Owner / Seeker / Both.
struct RoleDeclarationScreen: View {
    @Binding var role: OnboardingFlow.Role?
    let onBack: () -> Void
    let onContinue: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            BackChevron(action: onBack)
                .padding(.leading, 16)
                .padding(.top, 8)

            Spacer().frame(height: 28)

            VStack(alignment: .leading, spacing: 12) {
                Text("What are you looking for?")
                    .font(.custom(AmbitFont.display, size: 30))
                    .foregroundStyle(Brand.inkPrimary)

                Text("This shapes your entire experience on Ambit")
                    .font(.custom(AmbitFont.body, size: 13))
                    .foregroundStyle(Brand.inkMuted)
            }
            .padding(.horizontal, 24)

            Spacer().frame(height: 18)

            VStack(spacing: 22) {
                RoleCard(
                    title: "Project Owner",
                    subtitle: "I have an idea and I’m building\na team around it",
                    style: .neutral,
                    isSelected: role == .owner,
                    onTap: { role = .owner }
                )
                RoleCard(
                    title: "Project Seeker",
                    subtitle: "I want to find a project and\ncontribute my skills",
                    style: .seeker,
                    isSelected: role == .seeker,
                    onTap: { role = .seeker }
                )
                RoleCard(
                    title: "Both",
                    subtitle: "I’m running a project and open\nto joining others too",
                    style: .neutral,
                    isSelected: role == .both,
                    onTap: { role = .both }
                )
            }
            .padding(.horizontal, 16)

            Spacer()

            OnboardingContinue(title: "Continue", action: onContinue, isEnabled: role != nil)
                .padding(.horizontal, 16)
                .padding(.bottom, 60)
        }
    }
}

private struct RoleCard: View {
    let title: String
    let subtitle: String
    let style: Style
    let isSelected: Bool
    let onTap: () -> Void

    enum Style { case neutral, seeker }

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.custom(AmbitFont.body, size: 16).weight(.semibold))
                    .foregroundStyle(titleColor)
                Text(subtitle)
                    .font(.custom(AmbitFont.body, size: 13))
                    .foregroundStyle(subtitleColor)
            }
            .frame(maxWidth: .infinity, minHeight: 104, alignment: .topLeading)
            .padding(.horizontal, 20)
            .padding(.vertical, 20)
            .background(cardBackground)
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(isSelected ? Brand.accent : Color.clear, lineWidth: 2)
            )
        }
        .buttonStyle(.plain)
    }

    private var cardBackground: some View {
        RoundedRectangle(cornerRadius: 16, style: .continuous)
            .fill(style == .seeker ? Brand.seekerSand : Brand.surface2)
    }

    private var titleColor: Color { style == .seeker ? Brand.seekerInk : Brand.inkHigh }
    private var subtitleColor: Color { style == .seeker ? Brand.accent : Brand.inkMuted }
}

#Preview {
    RoleDeclarationScreen(role: .constant(.seeker), onBack: {}, onContinue: {})
}

import SwiftUI

/// S-013 Onboarding Complete. Figma is mostly an empty placeholder right now —
/// we layer a "You're all set" message here so the flow ends meaningfully.
struct CompleteScreen: View {
    let onDone: () -> Void
    @State private var appeared = false

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            Circle()
                .fill(Brand.warmTan)
                .frame(width: 96, height: 96)
                .overlay(
                    Image(systemName: "checkmark")
                        .font(.system(size: 40, weight: .semibold))
                        .foregroundStyle(Brand.inkOnBrand)
                )
                .scaleEffect(appeared ? 1.0 : 0.6)
                .opacity(appeared ? 1.0 : 0.0)

            Spacer().frame(height: 32)

            Text("You’re all set")
                .font(.custom(AmbitFont.display, size: 36))
                .foregroundStyle(Brand.inkPrimary)
                .opacity(appeared ? 1.0 : 0.0)
                .offset(y: appeared ? 0 : 12)

            Spacer().frame(height: 12)

            Text("Welcome to Ambit. Tap below to start finding your team.")
                .font(.custom(AmbitFont.body, size: 15))
                .foregroundStyle(Brand.inkMuted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
                .opacity(appeared ? 1.0 : 0.0)

            Spacer()

            OnboardingContinue(title: "Enter Ambit", action: onDone)
                .padding(.horizontal, 24)
                .padding(.bottom, 60)
                .opacity(appeared ? 1.0 : 0.0)
        }
        .onAppear {
            withAnimation(.spring(response: 0.6, dampingFraction: 0.7).delay(0.1)) {
                appeared = true
            }
        }
    }
}

#Preview {
    CompleteScreen(onDone: {})
}

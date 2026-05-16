import SwiftUI

/// S-005 Age Gate. Per Figma node 18:327 — slot-machine style with 17/18/19 visible.
struct AgeGateScreen: View {
    @Binding var age: Int
    let onBack: () -> Void
    let onContinue: () -> Void

    private var isValid: Bool { age >= 18 }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            BackChevron(action: onBack)
                .padding(.leading, 16)
                .padding(.top, 8)

            Spacer().frame(height: 240)

            Text("What is your age?")
                .font(.custom(AmbitFont.display, size: 36))
                .foregroundStyle(Brand.inkPrimary)
                .padding(.horizontal, 16)

            Spacer().frame(height: 16)

            Text("We bring the brightest college students together")
                .font(.custom(AmbitFont.body, size: 16))
                .foregroundStyle(Brand.inkMuted)
                .padding(.horizontal, 19)
                .frame(maxWidth: 250, alignment: .leading)

            Spacer().frame(height: 80)

            // Slot-machine row: prev / current / next
            HStack(alignment: .firstTextBaseline, spacing: 0) {
                ageCell(value: age - 1, big: false)
                Spacer()
                ageCell(value: age, big: true)
                Spacer()
                ageCell(value: age + 1, big: false)
            }
            .padding(.horizontal, 16)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 20)
                    .onEnded { value in
                        if value.translation.width < -40 { age += 1 }
                        else if value.translation.width > 40 { age = max(13, age - 1) }
                    }
            )

            Spacer()

            OnboardingContinue(title: "Continue", action: onContinue, isEnabled: isValid)
                .padding(.horizontal, 24)
                .padding(.bottom, 60)
        }
    }

    @ViewBuilder
    private func ageCell(value: Int, big: Bool) -> some View {
        Text("\(value)")
            .font(.custom(AmbitFont.display, size: big ? 128 : 96))
            .foregroundStyle(Brand.inkPrimary)
            .opacity(big ? 1.0 : 0.30)
    }
}

#Preview {
    AgeGateScreen(age: .constant(18), onBack: {}, onContinue: {})
}

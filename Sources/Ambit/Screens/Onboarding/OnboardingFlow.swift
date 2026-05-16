import SwiftUI

/// Container that walks the user through the v1.0 onboarding sequence.
/// Per spec Journey 1, but we're building the 5 key visual screens for the demo build.
/// State is in-memory only (no backend yet).
struct OnboardingFlow: View {
    @Environment(\.dismiss) private var dismiss

    @State private var step: Step = .eduEmail
    @State private var eduEmail = ""
    @State private var age: Int = 18
    @State private var vibeBlurb = ""
    @State private var role: Role? = .seeker

    enum Step: Int, CaseIterable {
        case eduEmail, ageGate, vibe, role, complete
    }
    enum Role: String, CaseIterable, Hashable { case owner, seeker, both }

    var body: some View {
        ZStack {
            Brand.canvas.ignoresSafeArea()
            content
                .transition(.asymmetric(
                    insertion: .move(edge: .trailing).combined(with: .opacity),
                    removal: .move(edge: .leading).combined(with: .opacity)
                ))
                .id(step)
        }
        .animation(.spring(response: 0.4, dampingFraction: 0.82), value: step)
    }

    @ViewBuilder
    private var content: some View {
        switch step {
        case .eduEmail:
            EduEmailScreen(
                email: $eduEmail,
                onBack: { dismiss() },
                onContinue: { advance() }
            )
        case .ageGate:
            AgeGateScreen(
                age: $age,
                onBack: { back() },
                onContinue: { advance() }
            )
        case .vibe:
            VibeBlurbScreen(
                blurb: $vibeBlurb,
                onBack: { back() },
                onContinue: { advance() }
            )
        case .role:
            RoleDeclarationScreen(
                role: $role,
                onBack: { back() },
                onContinue: { advance() }
            )
        case .complete:
            CompleteScreen(onDone: { dismiss() })
        }
    }

    private func advance() {
        guard let next = Step(rawValue: step.rawValue + 1) else { return }
        step = next
    }
    private func back() {
        guard let prev = Step(rawValue: step.rawValue - 1) else { dismiss(); return }
        step = prev
    }
}

#Preview { OnboardingFlow() }

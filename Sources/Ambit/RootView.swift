import SwiftUI

/// Top-level container.
/// Hosts the active tab screen, the floating LiquidNavBar, the debug wrench,
/// and the onboarding sheet when triggered from the debug menu.
struct RootView: View {
    @State private var selected: AppTab = .discovery
    @State private var debugSheetOpen = false
    @State private var onboardingOpen = false

    var body: some View {
        ZStack(alignment: .bottom) {
            screen(for: selected)
                .ignoresSafeArea(edges: .bottom)
                .transition(.opacity)
                .animation(.easeInOut(duration: 0.18), value: selected)

            LiquidNavBar(selected: $selected)
                .padding(.bottom, 12)
        }
        .background(Brand.canvas)
        .preferredColorScheme(.light)
        .overlay(alignment: .topTrailing) {
            DebugMenuButton(isPresented: $debugSheetOpen)
                .padding(.trailing, 16)
                .padding(.top, 8)
        }
        .sheet(isPresented: $debugSheetOpen) {
            DebugMenuSheet(onStartOnboarding: { onboardingOpen = true })
        }
        .fullScreenCover(isPresented: $onboardingOpen) {
            OnboardingFlow()
        }
    }

    @ViewBuilder
    private func screen(for tab: AppTab) -> some View {
        switch tab {
        case .discovery: DiscoveryView()
        case .chat:      ChatView()
        case .projects:  ProjectsView()
        case .profile:   ProfileView()
        }
    }
}

#Preview { RootView() }

import SwiftUI

/// Top-level container.
/// Uses `.safeAreaInset(edge: .bottom)` to anchor the LiquidNavBar at the bottom
/// so screen content above reserves vertical space and never sits behind the bar.
struct RootView: View {
    @State private var selected: AppTab = .discovery
    @State private var debugSheetOpen = false
    @State private var onboardingOpen = false

    var body: some View {
        screen(for: selected)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Brand.canvas)
            .preferredColorScheme(.light)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                LiquidNavBar(selected: $selected)
            }
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
            .animation(.easeInOut(duration: 0.18), value: selected)
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

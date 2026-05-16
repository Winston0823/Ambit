import SwiftUI

/// Top-level container. Hosts the active screen behind the floating LiquidNavBar.
/// Spec § 5.1.1 — seeker tab structure (Discover / Chats / Notifications / Profile).
struct RootView: View {
    @State private var selected: SeekerTab = .discover

    var body: some View {
        ZStack(alignment: .bottom) {
            // Content
            screen(for: selected)
                .ignoresSafeArea(edges: .bottom)
                .transition(.opacity)
                .animation(.easeInOut(duration: 0.18), value: selected)

            // Floating nav
            LiquidNavBar(selected: $selected)
                .padding(.bottom, 12)
        }
        .background(Brand.canvas)
        .preferredColorScheme(.light)
    }

    @ViewBuilder
    private func screen(for tab: SeekerTab) -> some View {
        switch tab {
        case .discover:      DiscoverView()
        case .chats:         ChatsView()
        case .notifications: NotificationsView()
        case .profile:       ProfileView()
        }
    }
}

#Preview { RootView() }

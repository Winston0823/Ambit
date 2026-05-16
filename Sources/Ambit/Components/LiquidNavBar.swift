import SwiftUI

/// Tabs in the nav bar, matching the Figma `Nav Bar (instance)` component.
/// Spec § 5.1.1 names them differently (Discover/Chats/Notifications/Profile) —
/// reconciling spec ↔ Figma is a deliberate follow-up.
enum AppTab: String, CaseIterable, Hashable {
    case discovery
    case chat
    case projects
    case profile

    var label: String {
        switch self {
        case .discovery: return "Discovery"
        case .chat:      return "Chat"
        case .projects:  return "Projects"
        case .profile:   return "Profile"
        }
    }

    /// Asset name in `Assets.xcassets`. Each is an SVG imageset with
    /// preserves-vector-representation + template-rendering, so foregroundColor tints it.
    var iconAsset: String {
        switch self {
        case .discovery: return "IconDiscovery"
        case .chat:      return "IconChat"
        case .projects:  return "IconProjects"
        case .profile:   return "IconProfile"
        }
    }

}

/// Anchored bottom tab bar matching the Figma `Nav Bar (instance)` design.
/// Full-width, rounded top corners only, solid dark fill, white iconography.
/// Active tab gets full white; inactive tabs are slightly dimmed for subtle feedback.
/// Use with `.safeAreaInset(edge: .bottom)` so screen content reserves space above it.
struct LiquidNavBar: View {
    @Binding var selected: AppTab

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.allCases, id: \.self) { tab in
                TabButton(
                    tab: tab,
                    isActive: tab == selected,
                    action: { handleTap(tab) }
                )
            }
        }
        .padding(.top, 16)
        .padding(.bottom, 12)
        .padding(.horizontal, 8)
        .background(barBackground)
    }

    @ViewBuilder
    private var barBackground: some View {
        UnevenRoundedRectangle(
            topLeadingRadius: 24,
            bottomLeadingRadius: 0,
            bottomTrailingRadius: 0,
            topTrailingRadius: 24,
            style: .continuous
        )
        .fill(Color(white: 0.16))
        .overlay(
            UnevenRoundedRectangle(
                topLeadingRadius: 24,
                bottomLeadingRadius: 0,
                bottomTrailingRadius: 0,
                topTrailingRadius: 24,
                style: .continuous
            )
            .strokeBorder(Color.white.opacity(0.06), lineWidth: 0.5)
        )
        .shadow(color: .black.opacity(0.22), radius: 18, x: 0, y: -6)
        .ignoresSafeArea(edges: .bottom)
    }

    private func handleTap(_ tab: AppTab) {
        withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
            selected = tab
        }
    }
}

private struct TabButton: View {
    let tab: AppTab
    let isActive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                // Uniform 32pt HEIGHT for every icon. Each PNG keeps its native
                // aspect ratio; widths flow naturally. This matches how Figma renders
                // the icons in their 32x32 groups — same vertical extent, varying widths.
                // Code is identical for all four tabs — no per-icon overrides.
                Image(tab.iconAsset)
                    .renderingMode(.original)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(height: 32)
                Text(tab.label)
                    .font(TypeScale.nav)
                    .lineLimit(1)
            }
            .foregroundStyle(Color.white)   // applies to the Text only; Image uses original colors
            .opacity(isActive ? 1.0 : 0.62)
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: isActive) { _, new in new }
    }
}

#Preview {
    StatefulPreviewWrapper(AppTab.discovery) { binding in
        VStack {
            Spacer()
            Text("Content above").foregroundStyle(.secondary)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.white)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            LiquidNavBar(selected: binding)
        }
    }
}

struct StatefulPreviewWrapper<Value, Content: View>: View {
    @State private var value: Value
    let content: (Binding<Value>) -> Content
    init(_ initial: Value, @ViewBuilder content: @escaping (Binding<Value>) -> Content) {
        _value = State(initialValue: initial)
        self.content = content
    }
    var body: some View { content($value) }
}

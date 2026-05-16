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

/// Floating liquid-glass tab bar. iOS 26 `.glassEffect()` background + a warm-tan
/// animated pill that morphs to the active tab via matched geometry.
struct LiquidNavBar: View {
    @Binding var selected: AppTab
    @Namespace private var pillSpace

    var body: some View {
        tabsRow
            .padding(8)
            .background(barBackground)
            .overlay(hairline)
            .shadow(color: Color.black.opacity(0.22), radius: 28, x: 0, y: 14)
            .padding(.horizontal, 12)
    }

    private var tabsRow: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.allCases, id: \.self) { tab in
                TabButton(
                    tab: tab,
                    isActive: tab == selected,
                    namespace: pillSpace,
                    action: { handleTap(tab) }
                )
            }
        }
    }

    @ViewBuilder
    private var barBackground: some View {
        if #available(iOS 26.0, *) {
            Capsule().fill(.clear).glassEffect(.regular.tint(.black.opacity(0.55)), in: Capsule())
        } else {
            Capsule().fill(.ultraThinMaterial).background(Color.black.opacity(0.55))
        }
    }

    private var hairline: some View {
        Capsule().strokeBorder(Color.white.opacity(0.18), lineWidth: 0.5)
    }

    private func handleTap(_ tab: AppTab) {
        withAnimation(.spring(response: 0.42, dampingFraction: 0.78)) {
            selected = tab
        }
    }
}

private struct TabButton: View {
    let tab: AppTab
    let isActive: Bool
    let namespace: Namespace.ID
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            content
                .frame(maxWidth: .infinity, minHeight: 56)
                .background(activeBackground)
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: isActive) { _, new in new }
    }

    private var content: some View {
        VStack(spacing: 3) {
            Image(tab.iconAsset)
                .renderingMode(.template)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 28, height: 24)
            Text(tab.label)
                .font(TypeScale.nav)
                .lineLimit(1)
        }
        .foregroundStyle(isActive ? Brand.inkDeep : Color.white)
    }

    @ViewBuilder
    private var activeBackground: some View {
        if isActive {
            Capsule()
                .fill(Brand.warmTan)
                .matchedGeometryEffect(id: "activePill", in: namespace)
                .shadow(color: .black.opacity(0.20), radius: 6, x: 0, y: 2)
        }
    }
}

#Preview {
    StatefulPreviewWrapper(AppTab.discovery) { binding in
        ZStack {
            Color(white: 0.10).ignoresSafeArea()
            VStack { Spacer(); LiquidNavBar(selected: binding).padding(.bottom, 24) }
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

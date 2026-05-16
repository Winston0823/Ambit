import SwiftUI

/// Tabs in the seeker-side nav. Spec § 5.1.1 (Project Seeker row):
/// Discover | Chats | Notifications | Profile.
/// Owner-side variant lives in a future `OwnerNavBar` once that role is wired.
enum SeekerTab: String, CaseIterable, Hashable {
    case discover
    case chats
    case notifications
    case profile

    var label: String {
        switch self {
        case .discover:      return "Discover"
        case .chats:         return "Chats"
        case .notifications: return "Notifs"
        case .profile:       return "Profile"
        }
    }

    /// SF Symbol for the inactive state. Active state uses the `.fill` variant.
    var symbol: String {
        switch self {
        case .discover:      return "safari"
        case .chats:         return "bubble.left.and.bubble.right"
        case .notifications: return "bell"
        case .profile:       return "person"
        }
    }

    var symbolFilled: String {
        switch self {
        case .discover:      return "safari.fill"
        case .chats:         return "bubble.left.and.bubble.right.fill"
        case .notifications: return "bell.fill"
        case .profile:       return "person.fill"
        }
    }
}

/// Floating liquid-glass tab bar. Uses iOS 26's `.glassEffect()` for the bar background
/// and a warm-tan pill that morphs to the active tab via matched geometry.
struct LiquidNavBar: View {
    @Binding var selected: SeekerTab
    @Namespace private var pillSpace

    var body: some View {
        tabsRow
            .padding(6)
            .background(barBackground)
            .overlay(hairline)
            .shadow(color: Color.black.opacity(0.18), radius: 24, x: 0, y: 12)
            .padding(.horizontal, 16)
    }

    private var tabsRow: some View {
        HStack(spacing: 0) {
            ForEach(SeekerTab.allCases, id: \.self) { tab in
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
            Capsule().fill(.clear).glassEffect(.regular, in: Capsule())
        } else {
            Capsule().fill(.ultraThinMaterial)
        }
    }

    private var hairline: some View {
        Capsule().strokeBorder(Color.white.opacity(0.45), lineWidth: 0.5)
    }

    private func handleTap(_ tab: SeekerTab) {
        withAnimation(.spring(response: 0.42, dampingFraction: 0.78)) {
            selected = tab
        }
    }
}

private struct TabButton: View {
    let tab: SeekerTab
    let isActive: Bool
    let namespace: Namespace.ID
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            content
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(activeBackground)
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: isActive) { _, new in new }
    }

    private var content: some View {
        VStack(spacing: 2) {
            Image(systemName: isActive ? tab.symbolFilled : tab.symbol)
                .font(.system(size: 20, weight: .regular))
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
                .shadow(color: .black.opacity(0.18), radius: 6, x: 0, y: 2)
        }
    }
}

#Preview {
    StatefulPreviewWrapper(SeekerTab.discover) { binding in
        ZStack {
            Color.black.ignoresSafeArea()
            VStack {
                Spacer()
                LiquidNavBar(selected: binding)
                    .padding(.bottom, 24)
            }
        }
    }
}

/// SwiftUI Preview helper for @Binding-based components.
struct StatefulPreviewWrapper<Value, Content: View>: View {
    @State private var value: Value
    let content: (Binding<Value>) -> Content
    init(_ initial: Value, @ViewBuilder content: @escaping (Binding<Value>) -> Content) {
        _value = State(initialValue: initial)
        self.content = content
    }
    var body: some View { content($value) }
}

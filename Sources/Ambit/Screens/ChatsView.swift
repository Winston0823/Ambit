import SwiftUI

/// Conversation List (S-050). Stub — real thread inbox wires through Stream Chat later.
struct ChatsView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                VStack(alignment: .leading, spacing: Space.sm) {
                    Text("CONVERSATIONS")
                        .font(TypeScale.label)
                        .foregroundStyle(Brand.inkLabel)
                        .tracking(1.2)
                    Text("Where the team comes together")
                        .font(TypeScale.h1)
                        .foregroundStyle(Brand.inkPrimary)
                }
                .padding(.horizontal, Space.screenH)
                .padding(.top, Space.lg)

                VStack(alignment: .leading, spacing: Space.sm) {
                    Text("Nothing here yet")
                        .font(TypeScale.title)
                        .foregroundStyle(Brand.inkHigh)
                    Text("Express interest in a project from the Discover tab. When the owner opens chat, it lands here.")
                        .font(TypeScale.helper)
                        .foregroundStyle(Brand.inkMuted)
                }
                .padding(Space.lg)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Brand.surface1)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
                .padding(.horizontal, Space.screenH)

                Spacer(minLength: 160)
            }
        }
        .background(Brand.canvas)
    }
}

#Preview { ChatsView() }

import SwiftUI

/// Seeker Feed (S-020). Stub for first layer — real feed wiring will come next pass.
struct DiscoveryView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                VStack(alignment: .leading, spacing: Space.sm) {
                    Text("DISCOVER")
                        .font(TypeScale.label)
                        .foregroundStyle(Brand.inkLabel)
                        .tracking(1.2)
                    Text("What are you building?")
                        .font(TypeScale.h1)
                        .foregroundStyle(Brand.inkPrimary)
                }
                .padding(.horizontal, Space.screenH)
                .padding(.top, Space.lg)

                placeholderCard
                placeholderCard
                placeholderCard

                Spacer(minLength: 160) // clearance for the floating nav bar
            }
        }
        .background(Brand.canvas)
    }

    private var placeholderCard: some View {
        VStack(alignment: .leading, spacing: Space.sm) {
            Text("Project")
                .font(TypeScale.label)
                .foregroundStyle(Brand.inkLabel)
            Text("Card placeholder")
                .font(TypeScale.title)
                .foregroundStyle(Brand.inkHigh)
            Text("Feed cards land here once the Discover API is wired. Spec § 8.3.")
                .font(TypeScale.helper)
                .foregroundStyle(Brand.inkMuted)
        }
        .padding(Space.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Brand.surface1)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .padding(.horizontal, Space.screenH)
    }
}

#Preview { DiscoveryView() }

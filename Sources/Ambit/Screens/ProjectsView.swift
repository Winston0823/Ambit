import SwiftUI

/// Saved Projects / Bookmarks (S-024). Stub.
struct ProjectsView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                VStack(alignment: .leading, spacing: Space.sm) {
                    Text("SAVED")
                        .font(TypeScale.label)
                        .foregroundStyle(Brand.inkLabel)
                        .tracking(1.2)
                    Text("Your projects")
                        .font(TypeScale.h1)
                        .foregroundStyle(Brand.inkPrimary)
                }
                .padding(.horizontal, Space.screenH)
                .padding(.top, Space.lg)

                VStack(alignment: .leading, spacing: Space.sm) {
                    Text("Nothing saved yet")
                        .font(TypeScale.title)
                        .foregroundStyle(Brand.inkHigh)
                    Text("Tap save on a project card from the Discovery tab and it lands here. Spec § 8.3 / S-024.")
                        .font(TypeScale.helper)
                        .foregroundStyle(Brand.inkMuted)
                }
                .padding(Space.lg)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Brand.surface1)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
                .padding(.horizontal, Space.screenH)

                Spacer(minLength: 24)
            }
        }
        .background(Brand.canvas)
    }
}

#Preview { ProjectsView() }

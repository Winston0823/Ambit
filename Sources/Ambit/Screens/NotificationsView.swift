import SwiftUI

/// Notification Center (S-060). Stub.
struct NotificationsView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                VStack(alignment: .leading, spacing: Space.sm) {
                    Text("NOTIFICATIONS")
                        .font(TypeScale.label)
                        .foregroundStyle(Brand.inkLabel)
                        .tracking(1.2)
                    Text("Quiet for now")
                        .font(TypeScale.h1)
                        .foregroundStyle(Brand.inkPrimary)
                }
                .padding(.horizontal, Space.screenH)
                .padding(.top, Space.lg)

                VStack(alignment: .leading, spacing: Space.sm) {
                    Text("No new activity")
                        .font(TypeScale.title)
                        .foregroundStyle(Brand.inkHigh)
                    Text("Interest accepts, expirations, meet-up reminders and project updates will show up here. Spec § 8.7.")
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

#Preview { NotificationsView() }

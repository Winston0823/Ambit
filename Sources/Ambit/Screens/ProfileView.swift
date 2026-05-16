import SwiftUI

/// My Profile (S-090). Stub. Role switch lives here (spec § 5.1 / § 8.1).
struct ProfileView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Space.lg) {
                VStack(alignment: .leading, spacing: Space.sm) {
                    Text("PROFILE")
                        .font(TypeScale.label)
                        .foregroundStyle(Brand.inkLabel)
                        .tracking(1.2)
                    Text("This is you")
                        .font(TypeScale.h1)
                        .foregroundStyle(Brand.inkPrimary)
                }
                .padding(.horizontal, Space.screenH)
                .padding(.top, Space.lg)

                VStack(alignment: .leading, spacing: Space.md) {
                    Circle()
                        .fill(Brand.surface2)
                        .frame(width: 88, height: 88)
                    Text("Vibe blurb")
                        .font(TypeScale.label)
                        .foregroundStyle(Brand.inkLabel)
                    Text("Two to three sentences about who you are. This is what owners read first — speak in your own voice.")
                        .font(TypeScale.body)
                        .foregroundStyle(Brand.inkBody)
                }
                .padding(Space.lg)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Brand.seekerSand)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
                .padding(.horizontal, Space.screenH)

                Spacer(minLength: 24)
            }
        }
        .background(Brand.canvas)
    }
}

#Preview { ProfileView() }

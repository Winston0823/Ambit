import SwiftUI

/// S-003 → S-004 area: collect .edu email. Per Figma node 18:270.
struct EduEmailScreen: View {
    @Binding var email: String
    let onBack: () -> Void
    let onContinue: () -> Void

    private var isValid: Bool {
        email.lowercased().hasSuffix(".edu") && email.contains("@")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            BackChevron(action: onBack)
                .padding(.leading, 16)
                .padding(.top, 8)

            Spacer().frame(height: 100)

            // Illustration placeholder (matches the 188×180 d9d9d9 block in Figma)
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(Color(white: 0.85))
                .frame(width: 188, height: 180)
                .frame(maxWidth: .infinity)

            Spacer().frame(height: 32)

            Text("Please provide your .edu email")
                .font(.custom(AmbitFont.display, size: 32))
                .foregroundStyle(Brand.inkPrimary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 24)

            Spacer().frame(height: 60)

            VStack(alignment: .leading, spacing: 8) {
                Text("Education email")
                    .font(.custom(AmbitFont.body, size: 16))
                    .foregroundStyle(Brand.inkPrimary)

                ZStack(alignment: .trailing) {
                    TextField("example@college.edu", text: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()
                        .font(.custom(AmbitFont.body, size: 16).weight(.semibold))
                        .foregroundStyle(Brand.inkBody)
                        .padding(.horizontal, 14)
                        .padding(.trailing, 80) // room for tan submit chip
                        .frame(height: 46)
                        .background(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(Brand.surface1)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .stroke(Brand.border, lineWidth: 1.5)
                                )
                        )

                    Button(action: onContinue) {
                        Image(systemName: "arrow.right")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Brand.inkOnBrand)
                            .frame(width: 63, height: 36)
                            .background(
                                RoundedRectangle(cornerRadius: 6, style: .continuous)
                                    .fill(Brand.primary)
                            )
                    }
                    .buttonStyle(.plain)
                    .disabled(!isValid)
                    .opacity(isValid ? 1.0 : 0.45)
                    .padding(.trailing, 5)
                }
            }
            .padding(.horizontal, 24)

            Spacer()
        }
    }
}

#Preview {
    EduEmailScreen(email: .constant(""), onBack: {}, onContinue: {})
}

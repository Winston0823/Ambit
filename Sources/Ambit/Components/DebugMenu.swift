import SwiftUI

/// Floating wrench in the top-right of every screen (debug build only).
/// Tap to open a sheet with developer test actions.
struct DebugMenuButton: View {
    @Binding var isPresented: Bool

    var body: some View {
        Button(action: { isPresented = true }) {
            Image(systemName: "wrench.and.screwdriver")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 36, height: 36)
                .background {
                    if #available(iOS 26.0, *) {
                        Circle().fill(.clear).glassEffect(.regular.tint(.black.opacity(0.55)), in: Circle())
                    } else {
                        Circle().fill(.ultraThinMaterial)
                    }
                }
                .overlay(Circle().stroke(Color.white.opacity(0.15), lineWidth: 0.5))
                .shadow(color: .black.opacity(0.25), radius: 10, y: 4)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Developer menu")
    }
}

struct DebugMenuSheet: View {
    let onStartOnboarding: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Button {
                        dismiss()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                            onStartOnboarding()
                        }
                    } label: {
                        Label("Start Onboarding", systemImage: "play.fill")
                    }
                } header: {
                    Text("Flows")
                } footer: {
                    Text("Walks through S-003 → S-005 → S-007 → S-009 → S-013. UI only — no backend wired.")
                }

                Section {
                    LabeledContent("App version", value: "0.1.0 (1)")
                    LabeledContent("Build config", value: "Debug")
                    LabeledContent("iOS deployment", value: "26.0+")
                } header: {
                    Text("Build info")
                }
            }
            .navigationTitle("Developer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

#Preview {
    DebugMenuSheet(onStartOnboarding: {})
}

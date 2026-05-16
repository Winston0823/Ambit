import SwiftUI

@main
struct AmbitApp: App {
    init() {
        FontLoader.registerAll()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}

import SwiftUI
import XTRICronogramasCore

@main
struct XTRICronogramasApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    private let config = AppConfig.fromEnvironment()

    var body: some Scene {
        WindowGroup {
            ContentView(config: config)
                .frame(minWidth: 1100, minHeight: 720)
        }
        .commands {
            AppCommands()
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
    }
}

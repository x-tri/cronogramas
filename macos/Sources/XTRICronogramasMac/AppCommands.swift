import SwiftUI

struct AppCommands: Commands {
    var body: some Commands {
        CommandGroup(after: .appInfo) {
            Button("Abrir produção no navegador") {
                if let url = URL(string: "https://horariodeestudos.com") {
                    NSWorkspace.shared.open(url)
                }
            }
        }
    }
}

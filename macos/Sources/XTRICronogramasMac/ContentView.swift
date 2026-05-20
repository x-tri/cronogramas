import SwiftUI
import XTRICronogramasCore

struct ContentView: View {
    let config: AppConfig

    @State private var selectedPortal: XTRIPortal
    @State private var currentURL: URL
    @State private var reloadToken = 0
    @State private var clearCacheToken = 0

    init(config: AppConfig) {
        self.config = config
        let portal = config.initialPortal
        _selectedPortal = State(initialValue: portal)
        _currentURL = State(initialValue: config.url(for: portal))
    }

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            Divider()
            WebAppView(url: currentURL, reloadToken: reloadToken, clearCacheToken: clearCacheToken)
        }
        .navigationTitle("XTRI Cronogramas")
    }

    private var toolbar: some View {
        HStack(spacing: 12) {
            Image(systemName: "xmark.seal.fill")
                .font(.title2)
                .foregroundStyle(.blue)

            Text("Portal")
                .font(.callout)
                .foregroundStyle(.secondary)

            Picker("Portal", selection: $selectedPortal) {
                ForEach(XTRIPortal.allCases) { portal in
                    Text(portal.title).tag(portal)
                }
            }
            .pickerStyle(.segmented)
            .frame(width: 320)
            .onChange(of: selectedPortal) { newPortal in
                currentURL = config.url(for: newPortal)
                reloadToken += 1
            }

            Text(currentURL.host(percentEncoded: false) ?? currentURL.absoluteString)
                .font(.callout)
                .foregroundStyle(.secondary)
                .lineLimit(1)

            Spacer()

            Button {
                reloadToken += 1
            } label: {
                Label("Recarregar", systemImage: "arrow.clockwise")
            }

            Button {
                clearCacheToken += 1
            } label: {
                Label("Limpar cache", systemImage: "trash")
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.regularMaterial)
    }
}

import SwiftUI
import WebKit

struct WebAppView: NSViewRepresentable {
    let url: URL
    let reloadToken: Int
    let clearCacheToken: Int

    func makeCoordinator() -> Coordinator {
        Coordinator(reloadToken: reloadToken, clearCacheToken: clearCacheToken)
    }

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.customUserAgent = "XTRICronogramasMac/0.2 WKWebView"
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
        context.coordinator.focus(webView)
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        if webView.url?.absoluteString != url.absoluteString {
            webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
            context.coordinator.focus(webView)
        }

        if context.coordinator.lastReloadToken != reloadToken {
            context.coordinator.lastReloadToken = reloadToken
            webView.reloadFromOrigin()
            context.coordinator.focus(webView)
        }

        if context.coordinator.lastClearCacheToken != clearCacheToken {
            context.coordinator.lastClearCacheToken = clearCacheToken
            context.coordinator.clearCacheAndReload(webView, url: url)
        }
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        var lastReloadToken: Int
        var lastClearCacheToken: Int

        init(reloadToken: Int, clearCacheToken: Int) {
            self.lastReloadToken = reloadToken
            self.lastClearCacheToken = clearCacheToken
        }

        func focus(_ webView: WKWebView) {
            DispatchQueue.main.async {
                webView.window?.makeFirstResponder(webView)
            }
        }

        func clearCacheAndReload(_ webView: WKWebView, url: URL) {
            let store = WKWebsiteDataStore.default()
            store.removeData(
                ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(),
                modifiedSince: Date(timeIntervalSince1970: 0)
            ) {
                DispatchQueue.main.async {
                    webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalAndRemoteCacheData))
                    self.focus(webView)
                }
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            focus(webView)
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void
        ) {
            guard let targetURL = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            if targetURL.scheme == "mailto" || targetURL.scheme == "tel" {
                NSWorkspace.shared.open(targetURL)
                decisionHandler(.cancel)
                return
            }

            decisionHandler(.allow)
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
                webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
            }

            return nil
        }
    }
}

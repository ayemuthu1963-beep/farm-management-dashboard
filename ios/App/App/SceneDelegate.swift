import UIKit
import Capacitor
import WebKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = MuthuFarmsBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

final class MuthuFarmsBridgeViewController: CAPBridgeViewController, WKScriptMessageHandler {
    private static let downloadHandlerName = "mfmsDownload"
    private static let maxDownloadBytes = 25 * 1024 * 1024
    private static let trustedDownloadHosts = Set([
        "preview.muthufarms.com",
        "muthufarms.com",
        "www.muthufarms.com",
    ])

    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        configuration.userContentController.add(self, name: Self.downloadHandlerName)
        if let source = Self.downloadBridgeScript() {
            configuration.userContentController.addUserScript(
                WKUserScript(source: source, injectionTime: .atDocumentEnd, forMainFrameOnly: false)
            )
        }
        return super.webView(with: frame, configuration: configuration)
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        webView?.allowsBackForwardNavigationGestures = true
    }

    deinit {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: Self.downloadHandlerName)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard
            message.name == Self.downloadHandlerName,
            let pageHost = message.frameInfo.request.url?.host?.lowercased(),
            Self.trustedDownloadHosts.contains(pageHost),
            let payload = message.body as? [String: Any],
            let base64Data = payload["base64Data"] as? String,
            base64Data.count <= 36 * 1024 * 1024,
            let data = Data(base64Encoded: base64Data, options: .ignoreUnknownCharacters),
            data.count <= Self.maxDownloadBytes
        else {
            showDownloadError("The exported file could not be saved securely.")
            return
        }

        let requestedName = payload["fileName"] as? String ?? "muthu-farms-download"
        let fileName = Self.safeFileName(requestedName)
        let fileURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
            .appendingPathComponent(fileName, isDirectory: false)

        do {
            try FileManager.default.createDirectory(
                at: fileURL.deletingLastPathComponent(),
                withIntermediateDirectories: true,
                attributes: nil
            )
            try data.write(to: fileURL, options: .atomic)
        } catch {
            showDownloadError("The exported file could not be written.")
            return
        }

        let activityController = UIActivityViewController(activityItems: [fileURL], applicationActivities: nil)
        activityController.popoverPresentationController?.sourceView = view
        activityController.popoverPresentationController?.sourceRect = CGRect(
            x: view.bounds.midX,
            y: view.bounds.midY,
            width: 1,
            height: 1
        )
        activityController.completionWithItemsHandler = { _, _, _, _ in
            try? FileManager.default.removeItem(at: fileURL.deletingLastPathComponent())
        }
        present(activityController, animated: true)
    }

    private static func downloadBridgeScript() -> String? {
        let directURL = Bundle.main.url(
            forResource: "mfms-mobile-download-bridge",
            withExtension: "js",
            subdirectory: "public"
        )
        let fallbackURL = Bundle.main.url(forResource: "mfms-mobile-download-bridge", withExtension: "js")
        guard let sourceURL = directURL ?? fallbackURL else { return nil }
        return try? String(contentsOf: sourceURL, encoding: .utf8)
    }

    private static func safeFileName(_ value: String) -> String {
        let invalid = CharacterSet(charactersIn: "\\/:*?\"<>|\r\n").union(.controlCharacters)
        let cleaned = value.unicodeScalars
            .map { invalid.contains($0) ? "_" : String($0) }
            .joined()
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let fallback = cleaned.isEmpty || cleaned == "." || cleaned == ".." ? "muthu-farms-download" : cleaned
        return String(fallback.suffix(120))
    }

    private func showDownloadError(_ message: String) {
        let alert = UIAlertController(title: "Download unavailable", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
}

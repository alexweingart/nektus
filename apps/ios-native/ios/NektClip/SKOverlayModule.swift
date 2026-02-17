import Foundation
import StoreKit
import React

@objc(SKOverlayModule)
class SKOverlayModule: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { return true }

  @objc func showAppStoreOverlay() {
    DispatchQueue.main.async {
      guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene else {
        print("[SKOverlayModule] No window scene found")
        return
      }
      let config = SKOverlay.AppClipConfiguration(position: .bottom)
      let overlay = SKOverlay(configuration: config)
      overlay.present(in: windowScene)
    }
  }

  @objc func dismissOverlay() {
    DispatchQueue.main.async {
      guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene else { return }
      SKOverlay.dismiss(in: windowScene)
    }
  }
}

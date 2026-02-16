import Foundation
import EventKit
import EventKitUI
import React

@objc(EventKitViewer)
class EventKitViewerModule: NSObject, EKEventViewDelegate {

  /// Keep the instance + store alive while the VC is shown
  private static var activeInstance: EventKitViewerModule?
  private var eventStore: EKEventStore?
  private var resolveBlock: RCTPromiseResolveBlock?

  @objc static func requiresMainQueueSetup() -> Bool { return false }

  @objc func presentEvent(_ eventId: String,
                           resolver resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
    let store = EKEventStore()

    // Request access so this store instance can read event data
    store.requestAccess(to: .event) { [weak self] granted, error in
      guard let self = self else { return }

      guard granted else {
        reject("NO_ACCESS", "Calendar access not granted", error)
        return
      }

      guard let event = store.event(withIdentifier: eventId) else {
        reject("EVENT_NOT_FOUND", "Could not find event with ID: \(eventId)", nil)
        return
      }

      DispatchQueue.main.async {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootVC = windowScene.windows.first?.rootViewController else {
          reject("NO_ROOT_VC", "Could not find root view controller", nil)
          return
        }

        // Walk up to the topmost presented VC
        var topVC = rootVC
        while let presented = topVC.presentedViewController {
          topVC = presented
        }

        // Keep self and store alive while the VC is presented
        // Resolve only when the user dismisses the event viewer
        EventKitViewerModule.activeInstance = self
        self.eventStore = store
        self.resolveBlock = resolve

        let eventVC = EKEventViewController()
        eventVC.event = event
        eventVC.allowsEditing = true
        eventVC.delegate = self

        let navController = UINavigationController(rootViewController: eventVC)
        navController.modalPresentationStyle = .pageSheet

        topVC.present(navController, animated: true, completion: nil)
      }
    }
  }

  // MARK: - EKEventViewDelegate
  func eventViewController(_ controller: EKEventViewController, didCompleteWith action: EKEventViewAction) {
    controller.navigationController?.dismiss(animated: true) {
      self.resolveBlock?(nil)
      self.resolveBlock = nil
      self.eventStore = nil
      EventKitViewerModule.activeInstance = nil
    }
  }
}

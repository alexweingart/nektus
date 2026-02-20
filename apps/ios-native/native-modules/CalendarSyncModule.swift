import Foundation
import EventKit
import BackgroundTasks
import React

/// Syncs EventKit busy times to the server for cross-user scheduling.
///
/// Three sync paths:
/// 1. JS calls syncNow() — foreground sync on calendar link, app open, etc.
/// 2. EKEventStoreChanged — auto-syncs when device calendar changes (foreground)
/// 3. BGAppRefreshTask — periodic background sync (~every 30 min for active apps)
///
/// All paths read EventKit in Swift and POST to /api/calendar-sync/device-busy-times.
/// Credentials (Firebase ID token) are stored in UserDefaults by JS before backgrounding.
@objc(CalendarSync)
class CalendarSyncModule: NSObject {

  static let bgTaskId = "com.nektus.app.calendar-sync"
  private static let configKey = "CalendarSyncConfig"

  private let eventStore = EKEventStore()
  private var isListening = false

  @objc static func requiresMainQueueSetup() -> Bool { return false }

  // MARK: - BGTask Registration (called from AppDelegate)

  /// Must be called during application(_:didFinishLaunchingWithOptions:)
  static func registerBackgroundTask() {
    BGTaskScheduler.shared.register(
      forTaskWithIdentifier: bgTaskId,
      using: nil
    ) { task in
      handleBackgroundRefresh(task as! BGAppRefreshTask)
    }
  }

  // MARK: - JS API

  /// Store credentials for background sync.
  /// Called from JS whenever auth state changes or before backgrounding.
  @objc func configure(_ userId: String, idToken: String, apiBaseUrl: String) {
    let config: [String: String] = [
      "userId": userId,
      "idToken": idToken,
      "apiBaseUrl": apiBaseUrl
    ]
    UserDefaults.standard.set(config, forKey: Self.configKey)
  }

  /// Schedule a BGAppRefreshTask for periodic background sync.
  @objc func scheduleBackgroundSync() {
    Self.scheduleNextTask()
  }

  /// Perform an immediate sync: read EventKit → upload to server.
  @objc func syncNow(_ resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.global(qos: .utility).async {
      let busyTimes = Self.readEventKitBusyTimes()
      Self.uploadBusyTimes(busyTimes) { success, error in
        if success {
          resolve(["synced": busyTimes.count])
        } else {
          reject("SYNC_FAILED", error ?? "Upload failed", nil)
        }
      }
    }
  }

  /// Start listening for EKEventStoreChanged — auto-syncs on change.
  @objc func startListening() {
    guard !isListening else { return }
    isListening = true
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(calendarDidChange),
      name: .EKEventStoreChanged,
      object: eventStore
    )
  }

  /// Stop listening for calendar changes.
  @objc func stopListening() {
    guard isListening else { return }
    isListening = false
    NotificationCenter.default.removeObserver(
      self,
      name: .EKEventStoreChanged,
      object: eventStore
    )
  }

  // MARK: - Internal

  @objc private func calendarDidChange() {
    // Debounce: EKEventStoreChanged can fire multiple times rapidly
    NSObject.cancelPreviousPerformRequests(
      withTarget: self,
      selector: #selector(performChangeSync),
      object: nil
    )
    self.perform(#selector(performChangeSync), with: nil, afterDelay: 2.0)
  }

  @objc private func performChangeSync() {
    DispatchQueue.global(qos: .utility).async {
      let busyTimes = Self.readEventKitBusyTimes()
      Self.uploadBusyTimes(busyTimes) { success, _ in
        print("[CalendarSync] Change sync \(success ? "succeeded" : "failed") (\(busyTimes.count) events)")
      }
    }
  }

  // MARK: - Background Task

  private static func scheduleNextTask() {
    let request = BGAppRefreshTaskRequest(identifier: bgTaskId)
    request.earliestBeginDate = Date(timeIntervalSinceNow: 30 * 60) // 30 min minimum
    do {
      try BGTaskScheduler.shared.submit(request)
      print("[CalendarSync] Background task scheduled")
    } catch {
      print("[CalendarSync] Failed to schedule background task: \(error)")
    }
  }

  private static func handleBackgroundRefresh(_ task: BGAppRefreshTask) {
    // Schedule the next refresh before doing work
    scheduleNextTask()

    task.expirationHandler = {
      task.setTaskCompleted(success: false)
    }

    let busyTimes = readEventKitBusyTimes()
    uploadBusyTimes(busyTimes) { success, _ in
      print("[CalendarSync] Background sync \(success ? "succeeded" : "failed") (\(busyTimes.count) events)")
      task.setTaskCompleted(success: success)
    }
  }

  // MARK: - EventKit Reading

  private static func readEventKitBusyTimes() -> [[String: String]] {
    let store = EKEventStore()

    // Check authorization (permission is requested via expo-calendar in JS)
    let status = EKEventStore.authorizationStatus(for: .event)
    let isAuthorized: Bool
    if #available(iOS 17.0, *) {
      isAuthorized = status == .fullAccess
    } else {
      isAuthorized = status == .authorized
    }
    guard isAuthorized else {
      print("[CalendarSync] Calendar access not granted (status: \(status.rawValue))")
      return []
    }

    let now = Date()
    guard let twoWeeksOut = Calendar.current.date(byAdding: .day, value: 14, to: now) else {
      return []
    }

    let predicate = store.predicateForEvents(
      withStart: now,
      end: twoWeeksOut,
      calendars: nil // all calendars
    )

    let events = store.events(matching: predicate)
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

    var busyTimes: [[String: String]] = []
    for event in events {
      if event.isAllDay { continue }
      if event.availability == .free { continue }

      busyTimes.append([
        "start": formatter.string(from: event.startDate),
        "end": formatter.string(from: event.endDate)
      ])
    }

    return busyTimes
  }

  // MARK: - Upload

  private static func uploadBusyTimes(
    _ busyTimes: [[String: String]],
    completion: @escaping (Bool, String?) -> Void
  ) {
    guard let config = UserDefaults.standard.dictionary(forKey: configKey) as? [String: String],
          let idToken = config["idToken"],
          let apiBaseUrl = config["apiBaseUrl"] else {
      completion(false, "No sync config stored")
      return
    }

    let now = Date()
    guard let twoWeeksOut = Calendar.current.date(byAdding: .day, value: 14, to: now) else {
      completion(false, "Date calculation failed")
      return
    }

    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

    let body: [String: Any] = [
      "busyTimes": busyTimes,
      "windowStart": formatter.string(from: now),
      "windowEnd": formatter.string(from: twoWeeksOut),
      "updatedAt": Int(now.timeIntervalSince1970 * 1000)
    ]

    guard let url = URL(string: "\(apiBaseUrl)/api/calendar-sync/device-busy-times"),
          let jsonData = try? JSONSerialization.data(withJSONObject: body) else {
      completion(false, "Invalid URL or JSON serialization failed")
      return
    }

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(idToken)", forHTTPHeaderField: "Authorization")
    request.httpBody = jsonData
    request.timeoutInterval = 15

    URLSession.shared.dataTask(with: request) { _, response, error in
      let httpResponse = response as? HTTPURLResponse
      let success = error == nil && httpResponse?.statusCode == 200
      if !success {
        let errorMsg = error?.localizedDescription ?? "HTTP \(httpResponse?.statusCode ?? 0)"
        print("[CalendarSync] Upload failed: \(errorMsg)")
        completion(false, errorMsg)
      } else {
        completion(true, nil)
      }
    }.resume()
  }
}

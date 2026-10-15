import ActivityKit
import CoreLocation
import Foundation
import React

@objc(RunLiveActivity)
final class RunLiveActivity: NSObject, RCTBridgeModule {
  @objc static func moduleName() -> String! { "RunLiveActivity" }
  static func requiresMainQueueSetup() -> Bool { false }

  private let operationQueue = DispatchQueue(label: "com.athleticcs.live-activity")
  private var pendingOperation: Task<Void, Never>?

  // Activity.request/update/end must stay in order even if Pause or Finish is
  // tapped before the asynchronous start operation has finished.
  private func enqueue(_ operation: @escaping () async -> Void) {
    operationQueue.async {
      let previous = self.pendingOperation
      self.pendingOperation = Task {
        await previous?.value
        await operation()
      }
    }
  }

  private func distance(_ points: [[String: Any]]) -> Double {
    guard points.count > 1 else { return 0 }
    return zip(points, points.dropFirst()).reduce(0) { total, pair in
      guard let lat1 = pair.0["latitude"] as? CLLocationDegrees,
            let lon1 = pair.0["longitude"] as? CLLocationDegrees,
            let lat2 = pair.1["latitude"] as? CLLocationDegrees,
            let lon2 = pair.1["longitude"] as? CLLocationDegrees else { return total }
      return total + CLLocation(latitude: lat1, longitude: lon1).distance(from: CLLocation(latitude: lat2, longitude: lon2))
    }
  }

  @objc(start:distanceUnit:)
  func start(_ startedAt: NSNumber, distanceUnit: String) {
    startSession(startedAt, distanceUnit: distanceUnit, mode: "outdoor")
  }

  @objc(startSession:distanceUnit:mode:)
  func startSession(_ startedAt: NSNumber, distanceUnit: String, mode: String) {
    guard #available(iOS 16.2, *), ActivityAuthorizationInfo().areActivitiesEnabled else { return }
    enqueue {
      for activity in Activity<RunActivityAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
      let attributes = RunActivityAttributes(startedAt: Date(timeIntervalSince1970: startedAt.doubleValue / 1000), distanceUnit: distanceUnit, mode: mode)
      let elapsed = max(0, Int(Date().timeIntervalSince1970 - startedAt.doubleValue / 1000))
      let state = RunActivityAttributes.ContentState(elapsed: elapsed, distanceMeters: 0, paused: false, updatedAt: Date())
      do {
        _ = try Activity.request(attributes: attributes, content: ActivityContent(state: state, staleDate: nil))
      } catch {
        NSLog("[RunLiveActivity] Could not start: %@", error.localizedDescription)
      }
    }
  }

  @objc(update:points:paused:)
  func update(_ elapsed: NSNumber, points: [[String: Any]], paused: Bool) {
    guard #available(iOS 16.2, *) else { return }
    let state = RunActivityAttributes.ContentState(elapsed: elapsed.intValue, distanceMeters: distance(points), paused: paused, updatedAt: Date())
    enqueue {
      for activity in Activity<RunActivityAttributes>.activities {
        await activity.update(ActivityContent(state: state, staleDate: Date().addingTimeInterval(120)))
      }
    }
  }

  @objc(restore:distanceUnit:elapsed:points:paused:)
  func restore(_ startedAt: NSNumber, distanceUnit: String, elapsed: NSNumber, points: [[String: Any]], paused: Bool) {
    restoreSession(startedAt, distanceUnit: distanceUnit, elapsed: elapsed, points: points, paused: paused, mode: "outdoor")
  }

  @objc(restoreSession:distanceUnit:elapsed:points:paused:mode:)
  func restoreSession(_ startedAt: NSNumber, distanceUnit: String, elapsed: NSNumber, points: [[String: Any]], paused: Bool, mode: String) {
    guard #available(iOS 16.2, *) else { return }
    // Restore the current totals in the initial request. Starting at zero and
    // immediately updating can race the asynchronous Activity.request call.
    let state = RunActivityAttributes.ContentState(elapsed: elapsed.intValue, distanceMeters: distance(points), paused: paused, updatedAt: Date())
    enqueue {
      let activities = Activity<RunActivityAttributes>.activities
      let matching = activities.first {
        ($0.attributes.mode ?? "outdoor") == mode && $0.attributes.distanceUnit == distanceUnit
          && abs($0.attributes.startedAt.timeIntervalSince1970 - startedAt.doubleValue / 1000) < 1
      }
      for activity in activities where activity.id != matching?.id {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
      if let activity = matching {
        await activity.update(ActivityContent(state: state, staleDate: Date().addingTimeInterval(120)))
      } else {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let attributes = RunActivityAttributes(startedAt: Date(timeIntervalSince1970: startedAt.doubleValue / 1000), distanceUnit: distanceUnit, mode: mode)
        do { _ = try Activity.request(attributes: attributes, content: ActivityContent(state: state, staleDate: nil)) }
        catch { NSLog("[RunLiveActivity] Could not restore: %@", error.localizedDescription) }
      }
    }
  }

  @objc(end)
  func end() {
    guard #available(iOS 16.2, *) else { return }
    enqueue {
      for activity in Activity<RunActivityAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }
  }
}

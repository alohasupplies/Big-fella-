import ActivityKit
import CoreLocation
import Foundation
import React

@objc(RunLiveActivity)
final class RunLiveActivity: NSObject, RCTBridgeModule {
  @objc static func moduleName() -> String! { "RunLiveActivity" }
  static func requiresMainQueueSetup() -> Bool { false }

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
    guard #available(iOS 16.2, *), ActivityAuthorizationInfo().areActivitiesEnabled else { return }
    Task {
      for activity in Activity<RunActivityAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
      let attributes = RunActivityAttributes(startedAt: Date(timeIntervalSince1970: startedAt.doubleValue / 1000), distanceUnit: distanceUnit)
      let state = RunActivityAttributes.ContentState(elapsed: 0, distanceMeters: 0, paused: false)
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
    let state = RunActivityAttributes.ContentState(elapsed: elapsed.intValue, distanceMeters: distance(points), paused: paused)
    Task {
      for activity in Activity<RunActivityAttributes>.activities {
        await activity.update(ActivityContent(state: state, staleDate: Date().addingTimeInterval(120)))
      }
    }
  }

  @objc(restore:distanceUnit:elapsed:points:paused:)
  func restore(_ startedAt: NSNumber, distanceUnit: String, elapsed: NSNumber, points: [[String: Any]], paused: Bool) {
    guard #available(iOS 16.2, *) else { return }
    if Activity<RunActivityAttributes>.activities.isEmpty { start(startedAt, distanceUnit: distanceUnit) }
    update(elapsed, points: points, paused: paused)
  }

  @objc(end)
  func end() {
    guard #available(iOS 16.2, *) else { return }
    Task {
      for activity in Activity<RunActivityAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }
  }
}

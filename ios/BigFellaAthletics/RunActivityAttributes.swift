import ActivityKit
import Foundation

@available(iOS 16.1, *)
struct RunActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var elapsed: Int
    var distanceMeters: Double
    var paused: Bool
  }

  var startedAt: Date
  var distanceUnit: String
}

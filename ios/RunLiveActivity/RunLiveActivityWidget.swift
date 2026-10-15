import ActivityKit
import SwiftUI
import WidgetKit

@main
struct RunLiveActivityEntry {
  @MainActor static func main() {
    if #available(iOS 18.0, *) { RunLiveActivityWatchBundle.main() }
    else { RunLiveActivityBundle.main() }
  }
}

struct RunLiveActivityBundle: WidgetBundle {
  var body: some Widget { RunLiveActivityWidget() }
}

@available(iOS 18.0, *)
struct RunLiveActivityWatchBundle: WidgetBundle {
  var body: some Widget { RunLiveActivityWatchWidget() }
}

@available(iOS 18.0, *)
struct RunLiveActivityWatchWidget: Widget {
  var body: some WidgetConfiguration {
    RunLiveActivityWidget().configuration.supplementalActivityFamilies([.small, .medium])
  }
}

struct RunLiveActivityWidget: Widget {
  var body: some WidgetConfiguration { configuration }

  var configuration: some WidgetConfiguration {
    ActivityConfiguration(for: RunActivityAttributes.self) { context in
      Group {
        if #available(iOS 18.0, *) { AdaptiveRunActivityView(context: context) }
        else { RunLockScreenView(state: context.state, distanceUnit: context.attributes.distanceUnit, mode: context.attributes.mode) }
      }
      .activityBackgroundTint(Color.black)
      .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      let indoor = context.attributes.mode == "indoor"
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Label(indoor ? "INDOOR RUN" : "OUTDOOR RUN", systemImage: "figure.run")
            .font(.system(size: 10, weight: .heavy)).foregroundStyle(RunLiveStyle.red)
        }
        DynamicIslandExpandedRegion(.trailing) { RunLiveStatus(paused: context.state.paused) }
        DynamicIslandExpandedRegion(.bottom) {
          HStack(alignment: .center, spacing: 14) {
            if indoor {
              VStack(alignment: .leading, spacing: 3) {
                RunElapsedText(state: context.state).font(.system(size: 34, weight: .heavy, design: .rounded))
                Text("ELAPSED TIME").font(.system(size: 9, weight: .bold)).foregroundStyle(.secondary)
              }
              Spacer(minLength: 0)
              Text("Distance added\nat finish").font(.caption2.weight(.semibold)).foregroundStyle(.secondary).lineLimit(2)
            } else {
              VStack(alignment: .leading, spacing: 2) {
                Text(RunLiveStyle.distance(context.state, unit: context.attributes.distanceUnit))
                  .font(.system(size: 34, weight: .heavy, design: .rounded)).monospacedDigit()
                Text(context.attributes.distanceUnit == "miles" ? "MILES" : "KILOMETERS")
                  .font(.system(size: 9, weight: .bold)).foregroundStyle(.secondary)
              }
              Spacer(minLength: 0)
              VStack(alignment: .trailing, spacing: 5) {
                RunElapsedText(state: context.state).font(.title3.bold())
                Text(RunLiveStyle.pace(context.state, unit: context.attributes.distanceUnit)).font(.caption.bold()).foregroundStyle(.secondary)
              }
            }
          }.lineLimit(1).minimumScaleFactor(0.65).padding(.top, 6)
        }
      } compactLeading: {
        Image(systemName: context.state.paused ? "pause.fill" : "figure.run").foregroundStyle(RunLiveStyle.red)
      } compactTrailing: {
        if indoor { RunElapsedText(state: context.state).font(.caption.bold()).frame(width: 58).minimumScaleFactor(0.6) }
        else {
          Text(RunLiveStyle.distance(context.state, unit: context.attributes.distanceUnit) + (context.attributes.distanceUnit == "miles" ? " mi" : " km"))
            .font(.caption2.bold()).monospacedDigit().minimumScaleFactor(0.65)
        }
      } minimal: {
        if indoor { Image(systemName: context.state.paused ? "pause.fill" : "figure.run").foregroundStyle(RunLiveStyle.red) }
        else {
          Text(String(format: "%.1f", context.state.distanceMeters / (context.attributes.distanceUnit == "miles" ? 1609.344 : 1000)))
            .font(.caption2.bold()).monospacedDigit().minimumScaleFactor(0.6)
        }
      }
      .keylineTint(RunLiveStyle.red)
    }
  }
}

@available(iOS 18.0, *)
private struct AdaptiveRunActivityView: View {
  @Environment(\.activityFamily) private var family
  let context: ActivityViewContext<RunActivityAttributes>
  var body: some View {
    if family == .small { RunWatchMetricsView(state: context.state, distanceUnit: context.attributes.distanceUnit, mode: context.attributes.mode) }
    else { RunLockScreenView(state: context.state, distanceUnit: context.attributes.distanceUnit, mode: context.attributes.mode) }
  }
}

struct RunLockScreenView: View {
  let state: RunActivityAttributes.ContentState
  let distanceUnit: String
  var mode: String? = nil
  private var indoor: Bool { mode == "indoor" }

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(spacing: 9) {
        Image(systemName: "figure.run").font(.system(size: 17, weight: .bold))
          .foregroundStyle(.white).frame(width: 32, height: 32)
          .background(RunLiveStyle.red.gradient, in: RoundedRectangle(cornerRadius: 10))
        VStack(alignment: .leading, spacing: 2) {
          Text("ATHLETICCS").font(.system(size: 10, weight: .black)).tracking(1.8)
          Text(indoor ? "TREADMILL RUN" : "OUTDOOR RUN").font(.system(size: 9, weight: .semibold)).tracking(0.8).foregroundStyle(.secondary)
        }
        Spacer(minLength: 8)
        RunLiveStatus(paused: state.paused)
      }
      HStack(alignment: .center, spacing: 18) {
        if indoor {
          VStack(alignment: .leading, spacing: 2) {
            RunElapsedText(state: state).font(.system(size: 40, weight: .heavy, design: .rounded))
            Text("ELAPSED TIME").font(RunLiveStyle.caption).tracking(1.1).foregroundStyle(.secondary)
          }.frame(maxWidth: .infinity, alignment: .leading)
          VStack(alignment: .trailing, spacing: 5) {
            Image(systemName: "gauge.with.dots.needle.50percent").font(.title2).foregroundStyle(RunLiveStyle.red)
            VStack(alignment: .trailing, spacing: 2) {
              Text("DISTANCE")
              Text("AT FINISH")
            }.font(.system(size: 8, weight: .heavy)).tracking(0.7).foregroundStyle(.secondary)
          }
        } else {
          VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 5) {
              Text(RunLiveStyle.distance(state, unit: distanceUnit)).font(.system(size: 44, weight: .heavy, design: .rounded)).monospacedDigit()
              Text(distanceUnit == "miles" ? "MI" : "KM").font(.system(size: 12, weight: .heavy)).foregroundStyle(.secondary)
            }
            Text("DISTANCE").font(RunLiveStyle.caption).tracking(1.1).foregroundStyle(.secondary)
          }.frame(maxWidth: .infinity, alignment: .leading)
          Rectangle().fill(.white.opacity(0.12)).frame(width: 1, height: 45)
          VStack(alignment: .trailing, spacing: 5) {
            RunElapsedText(state: state).font(.system(size: 23, weight: .heavy, design: .rounded))
            Text(RunLiveStyle.pace(state, unit: distanceUnit)).font(.system(size: 12, weight: .bold)).foregroundStyle(.secondary)
          }
        }
      }.lineLimit(1).minimumScaleFactor(0.6)
      HStack(spacing: 5) {
        Image(systemName: indoor ? "pencil.line" : state.paused ? "pause.fill" : "location.fill")
        Text(indoor ? "Enter treadmill distance when you finish" : state.paused ? "Timer and route paused" : "Recording your route")
      }.font(.system(size: 10, weight: .medium)).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.75)
    }
    .padding(14)
    .background(LinearGradient(colors: [Color(red: 0.14, green: 0.025, blue: 0.025), Color(white: 0.055), .black], startPoint: .topLeading, endPoint: .bottomTrailing))
    .foregroundStyle(.white)
  }
}

struct RunWatchMetricsView: View {
  let state: RunActivityAttributes.ContentState
  let distanceUnit: String
  var mode: String? = nil
  private var indoor: Bool { mode == "indoor" }

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack(spacing: 5) {
        Image(systemName: state.paused ? "pause.fill" : "figure.run").foregroundStyle(RunLiveStyle.red)
        Text(state.paused ? "PAUSED" : indoor ? "TREADMILL" : "ATHLETICCS").font(.system(size: 10, weight: .heavy)).tracking(0.5)
        Spacer(minLength: 0)
      }
      if indoor {
        RunElapsedText(state: state).font(.system(size: 30, weight: .heavy, design: .rounded)).lineLimit(1).minimumScaleFactor(0.65)
        Text("Distance added at finish").font(.system(size: 10, weight: .medium)).foregroundStyle(.secondary)
      } else {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
          Text(RunLiveStyle.distance(state, unit: distanceUnit)).font(.system(size: 32, weight: .heavy, design: .rounded)).monospacedDigit()
          Text(distanceUnit == "miles" ? "MI" : "KM").font(.caption2.bold()).foregroundStyle(.secondary)
        }.lineLimit(1).minimumScaleFactor(0.65)
        HStack(alignment: .firstTextBaseline) {
          RunElapsedText(state: state).frame(maxWidth: .infinity, alignment: .leading)
          Text(RunLiveStyle.pace(state, unit: distanceUnit)).foregroundStyle(.secondary)
        }.font(.system(size: 12, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.7)
      }
    }.padding(.horizontal, 8).padding(.vertical, 4).foregroundStyle(.white)
  }
}

struct RunElapsedText: View {
  let state: RunActivityAttributes.ContentState
  var body: some View {
    Group {
      if state.paused { Text(RunLiveStyle.duration(state.elapsed)) }
      else {
        let origin = (state.updatedAt ?? Date()).addingTimeInterval(-Double(state.elapsed))
        Text(timerInterval: origin...origin.addingTimeInterval(max(86400, Double(state.elapsed) + 3600)), countsDown: false)
      }
    }.monospacedDigit().lineLimit(1).minimumScaleFactor(0.65)
  }
}

struct RunLiveStatus: View {
  let paused: Bool
  var body: some View {
    HStack(spacing: 4) {
      Circle().fill(paused ? Color.orange : RunLiveStyle.red).frame(width: 5, height: 5)
      Text(paused ? "PAUSED" : "LIVE").font(.system(size: 9, weight: .heavy)).tracking(0.7)
    }.foregroundStyle(paused ? Color.orange : .white)
      .padding(.horizontal, 8).padding(.vertical, 5)
      .background(.white.opacity(0.065), in: Capsule())
  }
}

enum RunLiveStyle {
  static let red = Color(red: 0.85, green: 0.025, blue: 0.035)
  static let caption = Font.system(size: 8, weight: .heavy)
  static func distance(_ state: RunActivityAttributes.ContentState, unit: String) -> String {
    String(format: "%.2f", state.distanceMeters / (unit == "miles" ? 1609.344 : 1000))
  }
  static func pace(_ state: RunActivityAttributes.ContentState, unit: String) -> String {
    let units = state.distanceMeters / (unit == "miles" ? 1609.344 : 1000)
    guard units > 0 else { return "--:--" }
    return duration(Int(Double(state.elapsed) / units)) + (unit == "miles" ? " /mi" : " /km")
  }
  static func duration(_ seconds: Int) -> String {
    let hours = seconds / 3600, minutes = (seconds % 3600) / 60, remaining = seconds % 60
    return hours > 0 ? String(format: "%d:%02d:%02d", hours, minutes, remaining) : String(format: "%02d:%02d", minutes, remaining)
  }
}

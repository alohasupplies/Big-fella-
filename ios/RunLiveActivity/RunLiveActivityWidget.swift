import ActivityKit
import SwiftUI
import WidgetKit

@main
struct RunLiveActivityBundle: WidgetBundle {
  var body: some Widget { RunLiveActivityWidget() }
}

struct RunLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: RunActivityAttributes.self) { context in
      lockScreen(context)
        .activityBackgroundTint(Color.black)
        .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) { metric(context, title: "DISTANCE", value: distance(context)) }
        DynamicIslandExpandedRegion(.trailing) { metric(context, title: "PACE", value: pace(context)) }
        DynamicIslandExpandedRegion(.bottom) {
          HStack {
            Image(systemName: context.state.paused ? "pause.fill" : "figure.run")
              .foregroundStyle(Color.red)
            elapsed(context).font(.title2.bold()).monospacedDigit()
            Spacer()
            Text(context.state.paused ? "PAUSED" : "RUNNING").font(.caption.bold()).foregroundStyle(.secondary)
          }.padding(.horizontal, 4)
        }
      } compactLeading: {
        Image(systemName: context.state.paused ? "pause.fill" : "figure.run").foregroundStyle(Color.red)
      } compactTrailing: {
        elapsed(context).monospacedDigit().frame(maxWidth: 48)
      } minimal: {
        Image(systemName: "figure.run").foregroundStyle(Color.red)
      }
      .keylineTint(Color.red)
    }
  }

  private func lockScreen(_ context: ActivityViewContext<RunActivityAttributes>) -> some View {
    VStack(spacing: 14) {
      HStack {
        Image(systemName: "figure.run").foregroundStyle(Color.red)
        Text("ATHLETICCS RUN").font(.caption.bold()).tracking(1.2)
        Spacer()
        Text(context.state.paused ? "PAUSED" : "LIVE").font(.caption.bold()).foregroundStyle(context.state.paused ? .orange : .red)
      }
      HStack {
        metric(context, title: "DISTANCE", value: distance(context))
        Spacer()
        VStack(alignment: .center, spacing: 3) { Text("TIME").font(.caption2.bold()).foregroundStyle(.secondary); elapsed(context).font(.title2.bold()).monospacedDigit() }
        Spacer()
        metric(context, title: "AVG PACE", value: pace(context))
      }
    }.padding()
  }

  private func metric(_ context: ActivityViewContext<RunActivityAttributes>, title: String, value: String) -> some View {
    VStack(alignment: .leading, spacing: 3) { Text(title).font(.caption2.bold()).foregroundStyle(.secondary); Text(value).font(.title3.bold()).monospacedDigit() }
  }

  private func elapsed(_ context: ActivityViewContext<RunActivityAttributes>) -> Text {
    if context.state.paused { return Text(duration(context.state.elapsed)) }
    return Text(timerInterval: Date().addingTimeInterval(-Double(context.state.elapsed))...Date.distantFuture, countsDown: false)
  }

  private func distance(_ context: ActivityViewContext<RunActivityAttributes>) -> String {
    let isMiles = context.attributes.distanceUnit == "miles"
    return String(format: "%.2f %@", context.state.distanceMeters / (isMiles ? 1609.344 : 1000), isMiles ? "mi" : "km")
  }

  private func pace(_ context: ActivityViewContext<RunActivityAttributes>) -> String {
    let isMiles = context.attributes.distanceUnit == "miles"
    let units = context.state.distanceMeters / (isMiles ? 1609.344 : 1000)
    guard units > 0 else { return "--:--" }
    return duration(Int(Double(context.state.elapsed) / units)) + (isMiles ? "/mi" : "/km")
  }

  private func duration(_ seconds: Int) -> String {
    let hours = seconds / 3600, minutes = (seconds % 3600) / 60, remaining = seconds % 60
    return hours > 0 ? String(format: "%d:%02d:%02d", hours, minutes, remaining) : String(format: "%02d:%02d", minutes, remaining)
  }
}

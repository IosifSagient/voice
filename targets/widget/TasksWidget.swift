import SwiftUI
import WidgetKit

struct TasksEntry: TimelineEntry {
  let date: Date
  let snapshot: WidgetSnapshot
}

struct TasksProvider: TimelineProvider {
  func placeholder(in context: Context) -> TasksEntry {
    TasksEntry(date: Date(), snapshot: .empty)
  }

  func getSnapshot(in context: Context, completion: @escaping (TasksEntry) -> Void) {
    completion(TasksEntry(date: Date(), snapshot: SnapshotStore.load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TasksEntry>) -> Void) {
    let now = Date()
    let snapshot = SnapshotStore.load()
    let entries = Self.entryDates(for: snapshot, now: now, calendar: .current)
      .map { TasksEntry(date: $0, snapshot: snapshot) }
    completion(Timeline(entries: entries, policy: .atEnd))
  }

  // Now, each local midnight in the next 48h, and each listed task's due time
  // today or tomorrow. The labels are computed from the entry's date.
  static func entryDates(for snapshot: WidgetSnapshot, now: Date, calendar: Calendar) -> [Date] {
    let today = calendar.startOfDay(for: now)
    let horizon = now.addingTimeInterval(48 * 60 * 60)
    var dates: Set<Date> = [now]

    for offset in 1...2 {
      if let midnight = calendar.date(byAdding: .day, value: offset, to: today),
        midnight <= horizon
      {
        dates.insert(midnight)
      }
    }

    for task in snapshot.tasks {
      guard let day = DueDates.day(from: task.dueDate, calendar: calendar),
        let daysAway = calendar.dateComponents([.day], from: today, to: day).day,
        daysAway == 0 || daysAway == 1,
        let moment = DueDates.moment(day: day, time: task.dueTime, calendar: calendar),
        moment > now
      else {
        continue
      }
      dates.insert(moment)
    }

    return dates.sorted()
  }
}

struct CircularView: View {
  let snapshot: WidgetSnapshot

  private var countText: String {
    snapshot.openCount >= 100 ? "99+" : "\(snapshot.openCount)"
  }

  var body: some View {
    ZStack {
      AccessoryWidgetBackground()
      VStack(spacing: 0) {
        Image(systemName: "checklist")
          .font(.caption2)
          .widgetAccentable()
        Text(countText)
          .font(.title2.bold())
          .minimumScaleFactor(0.6)
          .lineLimit(1)
      }
      .privacySensitive()
    }
  }
}

struct RectangularView: View {
  let entry: TasksEntry

  private static let visibleTasks = 2

  private var countNoun: String {
    entry.snapshot.openCount == 1 ? WidgetStrings.countSingular : WidgetStrings.countPlural
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      if entry.snapshot.openCount == 0 {
        Label(WidgetStrings.empty, systemImage: "checklist")
          .font(.caption)
          .lineLimit(2)
      } else {
        header
        ForEach(entry.snapshot.tasks.prefix(Self.visibleTasks), id: \.id) { task in
          taskRow(task)
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .privacySensitive()
  }

  private var header: some View {
    HStack(alignment: .firstTextBaseline, spacing: 4) {
      Image(systemName: "checklist")
        .font(.caption2)
        .widgetAccentable()
      Text("\(entry.snapshot.openCount)")
        .font(.headline.bold())
        .widgetAccentable()
      Text(countNoun)
        .font(.caption2)
        .foregroundStyle(.secondary)
    }
    .lineLimit(1)
  }

  // The text outranks the Spacer: at equal priority they split the free width,
  // which truncates the text early and strands the label mid-widget.
  private func taskRow(_ task: WidgetTask) -> some View {
    HStack(alignment: .firstTextBaseline, spacing: 4) {
      Text(DueDates.sentenceCased(task.text))
        .font(.caption)
        .lineLimit(1)
        .truncationMode(.tail)
        .layoutPriority(1)
      Spacer(minLength: 0)
      if let label = DueDates.label(for: task, now: entry.date, calendar: .current) {
        dueLabel(label)
      }
    }
  }

  @ViewBuilder private func dueLabel(_ label: DueLabel) -> some View {
    let text = Text(label.text).font(.caption2)
    Group {
      if label.isOverdue {
        text.bold()
      } else {
        text.foregroundStyle(.secondary)
      }
    }
    .lineLimit(1)
    .fixedSize()
  }
}

struct TasksWidgetEntryView: View {
  @Environment(\.widgetFamily) private var family
  let entry: TasksEntry

  private var recordURL: URL? {
    WidgetConfig.urlScheme.flatMap { URL(string: "\($0)://record") }
  }

  var body: some View {
    content
      .widgetURL(recordURL)
      .widgetContainerBackground()
  }

  @ViewBuilder private var content: some View {
    switch family {
    case .accessoryCircular:
      CircularView(snapshot: entry.snapshot)
    case .accessoryRectangular:
      RectangularView(entry: entry)
    default:
      EmptyView()
    }
  }
}

extension View {
  // iOS 17+ refuses to render a widget without a declared container background.
  @ViewBuilder fileprivate func widgetContainerBackground() -> some View {
    if #available(iOS 17.0, *) {
      containerBackground(for: .widget) { Color.clear }
    } else {
      self
    }
  }
}

@main
struct TasksWidget: Widget {
  static let kind = "TasksWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: Self.kind, provider: TasksProvider()) { entry in
      TasksWidgetEntryView(entry: entry)
    }
    .configurationDisplayName(WidgetStrings.widgetName)
    .description(WidgetStrings.widgetDescription)
    .supportedFamilies([.accessoryCircular, .accessoryRectangular])
  }
}

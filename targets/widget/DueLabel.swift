import Foundation

enum DueDates {
  static let locale = Locale(identifier: "el_GR")

  // A "YYYY-MM-DD" due date as the start of that day on the device's calendar.
  static func day(from string: String?, calendar: Calendar) -> Date? {
    guard let parts = string?.split(separator: "-").compactMap({ Int($0) }),
      parts.count == 3
    else {
      return nil
    }
    return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
  }

  // The moment a due date + "HH:MM" falls on, for timeline entries.
  static func moment(day: Date, time: String?, calendar: Calendar) -> Date? {
    guard let parts = time?.split(separator: ":").compactMap({ Int($0) }),
      parts.count == 2
    else {
      return nil
    }
    return calendar.date(bySettingHour: parts[0], minute: parts[1], second: 0, of: day)
  }

  static func label(for task: WidgetTask, now: Date, calendar: Calendar) -> String? {
    guard let due = day(from: task.dueDate, calendar: calendar),
      let daysAway = calendar.dateComponents(
        [.day], from: calendar.startOfDay(for: now), to: due
      ).day
    else {
      return nil
    }

    if daysAway < 0 { return WidgetStrings.overdue }
    if daysAway == 0 {
      if let time = task.dueTime { return "\(WidgetStrings.today) \(time)" }
      return WidgetStrings.today
    }
    if daysAway == 1 { return WidgetStrings.tomorrow }

    let formatter = DateFormatter()
    formatter.calendar = calendar
    formatter.locale = locale
    formatter.dateFormat = "d MMM"
    return formatter.string(from: due)
  }
}

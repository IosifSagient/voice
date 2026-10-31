import Foundation

struct DueLabel {
  let text: String
  let isOverdue: Bool
}

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

  // Depends only on the calendar day, so the timeline's midnight entries keep
  // every label correct, including the 7-day → weekday change.
  static func label(for task: WidgetTask, now: Date, calendar: Calendar) -> DueLabel? {
    guard let due = day(from: task.dueDate, calendar: calendar),
      let daysAway = calendar.dateComponents(
        [.day], from: calendar.startOfDay(for: now), to: due
      ).day
    else {
      return nil
    }

    if daysAway < 0 { return DueLabel(text: WidgetStrings.overdue, isOverdue: true) }

    let text: String
    switch daysAway {
    case 0:
      text = task.dueTime ?? WidgetStrings.today
    case 1:
      text = WidgetStrings.tomorrow
    case 2...6:
      text = formatted(due, as: "EEE", calendar: calendar)
    default:
      text = formatted(due, as: "d MMM", calendar: calendar)
    }
    return DueLabel(text: text, isOverdue: false)
  }

  private static func formatted(_ date: Date, as format: String, calendar: Calendar) -> String {
    let formatter = DateFormatter()
    formatter.calendar = calendar
    formatter.timeZone = calendar.timeZone
    formatter.locale = locale
    formatter.dateFormat = format
    return formatter.string(from: date)
  }

  // Display only. Not uppercased(with:): the el_GR rules for that drop the tonos
  // ("έλεγχος" → "Ελεγχος"), while capitalized(with:) gives "Έλεγχος".
  static func sentenceCased(_ text: String) -> String {
    text.prefix(1).capitalized(with: locale) + text.dropFirst()
  }
}

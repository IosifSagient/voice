import Foundation

// Every user-visible string in the widget. Greek, matching the app; these
// can't be shared with the JS strings.
enum WidgetStrings {
  static let widgetName = "Ask Lisa"
  static let widgetDescription = "Οι επόμενες εκκρεμότητές σου."

  static let empty = "Δεν υπάρχουν εκκρεμότητες"

  static let overdue = "Εκπρ."
  static let today = "Σήμερα"
  static let tomorrow = "Αύριο"
}

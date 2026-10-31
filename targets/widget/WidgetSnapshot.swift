import Foundation

// Must match src/types/widget.ts's WidgetSnapshot v1 exactly.
struct WidgetTask: Decodable {
  let id: String
  let text: String
  let shortTitle: String?  // preferred display text; missing or null falls back to `text`
  let dueDate: String?  // "YYYY-MM-DD"
  let dueTime: String?  // "HH:MM", local
  let allDay: Bool
}

struct WidgetSnapshot: Decodable {
  let version: Int
  let generatedAt: Double  // epoch ms
  let openCount: Int
  let tasks: [WidgetTask]

  static let supportedVersion = 1
  static let empty = WidgetSnapshot(
    version: supportedVersion, generatedAt: 0, openCount: 0, tasks: [])
}

// Per-variant values, injected into Info.plist by expo-target.config.js.
enum WidgetConfig {
  static let snapshotKey = "widgetSnapshot"

  static var appGroup: String? { infoString("AskLisaAppGroup") }
  static var urlScheme: String? { infoString("AskLisaURLScheme") }

  private static func infoString(_ key: String) -> String? {
    Bundle.main.object(forInfoDictionaryKey: key) as? String
  }
}

enum SnapshotStore {
  // Missing, unreadable or wrong-version data all read as empty.
  static func load() -> WidgetSnapshot {
    guard let group = WidgetConfig.appGroup,
      let defaults = UserDefaults(suiteName: group),
      let data = rawData(from: defaults),
      let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data),
      snapshot.version == WidgetSnapshot.supportedVersion
    else {
      return .empty
    }
    return snapshot
  }

  // ExtensionStorage stores a string as a string and an object as JSON Data.
  private static func rawData(from defaults: UserDefaults) -> Data? {
    if let string = defaults.string(forKey: WidgetConfig.snapshotKey) {
      return string.data(using: .utf8)
    }
    return defaults.data(forKey: WidgetConfig.snapshotKey)
  }
}

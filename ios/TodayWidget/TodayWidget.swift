import SwiftUI
import WidgetKit

private let appGroupIdentifier = "group.com.ghilger16.WeeklyEats"
private let payloadKey = "todayWidgetPayload"

struct TodayMealEntry: TimelineEntry {
  let date: Date
  let title: String
  let icon: String
  let dateLabel: String
  let sides: [String]
  let recipeURL: URL?
}

struct TodayMealProvider: TimelineProvider {
  func placeholder(in context: Context) -> TodayMealEntry {
    TodayMealEntry(
      date: Date(),
      title: "Tonight's Dinner",
      icon: "🍽️",
      dateLabel: "Today",
      sides: ["Plan your meal"],
      recipeURL: URL(string: "weeklyeats://week")
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (TodayMealEntry) -> Void) {
    completion(loadEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TodayMealEntry>) -> Void) {
    let entry = loadEntry()
    let nextRefresh = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date()
    completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
  }

  private func loadEntry() -> TodayMealEntry {
    guard
      let defaults = UserDefaults(suiteName: appGroupIdentifier),
      let payload = defaults.dictionary(forKey: payloadKey)
    else {
      return emptyEntry()
    }

    let title = (payload["title"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
    let icon = (payload["icon"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
    let dateLabel = (payload["dateLabel"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
    let sides = payload["sides"] as? [String] ?? []
    let recipeURLString = (payload["recipeUrl"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)

    guard let title, !title.isEmpty else {
      return emptyEntry()
    }

    return TodayMealEntry(
      date: Date(),
      title: title,
      icon: icon?.isEmpty == false ? icon! : "🍽️",
      dateLabel: dateLabel?.isEmpty == false ? dateLabel! : "Today",
      sides: sides.filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty },
      recipeURL: recipeURLString.flatMap(URL.init(string:)) ?? URL(string: "weeklyeats://week")
    )
  }

  private func emptyEntry() -> TodayMealEntry {
    TodayMealEntry(
      date: Date(),
      title: "No meal planned",
      icon: "🍽️",
      dateLabel: "Today",
      sides: ["Tap to plan tonight"],
      recipeURL: URL(string: "weeklyeats://week")
    )
  }
}

struct TodayMealWidgetView: View {
  let entry: TodayMealEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .center, spacing: 8) {
        Text(entry.icon)
          .font(.system(size: 30))
          .frame(width: 42, height: 42)
          .background(Color.white.opacity(0.72))
          .clipShape(Circle())

        Spacer(minLength: 4)

        Text(entry.dateLabel.uppercased())
          .font(.system(size: 11, weight: .bold))
          .foregroundStyle(Color(red: 0.44, green: 0.47, blue: 0.54))
      }

      Spacer(minLength: 2)

      Text(entry.title)
        .font(.system(size: 20, weight: .bold, design: .rounded))
        .foregroundStyle(Color.black)
        .lineLimit(3)
        .minimumScaleFactor(0.72)

      if let sidesLabel = entry.sides.prefix(2).joined(separator: " • ").nilIfEmpty {
        Text(sidesLabel)
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(Color(red: 0.44, green: 0.47, blue: 0.54))
          .lineLimit(1)
      } else if entry.recipeURL?.scheme?.hasPrefix("http") == true {
        Text("Tap for recipe")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(Color(red: 1.0, green: 0.27, blue: 0.55))
      }
    }
    .padding(14)
    .widgetCardBackground()
    .widgetURL(entry.recipeURL)
  }
}

private extension View {
  @ViewBuilder
  func widgetCardBackground() -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      containerBackground(
        LinearGradient(
          colors: [
            Color(red: 1.0, green: 0.95, blue: 0.98),
            Color(red: 0.95, green: 0.98, blue: 1.0),
          ],
          startPoint: .topLeading,
          endPoint: .bottomTrailing
        ),
        for: .widget
      )
    } else {
      background(
        LinearGradient(
          colors: [
            Color(red: 1.0, green: 0.95, blue: 0.98),
            Color(red: 0.95, green: 0.98, blue: 1.0),
          ],
          startPoint: .topLeading,
          endPoint: .bottomTrailing
        )
      )
    }
  }
}

private extension String {
  var nilIfEmpty: String? {
    isEmpty ? nil : self
  }
}

@main
struct TodayMealWidget: Widget {
  let kind = "TodayMealWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: TodayMealProvider()) { entry in
      TodayMealWidgetView(entry: entry)
    }
    .configurationDisplayName("Today's Meal")
    .description("See tonight's planned meal and tap to open the recipe.")
    .supportedFamilies([.systemSmall])
  }
}

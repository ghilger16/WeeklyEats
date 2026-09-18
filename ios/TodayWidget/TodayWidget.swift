import SwiftUI
import WidgetKit

private let appGroupIdentifier = "group.com.ghilger16.WeeklyEats"
private let payloadKey = "todayWidgetPayload"
private let widgetPink = Color(red: 1.0, green: 75.0 / 255.0, blue: 145.0 / 255.0)
private let widgetPurple = Color(red: 0.55, green: 0.31, blue: 0.89)

private enum DinnerOutcome: String {
  case served, cookedAlt, ateOut, skipped

  var smallLabel: String {
    switch self {
    case .served: return "Dinner served!"
    case .cookedAlt: return "Dinner changed"
    case .ateOut: return "Ate out tonight"
    case .skipped: return "No dinner tonight"
    }
  }

  var symbol: String {
    switch self {
    case .served: return "checkmark"
    case .cookedAlt: return "arrow.left.arrow.right"
    case .ateOut: return "fork.knife"
    case .skipped: return "minus"
    }
  }
}

private struct WidgetMeal {
  let date: Date
  let title: String
  let icon: String
  let dateLabel: String
  let sides: [String]
  let prepNote: String?
  let recipeURL: URL?
  var mealId: String? = nil
  var isPlanned: Bool = true

  static func noPlans(on date: Date) -> WidgetMeal {
    WidgetMeal(date: date, title: "No Plans", icon: "custom:no-plans", dateLabel: date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()), sides: [], prepNote: nil, recipeURL: nil, isPlanned: false)
  }

  var isFlexNight: Bool { mealId == "__flex_night__" || (mealId == nil && icon == "🔄") }
  var isEatOut: Bool { mealId == "__eat_out__" || (mealId == nil && (title == "Eat Out Night" || title == "Eat Out")) }
  var displayTitle: String { isEatOut ? "Eat Out" : (isFlexNight ? "Flex Night" : title) }
  var specialSubtitle: String? {
    if isFlexNight { return "Keep tonight flexible" }
    if isEatOut && title != "Eat Out Night" && title != "Eat Out" { return title }
    return nil
  }

  var accessibilitySummary: String { ([displayTitle] + (specialSubtitle.map { [$0] } ?? []) + sides).joined(separator: " with ") }
}

struct TodayMealEntry: TimelineEntry {
  let date: Date
  fileprivate let today: WidgetMeal
  fileprivate let tomorrow: WidgetMeal?
  fileprivate let outcome: DinnerOutcome?
  fileprivate var nextUpcoming: WidgetMeal? = nil
  fileprivate var noPlanToday: Bool { !today.isPlanned }

  fileprivate var destinationURL: URL {
    URL(string: "weeklyeats://week-dashboard")!
  }

  fileprivate var recipeMeal: WidgetMeal? { noPlanToday ? nil : (outcome == nil ? today : tomorrow) }
}

struct TodayMealProvider: TimelineProvider {
  func placeholder(in context: Context) -> TodayMealEntry { Self.previewNormal }

  func getSnapshot(in context: Context, completion: @escaping (TodayMealEntry) -> Void) {
    completion(context.isPreview ? Self.previewNormal : loadEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TodayMealEntry>) -> Void) {
    let now = Date()
    let calendar = Calendar.current
    let futureMidnights = (1...14).compactMap { calendar.date(byAdding: .day, value: $0, to: calendar.startOfDay(for: now)) }
    let entries = [loadEntry(now: now)] + futureMidnights.map { loadEntry(now: $0) }
    completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(1_800))))
  }

  private func loadEntry(now: Date = Date()) -> TodayMealEntry {
    guard let defaults = UserDefaults(suiteName: appGroupIdentifier),
          let payload = defaults.dictionary(forKey: payloadKey) else {
      return TodayMealEntry(date: now, today: .noPlans(on: now), tomorrow: nil, outcome: nil)
    }
    let calendar = Calendar.current
    let storedToday = (payload["today"] as? [String: Any]).flatMap(meal(from:))
    let storedTomorrow = (payload["tomorrow"] as? [String: Any]).flatMap(meal(from:))
    // A dated plan snapshot lets the widget roll over without showing yesterday's
    // meal or promoting a later meal into today's primary position.
    let plannedMeals = ((payload["plannedMeals"] as? [[String: Any]])?.compactMap(meal(from:))
      ?? [storedToday, storedTomorrow].compactMap { $0 })
      .filter { $0.isPlanned }.sorted { $0.date < $1.date }
    let today = plannedMeals.first { calendar.isDate($0.date, inSameDayAs: now) }
    let tomorrowDate = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))!
    let tomorrow = plannedMeals.first { calendar.isDate($0.date, inSameDayAs: tomorrowDate) }
    let nextUpcoming = plannedMeals.first { calendar.startOfDay(for: $0.date) > calendar.startOfDay(for: now) }
    // Outcome belongs only to the recorded day, never to a future/unplanned day.
    let outcomeIsForToday = storedToday.map { calendar.isDate($0.date, inSameDayAs: now) } ?? false
    let outcome = today != nil && outcomeIsForToday
      ? (payload["todayOutcome"] as? String).flatMap(DinnerOutcome.init(rawValue:)) : nil
    return TodayMealEntry(date: now, today: today ?? .noPlans(on: now), tomorrow: tomorrow, outcome: outcome, nextUpcoming: nextUpcoming)
  }

  private func meal(from dictionary: [String: Any]) -> WidgetMeal? {
    guard let rawTitle = dictionary["title"] as? String, !rawTitle.trimmed.isEmpty else { return nil }
    // Calendar dates preserve the planned day when the user's timezone changes.
    let localDate = (dictionary["dateKey"] as? String).flatMap { value -> Date? in
      let parts = value.split(separator: "-").compactMap { Int($0) }
      guard parts.count == 3 else { return nil }
      return Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }
    guard let date = localDate ?? (dictionary["dateISO"] as? String).flatMap(Self.isoFormatter.date(from:)) else { return nil }
    let sides = (dictionary["sides"] as? [String] ?? []).map(\.trimmed).filter { !$0.isEmpty }
    return WidgetMeal(
      date: date,
      title: rawTitle.trimmed,
      icon: (dictionary["icon"] as? String)?.trimmed.nilIfEmpty ?? "🍽️",
      dateLabel: date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day()),
      sides: sides,
      prepNote: (dictionary["prepNote"] as? String)?.trimmed.nilIfEmpty,
      recipeURL: (dictionary["recipeUrl"] as? String)?.trimmed.nilIfEmpty.flatMap(URL.init(string:)),
      mealId: dictionary["mealId"] as? String,
      isPlanned: (dictionary["isPlanned"] as? Bool) ?? !["Nothing planned yet", "No Plans"].contains(rawTitle.trimmed)
    )
  }

  private static let isoFormatter: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
  }()

  fileprivate static let previewNormal = TodayMealEntry(
    date: Date(),
    today: WidgetMeal(date: Date(), title: "Burgers", icon: "🍔", dateLabel: "Fri, Sep 4", sides: ["Side Salad", "Air Fryer Fries"], prepNote: "Slice onions, prep patties", recipeURL: URL(string: "https://example.com/burgers")),
    tomorrow: WidgetMeal(date: Date().addingTimeInterval(86_400), title: "Pizza", icon: "🍕", dateLabel: "Sat, Sep 5", sides: ["Garlic Bread"], prepNote: "Preheat oven to 425°", recipeURL: nil),
    outcome: nil
  )
  fileprivate static let previewServed = TodayMealEntry(date: Date(), today: previewNormal.today, tomorrow: previewNormal.tomorrow, outcome: .served)
  fileprivate static let previewAteOut = TodayMealEntry(date: Date(), today: WidgetMeal(date: Date(), title: "Eat Out", icon: "🍴", dateLabel: "Fri, Sep 4", sides: [], prepNote: nil, recipeURL: nil), tomorrow: previewNormal.tomorrow, outcome: .ateOut)
  fileprivate static let previewNoRecipe = TodayMealEntry(date: Date(), today: WidgetMeal(date: Date(), title: "Chicken Tacos", icon: "🌮", dateLabel: "Fri, Sep 4", sides: ["Black Beans"], prepNote: nil, recipeURL: nil), tomorrow: previewNormal.tomorrow, outcome: nil)
  fileprivate static let previewLong = TodayMealEntry(date: Date(), today: WidgetMeal(date: Date(), title: "Slow-Roasted Garlic Parmesan Chicken", icon: "🍗", dateLabel: "Fri, Sep 4", sides: ["Roasted Broccoli", "Mashed Potatoes"], prepNote: "Marinate chicken, chop vegetables, and preheat the oven before dinner", recipeURL: nil), tomorrow: previewNormal.tomorrow, outcome: nil)
  fileprivate static let emptyEntry = TodayMealEntry(date: Date(), today: WidgetMeal.noPlans(on: Date()), tomorrow: nil, outcome: nil)
  fileprivate static let previewTomorrowMissing = TodayMealEntry(date: Date(), today: previewNormal.today, tomorrow: nil, outcome: .served)
}

struct TodayMealWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: TodayMealEntry

  var body: some View {
    Group {
      if family == .systemMedium { MediumTodayCard(entry: entry) }
      else { SmallTodayCard(entry: entry) }
    }
    .widgetURL(entry.destinationURL)
    .accessibilityLabel(accessibilityLabel)
    .todayCardBackground()
  }

  private var accessibilityLabel: String {
    if entry.noPlanToday {
      if family == .systemMedium, let next = entry.nextUpcoming {
        return "Today. No Plans. Next: \(next.displayTitle), \(next.date.formatted(.dateTime.weekday(.wide)))."
      }
      return "Today. No Plans."
    }
    if family == .systemSmall {
      return entry.outcome == nil
        ? "Today. \(entry.today.accessibilitySummary)"
        : "Tomorrow. \(entry.tomorrow?.accessibilitySummary ?? "No Plans")"
    }
    guard let outcome = entry.outcome else { return entry.today.accessibilitySummary }
    return "\(outcome.smallLabel). Tomorrow is \(entry.tomorrow?.accessibilitySummary ?? "No Plans")."
  }
}

private struct SmallTodayCard: View {
  let entry: TodayMealEntry
  private var displayedMeal: WidgetMeal? { entry.outcome == nil ? entry.today : entry.tomorrow }
  private var needsCompactSpacing: Bool { (displayedMeal?.sides.count ?? 0) >= 2 }

  var body: some View {
    VStack(spacing: needsCompactSpacing ? 5 : 8) {
      if !entry.noPlanToday {
        ZStack {
          if entry.outcome != nil { TomorrowLabel() }
          else { Text("TODAY").todayEyebrow(color: widgetPink) }
        }
        .frame(maxWidth: .infinity)
        .overlay(alignment: .trailing) { RecipeLink(meal: entry.recipeMeal) }
      }
      if entry.noPlanToday {
        NoPlansIdentity(compact: true)
      } else if entry.outcome != nil {
        if let tomorrow = entry.tomorrow { SmallMealIdentity(meal: tomorrow) }
        else { EmptyTomorrow().multilineTextAlignment(.center) }
      } else {
        SmallMealIdentity(meal: entry.today)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
    .padding(.horizontal, needsCompactSpacing ? 9 : 13)
    .padding(.vertical, needsCompactSpacing ? 8 : 13)
  }
}

private struct RecipeLink: View {
  let meal: WidgetMeal?

  private var destination: URL? {
    guard let recipeURL = meal?.recipeURL,
          let scheme = recipeURL.scheme?.lowercased(),
          ["http", "https"].contains(scheme), recipeURL.host != nil else { return nil }
    var components = URLComponents()
    components.scheme = "weeklyeats"
    components.host = "widget-recipe"
    components.queryItems = [URLQueryItem(name: "url", value: recipeURL.absoluteString)]
    return components.url
  }

  var body: some View {
    if let destination {
      Link(destination: destination) {
        Image(systemName: "link")
          .font(.system(size: 14, weight: .semibold))
          .foregroundStyle(widgetPink)
          .frame(width: 28, height: 28)
          .contentShape(Rectangle())
      }
      .accessibilityLabel("Open recipe in browser")
    }
  }
}

private struct WidgetMealIcon: View {
  let meal: WidgetMeal
  let size: CGFloat
  let diameter: CGFloat

  private var customImage: UIImage? {
    guard meal.icon.hasPrefix("custom:") else { return nil }
    let name = String(meal.icon.dropFirst("custom:".count))
    // Custom tokens share filenames with the app's assets/emoji registry.
    guard name.range(of: "^[a-z0-9]+(?:-[a-z0-9]+)*$", options: .regularExpression) != nil,
          let url = Bundle.main.url(forResource: name, withExtension: "png", subdirectory: "emoji") else { return nil }
    return UIImage(contentsOfFile: url.path)
  }

  var body: some View {
    Group {
      if meal.isFlexNight || meal.isEatOut {
        Text(meal.isFlexNight ? "\u{F04E6}" : "\u{F0A70}")
          .font(.custom("MaterialDesignIcons", fixedSize: size))
          .foregroundStyle(widgetPink)
      } else if let image = customImage {
        Image(uiImage: image)
          .resizable()
          .scaledToFit()
          .frame(width: size, height: size)
      } else {
        Text(meal.icon.hasPrefix("custom:") ? "🍽️" : meal.icon).font(.system(size: size))
      }
    }
    .frame(width: diameter, height: diameter)

  }
}

private struct NoPlansIdentity: View {
  let compact: Bool
  private var illustration: some View {
    WidgetMealIcon(meal: .noPlans(on: Date()), size: compact ? 58 : 64, diameter: compact ? 58 : 64)
  }
  var body: some View {
    Group {
      if compact {
        VStack(spacing: 8) {
          illustration
          Text("No Plans").font(.system(size: 19, weight: .bold, design: .rounded))
        }.frame(maxWidth: .infinity)
      } else {
        HStack(spacing: 14) {
          illustration
          Text("No Plans").font(.system(size: 22, weight: .bold, design: .rounded))
          Spacer(minLength: 0)
        }
      }
    }
  }
}

private struct SmallMealIdentity: View {
  let meal: WidgetMeal

  var body: some View {
    VStack(alignment: .center, spacing: meal.sides.isEmpty ? 10 : 4) {
      WidgetMealIcon(meal: meal, size: meal.sides.isEmpty ? 40 : 32, diameter: meal.sides.isEmpty ? 44 : 36)
      Text(meal.displayTitle)
        .font(.system(size: 17, weight: .bold, design: .rounded))
        .lineLimit(2)
        .minimumScaleFactor(0.72)
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity, alignment: .center)
      if !meal.sides.isEmpty {
        VStack(spacing: 1) {
          ForEach(Array(meal.sides.prefix(2).enumerated()), id: \.offset) { _, side in
            Text(side)
              .font(.system(size: 12, weight: .medium))
              .lineLimit(1)
              .minimumScaleFactor(0.85)
              .frame(maxWidth: .infinity, alignment: .center)
          }
          if meal.sides.count > 2 {
            Text("+\(meal.sides.count - 2) more")
              .font(.system(size: 10, weight: .medium))
              .lineLimit(1)
          }
        }
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
      }
    }
  }
}

private struct MediumTodayCard: View {
  let entry: TodayMealEntry
  var body: some View {
    VStack(alignment: .leading, spacing: 7) {
      HStack {
        Text("TODAY · \(entry.today.dateLabel.uppercased())").todayEyebrow(color: widgetPink)
        Spacer()
        RecipeLink(meal: entry.recipeMeal)
      }
      if entry.noPlanToday {
        NoPlansIdentity(compact: false)
        if let next = entry.nextUpcoming {
          Text("Next: \(next.displayTitle) · \(next.date.formatted(.dateTime.weekday(.abbreviated)))")
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(.secondary)
            .lineLimit(2)
            .minimumScaleFactor(0.85)
        }
      } else if let outcome = entry.outcome {
        HStack(spacing: 10) {
          StatusCircle(outcome: outcome, compact: false)
          Text(outcome == .skipped ? outcome.smallLabel : "\(entry.today.displayTitle) · \(outcome == .served ? "Served" : outcome.smallLabel)")
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
        }
        Divider()
        TomorrowLabel()
        if let tomorrow = entry.tomorrow {
          MealIdentity(meal: tomorrow, compact: false)
          PrepNote(note: tomorrow.prepNote, tint: widgetPurple)
        } else { EmptyTomorrow() }
      } else {
        MealIdentity(meal: entry.today, compact: false)
        Spacer(minLength: 0)
        PrepNote(note: entry.today.prepNote, tint: widgetPink)
      }
    }
    .padding(14)
  }
}

private struct MealIdentity: View {
  let meal: WidgetMeal
  let compact: Bool
  var body: some View {
    HStack(spacing: compact ? 8 : 12) {
      WidgetMealIcon(meal: meal, size: compact ? 34 : 38, diameter: compact ? 43 : 54)
      VStack(alignment: .leading, spacing: compact ? 1 : 3) {
        Text(meal.displayTitle).font(.system(size: compact ? 17 : 20, weight: .bold, design: .rounded)).lineLimit(compact ? 2 : 1).minimumScaleFactor(0.72)
        if let subtitle = meal.specialSubtitle {
          Text(subtitle).font(.system(size: 13, weight: .medium)).foregroundStyle(.secondary).lineLimit(1)
        } else if let sides = formattedSides {
          Text(sides).font(.system(size: compact ? 12 : 14, weight: .medium)).foregroundStyle(.secondary).lineLimit(compact ? 2 : 1)
        }
      }
      Spacer(minLength: 0)
    }
  }
  private var formattedSides: String? {
    guard !meal.sides.isEmpty else { return nil }
    if compact && meal.sides.count > 2 { return "\(meal.sides[0]) · +\(meal.sides.count - 1) more" }
    return meal.sides.prefix(2).joined(separator: compact ? "\n" : " · ")
  }
}

private struct PrepNote: View {
  let note: String?
  let tint: Color
  var body: some View {
    if let note, !note.isEmpty {
      HStack(spacing: 8) {
        Image(systemName: "list.clipboard").font(.system(size: 15, weight: .semibold)).foregroundStyle(tint)
        (Text("Prep: ").bold() + Text(note)).lineLimit(1)
      }
      .font(.system(size: 13)).padding(.horizontal, 10).frame(maxWidth: .infinity, minHeight: 32, alignment: .leading)
      .background(tint.opacity(0.09)).clipShape(RoundedRectangle(cornerRadius: 10))
    }
  }
}

private struct TomorrowLabel: View { var body: some View { Text("TOMORROW").todayEyebrow(color: widgetPurple) } }
private struct EmptyTomorrow: View { var body: some View { Text("No Plans").font(.system(size: 13, weight: .semibold)).foregroundStyle(.secondary) } }

private struct StatusCircle: View {
  let outcome: DinnerOutcome
  let compact: Bool
  var body: some View {
    Image(systemName: outcome.symbol).font(.system(size: compact ? 12 : 17, weight: .bold)).foregroundStyle(.white)
      .frame(width: compact ? 25 : 37, height: compact ? 25 : 37).background(outcome == .served ? Color.green : widgetPink).clipShape(Circle())
  }
}

private extension Text {
  func todayEyebrow(color: Color) -> some View { font(.system(size: 12, weight: .bold)).foregroundStyle(color) }
}

private extension View {
  @ViewBuilder func todayCardBackground() -> some View {
    if #available(iOSApplicationExtension 17.0, *) { containerBackground(for: .widget) { Color.widgetBackground } }
    else { background(Color.widgetBackground) }
  }
}

private extension Color {
  static let widgetBackground = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.12, green: 0.12, blue: 0.14, alpha: 1) : .systemBackground })
  static let accentSurface = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 0.26, green: 0.18, blue: 0.22, alpha: 1) : UIColor(red: 1.0, green: 0.93, blue: 0.96, alpha: 1) })
}

private extension String {
  var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
  var nilIfEmpty: String? { isEmpty ? nil : self }
}

@main
struct TodayMealWidget: Widget {
  let kind = "TodayMealWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: TodayMealProvider()) { TodayMealWidgetView(entry: $0) }
      .configurationDisplayName("TodayCard")
      .description("See today’s dinner, prep, and what’s coming tomorrow.")
      .supportedFamilies([.systemSmall, .systemMedium])
  }
}

#if DEBUG
@available(iOSApplicationExtension 17.0, *)
#Preview("Small · Meal + recipe", as: .systemSmall) { TodayMealWidget() } timeline: { TodayMealProvider.previewNormal }
@available(iOSApplicationExtension 17.0, *)
#Preview("Small · Meal without recipe", as: .systemSmall) { TodayMealWidget() } timeline: { TodayMealProvider.previewNoRecipe }
@available(iOSApplicationExtension 17.0, *)
#Preview("Small · Served + tomorrow", as: .systemSmall) { TodayMealWidget() } timeline: { TodayMealProvider.previewServed }
@available(iOSApplicationExtension 17.0, *)
#Preview("Small · Ate out", as: .systemSmall) { TodayMealWidget() } timeline: { TodayMealProvider.previewAteOut }
@available(iOSApplicationExtension 17.0, *)
#Preview("Small · Tomorrow missing", as: .systemSmall) { TodayMealWidget() } timeline: { TodayMealProvider.previewTomorrowMissing }
@available(iOSApplicationExtension 17.0, *)
#Preview("Medium · Meal + prep", as: .systemMedium) { TodayMealWidget() } timeline: { TodayMealProvider.previewNormal }
@available(iOSApplicationExtension 17.0, *)
#Preview("Medium · No prep note", as: .systemMedium) { TodayMealWidget() } timeline: { TodayMealProvider.previewNoRecipe }
@available(iOSApplicationExtension 17.0, *)
#Preview("Medium · Served", as: .systemMedium) { TodayMealWidget() } timeline: { TodayMealProvider.previewServed }
@available(iOSApplicationExtension 17.0, *)
#Preview("Medium · Long content", as: .systemMedium) { TodayMealWidget() } timeline: { TodayMealProvider.previewLong }
@available(iOSApplicationExtension 17.0, *)
#Preview("Medium · Ate out · Dark") {
  MediumTodayCard(entry: TodayMealProvider.previewAteOut)
    .environment(\.colorScheme, .dark)
    .frame(width: 329, height: 155)
    .background(Color.widgetBackground)
}
#endif

#Preview("Small · No Plans", as: .systemSmall) { TodayMealWidget() } timeline: { TodayMealProvider.emptyEntry }
#Preview("Medium · No Plans + next", as: .systemMedium) { TodayMealWidget() } timeline: {
  TodayMealEntry(date: Date(), today: .noPlans(on: Date()), tomorrow: nil, outcome: nil, nextUpcoming: TodayMealProvider.previewNormal.tomorrow)
}
#Preview("Medium · No Plans", as: .systemMedium) { TodayMealWidget() } timeline: { TodayMealProvider.emptyEntry }

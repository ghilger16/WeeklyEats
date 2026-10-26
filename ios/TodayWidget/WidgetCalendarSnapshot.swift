import Foundation

// Foundation-only calendar/selection logic, also exercised by the native fixture test.
enum WidgetCalendarSnapshot {
  static func calendar(timeZone: TimeZone = .current) -> Calendar {
    // Payload keys are Gregorian civil dates, regardless of the user's display calendar.
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    return calendar
  }

  static func dateKey(_ date: Date, calendar: Calendar) -> String {
    let parts = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", parts.year!, parts.month!, parts.day!)
  }

  static func date(from key: String, calendar: Calendar) -> Date? {
    let parts = key.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3,
          let date = calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])),
          dateKey(date, calendar: calendar) == key else { return nil }
    return calendar.startOfDay(for: date)
  }

  static func mealDate(_ meal: [String: Any], calendar: Calendar) -> Date? {
    if let key = meal["dateKey"] as? String { return date(from: key, calendar: calendar) }
    guard let iso = meal["dateISO"] as? String else { return nil }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: iso) { return date }
    formatter.formatOptions = [.withInternetDateTime]
    return formatter.date(from: iso)
  }

  struct Selection {
    let today: [String: Any]?
    let tomorrow: [String: Any]?
    let nextUpcoming: [String: Any]?
    let outcome: String?
  }

  static func select(_ payload: [String: Any], on now: Date, calendar: Calendar) -> Selection {
    let legacy = [payload["today"], payload["tomorrow"]].compactMap { $0 as? [String: Any] }
    let records = (payload["plannedMeals"] as? [[String: Any]]) ?? legacy
    let dated = records.compactMap { record -> (Date, [String: Any])? in
      guard (record["isPlanned"] as? Bool) != false,
            let title = record["title"] as? String, !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
            !["No Plans", "Nothing planned yet"].contains(title),
            let date = mealDate(record, calendar: calendar) else { return nil }
      return (date, record)
    }.sorted { $0.0 < $1.0 }
    let tomorrowDate = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))!
    let today = dated.first { calendar.isDate($0.0, inSameDayAs: now) }?.1
    let tomorrow = dated.first { calendar.isDate($0.0, inSameDayAs: tomorrowDate) }?.1
    let next = dated.first { calendar.startOfDay(for: $0.0) > calendar.startOfDay(for: now) }?.1
    var outcome: String?
    if let today {
      if let outcomes = payload["outcomesByDate"] as? [String: [String: Any]] {
        if let state = outcomes[dateKey(now, calendar: calendar)],
           state["mealId"] is NSNull || state["mealId"] as? String == today["mealId"] as? String {
          outcome = state["servedState"] as? String
        }
      } else if let stored = payload["today"] as? [String: Any],
                let storedDate = mealDate(stored, calendar: calendar),
                calendar.isDate(storedDate, inSameDayAs: now) {
        outcome = payload["todayOutcome"] as? String
      }
    }
    return Selection(today: today, tomorrow: tomorrow, nextUpcoming: next, outcome: outcome)
  }

  static func timelineDates(now: Date, calendar: Calendar) -> [Date] {
    [now] + (1...14).compactMap { calendar.date(byAdding: .day, value: $0, to: calendar.startOfDay(for: now)) }
  }

  static func nextRefresh(now: Date, calendar: Calendar) -> Date {
    let midnight = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))!
    return calendar.date(byAdding: .minute, value: 5, to: midnight)!
  }
}

import Foundation

@main
struct WidgetCalendarTests {
  static func main() {
    func meal(_ id: String, _ date: String) -> [String: Any] {
      ["mealId": id, "title": id, "dateKey": date, "isPlanned": true]
    }
    var assertions = 0
    func check(_ value: @autoclosure () -> Bool, _ message: String) {
      precondition(value(), message)
      assertions += 1
    }
    for zone in ["America/Phoenix", "America/New_York", "Asia/Tokyo", "Pacific/Auckland"] {
      let calendar = WidgetCalendarSnapshot.calendar(timeZone: TimeZone(identifier: zone)!)
      let monday = WidgetCalendarSnapshot.date(from: "2026-09-28", calendar: calendar)!
      let tuesday = calendar.date(byAdding: .day, value: 1, to: monday)!
      let payload: [String: Any] = ["plannedMeals": [meal("A", "2026-09-28"), meal("B", "2026-09-29")],
        "outcomesByDate": ["2026-09-28": ["mealId": "A", "servedState": "served"]]]
      let first = WidgetCalendarSnapshot.select(payload, on: monday, calendar: calendar)
      check(first.today?["mealId"] as? String == "A", "Monday meal in \(zone)")
      check(first.outcome == "served", "Monday served state")
      check(first.tomorrow?["mealId"] as? String == "B", "Existing served UX can show tomorrow")
      let next = WidgetCalendarSnapshot.select(payload, on: tuesday, calendar: calendar)
      check(next.today?["mealId"] as? String == "B", "Unchanged snapshot rolls over overnight")
      check(next.outcome == nil, "Yesterday's served status must not leak")
      check(WidgetCalendarSnapshot.select(payload, on: calendar.date(byAdding: .day, value: 2, to: monday)!, calendar: calendar).today == nil, "No yesterday fallback")
      let dates = WidgetCalendarSnapshot.timelineDates(now: monday, calendar: calendar)
      check(dates.count == 15 && dates[1] == tuesday, "Midnight already in timeline")
      check(WidgetCalendarSnapshot.nextRefresh(now: monday, calendar: calendar) == calendar.date(byAdding: .minute, value: 5, to: tuesday), "Refresh shortly after local midnight")
      var replaced = payload
      replaced["plannedMeals"] = [meal("Replacement", "2026-09-28"), meal("New tomorrow", "2026-09-29")]
      let changed = WidgetCalendarSnapshot.select(replaced, on: monday, calendar: calendar)
      check(changed.today?["mealId"] as? String == "Replacement" && changed.outcome == nil, "Replacement cannot inherit old meal's served state")
      check(changed.tomorrow?["mealId"] as? String == "New tomorrow", "Tomorrow edit reflected without promoting it")
      for outcome in ["served", "cookedAlt", "ateOut", "skipped"] {
        var resolved = payload
        resolved["outcomesByDate"] = ["2026-09-28": ["mealId": "A", "servedState": outcome]]
        check(WidgetCalendarSnapshot.select(resolved, on: monday, calendar: calendar).outcome == outcome, "Outcome \(outcome)")
      }
      var undone = payload
      undone["outcomesByDate"] = [String: [String: Any]]()
      check(WidgetCalendarSnapshot.select(undone, on: monday, calendar: calendar).outcome == nil, "Undo served")
      for id in ["__eat_out__", "__flex_night__"] {
        check(WidgetCalendarSnapshot.select(["plannedMeals": [meal(id, "2026-09-28")]], on: monday, calendar: calendar).today?["mealId"] as? String == id, "Special meal identity")
      }
      check(WidgetCalendarSnapshot.date(from: "2026-02-30", calendar: calendar) == nil, "Reject invalid civil date")
    }
    let ny = WidgetCalendarSnapshot.calendar(timeZone: TimeZone(identifier: "America/New_York")!)
    for (key, hours) in [("2026-03-08", 23.0), ("2026-11-01", 25.0)] {
      let start = WidgetCalendarSnapshot.date(from: key, calendar: ny)!
      let next = WidgetCalendarSnapshot.timelineDates(now: start, calendar: ny)[1]
      check(next.timeIntervalSince(start) == hours * 3600, "DST uses calendar days, not 24-hour offsets")
    }
    let now = WidgetCalendarSnapshot.date(from: "2026-09-28", calendar: ny)!
    let deviceOne: [String: Any] = ["plannedMeals": [meal("A", "2026-09-28")]]
    let deviceTwo: [String: Any] = ["plannedMeals": [meal("Other device", "2026-09-28")]]
    check(WidgetCalendarSnapshot.select(deviceOne, on: now, calendar: ny).today?["mealId"] as? String == "A", "Device one isolation")
    check(WidgetCalendarSnapshot.select(deviceTwo, on: now, calendar: ny).today?["mealId"] as? String == "Other device", "Device two isolation")
    print("Widget calendar: \(assertions) native assertions passed")
  }
}

import Foundation
import WidgetKit

@objc(TodayWidgetBridge)
final class TodayWidgetBridge: NSObject {
  private let appGroupIdentifier = "group.com.ghilger16.WeeklyEats"
  private let payloadKey = "todayWidgetPayload"

  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(savePayload:resolver:rejecter:)
  func savePayload(
    _ payload: NSDictionary,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: appGroupIdentifier) else {
      reject("app_group_unavailable", "Could not open WeeklyEats app group.", nil)
      return
    }

    guard JSONSerialization.isValidJSONObject(payload),
          let data = try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys]) else {
      reject("invalid_widget_payload", "Widget snapshot is not valid JSON.", nil)
      return
    }
    // JSON data supports nullable optional React Native fields; property-list
    // dictionaries do not support NSNull. Compare content across app restarts too.
    let previous: NSDictionary? = {
      if let saved = defaults.data(forKey: payloadKey) {
        return (try? JSONSerialization.jsonObject(with: saved)) as? NSDictionary
      }
      return defaults.dictionary(forKey: payloadKey) as NSDictionary?
    }()
    func content(_ value: NSDictionary) -> NSDictionary {
      let copy = value.mutableCopy() as! NSMutableDictionary
      copy.removeObject(forKey: "generatedAtISO")
      copy.removeObject(forKey: "snapshotGeneratedAt")
      return copy
    }
    if let previous, content(previous).isEqual(content(payload)) {
      resolve(true)
      return
    }
    defaults.set(data, forKey: payloadKey)
    defaults.synchronize()
    reloadWidgets()
    #if DEBUG
    print("[WeeklyEatsWidget] shared snapshot written before reload; date=\(payload["snapshotDate"] ?? "unknown"), generated=\(payload["snapshotGeneratedAt"] ?? "unknown")")
    #endif
    resolve(true)
  }

  @objc(clearPayload:rejecter:)
  func clearPayload(
    resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: appGroupIdentifier) else {
      reject("app_group_unavailable", "Could not open WeeklyEats app group.", nil)
      return
    }

    defaults.removeObject(forKey: payloadKey)
    defaults.synchronize()
    reloadWidgets()
    resolve(true)
  }

  private func reloadWidgets() {
    if #available(iOS 14.0, *) {
      WidgetCenter.shared.reloadTimelines(ofKind: "TodayMealWidget")
    }
  }
}

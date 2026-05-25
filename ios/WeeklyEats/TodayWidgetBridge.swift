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

    defaults.set(payload, forKey: payloadKey)
    defaults.synchronize()
    reloadWidgets()
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

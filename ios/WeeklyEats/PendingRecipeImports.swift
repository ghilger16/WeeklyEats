import Foundation

@objc(PendingRecipeImports)
final class PendingRecipeImports: NSObject {
  private let appGroupIdentifier = "group.com.ghilger16.WeeklyEats"
  private let pendingImportsKey = "pendingRecipeImports"

  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(getPendingImports:rejecter:)
  func getPendingImports(
    resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: appGroupIdentifier) else {
      reject("app_group_unavailable", "Could not open WeeklyEats app group.", nil)
      return
    }

    let imports = defaults.array(forKey: pendingImportsKey) as? [[String: Any]] ?? []
    resolve(imports)
  }

  @objc(removePendingImport:resolver:rejecter:)
  func removePendingImport(
    _ importId: String,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: appGroupIdentifier) else {
      reject("app_group_unavailable", "Could not open WeeklyEats app group.", nil)
      return
    }

    let imports = defaults.array(forKey: pendingImportsKey) as? [[String: Any]] ?? []
    let filtered = imports.filter { item in
      (item["id"] as? String) != importId
    }
    defaults.set(filtered, forKey: pendingImportsKey)
    defaults.synchronize()
    resolve(true)
  }
}

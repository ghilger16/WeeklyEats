#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(TodayWidgetBridge, NSObject)

RCT_EXTERN_METHOD(savePayload:(NSDictionary *)payload
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearPayload:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end

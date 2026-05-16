#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PendingRecipeImports, NSObject)

RCT_EXTERN_METHOD(getPendingImports:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(removePendingImport:(NSString *)importId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end

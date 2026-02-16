#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(MeCardModule, NSObject)
RCT_EXTERN_METHOD(getMeCard:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(getMeCardImage:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
@end

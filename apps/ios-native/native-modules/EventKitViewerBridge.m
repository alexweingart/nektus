#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(EventKitViewer, NSObject)
RCT_EXTERN_METHOD(presentEvent:(NSString *)eventId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
@end

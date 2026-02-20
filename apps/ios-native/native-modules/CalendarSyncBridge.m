#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(CalendarSync, NSObject)
RCT_EXTERN_METHOD(configure:(NSString *)userId
                  idToken:(NSString *)idToken
                  apiBaseUrl:(NSString *)apiBaseUrl)
RCT_EXTERN_METHOD(scheduleBackgroundSync)
RCT_EXTERN_METHOD(syncNow:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(startListening)
RCT_EXTERN_METHOD(stopListening)
@end

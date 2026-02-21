#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(BLEPeripheral, RCTEventEmitter)
RCT_EXTERN_METHOD(startAdvertising:(NSString *)userId
                  sharingCategory:(NSString *)sharingCategory
                  buttonPressTimestamp:(nonnull NSNumber *)buttonPressTimestamp)
RCT_EXTERN_METHOD(stopAdvertising)
RCT_EXTERN_METHOD(setProfileData:(NSString *)profileJson)
RCT_EXTERN_METHOD(setupGATTServer)
@end

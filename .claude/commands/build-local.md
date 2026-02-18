Build and launch the iOS app on iPhone Air simulator.

1. Boot iPhone Air simulator if not already running:
   - Check with `xcrun simctl list devices | grep "iPhone Air"`
   - If not booted: `xcrun simctl boot "iPhone Air"` and `open -a Simulator`
2. Run `cd apps/ios-native && npx expo run:ios` (incremental build)
3. Run the build in the background so the conversation can continue

Note: For JS/TS-only changes, a build is not needed — the app will hot reload via Metro. Only use this command when native code has changed.

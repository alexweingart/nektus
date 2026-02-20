Reset the iPhone Air simulator for testing the Apple Sign-In "Join" flow.

This erases the simulator (which resets Apple's "Sign in with Apple" state), boots it back up, and reinstalls Nekt.

Steps:
1. Shut down the simulator: `xcrun simctl shutdown "iPhone Air"`
2. Erase the simulator: `xcrun simctl erase "iPhone Air"`
3. Boot the simulator: `xcrun simctl boot "iPhone Air"` and `open -a Simulator`
4. Build and install Nekt: `cd apps/ios-native && npx expo run:ios --device "iPhone Air"`
5. Tell the user: "Simulator is reset and Nekt is installed. Sign into your Apple ID in Settings, then you can test the Join flow."

Note: The user will need to manually sign into their Apple ID in Settings after the reset (~30 sec with 2FA). This cannot be automated.

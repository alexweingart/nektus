import { useCallback, useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer, useNavigationContainerRef, LinkingOptions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Linking from "expo-linking";
import * as SplashScreenModule from "expo-splash-screen";
import { SessionProvider, useSession } from "./src/app/providers/SessionProvider";
import { ProfileProvider, useProfile } from "./src/app/context/ProfileContext";
import { RouteContext } from "./src/app/context/RouteContext";
import AdminModeProvider from "./src/app/providers/AdminModeProvider";
import { LayoutBackground } from "./src/app/components/ui/layout/LayoutBackground";
import { HomePage } from "./src/app/components/views/HomePage";
import { ProfileSetupView } from "./src/app/components/views/ProfileSetupView";
import { ProfileView } from "./src/app/components/views/ProfileView";
import { PrivacyView } from "./src/app/components/views/PrivacyView";
import { TermsView } from "./src/app/components/views/TermsView";
import { EditProfileView } from "./src/app/components/views/EditProfileView";
import { ContactView } from "./src/app/components/views/ContactView";
import { ContactProfileView } from "./src/app/components/views/ContactProfileView";
import { HistoryView } from "./src/app/components/views/HistoryView";
import { CalendarView } from "./src/app/components/views/CalendarView";
import { LocationView } from "./src/app/components/views/LocationView";
import { SmartScheduleView } from "./src/app/components/views/SmartScheduleView";
import { AIScheduleView } from "./src/app/components/views/AIScheduleView";

// Keep the splash screen visible while we fetch resources
SplashScreenModule.preventAutoHideAsync();
// Enable fade-out animation (default is false on iOS = instant hide = black flash)
SplashScreenModule.setOptions({ fade: true, duration: 400 });

// Navigation types
export type RootStackParamList = {
  Home: undefined;
  Privacy: undefined;
  Terms: undefined;
  ProfileSetup: undefined;
  Profile: undefined;
  EditProfile: { openInlineAddLink?: 'personal' | 'work' } | undefined;
  Contact: { userId?: string; token: string; isHistoricalMode?: boolean; backgroundColors?: string[] };
  ContactProfile: { code: string };  // View profile via shortCode (/c/:code)
  History: undefined;
  // Phase 2: Scheduling
  Calendar: { section: 'personal' | 'work' };
  Location: { section: 'personal' | 'work' };
  SmartSchedule: { contactUserId: string; backgroundColors?: string[]; contactProfile?: any };
  AISchedule: { contactUserId: string; backgroundColors?: string[]; savedContact?: any; autoFocus?: boolean };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Deep linking configuration for Universal Links
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    'https://nekt.us',
    'https://www.nekt.us',
    'nekt://', // Custom scheme
  ],
  config: {
    screens: {
      Home: '',
      Privacy: 'privacy',
      Terms: 'terms',
      ProfileSetup: 'setup',
      Profile: 'profile',
      EditProfile: 'edit-profile',
      Contact: 'x/:token',
      ContactProfile: 'c/:code',
      History: 'history',
      Calendar: 'calendar/:section',
      Location: 'location/:section',
      SmartSchedule: 'schedule/:contactUserId',
      AISchedule: 'ai-schedule/:contactUserId',
    },
  },
};

// Main app content - routes to appropriate view using navigation
function AppContent() {
  const { status } = useSession();
  const { needsSetup, isLoading: profileLoading } = useProfile();
  const [appIsReady, setAppIsReady] = useState(false);

  // Determine if loading
  const isLoading = status === "loading" || (status === "authenticated" && profileLoading);

  // Content fade-in after native splash hides
  const contentOpacity = useSharedValue(0);
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    flex: 1,
  }));

  // When content has laid out, hide native splash and fade in content
  const handleContentReady = useCallback(() => {
    if (appIsReady) return;
    // Small delay to ensure gradient is fully composited
    setTimeout(async () => {
      await SplashScreenModule.hideAsync();
      contentOpacity.value = withTiming(1, { duration: 500 });
      setAppIsReady(true);
    }, 100);
  }, [appIsReady]);

  // Determine initial route based on auth state
  const getInitialRouteName = (): keyof RootStackParamList => {
    if (status === "unauthenticated") return "Home";
    if (needsSetup) return "ProfileSetup";
    return "Profile";
  };

  // Compute navigator key based on auth state to force remount on state changes
  const navigatorKey = status === "unauthenticated" ? "unauth" : needsSetup ? "setup" : "auth";

  // Always render LayoutBackground so gradient paints behind the native splash.
  // Only render navigation content once data is loaded.
  return (
    <View style={styles.container}>
      <LayoutBackground>
        {!isLoading && (
          <View style={{ flex: 1 }} onLayout={handleContentReady}>
            <Animated.View style={contentStyle}>
              <Stack.Navigator
                key={navigatorKey}
                initialRouteName={getInitialRouteName()}
                screenOptions={{
                  headerShown: false,
                  animation: "none",
                  contentStyle: { backgroundColor: "transparent" },
                }}
              >
                {status === "unauthenticated" ? (
                  <>
                    <Stack.Screen name="Home" component={HomePage} />
                    <Stack.Screen name="Privacy" component={PrivacyView} />
                    <Stack.Screen name="Terms" component={TermsView} />
                  </>
                ) : needsSetup ? (
                  <>
                    <Stack.Screen name="ProfileSetup" component={ProfileSetupView} />
                    <Stack.Screen name="Privacy" component={PrivacyView} />
                    <Stack.Screen name="Terms" component={TermsView} />
                  </>
                ) : (
                  <>
                    <Stack.Screen name="Profile" component={ProfileView} />
                    <Stack.Screen name="EditProfile" component={EditProfileView} />
                    <Stack.Screen name="Contact" component={ContactView} />
                    <Stack.Screen name="ContactProfile" component={ContactProfileView} />
                    <Stack.Screen name="History" component={HistoryView} />
                    <Stack.Screen name="Calendar" component={CalendarView} />
                    <Stack.Screen name="Location" component={LocationView} />
                    <Stack.Screen name="SmartSchedule" component={SmartScheduleView} />
                    <Stack.Screen name="AISchedule" component={AIScheduleView} />
                    <Stack.Screen name="Privacy" component={PrivacyView} />
                    <Stack.Screen name="Terms" component={TermsView} />
                  </>
                )}
              </Stack.Navigator>
            </Animated.View>
          </View>
        )}
      </LayoutBackground>
    </View>
  );
}

// Root app with providers
export default function App() {
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const [currentRoute, setCurrentRoute] = useState<string | null>(null);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0a0f1a" }}>
      <SafeAreaProvider>
        <NavigationContainer
          ref={navigationRef}
          linking={linking}
          onStateChange={() => {
            const route = navigationRef.getCurrentRoute();
            if (route?.name) {
              setCurrentRoute(route.name);
            }
          }}
          onReady={() => {
            const route = navigationRef.getCurrentRoute();
            if (route?.name) {
              setCurrentRoute(route.name);
            }
          }}
        >
          <RouteContext.Provider value={currentRoute}>
            <SessionProvider>
              <ProfileProvider>
                <AdminModeProvider>
                  <AppContent />
                </AdminModeProvider>
              </ProfileProvider>
            </SessionProvider>
          </RouteContext.Provider>
        </NavigationContainer>
        <StatusBar style="light" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0f1a",
  },
});

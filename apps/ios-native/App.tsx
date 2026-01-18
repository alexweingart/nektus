import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
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
import { HistoryView } from "./src/app/components/views/HistoryView";
import { CalendarView } from "./src/app/components/views/CalendarView";
import { LocationView } from "./src/app/components/views/LocationView";
import { SmartScheduleView } from "./src/app/components/views/SmartScheduleView";
import { AIScheduleView } from "./src/app/components/views/AIScheduleView";

// Keep the splash screen visible while we fetch resources
SplashScreenModule.preventAutoHideAsync();

// Navigation types
export type RootStackParamList = {
  Home: undefined;
  Privacy: undefined;
  Terms: undefined;
  ProfileSetup: undefined;
  Profile: undefined;
  EditProfile: undefined;
  Contact: { userId: string; token: string; isHistoricalMode?: boolean };
  History: undefined;
  // Phase 2: Scheduling
  Calendar: { section: 'personal' | 'work' };
  Location: { section: 'personal' | 'work' };
  SmartSchedule: { contactUserId: string };
  AISchedule: { contactUserId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Main app content - routes to appropriate view using navigation
function AppContent() {
  const { status } = useSession();
  const { needsSetup, isLoading: profileLoading } = useProfile();
  const [appIsReady, setAppIsReady] = useState(false);

  // Debug logging
  console.log("[AppContent] status:", status, "needsSetup:", needsSetup, "profileLoading:", profileLoading);

  // Determine if loading
  const isLoading = status === "loading" || (status === "authenticated" && profileLoading);

  // Hide the native splash screen once app state is determined
  useEffect(() => {
    if (!isLoading) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(async () => {
        await SplashScreenModule.hideAsync();
        setAppIsReady(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Keep native splash visible while loading
  if (isLoading || !appIsReady) {
    return null;
  }

  // Determine initial route based on auth state
  const getInitialRouteName = (): keyof RootStackParamList => {
    if (status === "unauthenticated") return "Home";
    if (needsSetup) return "ProfileSetup";
    return "Profile";
  };

  // Compute navigator key based on auth state to force remount on state changes
  // This prevents React Navigation from trying to reconcile invalid routes
  const navigatorKey = status === "unauthenticated" ? "unauth" : needsSetup ? "setup" : "auth";

  return (
    <LayoutBackground>
      <Stack.Navigator
        key={navigatorKey}
        initialRouteName={getInitialRouteName()}
        screenOptions={{
          headerShown: false,
          animation: "fade", // Crossfade transition matching web
          animationDuration: 300,
          contentStyle: { backgroundColor: "transparent" },
        }}
      >
        {status === "unauthenticated" ? (
          // Unauthenticated screens
          <>
            <Stack.Screen name="Home" component={HomePage} />
            <Stack.Screen name="Privacy" component={PrivacyView} />
            <Stack.Screen name="Terms" component={TermsView} />
          </>
        ) : needsSetup ? (
          // Profile setup screens
          <>
            <Stack.Screen name="ProfileSetup" component={ProfileSetupView} />
            <Stack.Screen name="Privacy" component={PrivacyView} />
            <Stack.Screen name="Terms" component={TermsView} />
          </>
        ) : (
          // Authenticated screens - all use fade (crossfade) to keep background static
          <>
            <Stack.Screen name="Profile" component={ProfileView} />
            <Stack.Screen name="EditProfile" component={EditProfileView} />
            <Stack.Screen name="Contact" component={ContactView} />
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
    </LayoutBackground>
  );
}

// Root app with providers
export default function App() {
  const navigationRef = useNavigationContainerRef();
  const [currentRoute, setCurrentRoute] = useState<string | null>(null);

  return (
    <SafeAreaProvider>
      <NavigationContainer
        ref={navigationRef}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#0a0f1a",
  },
});

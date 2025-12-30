import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as SplashScreenModule from "expo-splash-screen";
import { SessionProvider, useSession } from "./src/app/providers/SessionProvider";
import { ProfileProvider, useProfile } from "./src/app/context/ProfileContext";
import { HomePage } from "./src/app/components/views/HomePage";
import { ProfileSetupView } from "./src/app/components/views/ProfileSetupView";
import { ProfileView } from "./src/app/components/views/ProfileView";
import { PrivacyView } from "./src/app/components/views/PrivacyView";
import { TermsView } from "./src/app/components/views/TermsView";

// Keep the splash screen visible while we fetch resources
SplashScreenModule.preventAutoHideAsync();

// Navigation types
export type RootStackParamList = {
  Home: undefined;
  Privacy: undefined;
  Terms: undefined;
  ProfileSetup: undefined;
  Profile: undefined;
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

  return (
    <Stack.Navigator
      initialRouteName={getInitialRouteName()}
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
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
        // Authenticated screens
        <>
          <Stack.Screen name="Profile" component={ProfileView} />
          <Stack.Screen name="Privacy" component={PrivacyView} />
          <Stack.Screen name="Terms" component={TermsView} />
        </>
      )}
    </Stack.Navigator>
  );
}

// Root app with providers
export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <SessionProvider>
          <ProfileProvider>
            <AppContent />
          </ProfileProvider>
        </SessionProvider>
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

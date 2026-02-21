# Nekt React Native Migration Report
**Date:** December 29, 2025
**Purpose:** Analysis of web source code for React Native iOS app rebuild
**Platform:** React Native (NOT native Swift)

## Executive Summary

This report categorizes all files in `apps/web/src` for React Native migration:
1. **Reuse Exactly** - Use as-is in React Native
2. **Adapt for React Native** - Keep logic, change React Native primitives/APIs
3. **Totally Rebuild** - Needs complete reimplementation
4. **Ignore** - Web-specific, not needed

**KEY INSIGHT:** React Native allows ~70% code reuse from the web app, compared to ~20% for native Swift!

---

## React Native Advantages

### What Stays the Same ✅
- **TypeScript** - No conversion needed!
- **React** - Same component model, hooks, context
- **Business Logic** - All utilities, helpers, data transforms
- **Types** - Reuse all TypeScript types as-is
- **State Management** - React Context, hooks, providers work identically
- **API Calls** - fetch() works in React Native

### What Changes 🔄
- **Components** - `<div>` → `<View>`, `<p>` → `<Text>`, etc.
- **Styling** - CSS → StyleSheet or styled-components
- **Navigation** - Next.js router → React Navigation
- **Animations** - CSS → React Native Animated or Reanimated
- **Native APIs** - Web APIs → Native modules (CoreMotion, Contacts, etc.)

---

## Category 1: REUSE EXACTLY ✅

### API Routes (`app/api/*`)
**Status:** Reuse all - React Native app calls same endpoints
**Action:** Keep unchanged in `apps/web/src/app/api/`

All API routes from previous report remain the same.

---

### Server Libraries (`lib/server/*`)
**Status:** Reuse all - Server-side code is platform-agnostic
**Action:** Keep unchanged

All server libraries from previous report remain the same.

---

### Configuration (`lib/config/*`)
**Status:** Reuse all
**Action:** Keep unchanged

- `config/firebase/admin.ts` - Server-side (unchanged)
- `config/firebase/client.ts` - Works with React Native Firebase
- `config/openai.ts` - Platform-agnostic
- `config/redis.ts` - Platform-agnostic

---

### Constants (`lib/constants.ts`)
**Status:** Reuse exactly - TypeScript works in React Native!
**Action:** Import directly, no conversion needed ✅

```typescript
// Works as-is in React Native!
import {
  AVAILABILITY_CONSTANTS,
  WORK_SCHEDULABLE_HOURS,
  UNIVERSAL_SCHEDULABLE_HOURS
} from '@/lib/constants';
```

---

### Types (`types/*`)
**Status:** Reuse all TypeScript types exactly
**Action:** Import directly

```typescript
// All types work as-is!
import type { UserProfile, ProfileField, SchedulableHours } from '@/types';
```

**Ignore these type files:**
- `next-pwa.d.ts` - PWA-specific
- `next-auth.d.ts` - NextAuth-specific
- `css.d.ts` - CSS-specific

**Keep these:**
- `profile.ts` ✅
- `contactExchange.ts` ✅
- `ai-scheduling.ts` ✅
- `places.ts` ✅
- `index.ts` ✅

---

### React Context & Providers
**Status:** Reuse with minor adaptations
**Action:** Port to React Native with minimal changes

#### `context/ProfileContext.tsx`
```typescript
// Works almost identically in React Native!
// Just update imports from 'react' to 'react'
// Firebase imports work with @react-native-firebase
```

#### `providers/SessionProvider.tsx`
```typescript
// Adapt to use React Native Firebase Auth instead of NextAuth
// Core logic stays the same
```

#### `providers/AdminModeProvider.tsx`
```typescript
// Works as-is, use AsyncStorage instead of localStorage
import AsyncStorage from '@react-native-async-storage/async-storage';
```

**Action:** Keep React Context pattern, swap web-specific APIs

---

### Hooks (`lib/hooks/*`)
**Status:** Reuse most hooks with minor adaptations

#### ✅ Reuse with Adaptation

**`use-contact-exchange-state.ts`**
- Core logic: ✅ Reuse
- Changes: AsyncStorage instead of localStorage
- React Native: Same hook pattern

**`use-streaming-ai.ts`**
- Core logic: ✅ Reuse
- Changes: None (fetch works in RN)
- React Native: Same hook pattern

**`use-contact-back-navigation.ts`**
- Core logic: ✅ Reuse concept
- Changes: Use React Navigation's `useNavigation()` hook
- React Native: Adapt to React Navigation

**`use-edit-profile-fields.ts`**
- Core logic: ✅ Reuse entirely
- Changes: None
- React Native: Works as-is

**`use-calendar-location-management.ts`**
- Core logic: ✅ Reuse entirely
- Changes: None
- React Native: Works as-is

**`use-drag-and-drop.ts`**
- Core logic: Adapt
- Changes: Use React Native gesture handlers
- React Native: Use `react-native-gesture-handler` + `react-native-reanimated`

**`use-scheduling-pre-fetch.ts`**
- Core logic: ✅ Reuse entirely
- Changes: None
- React Native: Works as-is

#### ❌ Ignore

**`use-pwa-install.ts`**
- No PWA in React Native
- Delete this hook

**Action:** Port hooks with minimal changes, using React Native equivalents for web APIs

---

### Client Libraries (`lib/client/*`)
**Status:** HIGH REUSE with React Native adaptations

#### Auth (`client/auth/`)

**`firebase.ts`**
- Core logic: ✅ Reuse
- Changes: Use `@react-native-firebase/auth` instead of Firebase JS SDK
```typescript
// Web
import { getAuth } from 'firebase/auth';

// React Native
import auth from '@react-native-firebase/auth';
```

**`google-incremental.ts`**
- Core logic: ✅ Reuse concept
- Changes: Use `@react-native-google-signin/google-signin`
```typescript
import { GoogleSignin } from '@react-native-google-signin/google-signin';
```

#### Contacts (`client/contacts/`)

**`messaging.ts`**
- Core logic: ✅ Reuse
- Changes: Use React Native Share API
```typescript
import { Share } from 'react-native';
```

**`vcard.ts`**
- Core logic: ✅ Reuse vCard generation logic
- Changes: Use `react-native-contacts` for contact saving
```typescript
import Contacts from 'react-native-contacts';
```

**`exchange/state.ts`**
- Core logic: ✅ Reuse entirely
- Changes: AsyncStorage instead of localStorage
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
```

**`exchange/service.ts`**
- Core logic: ✅ Reuse entirely
- Changes: None (fetch works in RN)

**`motion.ts`**
- Core logic: Adapt
- Changes: Use `react-native-sensors` or `expo-sensors`
```typescript
import { Accelerometer } from 'react-native-sensors';
// or
import { Accelerometer } from 'expo-sensors';
```

**`url-utils.ts`**
- Core logic: ✅ Reuse entirely
- Changes: None

**`save.ts`**
- Core logic: ✅ Reuse logic
- Changes: Use `react-native-contacts` API instead of vCard download

#### Profile (`client/profile/`)

**All profile files can be largely reused:**
- `firebase-save.ts` ✅ (use RN Firebase)
- `firebase-storage.ts` ✅ (use RN Firebase)
- `image.ts` → Adapt to React Native Image APIs
- `avatar.ts` ✅
- `google-image.ts` ✅
- `utils.ts` ✅
- `transforms.ts` ✅
- `save.ts` ✅
- `filtering.ts` ✅
- `phone-formatter.ts` ✅
- `asset-generation.ts` ✅

#### Calendar (`client/calendar/providers/`)

**`apple.ts`**
- Use `react-native-calendar-events` or `expo-calendar`

**`google.ts`**
- Core logic: ✅ Reuse
- Changes: Use React Native OAuth libraries

**`microsoft.ts`**
- Core logic: ✅ Reuse
- Changes: Use React Native OAuth libraries

**`tokens.ts`**
- Core logic: ✅ Reuse
- Changes: Use `@react-native-async-storage/async-storage` + `react-native-keychain` for secure storage

#### Platform Detection (`client/platform-detection.ts`)

**Adapt for React Native:**
```typescript
import { Platform } from 'react-native';

export const detectPlatform = () => ({
  isIOS: Platform.OS === 'ios',
  isAndroid: Platform.OS === 'android',
  isMobile: true, // Always mobile in RN
  platform: Platform.OS
});
```

**Action:** Keep most client utilities, swap web APIs for React Native equivalents

---

## Category 2: ADAPT FOR REACT NATIVE 🔄

### Next.js Pages → React Native Screens
**Status:** Keep logic, rebuild UI with React Native components
**Rationale:** Same React patterns, different primitives

#### Page Structure Conversion

**Web (Next.js):**
```tsx
// app/page.tsx
export default function HomePage() {
  return (
    <div className="container">
      <h1>Welcome</h1>
      <button onClick={handleClick}>Click</button>
    </div>
  );
}
```

**React Native:**
```tsx
// screens/HomeScreen.tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome</Text>
      <TouchableOpacity onPress={handleClick} style={styles.button}>
        <Text>Click</Text>
      </TouchableOpacity>
    </View>
  );
}
```

#### Screens to Adapt

| Web Page | React Native Screen | Complexity |
|----------|-------------------|------------|
| `/` | `HomeScreen.tsx` | Low |
| `/setup` | `ProfileSetupScreen.tsx` | Medium |
| `/edit` | `EditProfileScreen.tsx` | Medium |
| `/edit/calendar` | `CalendarSettingsScreen.tsx` | Medium |
| `/edit/location` | `LocationSettingsScreen.tsx` | Low |
| `/contact/[userId]` | `ContactScreen.tsx` | High |
| `/contact/[userId]/ai-schedule` | `AIScheduleScreen.tsx` | High |
| `/contact/[userId]/smart-schedule` | `SmartScheduleScreen.tsx` | High |
| `/history` | `HistoryScreen.tsx` | Medium |
| `/privacy` | `PrivacyScreen.tsx` | Low |
| `/terms` | `TermsScreen.tsx` | Low |
| `/debug-logs` | `DebugLogsScreen.tsx` | Low |

**Action:** Keep component logic, replace HTML elements with React Native primitives

---

### React Components → React Native Components
**Status:** Keep logic, adapt primitives and styling
**Rationale:** Same component model, different base components

#### Component Mapping

| Web Component | React Native Component |
|--------------|----------------------|
| `<div>` | `<View>` |
| `<span>`, `<p>`, `<h1>` | `<Text>` |
| `<button>` | `<TouchableOpacity>` or `<Pressable>` |
| `<input>` | `<TextInput>` |
| `<img>` | `<Image>` |
| `<a>` | `<TouchableOpacity>` + navigation |
| `<textarea>` | `<TextInput multiline>` |
| `<select>` | `@react-native-picker/picker` |

#### Components to Adapt

**Buttons** (`components/ui/buttons/`)
```tsx
// Web
const Button = ({ children, onClick, className }) => (
  <button onClick={onClick} className={className}>
    {children}
  </button>
);

// React Native
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

const Button = ({ children, onPress, style }) => (
  <TouchableOpacity onPress={onPress} style={[styles.button, style]}>
    <Text style={styles.text}>{children}</Text>
  </TouchableOpacity>
);
```

**All UI components can be adapted similarly:**
- `Button.tsx` → RN TouchableOpacity ✅
- `ContactButton.tsx` → RN TouchableOpacity ✅
- `ExchangeButton.tsx` → RN TouchableOpacity ✅
- `SecondaryButton.tsx` → RN TouchableOpacity ✅

**Calendar** (`components/ui/calendar/`)
- `SchedulableHoursEditor.tsx` → Use `@react-native-community/datetimepicker`

**Chat** (`components/ui/chat/`)
- `MessageList.tsx` → `<FlatList>` ✅
- `ChatInput.tsx` → `<TextInput>` ✅
- `EventCard.tsx` → `<View>` with styling ✅

**Layout** (`components/ui/layout/`)
- `FieldList.tsx` → `<FlatList>` or `<ScrollView>` ✅
- `LayoutBackground.tsx` → React Native gradient (`expo-linear-gradient`)
- `ParticleNetwork.tsx` → Adapt with `react-native-svg` or Skia
- `PageHeader.tsx` → React Navigation header
- `FieldSection.tsx` → `<View>` ✅
- `ScrollBehavior.tsx` → `<ScrollView>` props ✅

**Modals** (`components/ui/modals/`)
- All modals → `<Modal>` from React Native
- `StandardModal.tsx` → `<Modal>` ✅
- `AddLocationModal.tsx` → `<Modal>` ✅
- `AddCalendarModal.tsx` → `<Modal>` ✅
- `AppleCalendarSetupModal.tsx` → `<Modal>` + native calendar permissions

**Elements** (`components/ui/elements/`)
- `Avatar.tsx` → `<Image>` with circular crop ✅
- `ProfileImageIcon.tsx` → `<Image>` ✅
- `ProfileField.tsx` → `<View>` + `<Text>` ✅
- `SocialIcon.tsx` → `<Image>` or icon library ✅
- `SocialIconsList.tsx` → `<View>` with flexDirection ✅
- `LoadingSpinner.tsx` → `<ActivityIndicator>` ✅

**Inputs** (`components/ui/inputs/`)
- All inputs → `<TextInput>` with variations
- `DropdownSelector.tsx` → `@react-native-picker/picker`
- `DropdownPhoneInput.tsx` → `react-native-phone-number-input`
- `TimePicker.tsx` → `@react-native-community/datetimepicker`
- `ExpandingInput.tsx` → `<TextInput multiline>` ✅
- `ValidatedInput.tsx` → `<TextInput>` with validation ✅
- `NumberInput.tsx` → `<TextInput keyboardType="numeric">` ✅

**Action:** Keep component logic and structure, replace primitives and styling

---

### Styling: CSS → React Native StyleSheet
**Status:** Convert CSS to StyleSheet or styled-components
**Rationale:** Same styling concepts, different syntax

#### Conversion Examples

**Web CSS:**
```css
.container {
  max-width: 448px;
  padding: 20px;
  background: linear-gradient(135deg, #E7FED2 0%, #71E454 100%);
  border-radius: 12px;
}
```

**React Native StyleSheet:**
```tsx
import { StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

const styles = StyleSheet.create({
  container: {
    maxWidth: 448,
    padding: 20,
    borderRadius: 12,
  }
});

// For gradient:
<LinearGradient
  colors={['#E7FED2', '#71E454']}
  start={{ x: 0, y: 0 }}
  end={{ x: 1, y: 1 }}
  style={styles.container}
>
```

**Or use styled-components for React Native:**
```tsx
import styled from 'styled-components/native';

const Container = styled.View`
  max-width: 448px;
  padding: 20px;
  border-radius: 12px;
`;
```

#### Files to Convert

**`app/globals.css`**
- Convert CSS variables to React Native theme object
- Convert base styles to default component styles
- Convert utility classes to StyleSheet utilities

**Theme conversion:**
```typescript
// theme.ts
export const theme = {
  colors: {
    primary: '#71E454',
    primaryDark: '#5CBD3D',
    background: '#000000',
    foreground: '#FFFFFF',
    glassTint: 'rgba(113, 228, 84, 0.3)',
  },
  spacing: {
    sm: 8,
    md: 16,
    lg: 24,
  },
  borderRadius: {
    sm: 6,
    md: 12,
    lg: 18,
    full: 9999,
  },
  maxContentWidth: 448,
};
```

**Action:** Convert CSS to StyleSheet or use styled-components/native

---

### Animations: CSS → React Native Animated
**Status:** Convert CSS keyframes to Animated or Reanimated
**Rationale:** Different animation APIs, same visual effects

#### Animation Library Options

**Option 1: React Native Animated (Built-in)**
```tsx
import { Animated } from 'react-native';

const fadeAnim = useRef(new Animated.Value(0)).current;

Animated.timing(fadeAnim, {
  toValue: 1,
  duration: 300,
  useNativeDriver: true,
}).start();
```

**Option 2: React Native Reanimated (Recommended)**
```tsx
import Animated, { useSharedValue, withSpring } from 'react-native-reanimated';

const scale = useSharedValue(1);
scale.value = withSpring(1.1);
```

#### Animations to Convert (`app/animations.css`)

**Float animation:**
```css
/* Web */
@keyframes float {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}
```

```tsx
// React Native Reanimated
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming
} from 'react-native-reanimated';

const FloatingView = ({ children }) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.03, { duration: 1500 }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};
```

**All animations can be converted:**
- `float` → Reanimated repeat + scale ✅
- `windUp` → Reanimated scale + rotate ✅
- `profileExit` → Reanimated translateY + scale + opacity ✅
- `contactEnter` → Reanimated translateY + scale + opacity ✅
- `fadeBlurOut` → Reanimated opacity (blur not supported natively)
- `modalEnter` → Reanimated scale + opacity with spring ✅
- `buttonFadeOut` → Reanimated scale + opacity ✅

**Note:** React Native doesn't support blur animations like web. Use opacity or scale instead.

**Action:** Convert all CSS animations to React Native Reanimated

---

### Navigation: Next.js Router → React Navigation
**Status:** Replace routing system entirely
**Rationale:** Different navigation paradigms

#### React Navigation Setup

```tsx
// App.tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Contact" component={ContactScreen} />
        {/* More screens... */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

#### Route Mapping

| Web Route | React Navigation Route |
|-----------|----------------------|
| `/` | `Home` screen |
| `/setup` | `ProfileSetup` screen |
| `/edit` | `EditProfile` screen |
| `/contact/[userId]` | `Contact` screen with params |
| `/history` | `History` screen |

**Navigation calls:**
```tsx
// Web
import { useRouter } from 'next/navigation';
const router = useRouter();
router.push('/contact/123');

// React Native
import { useNavigation } from '@react-navigation/native';
const navigation = useNavigation();
navigation.navigate('Contact', { userId: '123' });
```

**Action:** Replace all Next.js routing with React Navigation

---

### Middleware (`middleware.ts`)
**Status:** Adapt to React Navigation guards
**Rationale:** Auth protection needed, different implementation

**Web middleware:**
- Protects routes via Next.js middleware
- Redirects based on auth state

**React Native equivalent:**
```tsx
// AuthNavigator.tsx
const AuthNavigator = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator>
      {user ? (
        // Authenticated screens
        <>
          {!user.phoneNumber ? (
            <Stack.Screen name="Setup" component={ProfileSetupScreen} />
          ) : (
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen name="Profile" component={ProfileScreen} />
              {/* More authenticated screens */}
            </>
          )}
        </>
      ) : (
        // Unauthenticated screens
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
};
```

**Action:** Implement navigation guards in React Navigation structure

---

## Category 3: TOTALLY REBUILD 🔨

### Native Module Integrations

These require React Native native modules (not web APIs):

#### 1. Motion Detection
**Web:** `DeviceMotionEvent` API
**React Native:** `react-native-sensors` or `expo-sensors`

```tsx
import { accelerometer } from 'react-native-sensors';

const subscription = accelerometer.subscribe(({ x, y, z }) => {
  const magnitude = Math.sqrt(x * x + y * y + z * z);
  if (magnitude > THRESHOLD) {
    // Bump detected!
  }
});
```

**Action:** Port `lib/client/contacts/motion.ts` to use native sensors

---

#### 2. Contact Saving
**Web:** vCard download
**React Native:** `react-native-contacts`

```tsx
import Contacts from 'react-native-contacts';

const saveContact = async (profile: UserProfile) => {
  const contact = {
    givenName: profile.firstName,
    familyName: profile.lastName,
    phoneNumbers: [{
      label: 'mobile',
      number: profile.phoneNumber,
    }],
    emailAddresses: [{
      label: 'work',
      email: profile.email,
    }],
  };

  await Contacts.addContact(contact);
};
```

**Action:** Replace vCard download with native contact saving

---

#### 3. Calendar Integration
**Web:** OAuth flows + API calls
**React Native:** `react-native-calendar-events` or `expo-calendar`

```tsx
import * as Calendar from 'expo-calendar';

const createEvent = async (eventDetails) => {
  const { status } = await Calendar.requestCalendarPermissionsAsync();

  if (status === 'granted') {
    const defaultCalendar = await Calendar.getDefaultCalendarAsync();
    await Calendar.createEventAsync(defaultCalendar.id, eventDetails);
  }
};
```

**Action:** Use native calendar modules for iOS Calendar, keep OAuth for Google/Microsoft

---

#### 4. Particle Network Background
**Web:** HTML Canvas
**React Native:** React Native Skia or `react-native-svg`

**Option 1: Skia (Recommended - better performance)**
```tsx
import { Canvas, Circle, Group } from '@shopify/react-native-skia';

const ParticleNetwork = () => {
  return (
    <Canvas style={{ flex: 1 }}>
      <Group>
        {particles.map((particle, i) => (
          <Circle
            key={i}
            cx={particle.x}
            cy={particle.y}
            r={particle.radius}
            color="rgba(113, 228, 84, 0.5)"
          />
        ))}
      </Group>
    </Canvas>
  );
};
```

**Option 2: React Native SVG**
```tsx
import Svg, { Circle, Line } from 'react-native-svg';
```

**Action:** Rebuild with React Native Skia or SVG

---

### Root Layout (`app/layout.tsx`)
**Status:** Rebuild as React Native App component
**Rationale:** Different app structure

**Web:** Next.js root layout with HTML
**React Native:** App.tsx with providers

```tsx
// App.tsx
import { NavigationContainer } from '@react-navigation/native';
import { SessionProvider } from './providers/SessionProvider';
import { ProfileProvider } from './context/ProfileContext';
import { AdminModeProvider } from './providers/AdminModeProvider';

export default function App() {
  return (
    <SessionProvider>
      <ProfileProvider>
        <AdminModeProvider>
          <NavigationContainer>
            {/* Navigation setup */}
          </NavigationContainer>
        </AdminModeProvider>
      </ProfileProvider>
    </SessionProvider>
  );
}
```

**Action:** Create React Native App.tsx with same provider structure

---

## Category 4: IGNORE ❌

### Web-Specific Files
- `app/sitemap.ts` - SEO (web-only)
- `app/error.tsx` - Next.js error boundary (use React Native error boundaries)
- `lib/cn.ts` - Tailwind utility (not needed)
- `lib/hooks/use-pwa-install.ts` - PWA (no PWA in React Native)
- `types/next-pwa.d.ts` - PWA types
- `types/next-auth.d.ts` - NextAuth types (use Firebase Auth)
- `types/css.d.ts` - CSS types
- `public/manifest.json` - PWA manifest
- `public/sw.js`, `public/workbox-*.js` - Service workers
- `public/robots.txt` - SEO

---

## React Native Project Structure

```
nektus/
├── apps/
│   ├── web/                          # Existing Next.js web app
│   └── mobile/                       # New React Native app
│       ├── android/                  # Android native code
│       ├── ios/                      # iOS native code
│       ├── src/
│       │   ├── App.tsx               # Root component
│       │   ├── navigation/
│       │   │   ├── RootNavigator.tsx
│       │   │   ├── AuthNavigator.tsx
│       │   │   └── types.ts
│       │   ├── screens/
│       │   │   ├── Home/
│       │   │   │   └── HomeScreen.tsx
│       │   │   ├── Profile/
│       │   │   │   ├── ProfileScreen.tsx
│       │   │   │   ├── EditProfileScreen.tsx
│       │   │   │   └── ProfileSetupScreen.tsx
│       │   │   ├── Contact/
│       │   │   │   ├── ContactScreen.tsx
│       │   │   │   └── ContactListScreen.tsx
│       │   │   ├── Scheduling/
│       │   │   │   ├── AIScheduleScreen.tsx
│       │   │   │   └── SmartScheduleScreen.tsx
│       │   │   ├── History/
│       │   │   │   └── HistoryScreen.tsx
│       │   │   └── Settings/
│       │   │       ├── CalendarSettingsScreen.tsx
│       │   │       └── LocationSettingsScreen.tsx
│       │   ├── components/
│       │   │   ├── ui/
│       │   │   │   ├── buttons/
│       │   │   │   │   ├── Button.tsx
│       │   │   │   │   ├── ContactButton.tsx
│       │   │   │   │   └── ExchangeButton.tsx
│       │   │   │   ├── inputs/
│       │   │   │   │   ├── TextInput.tsx
│       │   │   │   │   └── PhoneInput.tsx
│       │   │   │   ├── modals/
│       │   │   │   │   └── Modal.tsx
│       │   │   │   └── layout/
│       │   │   │       ├── GradientBackground.tsx
│       │   │   │       └── ParticleNetwork.tsx
│       │   │   └── views/
│       │   │       └── (adapted from web)
│       │   ├── lib/
│       │   │   ├── client/           # REUSE from web with RN adaptations
│       │   │   ├── hooks/            # REUSE from web with RN adaptations
│       │   │   ├── constants.ts      # REUSE from web ✅
│       │   │   └── utils/            # REUSE from web ✅
│       │   ├── context/              # REUSE from web ✅
│       │   │   └── ProfileContext.tsx
│       │   ├── providers/            # ADAPT from web
│       │   │   ├── SessionProvider.tsx
│       │   │   └── AdminModeProvider.tsx
│       │   ├── types/                # REUSE from web ✅
│       │   │   └── (all TypeScript types)
│       │   ├── services/
│       │   │   ├── api/
│       │   │   │   └── client.ts     # HTTP client (fetch)
│       │   │   ├── firebase/
│       │   │   │   ├── auth.ts       # RN Firebase Auth
│       │   │   │   └── storage.ts    # RN Firebase Storage
│       │   │   ├── native/
│       │   │   │   ├── contacts.ts   # react-native-contacts
│       │   │   │   ├── calendar.ts   # react-native-calendar-events
│       │   │   │   └── sensors.ts    # react-native-sensors
│       │   │   └── storage/
│       │   │       └── async-storage.ts
│       │   ├── theme/
│       │   │   ├── colors.ts
│       │   │   ├── spacing.ts
│       │   │   ├── typography.ts
│       │   │   └── animations.ts
│       │   └── utils/
│       │       └── (shared utilities)
│       ├── assets/
│       │   ├── images/
│       │   ├── fonts/
│       │   └── animations/
│       ├── package.json
│       ├── metro.config.js
│       ├── babel.config.js
│       └── tsconfig.json
├── shared-assets/                    # Images, logos (from web public/)
└── docs/
    └── specs/                        # Moved from apps/web/specs
```

---

## Key React Native Packages

### Required Packages

```json
{
  "dependencies": {
    "react": "^18.x",
    "react-native": "^0.73.x",

    // Navigation
    "@react-navigation/native": "^6.x",
    "@react-navigation/native-stack": "^6.x",
    "@react-navigation/bottom-tabs": "^6.x",

    // Firebase
    "@react-native-firebase/app": "^19.x",
    "@react-native-firebase/auth": "^19.x",
    "@react-native-firebase/firestore": "^19.x",
    "@react-native-firebase/storage": "^19.x",

    // Google Sign-In
    "@react-native-google-signin/google-signin": "^11.x",

    // Native Modules
    "react-native-contacts": "^7.x",
    "react-native-calendar-events": "^2.x",
    "react-native-sensors": "^7.x",
    "@react-native-community/datetimepicker": "^7.x",
    "@react-native-picker/picker": "^2.x",
    "@react-native-async-storage/async-storage": "^1.x",
    "react-native-keychain": "^8.x",

    // UI & Animation
    "react-native-reanimated": "^3.x",
    "react-native-gesture-handler": "^2.x",
    "react-native-linear-gradient": "^2.x",
    "@shopify/react-native-skia": "^0.1.x",
    "react-native-svg": "^14.x",

    // Utilities
    "react-native-phone-number-input": "^2.x",
    "react-native-share": "^10.x"
  }
}
```

---

## Code Reuse Breakdown

### High Reuse (70%+ code reuse)

| Category | Web LOC | RN LOC | Reuse % |
|----------|---------|--------|---------|
| **API Routes** | 3,000 | 0 (calls endpoints) | 100% (unchanged) |
| **Server Logic** | 5,000 | 0 (calls endpoints) | 100% (unchanged) |
| **Types** | 500 | 500 | 100% (copy as-is) |
| **Constants** | 100 | 100 | 100% (copy as-is) |
| **Business Logic** | 2,000 | 2,000 | 90% (minor adaptations) |
| **Hooks** | 400 | 350 | 85% (minor adaptations) |
| **Context/Providers** | 300 | 280 | 90% (minor adaptations) |
| **Component Logic** | 3,000 | 2,800 | 80% (primitives change) |
| **Styling** | 2,000 | 2,500 | 0% (rebuild as StyleSheet) |
| **Animations** | 300 | 400 | 0% (rebuild with Reanimated) |
| **Navigation** | 200 | 300 | 0% (rebuild with React Navigation) |

**Total:** ~16,800 LOC (web) → ~9,230 LOC (RN)
**Code Reuse:** ~70% of business logic and components

---

## Migration Phases

### Phase 1: Project Setup (1 week)
- [ ] Initialize React Native project (`npx react-native init`)
- [ ] Set up TypeScript
- [ ] Configure Metro bundler
- [ ] Install core dependencies (navigation, Firebase, etc.)
- [ ] Set up folder structure

### Phase 2: Shared Code Migration (1 week)
- [ ] Copy `types/` directory → `src/types/` ✅
- [ ] Copy `lib/constants.ts` → `src/lib/constants.ts` ✅
- [ ] Copy `lib/hooks/` → `src/lib/hooks/` (adapt storage)
- [ ] Copy `context/` → `src/context/` ✅
- [ ] Copy `providers/` → `src/providers/` (adapt for RN)

### Phase 3: Services & API (1 week)
- [ ] Create API client (fetch wrapper)
- [ ] Set up React Native Firebase
- [ ] Configure Google Sign-In
- [ ] Port `lib/client/auth/` to RN Firebase
- [ ] Port `lib/client/profile/` (adapt image APIs)
- [ ] Port `lib/client/contacts/` (adapt native modules)

### Phase 4: Navigation & Auth (1 week)
- [ ] Set up React Navigation
- [ ] Create navigation types
- [ ] Implement auth flow screens (Login, Signup)
- [ ] Add auth guards (navigation protection)
- [ ] Implement deep linking

### Phase 5: Core Screens (2 weeks)
- [ ] HomeScreen (adapt from HomePage.tsx)
- [ ] ProfileScreen (adapt from ProfileView.tsx)
- [ ] EditProfileScreen (adapt from EditProfileView.tsx)
- [ ] ProfileSetupScreen (adapt from ProfileSetupView.tsx)
- [ ] ContactScreen (adapt from ContactView.tsx)

### Phase 6: UI Components (2 weeks)
- [ ] Buttons (TouchableOpacity components)
- [ ] Inputs (TextInput components)
- [ ] Modals (Modal components)
- [ ] Cards and layouts
- [ ] Loading states (ActivityIndicator)

### Phase 7: Native Integrations (2 weeks)
- [ ] Motion detection (react-native-sensors)
- [ ] Contact saving (react-native-contacts)
- [ ] Calendar integration (react-native-calendar-events)
- [ ] Location services (react-native-geolocation)
- [ ] Share functionality (react-native-share)

### Phase 8: Scheduling Features (2 weeks)
- [ ] AIScheduleScreen (adapt chat UI)
- [ ] SmartScheduleScreen
- [ ] Calendar settings
- [ ] Time slot pickers
- [ ] Streaming AI integration

### Phase 9: Styling & Animations (2 weeks)
- [ ] Convert CSS to StyleSheet
- [ ] Set up theme system
- [ ] Implement Reanimated animations
- [ ] Gradient backgrounds (LinearGradient)
- [ ] Particle network (Skia)
- [ ] Modal animations

### Phase 10: Testing & Polish (2 weeks)
- [ ] Unit tests for business logic
- [ ] Integration tests for screens
- [ ] E2E tests (Detox or Appium)
- [ ] Performance optimization
- [ ] Accessibility (a11y)
- [ ] Error handling

### Phase 11: iOS-Specific (1 week)
- [ ] App icons and launch screen
- [ ] iOS permissions (camera, contacts, calendar, location)
- [ ] Push notifications setup (APNs)
- [ ] iOS-specific UI polish
- [ ] TestFlight setup

### Phase 12: Android (Optional - 1 week)
- [ ] Android permissions
- [ ] Android-specific UI adjustments
- [ ] Google Play Store setup

**Total Time:** 16-18 weeks (iOS only)

---

## React Native vs Native Swift

| Aspect | React Native | Native Swift |
|--------|-------------|--------------|
| **Code Reuse from Web** | 70% | 20% |
| **Development Speed** | Fast (shared React knowledge) | Slower (new language/framework) |
| **Performance** | Good (near-native) | Excellent (truly native) |
| **Team Skillset** | Use existing React/TS skills | Learn Swift/SwiftUI |
| **Cross-Platform** | iOS + Android with same code | iOS only |
| **Community** | Large React Native ecosystem | Native iOS APIs |
| **App Size** | Larger (JS runtime) | Smaller |
| **Updates** | Over-the-air updates possible | App Store only |

**Recommendation:** React Native is the clear choice given:
1. You already have a React web app (70% code reuse!)
2. Your team knows React and TypeScript
3. Faster time to market
4. Potential for Android expansion later

---

## Critical Differences: Web vs React Native

### 1. Storage
```typescript
// Web
localStorage.setItem('key', 'value');

// React Native
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.setItem('key', 'value');
```

### 2. Images
```tsx
// Web
<img src="/images/avatar.png" alt="Avatar" />

// React Native
import { Image } from 'react-native';
<Image source={require('./images/avatar.png')} />
// or remote:
<Image source={{ uri: 'https://example.com/avatar.png' }} />
```

### 3. Fonts
```typescript
// Web (CSS)
font-family: 'Inter', sans-serif;

// React Native
// 1. Add fonts to assets/fonts/
// 2. Link in react-native.config.js
// 3. Use:
fontFamily: 'Inter-Regular'
```

### 4. Environment Variables
```typescript
// Web
process.env.NEXT_PUBLIC_API_URL

// React Native
import Config from 'react-native-config';
Config.API_URL
```

### 5. Navigation
```typescript
// Web
import { useRouter } from 'next/navigation';
const router = useRouter();
router.push('/profile');

// React Native
import { useNavigation } from '@react-navigation/native';
const navigation = useNavigation();
navigation.navigate('Profile');
```

---

## Shared Resources

### `public/` Directory
**Action:** Move relevant assets to React Native

```
apps/mobile/assets/
  images/
    default-background.png     # from public/DefaultBackgroundImage.png
    logo.svg                   # from public/nektus-logo.svg
  fonts/
    Inter-Regular.ttf
    Inter-Bold.ttf
```

**Leave in `apps/web/public/`:**
- PWA files (manifest.json, sw.js, workbox.js)
- robots.txt
- favicon files (web-only)

### `specs/` Directory
**Action:** Move to `nektus/docs/specs/` ✅
- Platform-agnostic specs useful for React Native development

---

## Conclusion

### React Native Benefits

1. ✅ **70% code reuse** from web app (vs 20% for native Swift)
2. ✅ **Same language** (TypeScript) and framework (React)
3. ✅ **Faster development** - leverage existing React knowledge
4. ✅ **Cross-platform** potential (add Android later)
5. ✅ **Shared business logic** - all types, hooks, utilities
6. ✅ **Unified API** - both apps call same backend
7. ✅ **Hot reload** - faster iteration during development

### Migration Summary

| Category | Files | Status |
|----------|-------|--------|
| **Reuse Exactly** | API routes, server logic, types, constants | Copy as-is ✅ |
| **High Reuse** | Hooks, context, business logic | Minor RN adaptations |
| **Medium Reuse** | Components, screens | Same logic, different primitives |
| **Low Reuse** | Styling, animations | Rebuild with StyleSheet/Reanimated |
| **Rebuild** | Navigation, native modules | Use RN libraries |

### Recommended Approach

1. **Start with shared code** - Copy types, constants, hooks
2. **Set up navigation** - React Navigation first
3. **Build core screens** - Home, Profile, Contact (reuse logic)
4. **Add native modules** - Sensors, Contacts, Calendar
5. **Polish UI/UX** - Styling and animations last
6. **Test & iterate** - Use iOS simulator, then real device

React Native gives you the best of both worlds: **fast development with high code reuse**, while still providing **native-quality user experience**.

---

**Generated:** December 29, 2025
**For:** Nekt React Native Migration
**Platform:** React Native (iOS primary, Android future)

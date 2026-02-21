# CalConnect → Nekt Merge Specification

## Overview
This specification outlines the integration of CalConnect's calendar and location features into the Nekt application. The merge introduces smart scheduling capabilities while maintaining Nekt's core contact exchange experience and design system.

**Core Features Being Integrated:**
- Calendar integration (Google, Microsoft, Apple)
- Location management with validation
- Smart Schedule page with instant availability
- AI-powered scheduling chat
- Meeting place suggestions

**Design Principles:**
- Maintain Nekt's existing UX patterns and component library
- Reuse type definitions where possible
- Minimize code duplication
- Adapt CalConnect UI to Nekt's visual design system

---

## 1. Authentication & Onboarding Changes

### 1.1 Sign Up / Sign In Flow

**Current Behavior (to be changed):**
- After Google OAuth, automatically runs bio & social link generation
- Generates profile image from Google profile

**New Behavior:**
- Google OAuth sign-in remains the same (using existing NextAuth + Firebase dual auth)
- **Skip AI generation on sign-in**: Do not run `BioAndSocialGenerationService` automatically
- **Placeholder bio**: Set bio to `"My bio is going to be awesome once I create it."`
- **Profile image**: Generate immediately using user's initials instead of waiting for AI

### 1.2 Initials-Based Profile Image

**Implementation:**
- Create new utility function: `generateInitialsImage(name: string): string`
- Extract first letter of first name and first letter of last name
- Generate canvas-based image or SVG with:
  - Background: Gradient (same as Nekt brand colors)
  - Text: White, bold, centered initials, playful font
  - Size: 400x400px for consistency with existing profile images
- Store in Firebase Storage at `/profile-images/{userId}/initials.png`

**File Location:** `/src/lib/utils/imageGeneration.ts`

### 1.3 First Link Prompt Banner

**Trigger Logic:**
- Show 2-3 seconds after 1st load of Profile View (delayed, less aggressive)

**Banner Design (if banner approach chosen):**
- Position: Top of screen, below status bar
- Background: `bg-theme-light/90 backdrop-blur-sm` (translucent Nekt green)
- Layout: Horizontal flex with icon, text, CTA button
- Text: `"Make your first Nekt great!"`
- CTA Button: Secondary CTA style, text: `"Add Link"`
- Dismissible: X button on right (stores dismissal in localStorage)

**Banner Component:**
```typescript
// /src/app/components/ui/Banner.tsx
interface BannerProps {
  icon: ReactNode;
  text: string;
  ctaText: string;
  onCtaClick: () => void;
  onDismiss: () => void;
  variant?: 'default' | 'admin';  // default = green, admin = red
}

// Variants:
// - default: bg-theme-light/90 with secondary CTA (default styling)
// - admin: bg-red-500/90 with red secondary CTA
```

**Usage:**
```typescript
// First Link Banner
<Banner
  icon={<LinkIcon />}
  text="Make your first Nekt great!"
  ctaText="Add Link"
  onCtaClick={handleAddLink}
  onDismiss={handleDismiss}
  variant="default"
/>

// Admin Banner (for future admin mode standardization)
<Banner
  icon={<AdminIcon />}
  text="Admin action required"
  ctaText="Review"
  onCtaClick={handleAdminAction}
  onDismiss={handleDismiss}
  variant="admin"
/>
```

**Action:** Tapping "Add Link" opens the new "Add Link" modal (defined in Section 3.5)

### 1.4 Phone and Email Initial Save

**Behavior:**
- When user completes profile setup, phone and email are saved **twice**:
  - Once to `section: 'personal'`
  - Once to `section: 'work'`
  - **Not** saved to `section: 'universal'` initially
- This allows users to customize them separately later
- Both entries start with same `value` but can diverge

**Implementation:**
```typescript
// During profile creation in ServerProfileService.getOrCreateProfile()
const contactEntries: ContactEntry[] = [
  { fieldType: 'phone', value: phone, section: 'personal', order: 0, isVisible: true, confirmed: true },
  { fieldType: 'phone', value: phone, section: 'work', order: 0, isVisible: true, confirmed: true },
  { fieldType: 'email', value: email, section: 'personal', order: 1, isVisible: true, confirmed: true },
  { fieldType: 'email', value: email, section: 'work', order: 1, isVisible: true, confirmed: true },
];
```

---

## 2. Profile View Changes

### 2.1 Location Display

**New Element:** Display city and location icon below name, above bio

**Location Source Priority:**
1. **Live location**: If user has granted browser location permission and live location is available, always show live location (on both Personal and Work views)
2. **Profile view location**: If no live location, show location that matches current profile view (Personal or Work)
3. **No location**: If neither live location nor view-specific location exists, hide this element entirely

**Important Notes:**
- **No universal location concept**: Locations are only saved to Personal view, Work view, or both views
- Live location takes precedence over saved profile locations
- When live location is saved, it defaults to saving to **both** Personal and Work views

**Design:**
- Icon: Location pin icon (similar to CalConnect styling)
- Icon size: `w-4 h-4`
- Icon color: White with slight transparency (`text-white/80`)
- Text: `{city}, {region}` format (e.g., "San Francisco, California")
- Text style: `Text` component with `variant="small"` from Nekt typography
- Layout: Flex row, centered, with gap-1
- Positioning: Between name and bio in ProfileInfo component

**Implementation:**
```typescript
// In ProfileInfo component (/src/app/components/ui/ProfileInfo.tsx)
const getLocationForView = async (
  locations: UserLocation[],
  currentView: 'personal' | 'work'
): Promise<{ city: string; region: string } | null> => {
  // 1. Try live location (highest priority)
  if (navigator.geolocation && navigator.permissions) {
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      if (permission.state === 'granted') {
        const liveLocation = await getLiveLocation(); // Get current position
        if (liveLocation) return liveLocation; // { city, region } from reverse geocoding
      }
    } catch (error) {
      // Continue to saved locations if live location fails
    }
  }

  // 2. Try view-specific saved location
  const viewLocation = locations.find(loc => loc.section === currentView);
  if (viewLocation) {
    return { city: viewLocation.city, region: viewLocation.region };
  }

  // 3. No location available
  return null;
};

// Render
{location && (
  <div className="flex items-center justify-center gap-1 mt-2 mb-1">
    <LocationPinIcon className="w-4 h-4 text-white/80" />
    <Text variant="small" className="text-white/90">
      {location.city}, {location.region}
    </Text>
  </div>
)}
```

**File Changes:**
- `/src/app/components/ui/ProfileInfo.tsx` - Add location display
- `/src/types/profile.ts` - Import `UserLocation` type from CalConnect

---

## 3. Edit Profile Page Changes

### 3.1 Overview of Changes

The Edit Profile page undergoes substantial restructuring to support calendar and location management. The page now has:

1. **Universal Section**: Only Name and Bio (no other universal fields)
2. **Personal/Work Sections**: Each with Calendar, Location, and draggable fields
3. **Hidden Section**: Only shows fields that have been hidden (empty by default)
4. **No Blank Fields**: Hidden section doesn't show blank/empty fields
5. **Drag & Drop**: Limited to fields within Personal/Work sections only

### 3.2 Calendar Management

#### 3.2.1 Calendar Data Model

**Type Definition:** Adapt CalConnect's `Calendar` type for Nekt

```typescript
// /src/types/profile.ts (add to existing file)
interface Calendar {
  id: string;
  userId: string;
  provider: 'google' | 'microsoft' | 'apple';
  email: string;
  section: 'personal' | 'work';  // Note: Calendar only supports personal/work, no universal (uses FieldSection naming)
  schedulableHours: SchedulableHours;

  // OAuth tokens (encrypted in Firestore)
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: number;

  // Apple CalDAV
  applePassword?: string;  // App-specific password, encrypted

  // Microsoft
  selectedCalendarIds?: string[];

  connectionStatus?: 'connecting' | 'connected' | 'failed';
  lastSyncError?: string;

  createdAt: number;
  updatedAt: number;
}

interface SchedulableHours {
  monday: TimeSlot[];
  tuesday: TimeSlot[];
  wednesday: TimeSlot[];
  thursday: TimeSlot[];
  friday: TimeSlot[];
  saturday: TimeSlot[];
  sunday: TimeSlot[];
}

interface TimeSlot {
  start: string;  // "09:00" 24-hour format
  end: string;    // "17:00" 24-hour format
}

// Add to UserProfile interface
interface UserProfile {
  // ... existing fields ...
  calendars?: Calendar[];  // Max 2: one personal, one work
  locations?: UserLocation[];  // Max 2: one personal, one work (or 1 universal)
}
```

#### 3.2.2 Calendar UI in Edit Profile

**Position:** Top of Personal and Work sections, above Location

**Display States:**

**State 1: No Calendar Added**
```typescript
<Button
  variant="white"
  onClick={() => setShowAddCalendarModal(true)}
  className="w-full"
>
  Add Calendar
</Button>
```

**State 2: Calendar Added**
- Use generalized version of `HistoryContactItem` component (rename to `ItemChip` component)
- **Icon**: Google/Microsoft/Apple logo (colored SVG, 8x8 size from CalConnect)
- **Title**: "Google Calendar" / "Microsoft Calendar" / "Apple Calendar"
- **Subtitle**: Calendar email (e.g., "alex@gmail.com")
- **Action Button**: Delete icon (trash icon from Nekt icon set)
- **Tap Behavior**: Navigate to `/edit-profile/calendar` page

**Component Structure:**
```typescript
// /src/app/components/ui/ItemChip.tsx (generalize from HistoryContactItem)
interface ItemChipProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  actionButton?: ReactNode;  // Optional - omit for variant without action button
  onClick?: () => void;
  className?: string;
  truncateTitle?: boolean;   // Enable text truncation with ellipsis (for suggestion chips)
}

// Layout:
// - Horizontal flex container
// - Left: icon (fixed width)
// - Center: title + subtitle (flex-1, truncate if enabled)
// - Right: action button (optional, fixed width)

// Usage in Edit Profile (with action button)
<ItemChip
  icon={<GoogleCalendarIcon className="w-8 h-8" />}
  title="Google Calendar"
  subtitle={calendar.email}
  actionButton={
    <IconButton
      icon={<TrashIcon />}
      onClick={handleDeleteCalendar}
      variant="ghost"
    />
  }
  onClick={() => router.push('/edit-profile/calendar')}
/>

// Usage in Smart Schedule (without action button, with truncation)
<ItemChip
  icon={<CoffeeIcon className="w-8 h-8" />}
  title="Coffee at Blue Bottle Coffee - Downtown Location"
  subtitle="123 Main St, 0.5 mi away"
  onClick={handleSchedule}
  truncateTitle={true}
/>
```

#### 3.2.3 Add Calendar Modal

**Modal Component:** Use existing `StandardModal` component from Nekt

**Title:** "Add Calendar"

**Content:** 3 Buttons (adapted from CalConnect's `CalendarProviderButtons` component)

```typescript
// /src/app/components/ui/modals/AddCalendarModal.tsx
interface AddCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: 'personal' | 'work';
  onCalendarAdded: (calendar: Calendar) => void;
}

// Modal content:
<div className="space-y-3">
  <Button
    variant="white"
    className="w-full flex items-center gap-3"
    onClick={handleGoogleOAuth}
  >
    <GoogleCalendarIcon className="w-6 h-6" />
    <span>Google Calendar</span>
  </Button>

  <Button
    variant="white"
    className="w-full flex items-center gap-3"
    onClick={handleMicrosoftOAuth}
  >
    <MicrosoftCalendarIcon className="w-6 h-6" />
    <span>Microsoft Calendar</span>
  </Button>

  <Button
    variant="white"
    className="w-full flex items-center gap-3"
    onClick={() => setShowAppleSetup(true)}
  >
    <AppleCalendarIcon className="w-6 h-6" />
    <span>Apple Calendar</span>
  </Button>
</div>
```

**OAuth Flow:**
- Google: Initiate OAuth via `/api/auth/google-calendar/authorize`
- Microsoft: Initiate OAuth via `/api/auth/microsoft-calendar/authorize`
- Apple: Show manual setup modal (Apple ID + app-specific password), based off CalConnect

**Calendar Duplication Logic:**
- If both Personal and Work have **no calendar**, auto-add to both profiles
- If one profile already has a calendar, only add to the selected profile

#### 3.2.4 Edit Calendar Page

**Route:** `/edit-profile/calendar`

**Page Component:** `/src/app/edit-profile/calendar/page.tsx`

**Title:** "Edit Calendar" (in top bar)

**Layout:**

```typescript
<PageContainer>
  <TopBar title="Edit Calendar" backButton />

  <div className="p-6 space-y-6">
    {/* Calendar Info */}
    <div className="flex items-center gap-3">
      <CalendarIcon /> {/* Google/Microsoft/Apple icon */}
      <div>
        <Text className="font-medium">{calendar.provider} Calendar</Text>
        <Text variant="small" className="text-white/60">{calendar.email}</Text>
      </div>
    </div>

    {/* Schedulable Hours Section */}
    <SchedulableHoursEditor
      schedulableHours={calendar.schedulableHours}
      onChange={handleSchedulableHoursChange}
    />

    {/* Actions */}
    <div className="space-y-3 pt-4">
      <Button
        variant="theme"
        className="w-full"
        onClick={handleSave}
        disabled={isSaving}
      >
        Save
      </Button>

      <SecondaryButton
        variant="dark"
        className="w-full text-red-500"
        onClick={handleDelete}
      >
        Delete Calendar
      </SecondaryButton>
    </div>
  </div>
</PageContainer>
```

**SchedulableHoursEditor Component:**

Adapt from CalConnect's `CalendarItem` expanded state UI.

```typescript
// /src/app/components/ui/calendar/SchedulableHoursEditor.tsx
interface SchedulableHoursEditorProps {
  schedulableHours: SchedulableHours;
  onChange: (hours: SchedulableHours) => void;
}

// UI: List of days (Mon-Sun) with expandable time slots
// Each day:
// - Day name button (tap to expand/collapse)
// - When expanded: list of time slots with start/end pickers
// - "Add Time Slot" button
// - Delete button per time slot
```

**Time Picker Component:**

Reuse CalConnect's `TimePicker` component, adapted to Nekt styling.

```typescript
// /src/app/components/ui/inputs/TimePicker.tsx
interface TimePickerProps {
  value: string;  // "09:00" format
  onChange: (time: string) => void;
  placeholder?: string;
}

// Features:
// - 12-hour display, 24-hour storage
// - Hour/minute inputs
// - AM/PM toggle
// - Nekt styling (white background, rounded)
```

**Delete Calendar Behavior:**
- Show confirmation modal: "Are you sure you want to delete this calendar?"
- On confirm:
  - If calendar exists in other profile (Personal/Work), only delete from current profile (in cache, Firestore etc.)
  - Else, also disconnect OAuth tokens (revoke if possible)
  - Navigate back to Edit Profile page (if not already there)

### 3.3 Location Management

#### 3.3.1 Location Data Model

**Type Definition:** Adapt CalConnect's `UserLocation` type for Nekt

```typescript
// /src/types/profile.ts (add to existing file)
interface UserLocation {
  id: string;
  userId: string;

  // Address fields
  address?: string;      // Street address
  city: string;          // Required
  region: string;        // State/Province - Required
  zip?: string;          // Postal code
  country: string;       // Required (USA, Canada, Australia only)

  // Coordinates (from Radar validation)
  coordinates?: {
    lat: number;
    lng: number;
  };

  section: 'personal' | 'work';  // Note: Location only supports personal/work, no universal (uses FieldSection naming)

  // Validation status
  validated?: boolean;
  radarPlaceId?: string;

  createdAt: number;
  updatedAt: number;
}
```

#### 3.3.2 Location UI in Edit Profile

**Position:** Below Calendar, above draggable fields in Personal/Work sections

**Display States:**

**State 1: No Location Added**
```typescript
<Button
  variant="white"
  onClick={handleAddLocation}
  className="w-full"
>
  Add Location
</Button>
```

**State 2: Location Added**
- Use `ItemChip` component (same as Calendar)
- **Icon**: Location pin icon with gradient background (adapt CalConnect styling)
- **Title**: City (e.g., "San Francisco")
- **Subtitle**: Street address (e.g., "123 Main St")
- **Action Button**: Delete icon
- **Tap Behavior**: Navigate to `/edit-profile/location` page

```typescript
<ItemChip
  icon={
    <div className="w-8 h-8 rounded-lg gradient-icon flex items-center justify-center">
      <LocationPinIcon className="w-5 h-5 text-white" />
    </div>
  }
  title={location.city}
  subtitle={location.address}
  actionButton={
    <IconButton
      icon={<TrashIcon />}
      onClick={handleDeleteLocation}
      variant="ghost"
    />
  }
  onClick={() => router.push('/edit-profile/location')}
/>
```

#### 3.3.3 Add Location Modal

**Modal Component:** Use `StandardModal` variant

**Title:** "Add Location"

**Trigger:** Tapping "Add Location" button initiates browser location permission request (if not already granted)

**Content:**

```typescript
// /src/app/components/ui/modals/AddLocationModal.tsx
interface AddLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: 'personal' | 'work';
  otherProfileType: 'personal' | 'work';
  onLocationAdded: (location: UserLocation) => void;
}

// Modal content:
<div className="space-y-4">
  {/* Address Fields (from CalConnect) */}
  <CustomInput
    icon={<LocationIcon />}
    value={address}
    onChange={setAddress}
    placeholder="Street Address"
  />

  <CustomInput
    icon={<CityIcon />}
    value={city}
    onChange={setCity}
    placeholder="City"
    required
  />

  <CustomInput
    icon={<ZipIcon />}
    value={zip}
    onChange={setZip}
    placeholder="Zip/Postal Code"
  />

  <CustomInput
    icon={<RegionIcon />}
    value={region}
    onChange={setRegion}
    placeholder="State/Region"
    required
  />

  <CustomInput
    icon={<CountryIcon />}
    value={country}
    onChange={setCountry}
    placeholder="Country"
    required
  />

  {/* Duplicate to Other Profile Toggle */}
  <div className="flex items-center justify-between">
    <Label>Use location for {otherProfileType} too</Label>
    <Toggle
      checked={duplicateToOther}
      onChange={setDuplicateToOther}
    />
  </div>

  {/* Validation Errors */}
  {validationError && (
    <Text variant="small" className="text-red-500">
      {validationError}
    </Text>
  )}

  {/* Save Button */}
  <Button
    variant="theme"
    className="w-full"
    onClick={handleSave}
    disabled={isSaving}
  >
    {isSaving ? 'Validating...' : 'Save'}
  </Button>
</div>
```

**Auto-fill from Browser Location:**
- On modal open, if browser location permission granted, call `navigator.geolocation.getCurrentPosition()`
- Use Radar reverse geocoding API: `/api/location/reverse-geocode`
- Auto-populate address fields
- User can still edit before saving
- **Default behavior for live location**: When saving live location, toggle defaults to ON (saves to both Personal and Work)

**Validation Flow:**
1. User fills in address fields (or accepts auto-filled live location)
2. Taps "Save"
3. Client-side validation (format checks, required fields)
4. Server-side Radar validation via `/api/location/validate`
5. If validation fails or confidence low, show suggestion modal
6. If validation succeeds, save to Firestore and close modal

**Duplicate Location Logic:**
- If toggle is ON (default for live location): Save location to both Personal and Work profile types
- If toggle is OFF: Only save to current section (Personal or Work)
- If saving to both, create two separate `UserLocation` entries with different `section` values
- User can manually edit either location later without affecting the other

#### 3.3.4 Edit Location Page

**Route:** `/edit-profile/location`

**Page Component:** `/src/app/edit-profile/location/page.tsx`

**Title:** "Edit Location"

**Layout:** Same as Add Location modal, but full-page instead of modal (and without the toggle)

```typescript
<PageContainer>
  <TopBar title="Edit Location" backButton />

  <div className="p-6 space-y-4">
    {/* Same address fields as modal */}
    {/* Same validation logic */}
    {/* Same save/delete buttons as Edit Calendar page */}
  </div>
</PageContainer>
```

**Delete Location Behavior:**
- Show confirmation modal
- On confirm: Delete location from Firestore
- If location exists in other profile (Personal/Work), only delete from current profile
- Navigate back to Edit Profile page

### 3.4 Draggable Fields Section

#### 3.4.1 Field Organization Changes

**Universal Section:**
- **Only contains:** Name, Bio
- No other fields in Universal
- No drag-drop in Universal section

**Personal/Work Sections:**
- **Top (Fixed):** Calendar, Location (if added)
- **Middle (Draggable):** Phone, Email, Social Links, Custom Links
- **Default Order:** Phone at top, Email below it
- **New Fields:** Appended to bottom of list

**Drag & Drop Scope:**
- Drag & drop **only** within the draggable fields portion
- Cannot drag Calendar or Location
- Cannot drag to/from Universal section
- Can reorder within Personal or Work sections
- This simplifies code by removing cross-section drag logic

#### 3.4.2 Field Types

**Type 1: Existing Input Fields**
- Phone: `CustomPhoneInput`
- Email: `CustomInput` with email validation
- Social fields: Use existing social input components

**Type 2: New Link Input**
- New component: `CustomExpandingLinkInput`
- Features:
  - Left icon: External link icon (tappable to open URL)
  - Text field: Auto-expanding like `CustomExpandingInput`
  - Right icon: Hide/show toggle (dual state like `CustomInput`)
  - Supports multi-line text (typically 2 lines for long URLs)

**Component:**
```typescript
// /src/app/components/ui/inputs/CustomExpandingLinkInput.tsx
interface CustomExpandingLinkInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isHidden?: boolean;
  onToggleHide?: () => void;
  onOpenLink?: () => void;
}

// Features:
// - Auto-resize textarea (max 200px height like CustomExpandingInput)
// - Left icon: External link icon (opens URL in new tab)
// - Right icon: Eye icon for hide/show toggle
// - Rounded pill design (same as other CustomInputs)
// - Icons vertically centered even when expanded
```

### 3.5 Add Link Modal

#### 3.5.1 Modal Structure

**Trigger:** Tapping "Add Link" button at bottom of Personal/Work draggable fields

**Component:** `/src/app/components/ui/modals/AddLinkModal.tsx`

**Title:** "Add Link"

**Content:**

```typescript
interface AddLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: 'personal' | 'work';
  onLinkAdded: (entry: ContactEntry) => void;
}

// Modal content:
<div className="space-y-4">
  {/* Option 1: Social Link */}
  <div className="space-y-2">
    <Label>Add Social Link</Label>
    <CustomSocialInputAdd
      onSave={handleSaveSocial}
    />
  </div>

  {/* Divider */}
  <div className="flex items-center gap-2">
    <div className="flex-1 h-px bg-white/20" />
    <Text variant="small" className="text-white/60">or</Text>
    <div className="flex-1 h-px bg-white/20" />
  </div>

  {/* Option 2: Custom Link */}
  <div className="space-y-2">
    <Label>Add Custom Link</Label>
    <CustomExpandingInput
      value={customLinkUrl}
      onChange={setCustomLinkUrl}
      placeholder="https://example.com"
    />
  </div>

  {/* Duplicate to Other Profile Toggle */}
  <div className="flex items-center justify-between">
    <Label>Add to {otherProfileType} too</Label>
    <Toggle
      checked={duplicateToOther}
      onChange={setDuplicateToOther}
    />
  </div>

  {/* Save Button */}
  <Button
    variant="theme"
    className="w-full"
    onClick={handleSave}
    disabled={!isValid}
  >
    Save
  </Button>
</div>
```

#### 3.5.2 General Dropdown Selector Component

**Component:** `/src/app/components/ui/inputs/DropdownSelector.tsx`

**Purpose:** Reusable dropdown selector based on the country selector in `CustomPhoneInput`. Used for social network selection, country selection, and any other dropdown needs.

**Interface:**
```typescript
export interface DropdownOption {
  label: string;              // Display name (e.g., "United States", "Instagram")
  value: string;              // Value/code (e.g., "US", "instagram")
  icon?: string | ReactNode;  // Optional icon - emoji string (e.g., "🇺🇸") OR React component (e.g., <FacebookIcon />)
  metadata?: any;             // Optional additional data (e.g., dialCode for countries)
}

interface DropdownSelectorProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showSearch?: boolean;  // Optional search/filter for long lists
}
```

**Implementation (based on CustomPhoneInput country selector):**
```typescript
// /src/app/components/ui/inputs/DropdownSelector.tsx
const DropdownSelector: React.FC<DropdownSelectorProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className = '',
  showSearch = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  const filteredOptions = showSearch
    ? options.filter(opt =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to render icon (string emoji or React component)
  const renderIcon = (icon: string | ReactNode) => {
    if (typeof icon === 'string') {
      return <span className="mr-2">{icon}</span>;
    }
    return <span className="mr-2 flex items-center">{icon}</span>;
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Selector Button (based on CustomPhoneInput country button) */}
      <button
        type="button"
        className="flex items-center justify-between px-4 text-black h-full focus:outline-none rounded-full text-base bg-transparent"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedOption.icon && renderIcon(selectedOption.icon)}
        <span className="mr-2">{selectedOption.label}</span>
        <div className="flex flex-col text-primary">
          <FaChevronUp className="h-3 w-3" />
          <FaChevronDown className="h-3 w-3" />
        </div>
      </button>

      {/* Dropdown Menu (based on CustomPhoneInput dropdown) */}
      {isOpen && (
        <div
          className="absolute z-50 top-full left-0 mt-3 w-60 shadow-lg rounded-md max-h-60 overflow-y-auto backdrop-blur-sm"
          style={{
            top: 'calc(100% + 0.5rem)',
            backgroundColor: 'rgba(255, 255, 255, 0.8)'
          }}
        >
          {showSearch && (
            <div className="sticky top-0 p-2 bg-white/90">
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1 rounded-md border border-gray-200"
              />
            </div>
          )}

          {filteredOptions.map((option) => (
            <div
              key={option.value}
              className="px-4 py-2 hover:bg-gray-100/80 cursor-pointer flex items-center text-black"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.icon && renderIcon(option.icon)}
              <span>{option.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

**Usage Examples:**

```typescript
// Example 1: Social Network Selector with React Icon Components
import { FacebookIcon, InstagramIcon, XIcon, LinkedInIcon } from '@/app/components/ui/icons/SocialIcon';

const socialNetworks: DropdownOption[] = [
  {
    label: 'Facebook',
    value: 'facebook',
    icon: <FacebookIcon className="w-5 h-5" />  // React component
  },
  {
    label: 'Instagram',
    value: 'instagram',
    icon: <InstagramIcon className="w-5 h-5" />  // React component
  },
  {
    label: 'X',
    value: 'x',
    icon: <XIcon className="w-5 h-5" />  // React component
  },
  {
    label: 'LinkedIn',
    value: 'linkedin',
    icon: <LinkedInIcon className="w-5 h-5" />  // React component
  },
  // ... more social networks with icon components
];

<DropdownSelector
  options={socialNetworks}
  value={selectedNetwork}
  onChange={setSelectedNetwork}
  placeholder="Select network"
/>

// Example 2: Country Selector with Emoji Strings (for CustomPhoneInput)
const countries: DropdownOption[] = [
  { label: 'United States', value: 'US', icon: '🇺🇸', metadata: { dialCode: '1' } },  // Emoji string
  { label: 'Canada', value: 'CA', icon: '🇨🇦', metadata: { dialCode: '1' } },  // Emoji string
  // ... more countries
];

<DropdownSelector
  options={countries}
  value={selectedCountry}
  onChange={setSelectedCountry}
  showSearch={true}  // Enable search for long country list
/>
```

#### 3.5.3 CustomSocialInputAdd Component

**Component:** `/src/app/components/ui/inputs/CustomSocialInputAdd.tsx`

**Features:**
- Uses `DropdownSelector` for social network selection
- Text input for username
- Supported networks: Facebook, Instagram, X, LinkedIn, Snapchat, WhatsApp, Telegram, WeChat

**Implementation:**
```typescript
import { DropdownSelector, DropdownOption } from '@/app/components/ui/inputs/DropdownSelector';
import { FacebookIcon, InstagramIcon, XIcon, LinkedInIcon, SnapchatIcon, WhatsAppIcon, TelegramIcon, WeChatIcon } from '@/app/components/ui/icons/SocialIcon';

interface CustomSocialInputAddProps {
  onSave: (fieldType: string, username: string) => void;
}

// Use existing Nekt social media icon components
const socialNetworks: DropdownOption[] = [
  {
    label: 'Facebook',
    value: 'facebook',
    icon: <FacebookIcon className="w-5 h-5" />  // Uses existing Nekt icon
  },
  {
    label: 'Instagram',
    value: 'instagram',
    icon: <InstagramIcon className="w-5 h-5" />  // Uses existing Nekt icon
  },
  {
    label: 'X',
    value: 'x',
    icon: <XIcon className="w-5 h-5" />  // Uses existing Nekt icon
  },
  {
    label: 'LinkedIn',
    value: 'linkedin',
    icon: <LinkedInIcon className="w-5 h-5" />  // Uses existing Nekt icon
  },
  {
    label: 'Snapchat',
    value: 'snapchat',
    icon: <SnapchatIcon className="w-5 h-5" />  // Uses existing Nekt icon
  },
  {
    label: 'WhatsApp',
    value: 'whatsapp',
    icon: <WhatsAppIcon className="w-5 h-5" />  // Uses existing Nekt icon
  },
  {
    label: 'Telegram',
    value: 'telegram',
    icon: <TelegramIcon className="w-5 h-5" />  // Uses existing Nekt icon
  },
  {
    label: 'WeChat',
    value: 'wechat',
    icon: <WeChatIcon className="w-5 h-5" />  // Uses existing Nekt icon
  },
];

const CustomSocialInputAdd: React.FC<CustomSocialInputAddProps> = ({ onSave }) => {
  const [selectedNetwork, setSelectedNetwork] = useState(socialNetworks[0].value);
  const [username, setUsername] = useState('');

  return (
    <div className="flex items-center gap-2">
      <DropdownSelector
        options={socialNetworks}
        value={selectedNetwork}
        onChange={setSelectedNetwork}
      />
      <CustomInput
        value={username}
        onChange={setUsername}
        placeholder="Username"
      />
    </div>
  );
};
```

#### 3.5.4 Custom Link Handling

**Data Model - Custom Links:**

Extend existing `ContactEntry` with new optional fields for custom links:

```typescript
interface ContactEntry {
  fieldType: string;      // For custom links: extracted domain (e.g., "medium", "substack", "github")
                          // For default social: existing values ("facebook", "instagram", etc.)
  value: string;          // Full URL for custom links, username for social
  section: FieldSection;
  order: number;
  isVisible: boolean;
  confirmed: boolean;
  automatedVerification?: boolean;
  discoveryMethod?: 'ai' | 'manual' | 'email-guess' | 'phone-guess';

  // New fields for links
  linkType?: 'default' | 'custom';  // "default" = native social (facebook, instagram, etc.)
                                     // "custom" = user-added custom link (medium, substack, etc.)
  icon?: string;                     // Icon URL/path - for ALL links (both default and custom)
                                     // Default: static asset path (e.g., "/icons/default/facebook.svg")
                                     // Custom: favicon URL from Google
}
```

**Link Type Logic:**

- **Default Links** (`linkType: 'default'` or undefined for backward compatibility):
  - Native social networks: Facebook, Instagram, X, LinkedIn, Snapchat, WhatsApp, Telegram, WeChat
  - `fieldType` is the social network name (e.g., "facebook", "instagram")
  - `value` is the username
  - `icon` field stores static asset path (e.g., `/icons/default/facebook.svg`)

- **Custom Links** (`linkType: 'custom'`):
  - User-added links to any website
  - `fieldType` is the extracted domain (e.g., "medium.com" → "medium", "substack.com" → "substack")
  - `value` is the full URL (e.g., "https://username.medium.com/")
  - `icon` field stores the favicon URL from Google's service

**Icon Storage for Default Links:**

Export existing Nekt social icons as static SVG assets:
1. Extract/export icons from `react-icons/fa` or use Nekt's existing icon assets
2. Store in `/public/icons/default/` directory:
   - `/public/icons/default/facebook.svg`
   - `/public/icons/default/instagram.svg`
   - `/public/icons/default/x.svg`
   - `/public/icons/default/linkedin.svg`
   - `/public/icons/default/snapchat.svg`
   - `/public/icons/default/whatsapp.svg`
   - `/public/icons/default/telegram.svg`
   - `/public/icons/default/wechat.svg`
   - `/public/icons/default/phone.svg`
   - `/public/icons/default/email.svg`
3. When creating default social link entries, set `icon: '/icons/default/{platform}.svg'`

**Icon Extraction for Custom Links:**

When user saves custom link:
1. Extract domain from URL
2. Use simplified domain as `fieldType`
3. Fetch and store favicon

**Implementation:**
```typescript
// Utility function to extract domain for fieldType
function extractDomainForFieldType(url: string): string {
  try {
    const urlObj = new URL(url);
    let domain = urlObj.hostname;

    // Remove 'www.' prefix
    domain = domain.replace(/^www\./, '');

    // Extract main domain (e.g., "username.medium.com" → "medium")
    const parts = domain.split('.');
    if (parts.length > 2) {
      // For subdomains, use the second-to-last part
      // e.g., "username.medium.com" → "medium"
      return parts[parts.length - 2];
    }

    // For regular domains, use first part
    // e.g., "github.com" → "github"
    return parts[0];
  } catch (error) {
    return 'link'; // Fallback for invalid URLs
  }
}

// Example usage when saving custom link
const url = "https://username.medium.com/article";
const fieldType = extractDomainForFieldType(url); // "medium"
const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;

// Example 1: Creating a default social link
const facebookEntry: ContactEntry = {
  fieldType: 'facebook',
  value: 'username',
  section: 'personal',
  order: nextOrder,
  isVisible: true,
  confirmed: true,
  linkType: 'default',
  icon: '/icons/default/facebook.svg',  // Static asset
};

// Example 2: Creating a custom link
const customLinkEntry: ContactEntry = {
  fieldType: fieldType,          // "medium"
  value: url,                     // Full URL
  section: 'personal',
  order: nextOrder,
  isVisible: true,
  confirmed: true,
  linkType: 'custom',
  icon: faviconUrl,               // Favicon URL from Google
};
```

**Favicon Processing:**
- Fetch favicon from Google's service
- Store URL directly (lazy load in UI)
- Optional: Convert to black/white using CSS filter (`filter: grayscale(100%) contrast(100%)`) or canvas processing

**Rendering Links in UI:**

When displaying links (e.g., in ProfileView social icons list or Edit Profile fields):

```typescript
// In SocialIconsList or similar component
const renderLinkIcon = (entry: ContactEntry) => {
  // ALL links now use the icon field consistently
  if (entry.icon) {
    return (
      <img
        src={entry.icon}
        alt={entry.fieldType}
        className="w-5 h-5 object-contain"
        style={{ filter: 'grayscale(100%) contrast(100%)' }} // Optional B&W conversion
      />
    );
  }

  // Fallback for legacy entries without icon field
  // (e.g., existing social links created before this change)
  return <SocialIcon platform={entry.fieldType} size="md" />;
};
```

#### 3.5.5 Link Duplication Logic

- If toggle is ON (default): Add link to both Personal and Work
- If toggle is OFF: Only add to current profile type
- Create separate `ContactEntry` instances with different `section` values

### 3.6 Hidden Section

**Changes:**
- **Only show fields that user has actively hidden** (i.e., `isVisible: false`)
- **Do not show blank/empty fields** (i.e., `value === ""`)
- If no hidden fields exist, section is empty ( show empty state)

**Implementation:**
```typescript
const hiddenFields = contactEntries.filter(
  entry =>
    entry.section === currentProfileType &&
    entry.isVisible === false &&
    entry.value.trim() !== ""
);

// Render
{hiddenFields.length > 0 && (
  <FieldSection title="Hidden">
    {hiddenFields.map(field => (
      <CustomInput key={field.id} {...field} />
    ))}
  </FieldSection>
)}
```

### 3.7 Sign Out Button

**Position:** Bottom of page, below all sections

**Styling:**
- `SecondaryButton` with `variant="dark"`
- Text color: Red (`text-red-500` like Delete buttons in Calendar/Location)
- Text: "Sign Out"

---

## 3.8 Contact Page Pre-fetching

**Important:** Similar to CalConnect's username page, trigger availability pre-fetching when user views a contact.

**Implementation:**

Use CalConnect's `SchedulingProvider` pattern:

```typescript
// /src/app/providers/SchedulingProvider.tsx (adapt from CalConnect)
interface SchedulingContextType {
  preFetchedData: PreFetchedData | null;
  isPreFetching: boolean;
  warmupSchedulingData: (user1Id: string, user2Id: string, calendarType: 'personal' | 'work') => Promise<void>;
  clearPreFetchedData: () => void;
  loadCachedData: (user1Id: string, user2Id: string, calendarType: 'personal' | 'work') => PreFetchedData | null;
}

// Caching strategy:
// - Store in localStorage with 10-minute TTL
// - Key: calconnect_scheduling_{user1Id}_{user2Id}_{calendarType}
// - Pre-fetch when user navigates to Contact page
// - Reuse cached data in Smart Schedule page
```

**Trigger Logic in Contact Page:**

```typescript
// In /src/app/contact/[userId]/page.tsx
const { warmupSchedulingData, user } = useScheduling();

useEffect(() => {
  if (user && contactUserId) {
    const calendarType = localStorage.getItem('profileViewMode') || 'personal';
    // Trigger background pre-fetch (non-blocking)
    warmupSchedulingData(user.id, contactUserId, calendarType as 'personal' | 'work');
  }
}, [user, contactUserId, warmupSchedulingData]);
```

**Benefits:**
- Smart Schedule page loads instantly (uses cached data)
- Reduces perceived latency
- Better UX for scheduling flows

---

## 4. History Page Changes

### 4.1 Calendar Icon CTA (Replaces Send Message CTA)

**Current:** Each contact item in History has a "Send Message" secondary CTA

**New:** Replace the send message CTA in each contact item with a calendar icon button

**Position:** In the contact item (where send message button currently is)

**Design:**
- Icon button (circle variant)
- Calendar icon from Nekt icon set
- Same size and styling as other icon buttons in app

**Behavior:**
- If user has calendar for current section (Personal or Work):
  - Navigate to `/contact/{contactUserId}/smart-schedule`
- If user has NO calendar for current section:
  - Open "Add Calendar" modal

**Implementation:**
```typescript
// In HistoryContactItem component (or wherever contact items are rendered)
const handleCalendarClick = (contactUserId: string) => {
  const currentSection = localStorage.getItem('profileViewMode') || 'personal';
  const userHasCalendar = profile.calendars?.some(
    cal => cal.section === currentSection
  );

  if (userHasCalendar) {
    router.push(`/contact/${contactUserId}/smart-schedule`);
  } else {
    setShowAddCalendarModal(true);
  }
};

// In HistoryContactItem
<HistoryContactItem
  contact={contact}
  secondaryAction={
    <IconButton
      icon={<CalendarIcon />}
      onClick={() => handleCalendarClick(contact.userId)}
      variant="circle"
      aria-label="Schedule meeting"
    />
  }
/>
```

**Note:** This replaces the existing "Send Message" button in each contact item

---

## 5. Contact Page Changes

### 5.1 Primary CTA Change

**Current:** Primary CTA varies based on context (Save Contact, etc.)

**New:** For already-saved contacts, change to "Meet Up 🤝"

**Behavior:**
- If user has calendar for current profile type:
  - Navigate to `/contact/{contactUserId}/smart-schedule`
- If user has NO calendar for current profile type:
  - Open "Add Calendar" modal

### 5.2 New Secondary CTA: "Say Hi"

**Current:** No secondary CTA after saving contact

**New:** Add secondary CTA with "Say Hi" text

**Behavior:** Same functionality as current primary CTA (likely opens messaging or contact action)

**Design:**
- `SecondaryButton` with `variant="dark"`
- Full width below primary CTA
- Text: "Say Hi"

**Layout:**
```typescript
// In /src/app/contact/[userId]/page.tsx
<div className="space-y-3">
  <Button
    variant="theme"
    className="w-full"
    onClick={handleMeetUp}
  >
    Meet Up 🤝
  </Button>

  <SecondaryButton
    variant="dark"
    className="w-full"
    onClick={handleSayHi}
  >
    Say Hi
  </SecondaryButton>
</div>
```

---

## 6. Connect Page Changes

### 6.1 Smart Schedule CTA

**When to Show:** In the final resting state of Connect page (when "Done" is the primary CTA)

**Design:** Secondary CTA below "Done" button

**Text:** "Schedule next meet up now!"

**Behavior:**
- If user has calendar for current profile type:
  - Navigate to `/contact/{matchedContactId}/smart-schedule`
- If user has NO calendar for current profile type:
  - Open "Add Calendar" modal

**Implementation:**
```typescript
// In /src/app/connect/page.tsx
// After successful match and save
<div className="space-y-3">
  <Button
    variant="theme"
    className="w-full"
    onClick={handleDone}
  >
    Done
  </Button>

  <SecondaryButton
    variant="dark"
    className="w-full"
    onClick={handleScheduleMeetUp}
  >
    Schedule next meet up now!
  </SecondaryButton>
</div>
```

---

## 7. Smart Schedule Page

### 7.1 Page Route & Structure

**Route:** `/contact/{userId}/smart-schedule`

**Page Component:** `/src/app/contact/[userId]/smart-schedule/page.tsx`

**Title:** "{Contact Name} - Smart Schedule" or just "Smart Schedule"

### 7.2 Implementation (Adapted from CalConnect)

**Source Files to Adapt:**
- CalConnect: `/Users/alexanderweingart/Code/calconnect/src/app/[username]/smart-schedule/page.tsx`
- CalConnect: `/Users/alexanderweingart/Code/calconnect/src/app/components/ui/SuggestionChip.tsx`

**Key Features:**
1. **Profile Type Selector**: Personal vs Work (at top of page)
2. **Pre-fetched Availability**: Load common availability on page load
3. **Suggestion Chips**: 5 pre-defined meeting types
4. **Place Fetching**: Auto-fetch venues for in-person meetings
5. **One-Click Scheduling**: Opens calendar compose URL

### 7.3 Location Detection Logic

**Priority Order (for in-person meetings):**
1. **Live location**: If user grants browser location permission, use current coordinates (highest priority)
2. **Profile type location**: Use location that matches current profile type (Personal or Work)
3. **IP-based detection**: Fallback to IP geolocation if no locations saved

**Important Notes:**
- No universal location concept - locations are either Personal or Work
- Live location always takes precedence when available
- If no profile type match, don't fall back to "any location" - go straight to IP detection

**Implementation:**
```typescript
// /src/lib/location/location-detection.ts
async function detectUserLocation(
  userId: string,
  section: 'personal' | 'work'
): Promise<Coordinates> {
  // 1. Try live location (highest priority)
  const liveLocation = await getLiveLocation();  // navigator.geolocation
  if (liveLocation) return liveLocation;

  // 2. Try profile type location (Personal or Work only)
  const userProfile = await getProfile(userId);
  const matchingLocation = userProfile.locations?.find(
    loc => loc.section === profileType
  );
  if (matchingLocation?.coordinates) return matchingLocation.coordinates;

  // 3. IP-based fallback (no "any location" fallback)
  return await getLocationFromIP();
}
```

**Location Permission Prompt:**
- Prompt browser location permission on page load (if not already granted)
- If user denies, proceed with profile location fallback
- Non-blocking: page loads immediately, location permission is async

### 7.4 Suggestion Chips

**Personal Meeting Types:**
1. Video 30m (telephone-classic.svg icon)
2. Coffee 30m (coffee-simple.svg icon)
3. Lunch 60m (burger.svg icon)
4. Dinner 60m (utensils.svg icon)
5. Drinks 60m (drinks.svg icon)

**Work Meeting Types:**
1. Quick Sync 30m (lightning-charge.svg icon)
2. Coffee 30m (coffee-simple.svg icon)
3. Deep Dive 60m (search.svg icon)
4. Live Working Session 60m (people.svg icon)
5. Lunch 60m (burger.svg icon)

**UI Component:** Use `ItemChip` component (without action button, with text truncation)

**Layout:**
- Vertical list of meeting options
- Each item shows:
  - **Icon**: Meeting type icon (8x8, in gradient container like CalConnect)
  - **Title**: Meeting type + duration (e.g., "Coffee 30m")
  - **Subtitle**: Place name + distance (for in-person) OR "Video Call" (for virtual)
  - **Text truncation**: Enable `truncateTitle={true}` to handle long venue names

**States (via className prop):**
- **Available**: Default styling from ItemChip
- **Loading**: Show skeleton loader in subtitle area while fetching place
- **Unavailable**: Reduced opacity (opacity-50), disabled pointer events

**Data Structure:**

CalConnect uses separate state for chips, times, and places:
```typescript
// CalConnect's SuggestionChip type (from src/types/index.ts)
interface SuggestionChip {
  id: string;
  eventId: string;  // References an Event template (e.g., 'coffee-30', 'lunch-60')
  icon?: string;    // Icon identifier (e.g., 'coffee', 'lunch')
}

// Predefined chips for Personal and Work
const PERSONAL_SUGGESTION_CHIPS: SuggestionChip[] = [
  { id: 'chip-1', eventId: 'video-30', icon: 'video' },
  { id: 'chip-2', eventId: 'coffee-30', icon: 'coffee' },
  { id: 'chip-3', eventId: 'lunch-60', icon: 'lunch' },
  { id: 'chip-4', eventId: 'dinner-60', icon: 'dinner' },
  { id: 'chip-5', eventId: 'drinks-60', icon: 'drinks' },
];

const WORK_SUGGESTION_CHIPS: SuggestionChip[] = [
  { id: 'chip-1', eventId: 'quick-sync-30', icon: 'quick_sync' },
  { id: 'chip-2', eventId: 'coffee-30', icon: 'coffee' },
  { id: 'chip-3', eventId: 'deep-dive-60', icon: 'deep_dive' },
  { id: 'chip-4', eventId: 'live-working-session-60', icon: 'live_working_session' },
  { id: 'chip-5', eventId: 'lunch-60', icon: 'lunch' },
];

// State management in Smart Schedule page
const [suggestedTimes, setSuggestedTimes] = useState<Record<string, TimeSlot | null>>({});
const [chipPlaces, setChipPlaces] = useState<Record<string, Place | null>>({});

// Event templates are fetched from event-templates.ts via getEventTemplate(eventId)
// Event interface includes preferredPlaces field (from src/types/index.ts)
interface Event {
  id: string;
  title: string;
  duration: number;
  eventType: 'video' | 'in-person';
  intent: 'coffee' | 'lunch' | 'dinner' | 'drinks' | 'quick_sync' | 'deep_dive' | 'live_working_session' | 'custom';
  preferredPlaces?: any[];  // Array of places (populated by place search)
  // ... other fields like travelBuffer, location, etc.
}
```

**Usage:**
```typescript
// Render meeting suggestions (based on CalConnect's actual implementation)
{SUGGESTION_CHIPS.map(chip => {
  // Fetch event template for this chip
  const eventTemplate = getEventTemplate(chip.eventId);
  if (!eventTemplate) return null;

  // Get suggested time slot for this chip
  const timeSlot = suggestedTimes[chip.id];
  const hasAvailableTime = timeSlot !== null && timeSlot !== undefined;

  // Get place for in-person events
  const place = chipPlaces[chip.id];

  // Build subtitle
  const subtitle = eventTemplate.eventType === 'video'
    ? 'Video Call'
    : place
      ? `${place.name} • ${place.distance_from_midpoint_km.toFixed(1)} mi`
      : hasAvailableTime
        ? 'Finding venue...'
        : 'No availability';

  return (
    <ItemChip
      key={chip.id}
      icon={
        <div className="w-8 h-8 rounded-lg gradient-icon flex items-center justify-center">
          <img src={`/icons/${chip.icon}.svg`} className="w-5 h-5" />
        </div>
      }
      title={`${eventTemplate.title} ${eventTemplate.duration}m`}
      subtitle={subtitle}
      onClick={() => handleChipClick(chip)}
      truncateTitle={true}
      className={!hasAvailableTime ? 'opacity-50 pointer-events-none' : ''}
    />
  );
})}
```

### 7.5 Place Fetching

**When:** For in-person meeting types (Coffee, Lunch, Dinner, Drinks)

**How:**
1. Calculate midpoint between user's location and contact's location
2. Search for places using Foursquare Places API
3. Filter by:
   - Category (cafe, restaurant, bar, etc.) using Foursquare category IDs
   - Within radius
   - Rating >= 4.0 (Foursquare returns 0-10 scale, converted to 0-5 for our Place interface)
4. **Sort by rating** (highest first), with unrated places at the end
5. Select top result

**Note:** Places are sorted by **rating** (not distance). Distance is only used for filtering within radius. Foursquare returns places pre-sorted by relevance, and CalConnect re-sorts by rating to ensure highest-quality venues.

**API Route:** `/api/places-suggestions`

**Implementation:**
```typescript
// /src/lib/places/place-search.ts
// Uses Foursquare Places API via CalConnect's foursquare-client.ts

async function findPlaceForMeeting(
  user1Location: Coordinates,
  user2Location: Coordinates,
  meetingType: 'coffee' | 'lunch' | 'dinner' | 'drinks',
  meetingTime: Date
): Promise<Place | null> {
  const midpoint = calculateMidpoint(user1Location, user2Location);
  const radius = calculateSearchRadius(user1Location, user2Location);

  // Map meeting type to search parameters for searchPlacesByType
  const typeMap = {
    coffee: 'cafe',
    lunch: 'restaurant',
    dinner: 'restaurant',
    drinks: 'bar'
  };

  const placeType = typeMap[meetingType];

  // Use searchPlacesByType from CalConnect's foursquare-client.ts
  // This function:
  // 1. Calls Foursquare Places API with appropriate category ID
  // 2. Converts rating from 0-10 to 0-5 scale
  // 3. Filters by radius and rating >= 4.0
  // 4. Sorts by rating (highest first)
  const places = await searchPlacesByType(
    midpoint,
    radius,
    placeType,
    undefined, // no keyword filter
    meetingTime
  );

  // Return top-rated place within radius
  return places[0] || null;
}
```

### 7.6 Calendar Compose URLs

**When user taps a suggestion chip:**
1. Find next available time slot
2. Fetch place (if in-person)
3. Generate calendar compose URLs for Google/Outlook/Apple using unified function
4. Open URL in new tab/window

**URL Generation:**

CalConnect already has a unified function `createCompleteCalendarEvent()` in `/src/lib/events/event-utils.ts`:

```typescript
// Use CalConnect's existing unified function
const { formattedTitle, description, calendar_urls } = createCompleteCalendarEvent(
  {
    title: eventName,
    description: eventDescription,
    startTime: startDate,
    endTime: endDate,
    location: (eventTemplate.eventType === 'in-person' && place) ? place.name : undefined,
    eventType: eventTemplate.eventType,
    travelBuffer: eventTemplate.travelBuffer,
    preferredPlaces: place ? [place] : undefined
  },
  { email: otherUser.email },
  currentUser,
  timezone
);

// calendar_urls contains: { google, outlook, apple }
// Open the appropriate URL based on user's preference or show options
```

This function handles:
- Formatting title with "• Starts at" for in-person events with travel buffer
- Generating URLs for all platforms (Google, Outlook, Apple/ICS)
- Including attendees (other user's email)
- Proper location formatting from Place object

### 7.7 Bottom CTA: Custom Time & Place

**Button:** At bottom of page, below suggestion chips

**Text:** "Find Custom Time & Place"

**Styling:** `Button` with `variant="white"` (primary white CTA)

**Behavior:** Navigate to `/contact/{userId}/ai-schedule`

---

## 8. AI Schedule Page

### 8.1 Page Route & Structure

**Route:** `/contact/{userId}/ai-schedule`

**Page Component:** `/src/app/contact/[userId]/ai-schedule/page.tsx`

**Title:** "Schedule with {Contact Name}" or "AI Scheduler"

### 8.2 Implementation (Adapted from CalConnect)

**Source Files to Adapt:**
- CalConnect: `/Users/alexanderweingart/Code/calconnect/src/app/[username]/chat-schedule/page.tsx`
- CalConnect: `/Users/alexanderweingart/Code/calconnect/src/app/components/chat/MessageList.tsx`
- CalConnect: `/Users/alexanderweingart/Code/calconnect/src/app/components/chat/ChatInput.tsx`

**Key Features:**
1. **Chat Interface**: User sends messages, AI responds
2. **Streaming Responses**: Real-time AI text generation
3. **Intent Detection**: Parse user request (time, place, type)
4. **Event Generation**: Create event with details
5. **Calendar Deep Links**: One-click event creation

### 8.3 Location Detection Logic

**Same as Smart Schedule Page:**
1. **Live location** (highest priority)
2. **Profile type location** (Personal or Work)
3. **IP-based fallback** (no universal or "any location")

**Implementation:** Reuse `detectUserLocation()` function from Smart Schedule (Section 7.3)

### 8.4 Chat Interface

**Initial AI Message:**
```
Hi! I'm here to help you schedule a meeting with {Contact Name}.

What kind of meeting would you like to have? For example:
- "Let's grab coffee next week"
- "I need an hour for a project review"
- "Dinner on Friday?"

Just tell me what you have in mind!
```

**Message Types:**
1. **User Messages**: Right-aligned, simple text bubbles
2. **AI Messages**: Left-aligned, can include text and event cards
3. **Event Cards**: Display meeting details with "Create Event" button

**UI Components:**

```typescript
// /src/app/components/chat/MessageBubble.tsx
interface MessageBubbleProps {
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

// /src/app/components/chat/EventCard.tsx
interface EventCardProps {
  event: Event;
  place?: Place;
  onCreateEvent: () => void;
}

// Event card shows:
// - Meeting title
// - Date/time
// - Duration
// - Location/place (if in-person)
// - "Create Event" button
```

**Chat Input:**
```typescript
// /src/app/components/chat/ChatInput.tsx
interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// Features:
// - Text input (auto-expanding, max 4 lines)
// - Send button (disabled when empty or processing)
// - Enter key to send (Shift+Enter for new line)
```

### 8.5 AI Scheduling Logic

**API Route:** `/api/ai-schedule`

**Request:**
```typescript
{
  userMessage: string;
  conversationHistory: Message[];
  user1Id: string;
  user2Id: string;
  user2Name: string;
  user1Location?: string;  // From detectUserLocation()
  user2Location?: string;  // From contact's profile
  calendarType: 'personal' | 'work';
  availableTimeSlots?: TimeSlot[];  // Pre-fetched common availability
  timezone: string;
}
```

**Response:**
```typescript
{
  intent: 'create_event' | 'ask_clarification' | 'confirm';
  event?: Event;
  message: string;
  showCreateButton?: boolean;
}
```

**OpenAI Prompt Structure:**
```typescript
const systemPrompt = `You are a scheduling assistant helping ${user1Name} schedule a meeting with ${user2Name}.

User 1 location: ${user1Location}
User 2 location: ${user2Location}

Available time slots:
${formatAvailableSlots(availableTimeSlots)}

Parse the user's request and extract:
1. Meeting type (video or in-person)
2. Duration
3. Preferred time/date
4. Location preference (if in-person)

Generate a meeting proposal with specific details.`;
```

**Intent Detection:**
- **create_event**: User request is clear, create event immediately
- **ask_clarification**: Need more info (time, type, etc.)
- **confirm**: Confirm details before creating

### 8.6 Streaming Implementation

**Use Server-Sent Events (SSE):**

```typescript
// API Route: /api/ai-schedule/stream
export async function POST(req: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const openai = new OpenAI();
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [...],
        stream: true,
      });

      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content || '';
        controller.enqueue(encoder.encode(`data: ${content}\n\n`));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

**Client-side:**
```typescript
const eventSource = new EventSource('/api/ai-schedule/stream', {
  method: 'POST',
  body: JSON.stringify(requestData),
});

eventSource.onmessage = (event) => {
  const chunk = event.data;
  setStreamingMessage(prev => prev + chunk);
};

eventSource.onerror = () => {
  eventSource.close();
  setIsStreaming(false);
};
```

---

## 9. Styling Adjustments

### 9.1 Component Adaptation Strategy

**Approach:** Adapt CalConnect components to Nekt's design system

**Key Differences:**
- **Colors**: CalConnect uses red-to-yellow gradient, Nekt uses teal/green with white accents
- **Typography**: CalConnect has custom text styles, Nekt has `Typography` component
- **Corner Radius**: May differ between apps
- **Shadows**: May differ between apps

**Adaptation Process:**
1. **Copy component structure** from CalConnect
2. **Replace color variables** with Nekt equivalents
3. **Replace text components** with Nekt's `Typography` components
4. **Adjust spacing** to match Nekt's spacing system
5. **Maintain functionality** from CalConnect

### 9.2 Design System Mapping

#### Colors

**CalConnect → Nekt Mapping:**

| CalConnect | Nekt Equivalent | Usage |
|------------|-----------------|-------|
| `--primary-gradient` (red-yellow) | `bg-gradient-to-r from-theme-light to-green-600` | Buttons, accents |
| `--icon-gradient` (light red-yellow) | `bg-white/20` | Icon containers |
| `bg-white` | `bg-white/80 backdrop-blur-sm` | Cards, inputs |
| `text-gray-900` | `text-white` | Primary text |
| `text-gray-600` | `text-white/60` | Secondary text |
| `border-gray-200` | `border-white/20` | Borders |

#### Typography

**CalConnect → Nekt Mapping:**

| CalConnect | Nekt Component | Props |
|------------|----------------|-------|
| `<h1>` | `<Heading as="h1">` | - |
| `<h2>` | `<Heading as="h2">` | - |
| `<p>` | `<Text>` | - |
| `<small>` | `<Text variant="small">` | - |
| Muted text | `<Text className="text-white/60">` | - |

#### Buttons

**CalConnect → Nekt Mapping:**

| CalConnect | Nekt Component | Props |
|------------|----------------|-------|
| Primary button | `<Button variant="theme">` | - |
| Secondary button | `<SecondaryButton variant="dark">` | - |
| White button | `<Button variant="white">` | - |
| Destructive | `<SecondaryButton className="text-red-500">` | - |

#### Spacing

**Both apps use Tailwind spacing scale**, so spacing should translate directly.

#### Corner Radius

**Verify and standardize:**
- Nekt uses `rounded-full` for inputs (pill shape)
- CalConnect uses `rounded-xl` for cards
- Adapt as needed for consistency

### 9.3 Banner Component (New)

**Purpose:** Reusable banner component for prompts and notifications, used for First Link prompt and Admin mode standardization.

**Component:** `/src/app/components/ui/Banner.tsx`

**Interface:**
```typescript
interface BannerProps {
  icon: ReactNode;
  text: string;
  ctaText: string;
  onCtaClick: () => void;
  onDismiss: () => void;
  variant?: 'default' | 'admin';
}
```

**Variants:**

| Variant | Background | CTA Style | Usage |
|---------|------------|-----------|-------|
| `default` | `bg-theme-light/90 backdrop-blur-sm` | Secondary CTA (default) | First Link prompt, general notifications |
| `admin` | `bg-red-500/90 backdrop-blur-sm` | Secondary CTA with red text | Admin mode actions |

**Layout:**
```typescript
<div className={bannerBackgroundClass}>
  <div className="flex items-center gap-3 px-4 py-3">
    {/* Icon */}
    <div className="flex-shrink-0">
      {icon}
    </div>

    {/* Text */}
    <Text className="flex-1 text-white">
      {text}
    </Text>

    {/* CTA Button */}
    <SecondaryButton
      variant="dark"
      className={variant === 'admin' ? 'text-red-500' : ''}
      onClick={onCtaClick}
    >
      {ctaText}
    </SecondaryButton>

    {/* Dismiss Button */}
    <IconButton
      icon={<XIcon />}
      onClick={onDismiss}
      variant="ghost"
      className="text-white"
    />
  </div>
</div>
```

**Styling Details:**
- Position: Fixed or absolute at top of screen, below status bar
- Height: Auto (based on content, typically ~56px)
- Width: Full width (w-full)
- Z-index: High (z-50) to appear above content
- Animation: Slide down on mount, slide up on dismiss
- Safe area: Account for iOS notch (`pt-safe`)

**Dismissal Logic:**
- Store dismissal state in localStorage
- Key format: `banner-dismissed-{bannerType}-{userId}`
- TTL options: Never show again, or show again after X days

**Usage Examples:**

```typescript
// First Link Prompt (default variant)
<Banner
  icon={<LinkIcon className="w-5 h-5 text-white" />}
  text="Make your first Nekt great!"
  ctaText="Add Link"
  onCtaClick={handleAddLink}
  onDismiss={handleDismiss}
  variant="default"
/>

// Admin Mode Notification (admin variant)
<Banner
  icon={<AlertIcon className="w-5 h-5 text-white" />}
  text="Admin action required"
  ctaText="Review"
  onCtaClick={handleAdminAction}
  onDismiss={handleDismiss}
  variant="admin"
/>
```

**Accessibility:**
- `role="banner"` or `role="alert"` depending on urgency
- Keyboard navigation support (Tab to CTA, Escape to dismiss)
- Screen reader announcements for dynamic banners

### 9.4 Icon Adaptation

**CalConnect Icons to Migrate:**

| Icon | Source File | Usage |
|------|-------------|-------|
| Google Calendar Logo | `/public/icons/google-calendar.svg` | Calendar provider icon |
| Microsoft Calendar Logo | `/public/icons/microsoft-calendar.svg` | Calendar provider icon |
| Apple Calendar Logo | `/public/icons/apple-calendar.svg` | Calendar provider icon |
| Meeting Type Icons | `/public/icons/{type}.svg` | Suggestion chips |

**Migration:**
- Copy SVG files to Nekt's `/public/icons/` directory
- Create React components in `/src/app/components/ui/icons/`
- Maintain original colors for brand logos (Google, Microsoft, Apple)
- Adapt other icons to Nekt's color scheme (white/transparent)

### 9.4 Modal Styling

**CalConnect Modals:**
- Dark translucent background (`bg-black/80`)
- White/transparent borders
- Backdrop blur

**Nekt Modals:**
- Uses `StandardModal` component
- Similar dark glass-morphism design
- Consistent with CalConnect style

**Recommendation:** CalConnect modals should adapt easily to Nekt's `StandardModal` component with minimal styling changes.

### 9.5 Input Styling

**CalConnect Inputs:**
- White background
- Rounded corners
- Border styling

**Nekt Inputs:**
- `CustomInput`: White/transparent background, rounded-full, border-2
- `CustomExpandingInput`: Same styling, auto-resize

**Recommendation:** Use Nekt's existing input components, no new styling needed.

---

## 10. Type Definitions & Code Reuse

### 10.1 Strategy

**Principle:** Maximize code reuse between Nekt and CalConnect type definitions.

**Approach:**
1. **Audit existing types** in both codebases
2. **Identify overlaps** (User, Profile, ContactEntry, etc.)
3. **Extend Nekt types** with CalConnect-specific fields
4. **Avoid creating duplicate types** for same concepts

### 10.2 Type Merging

#### UserProfile Type

**Nekt (existing):**
```typescript
interface UserProfile {
  userId: string;
  profileImage: string;
  backgroundImage: string;
  lastUpdated: number;
  contactEntries: ContactEntry[];
  aiGeneration?: {
    bioGenerated: boolean;
    avatarGenerated: boolean;
    backgroundImageGenerated: boolean;
  };
}
```

**CalConnect additions:**
```typescript
interface UserProfile {
  // ... existing Nekt fields ...

  // CalConnect additions
  calendars?: Calendar[];        // Max 2
  locations?: UserLocation[];    // Max 2
  timezone?: string;             // User's timezone (detected or manual)
}
```

#### ContactEntry Type

**Nekt (existing):**
```typescript
interface ContactEntry {
  fieldType: string;
  value: string;
  section: 'universal' | 'personal' | 'work';
  order: number;
  isVisible: boolean;
  confirmed: boolean;
  automatedVerification?: boolean;
  discoveryMethod?: 'ai' | 'manual' | 'email-guess' | 'phone-guess';
}
```

**CalConnect additions (for links):**
```typescript
interface ContactEntry {
  // ... existing Nekt fields ...

  // CalConnect additions for links
  linkType?: 'default' | 'custom';  // Differentiates native social vs custom links
  icon?: string;                     // Icon URL/path - for ALL links (both default and custom)
                                     // Default: static asset path (e.g., "/icons/default/facebook.svg")
                                     // Custom: favicon URL from Google
}
```

**Extended fieldType usage:**
- Default social links: `fieldType` = social network name (e.g., "facebook", "instagram")
- Custom links: `fieldType` = extracted domain (e.g., "medium", "substack", "github")

**Icon field usage:**
- Used for ALL link types (both default and custom) for consistency
- Default social links: Store static asset paths (e.g., `/icons/default/facebook.svg`)
- Custom links: Store favicon URLs from Google's service
- Unified approach simplifies rendering and provides flexibility for future customization

### 10.3 New Types to Add

**Important Naming Standardization:**
All types use `section` field (matching Nekt's existing `FieldSection` type) instead of CalConnect's `profileType` or `state` terminology.

**Type Distinction:**
- **ContactEntry** uses `section: 'universal' | 'personal' | 'work'` (existing Nekt type - Universal is valid for Name and Bio only)
- **Calendar** uses `section: 'personal' | 'work'` (new type - No universal, calendars are always specific to Personal or Work)
- **UserLocation** uses `section: 'personal' | 'work'` (new type - No universal, locations are always specific to Personal or Work)

This consistent use of `section` field across all types ensures code consistency and reduces confusion.

**Add to `/src/types/profile.ts`:**

```typescript
// Calendar types
interface Calendar {
  id: string;
  userId: string;
  provider: 'google' | 'microsoft' | 'apple';
  email: string;
  section: 'personal' | 'work';  // Note: Calendar only supports personal/work, no universal (uses FieldSection naming)
  schedulableHours: SchedulableHours;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: number;
  applePassword?: string;
  selectedCalendarIds?: string[];
  connectionStatus?: 'connecting' | 'connected' | 'failed';
  lastSyncError?: string;
  createdAt: number;
  updatedAt: number;
}

interface SchedulableHours {
  monday: TimeSlot[];
  tuesday: TimeSlot[];
  wednesday: TimeSlot[];
  thursday: TimeSlot[];
  friday: TimeSlot[];
  saturday: TimeSlot[];
  sunday: TimeSlot[];
}

interface TimeSlot {
  start: string;  // "09:00" 24-hour format
  end: string;    // "17:00" 24-hour format
}

// Location types
interface UserLocation {
  id: string;
  userId: string;
  address?: string;
  city: string;
  region: string;
  zip?: string;
  country: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  section: 'personal' | 'work';  // Note: Location only supports personal/work, no universal (uses FieldSection naming)
  validated?: boolean;
  radarPlaceId?: string;
  createdAt: number;
  updatedAt: number;
}

// Coordinates
interface Coordinates {
  lat: number;
  lng: number;
}
```

**Add to new file `/src/types/scheduling.ts`:**

```typescript
// Event types
interface Event {
  id: string;
  organizerId: string;
  attendeeId?: string;
  title: string;
  description?: string;
  duration: number;
  eventType: 'video' | 'in-person';
  intent: string;
  startTime?: Date;
  endTime?: Date;
  location?: string;
  videoCallLink?: string;
  status?: 'template' | 'scheduled' | 'cancelled';
  createdAt: number;
  updatedAt: number;
}

// Place types
interface Place {
  place_id: string;
  name: string;
  address: string;
  coordinates: Coordinates;
  rating?: number;
  price_level?: number;
  google_maps_url: string;
  distance_from_midpoint_km?: number;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
}

// AI Scheduling types
interface AISchedulingRequest {
  userMessage: string;
  conversationHistory: Message[];
  user1Id: string;
  user2Id: string;
  user2Name?: string;
  user1Location?: string;
  user2Location?: string;
  calendarType: 'personal' | 'work';
  availableTimeSlots?: TimeSlot[];
  timezone: string;
}

interface AISchedulingResponse {
  intent: 'create_event' | 'ask_clarification' | 'confirm';
  event?: Event;
  message: string;
  showCreateButton?: boolean;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  timestamp: number;
}
```

### 10.4 Service Layer Reuse

**CalConnect Lib Files to Migrate:**

| CalConnect File | Nekt Location | Migration Strategy |
|-----------------|---------------|-------------------|
| **Calendar Providers** | | |
| `/lib/calendar-providers/google.ts` | `/src/lib/calendar-providers/google.ts` | Copy wholesale - OAuth, token refresh, busy times |
| `/lib/calendar-providers/microsoft.ts` | `/src/lib/calendar-providers/microsoft.ts` | Copy wholesale - Graph API, token refresh |
| `/lib/calendar-providers/apple.ts` | `/src/lib/calendar-providers/apple.ts` | Copy wholesale - CalDAV connection |
| `/lib/calendar-providers/tokens.ts` | `/src/lib/calendar-providers/tokens.ts` | Copy wholesale - Token encryption/decryption |
| **Location** | | |
| `/lib/location/address-validation.ts` | `/src/lib/location/address-validation.ts` | Copy wholesale - Radar API validation |
| `/lib/location/location-utils.ts` | `/src/lib/location/location-utils.ts` | Copy wholesale - Midpoint calculation, distance |
| `/lib/location/location-state-utils.ts` | `/src/lib/location/location-state-utils.ts` | Copy wholesale - Location state management |
| **Places** | | |
| `/lib/places/foursquare-client.ts` | `/src/lib/places/foursquare-client.ts` | Copy wholesale - Already reviewed |
| `/lib/places/place-utils.ts` | `/src/lib/places/place-utils.ts` | Copy wholesale - Place fetching utilities |
| `/lib/places/geocoding.ts` | `/src/lib/places/geocoding.ts` | Copy wholesale - Reverse geocoding |
| **Events & Scheduling** | | |
| `/lib/events/event-templates.ts` | `/src/lib/events/event-templates.ts` | Copy wholesale - Pre-defined meeting types |
| `/lib/events/event-utils.ts` | `/src/lib/events/event-utils.ts` | Copy wholesale - Already reviewed (calendar URLs, etc.) |
| `/lib/events/scheduling-utils.ts` | `/src/lib/events/scheduling-utils.ts` | Copy wholesale - Common availability logic |
| `/lib/events/slot-generator.ts` | `/src/lib/events/slot-generator.ts` | Copy wholesale - Generate free slots from busy times |
| `/lib/events/time-utils.ts` | `/src/lib/events/time-utils.ts` | Copy wholesale - Timezone utilities |
| **ICS Parsing (for Apple)** | | |
| `/lib/ics-parsing/index.ts` | `/src/lib/ics-parsing/index.ts` | Copy wholesale - Main ICS parser |
| `/lib/ics-parsing/parser-core.ts` | `/src/lib/ics-parsing/parser-core.ts` | Copy wholesale - Core parsing logic |
| `/lib/ics-parsing/recurrence.ts` | `/src/lib/ics-parsing/recurrence.ts` | Copy wholesale - Recurring events |
| `/lib/ics-parsing/timezone.ts` | `/src/lib/ics-parsing/timezone.ts` | Copy wholesale - Timezone handling |
| **AI Scheduling** | | |
| `/lib/ai/openai-client.ts` | `/src/lib/ai/openai-client.ts` | Merge with existing Nekt OpenAI client |
| `/lib/ai/system-prompts.ts` | `/src/lib/ai/system-prompts.ts` | Copy wholesale - Scheduling prompts |
| `/lib/ai/functions/` (all) | `/src/lib/ai/functions/` | Copy wholesale - OpenAI function definitions |
| `/lib/ai/streaming-handlers/` (all) | `/src/lib/ai/streaming-handlers/` | Copy wholesale - SSE handlers |
| **Utilities** | | |
| `/lib/calendar-state-utils.ts` | `/src/lib/calendar-state-utils.ts` | Copy wholesale - Calendar state management |
| `/lib/processing-state.ts` | `/src/lib/processing-state.ts` | Copy wholesale - AI processing state tracking |
| `/lib/constants.ts` | Merge into Nekt constants | Merge calendar/location constants |

**Nekt Services to Extend:**

| Nekt Service | Extension Needed |
|--------------|------------------|
| ClientProfileService | Add methods for calendars and locations CRUD |
| ServerProfileService | Add profile creation/update with calendars/locations |
| Firebase DB helpers | Extend to handle Calendar and UserLocation collections/fields |

**Key Integration Points:**
- Nekt's existing Firebase setup works - just extend with calendar/location data
- Reuse Nekt's auth tokens for API route protection
- Merge OpenAI clients (Nekt has one, CalConnect has scheduling-specific prompts)
- All CalConnect utilities are standalone - can copy directly

### 10.5 Firebase Schema Updates

**Firestore Collections:**

| Collection | Document | Fields to Add |
|------------|----------|---------------|
| `users` | `{userId}` | `calendars`, `locations`, `timezone` |

**Structure:**
```typescript
// Firestore document: users/{userId}
{
  userId: string;
  profileImage: string;
  backgroundImage: string;
  lastUpdated: number;
  contactEntries: ContactEntry[];

  // New fields
  calendars?: Calendar[];
  locations?: UserLocation[];
  timezone?: string;

  aiGeneration?: {
    bioGenerated: boolean;
    avatarGenerated: boolean;
    backgroundImageGenerated: boolean;
  };
}
```

**Security Rules:**
```javascript
// Ensure users can only write max 2 calendars and 2 locations
match /users/{userId} {
  allow write: if request.auth.uid == userId
    && request.resource.data.calendars.size() <= 2
    && request.resource.data.locations.size() <= 2;
}
```

---

## 11. Implementation Phases

### Phase 1: Foundation (Types & Data Models)
1. Add new types to `/src/types/` (Calendar, UserLocation, Event, Place, etc.)
2. Update `UserProfile` interface with `calendars` and `locations` fields
3. Update Firestore schema and security rules
4. Migrate CalConnect services to `/src/lib/` (calendar providers, location utils, place search)

### Phase 2: Auth & Onboarding
1. Update sign-in flow to skip AI generation
2. Implement `generateInitialsImage()` utility
3. Add placeholder bio logic
4. Implement initial phone/email duplication to Personal + Work
5. Create Banner component (used for First Link prompt and Admin mode)

### Phase 3: Edit Profile - Calendar
1. Create `ItemChip` component (generalized from HistoryContactItem)
2. Create `AddCalendarModal` component
3. Implement OAuth flows (Google, Microsoft, Apple)
4. Create `/edit-profile/calendar` page
5. Create `SchedulableHoursEditor` component
6. Create `TimePicker` component (adapted from CalConnect)
7. Implement calendar save/delete logic

### Phase 4: Edit Profile - Location
1. Create `AddLocationModal` component
2. Implement browser location permission flow
3. Create `/edit-profile/location` page
4. Implement Radar validation API route
5. Implement location save/delete logic
6. Add location display to ProfileView component

### Phase 5: Edit Profile - Links
1. Create `DropdownSelector` component (general reusable dropdown based on CustomPhoneInput country selector)
2. Create `CustomExpandingLinkInput` component
3. Create `CustomSocialInputAdd` component (uses `DropdownSelector`)
4. Create `AddLinkModal` component
5. Implement favicon extraction for custom links
6. Update drag-drop logic to limit scope to Personal/Work fields
7. Update Hidden section to filter out blank fields
8. (Optional) Refactor `CustomPhoneInput` to use `DropdownSelector` for consistency

### Phase 6: Navigation CTAs
1. Update History page with calendar icon CTA
2. Update Contact page with "Meet Up 🤝" CTA and "Say Hi" secondary CTA
3. Update Connect page with "Schedule next meet up now!" CTA

### Phase 7: Smart Schedule Page
1. Create `/contact/[userId]/smart-schedule` page
2. Implement location detection logic
3. Use `ItemChip` component for meeting suggestions (no action button, with text truncation)
4. Implement availability pre-fetching
5. Implement place search for in-person meetings
6. Implement calendar compose URL generation
7. Add "Find Custom Time & Place" CTA

### Phase 8: AI Schedule Page
1. Create `/contact/[userId]/ai-schedule` page
2. Create chat interface components (MessageBubble, ChatInput, MessageList)
3. Create EventCard component
4. Implement AI scheduling API route
5. Implement streaming responses (SSE)
6. Implement intent detection and event generation
7. Integrate with calendar compose URLs

### Phase 9: Styling & Polish
1. Migrate CalConnect icons to Nekt
2. Adapt CalConnect component styles to Nekt design system
3. Test all components on mobile and desktop
4. Ensure consistent spacing, colors, typography
5. Add loading states and error handling
6. Optimize performance (lazy loading, caching)

### Phase 10: Testing & Launch
1. Unit tests for calendar/location services
2. Integration tests for OAuth flows
3. E2E tests for scheduling flows
4. User acceptance testing
5. Bug fixes and refinements
6. Deploy to production

---

## 12. API Routes & Backend

### 12.1 New API Routes

From CalConnect's actual implementation:

**Calendar OAuth & Management (from `/api/calendar-connections/`):**
- `POST /api/calendar-connections/add-new-calendar/google` - Google OAuth flow
- `POST /api/calendar-connections/add-new-calendar/office365` - Microsoft OAuth flow
- `POST /api/calendar-connections/add-new-calendar/apple` - Apple CalDAV setup
- `POST /api/calendar-connections/refresh-tokens` - Refresh expired OAuth tokens
- `PUT /api/user/calendar-save/[id]` - Update calendar settings (schedulable hours)

**Location (from CalConnect):**
- `POST /api/validate-address` - Validate address with Radar API
  - Returns: `{ isValid, suggestion?, coordinates?, radarPlaceId? }`
  - Used by: Add/Edit Location modal

**Scheduling (from `/api/scheduling/`):**
- `POST /api/scheduling/combined-common-times` - Get common availability between two users
  - Input: `{ user1Id, user2Id, duration, travelBuffer?, calendarType }`
  - Output: `{ commonSlots: TimeSlot[], user1Timezone, user2Timezone }`
  - Features: Redis caching (10min TTL), fetches from Google/Microsoft/Apple calendars
  - **Used for pre-fetching on Contact page and Smart Schedule page**

- `POST /api/scheduling/fetch-ics` - Fetch and parse ICS feeds for Apple calendars
  - Handles recurring events, timezone conversions
  - Returns busy times from ICS URLs

**AI Scheduling (from `/api/scheduling/ai-scheduling/`):**
- `POST /api/scheduling/ai-scheduling` - AI scheduling with streaming
  - Streaming SSE endpoint
  - Handles: generate-event, edit-event, navigate-to-booking, search-events, suggest-activities
  - Uses OpenAI function calling

- `GET /api/scheduling/ai-scheduling/status/[processingId]` - Poll AI scheduling status
  - For long-running AI operations
  - Returns: `{ status: 'processing' | 'completed' | 'failed', result? }`

**Places (from CalConnect):**
- `POST /api/places-suggestions` - Get place suggestions for meeting
  - Input: `{ user1Location, user2Location, activityType, meetingDateTime? }`
  - Uses Foursquare API
  - Returns: `Place[]` sorted by rating

**User Profile (from CalConnect):**
- `GET /api/user/profile` - Get user profile (includes calendars, locations)
- `PUT /api/user/profile` - Update user profile
  - Handles calendar and location updates
  - Validates max 2 calendars, max 2 locations

**Links (new for Nekt):**
- `POST /api/links/extract-favicon` - Extract favicon from custom URL
  - Input: `{ url }`
  - Output: `{ faviconUrl }` (Google Favicon API URL)

### 12.2 Environment Variables

**New Variables to Add:**

```bash
# Google Calendar API
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
GOOGLE_CALENDAR_REDIRECT_URI=

# Microsoft Graph API
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=

# Radar (Location Validation)
RADAR_SECRET_KEY=
RADAR_PUBLISHABLE_KEY=

# Foursquare Places API
FOURSQUARE_API_KEY=

# OpenAI (AI Scheduling) - Already exists in Nekt
OPENAI_API_KEY=

# Redis (for caching common availability - optional but recommended)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### 12.3 Firestore Indexes

**Add Composite Indexes:**

```javascript
// Index for querying calendars by userId + section
{
  collection: 'users',
  fields: [
    { fieldPath: 'userId', order: 'ASCENDING' },
    { fieldPath: 'calendars.section', order: 'ASCENDING' }
  ]
}

// Index for querying locations by userId + section
{
  collection: 'users',
  fields: [
    { fieldPath: 'userId', order: 'ASCENDING' },
    { fieldPath: 'locations.section', order: 'ASCENDING' }
  ]
}
```

---

## 13. Edge Cases & Error Handling

### 13.1 Calendar Edge Cases

**Max Calendar Limit:**
- Enforce max 2 calendars (1 personal, 1 work) in UI and backend
- Show error message if user tries to add 3rd calendar
- Disable "Add Calendar" button when limit reached

**OAuth Token Expiry:**
- Implement automatic token refresh before API calls
- If refresh fails, show re-authentication prompt
- Store token expiry timestamp and check before use

**Calendar Sync Failures:**
- Store last sync error in `Calendar.lastSyncError`
- Show error indicator in Edit Profile calendar item
- Provide "Reconnect" button to re-initiate OAuth

**Calendar Deletion:**
- If calendar is used by both Personal and Work, confirm which to delete
- If calendar is last reference, fully disconnect OAuth
- Clean up orphaned availability data

### 13.2 Location Edge Cases

**Max Location Limit:**
- Enforce max 2 locations in UI and backend
- Show error message if user tries to add 3rd
- Consider universal vs personal+work combinations

**Invalid Addresses:**
- Show validation errors in modal
- Provide suggestion from Radar API
- Allow manual override if user insists

**Browser Location Permission Denied:**
- Fall back to IP-based detection
- Allow manual address entry
- Don't block flow if permission denied

**Coordinates Missing:**
- Some locations may not have coordinates (validation failed)
- Fall back to city/region for midpoint calculation
- Show warning that accuracy may be reduced

### 13.3 Scheduling Edge Cases

**No Available Time Slots:**
- Show "No availability in next 2 weeks" message
- Disable suggestion chips
- Provide "Try AI Scheduler" option for flexible scheduling

**Place Search Failures:**
- If no places found at midpoint, expand search radius
- If still no results, allow manual location entry
- Fall back to generic location (city name)

**Calendar Compose URL Failures:**
- If user's calendar type unknown, show all options (Google/Outlook/Apple)
- Handle deep link failures gracefully
- Provide copy-to-clipboard fallback

### 13.4 Data Validation

**Phone Number:**
- Validate E.164 format using existing logic
- Handle international numbers correctly
- Preserve formatting for display

**Email:**
- Validate email format
- Check for common typos (gmial.com → gmail.com)
- Normalize to lowercase

**URL Validation:**
- Ensure custom links start with http:// or https://
- Auto-add https:// if missing
- Validate URL format before saving

**Time Validation:**
- Ensure end time > start time for time slots
- Prevent overlapping time slots in same day
- Validate 24-hour format (00:00 - 23:59)

---

## 14. Security & Privacy Considerations

### 14.1 OAuth Token Storage

**Security Measures:**
- **Encrypt OAuth tokens** before storing in Firestore
- Use Firebase Admin SDK server-side encryption
- Never expose tokens to client-side JavaScript
- Implement token rotation and refresh

**Implementation:**
```typescript
// /src/lib/security/encryption.ts
import { createCipheriv, createDecipheriv } from 'crypto';

const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY!;

export function encryptToken(token: string): string {
  const cipher = createCipheriv('aes-256-cbc', ENCRYPTION_KEY, IV);
  return cipher.update(token, 'utf8', 'hex') + cipher.final('hex');
}

export function decryptToken(encrypted: string): string {
  const decipher = createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, IV);
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}
```

### 14.2 Location Privacy

**Privacy Controls:**
- Only share location with matched contacts (not public)
- Allow users to delete location data at any time
- Don't store precise live location, only profile locations
- Radar API calls server-side only (hide API key)

### 14.3 Calendar Privacy

**Privacy Controls:**
- Only fetch free/busy times, not event details
- Don't store calendar events in Nekt database
- Only share availability with contacts user chooses to schedule with
- Provide clear disconnect/delete options

### 14.4 Data Retention

**Policies:**
- Delete OAuth tokens when calendar disconnected
- Delete location data when user deletes location
- Cascade delete calendars/locations when user deletes account
- Don't retain scheduling data after event created

---

## 15. Complete File Migration List

### 15.1 API Routes (19 files)

| CalConnect File | Nekt Location | Action |
|-----------------|---------------|--------|
| `/app/api/calendar-connections/add-new-calendar/google/route.ts` | `/src/app/api/calendar-connections/add-new-calendar/google/route.ts` | Copy wholesale |
| `/app/api/calendar-connections/add-new-calendar/office365/route.ts` | `/src/app/api/calendar-connections/add-new-calendar/office365/route.ts` | Copy wholesale |
| `/app/api/calendar-connections/add-new-calendar/apple/route.ts` | `/src/app/api/calendar-connections/add-new-calendar/apple/route.ts` | Copy wholesale |
| `/app/api/calendar-connections/refresh-tokens/route.ts` | `/src/app/api/calendar-connections/refresh-tokens/route.ts` | Copy wholesale |
| `/app/api/places-suggestions/route.ts` | `/src/app/api/places-suggestions/route.ts` | Copy wholesale |
| `/app/api/scheduling/ai-scheduling/route.ts` | `/src/app/api/scheduling/ai-scheduling/route.ts` | Copy wholesale |
| `/app/api/scheduling/ai-scheduling/status/[processingId]/route.ts` | `/src/app/api/scheduling/ai-scheduling/status/[processingId]/route.ts` | Copy wholesale |
| `/app/api/scheduling/combined-common-times/route.ts` | `/src/app/api/scheduling/combined-common-times/route.ts` | Copy wholesale |
| `/app/api/scheduling/fetch-ics/route.ts` | `/src/app/api/scheduling/fetch-ics/route.ts` | Copy wholesale |
| `/app/api/user/calendar-save/[id]/route.ts` | `/src/app/api/user/calendar-save/[id]/route.ts` | Copy wholesale |
| `/app/api/user/profile/route.ts` | `/src/app/api/user/profile/route.ts` | Merge with Nekt's profile route |
| `/app/api/validate-address/route.ts` | `/src/app/api/validate-address/route.ts` | Copy wholesale |
| `/app/api/auth/[...nextauth]/route.ts` | N/A | Skip - Nekt has own auth |
| `/app/api/auth/delete-account/route.ts` | N/A | Skip - Nekt has own auth |
| `/app/api/auth/firebase-token/route.ts` | N/A | Skip - Nekt has own auth |

### 15.2 Lib Files (44 files)

| CalConnect File | Nekt Location | Action |
|-----------------|---------------|--------|
| **Calendar Providers (4 files)** | | |
| `/lib/calendar-providers/google.ts` | `/src/lib/calendar-providers/google.ts` | Copy wholesale |
| `/lib/calendar-providers/microsoft.ts` | `/src/lib/calendar-providers/microsoft.ts` | Copy wholesale |
| `/lib/calendar-providers/apple.ts` | `/src/lib/calendar-providers/apple.ts` | Copy wholesale |
| `/lib/calendar-providers/tokens.ts` | `/src/lib/calendar-providers/tokens.ts` | Copy wholesale |
| **Events & Scheduling (5 files)** | | |
| `/lib/events/event-templates.ts` | `/src/lib/events/event-templates.ts` | Copy wholesale |
| `/lib/events/event-utils.ts` | `/src/lib/events/event-utils.ts` | Copy wholesale |
| `/lib/events/scheduling-utils.ts` | `/src/lib/events/scheduling-utils.ts` | Copy wholesale |
| `/lib/events/slot-generator.ts` | `/src/lib/events/slot-generator.ts` | Copy wholesale |
| `/lib/events/time-utils.ts` | `/src/lib/events/time-utils.ts` | Copy wholesale |
| **Location (3 files)** | | |
| `/lib/location/address-validation.ts` | `/src/lib/location/address-validation.ts` | Copy wholesale |
| `/lib/location/location-state-utils.ts` | `/src/lib/location/location-state-utils.ts` | Copy wholesale |
| `/lib/location/location-utils.ts` | `/src/lib/location/location-utils.ts` | Copy wholesale |
| **Places (3 files)** | | |
| `/lib/places/foursquare-client.ts` | `/src/lib/places/foursquare-client.ts` | Copy wholesale |
| `/lib/places/geocoding.ts` | `/src/lib/places/geocoding.ts` | Copy wholesale |
| `/lib/places/place-utils.ts` | `/src/lib/places/place-utils.ts` | Copy wholesale |
| **ICS Parsing (5 files)** | | |
| `/lib/ics-parsing/index.ts` | `/src/lib/ics-parsing/index.ts` | Copy wholesale |
| `/lib/ics-parsing/parser-core.ts` | `/src/lib/ics-parsing/parser-core.ts` | Copy wholesale |
| `/lib/ics-parsing/recurrence.ts` | `/src/lib/ics-parsing/recurrence.ts` | Copy wholesale |
| `/lib/ics-parsing/timezone.ts` | `/src/lib/ics-parsing/timezone.ts` | Copy wholesale |
| `/lib/ics-parsing/utils.ts` | `/src/lib/ics-parsing/utils.ts` | Copy wholesale |
| **AI Scheduling (16 files)** | | |
| `/lib/ai/openai-client.ts` | `/src/lib/ai/openai-client.ts` | Merge with Nekt's OpenAI |
| `/lib/ai/system-prompts.ts` | `/src/lib/ai/system-prompts.ts` | Copy wholesale |
| `/lib/ai/functions/edit-event.ts` | `/src/lib/ai/functions/edit-event.ts` | Copy wholesale |
| `/lib/ai/functions/generate-event-template.ts` | `/src/lib/ai/functions/generate-event-template.ts` | Copy wholesale |
| `/lib/ai/functions/generate-event.ts` | `/src/lib/ai/functions/generate-event.ts` | Copy wholesale |
| `/lib/ai/functions/navigate-to-booking.ts` | `/src/lib/ai/functions/navigate-to-booking.ts` | Copy wholesale |
| `/lib/ai/helpers/conditional-edit.ts` | `/src/lib/ai/helpers/conditional-edit.ts` | Copy wholesale |
| `/lib/ai/helpers/search-events.ts` | `/src/lib/ai/helpers/search-events.ts` | Copy wholesale |
| `/lib/ai/helpers/search-places.ts` | `/src/lib/ai/helpers/search-places.ts` | Copy wholesale |
| `/lib/ai/streaming-handlers/handle-edit-event.ts` | `/src/lib/ai/streaming-handlers/handle-edit-event.ts` | Copy wholesale |
| `/lib/ai/streaming-handlers/handle-generate-event.ts` | `/src/lib/ai/streaming-handlers/handle-generate-event.ts` | Copy wholesale |
| `/lib/ai/streaming-handlers/handle-navigate-booking.ts` | `/src/lib/ai/streaming-handlers/handle-navigate-booking.ts` | Copy wholesale |
| `/lib/ai/streaming-handlers/handle-search-events.ts` | `/src/lib/ai/streaming-handlers/handle-search-events.ts` | Copy wholesale |
| `/lib/ai/streaming-handlers/handle-show-more-events.ts` | `/src/lib/ai/streaming-handlers/handle-show-more-events.ts` | Copy wholesale |
| `/lib/ai/streaming-handlers/handle-suggest-activities.ts` | `/src/lib/ai/streaming-handlers/handle-suggest-activities.ts` | Copy wholesale |
| `/lib/ai/streaming-handlers/orchestrator.ts` | `/src/lib/ai/streaming-handlers/orchestrator.ts` | Copy wholesale |
| `/lib/ai/streaming-handlers/streaming-utils.ts` | `/src/lib/ai/streaming-handlers/streaming-utils.ts` | Copy wholesale |
| **Utilities (4 files)** | | |
| `/lib/calendar-state-utils.ts` | `/src/lib/calendar-state-utils.ts` | Copy wholesale |
| `/lib/processing-state.ts` | `/src/lib/processing-state.ts` | Copy wholesale |
| `/lib/constants.ts` | Merge into Nekt constants | Merge relevant constants |
| `/lib/auth-config.ts` | N/A | Skip - Nekt has own auth |
| **Firebase (4 files)** | | |
| `/lib/firebase/firebase-admin.ts` | Merge with Nekt | Merge admin functions |
| `/lib/firebase/firebase-admin-db.ts` | Merge with Nekt | Merge DB helpers for calendars/locations |
| `/lib/firebase/firebase-db.ts` | Merge with Nekt | Merge client DB helpers |
| `/lib/firebase/firebase.ts` | N/A | Skip - Nekt has own Firebase init |

### 15.3 Components (28 files)

| CalConnect File | Nekt Location | Action |
|-----------------|---------------|--------|
| **UI Components (16 files)** | | |
| `/app/components/ui/CalendarItem.tsx` | `/src/app/components/ui/CalendarItem.tsx` | Copy - calendar management UI |
| `/app/components/ui/CalendarManagement.tsx` | `/src/app/components/ui/CalendarManagement.tsx` | Copy - calendar list component |
| `/app/components/ui/CalendarProviderButtons.tsx` | `/src/app/components/ui/CalendarProviderButtons.tsx` | Copy - OAuth provider buttons |
| `/app/components/ui/LocationItem.tsx` | `/src/app/components/ui/LocationItem.tsx` | Copy - location display |
| `/app/components/ui/LocationManagement.tsx` | `/src/app/components/ui/LocationManagement.tsx` | Copy - location list component |
| `/app/components/ui/AddLocationButton.tsx` | `/src/app/components/ui/AddLocationButton.tsx` | Copy - add location trigger |
| `/app/components/ui/SuggestionChip.tsx` | Adapt to use `ItemChip` | Don't copy - use Nekt's ItemChip instead |
| `/app/components/ui/EventCard.tsx` | `/src/app/components/ui/EventCard.tsx` | Copy - AI scheduler event display |
| `/app/components/ui/ProfileCard.tsx` | N/A | Skip - Nekt has ProfileView |
| `/app/components/ui/TitleBar.tsx` | N/A | Skip - Nekt has TopBar |
| `/app/components/ui/Button.tsx` | N/A | Skip - Nekt has Button |
| `/app/components/ui/Typography.tsx` | N/A | Skip - Nekt has Typography |
| `/app/components/ui/LoadingAnimation.tsx` | `/src/app/components/ui/LoadingAnimation.tsx` | Copy - replace Nekt's version, use Nekt gradient colors |
| `/app/components/ui/state-selectors/ThreeStateSelector.tsx` | N/A | Skip - Nekt doesn't have 3-state |
| `/app/components/ui/state-selectors/calendar-selectors/Calendar2StateSelector.tsx` | N/A | Skip - Nekt uses profileViewMode |
| `/app/components/ui/state-selectors/calendar-selectors/Calendar3StateSelector.tsx` | N/A | Skip - Nekt doesn't have 3-state |
| **Input Components (5 files)** | | |
| `/app/components/ui/inputs/TimePicker.tsx` | `/src/app/components/ui/inputs/TimePicker.tsx` | Copy - time slot picker |
| `/app/components/ui/inputs/CustomTimeInput.tsx` | `/src/app/components/ui/inputs/CustomTimeInput.tsx` | Copy - time input |
| `/app/components/ui/inputs/CustomTextInput.tsx` | N/A | Skip - Nekt has CustomInput |
| `/app/components/ui/inputs/CustomExpandingTextInput.tsx` | N/A | Skip - Nekt has CustomExpandingInput |
| `/app/components/ui/inputs/ValidatedTextInput.tsx` | `/src/app/components/ui/inputs/ValidatedTextInput.tsx` | Copy - for address validation |
| **Modal Components (5 files)** | | |
| `/app/components/ui/modals/AppleCalendarSetupModal.tsx` | `/src/app/components/ui/modals/AppleCalendarSetupModal.tsx` | Copy - Apple setup flow |
| `/app/components/ui/modals/AddressValidationModal.tsx` | `/src/app/components/ui/modals/AddressValidationModal.tsx` | Copy - address validation |
| `/app/components/ui/modals/IcsModal.tsx` | `/src/app/components/ui/modals/IcsModal.tsx` | Copy - ICS download |
| `/app/components/ui/modals/UniversalCalendarConflictModal.tsx` | N/A | Skip - Nekt doesn't have universal |
| `/app/components/ui/modals/StandardModal.tsx` | N/A | Skip - Nekt has StandardModal |
| **Chat Components (2 files)** | | |
| `/app/components/chat/ChatInput.tsx` | `/src/app/components/chat/ChatInput.tsx` | Copy - AI scheduler input |
| `/app/components/chat/MessageList.tsx` | `/src/app/components/chat/MessageList.tsx` | Copy - AI scheduler messages |

### 15.4 Providers (4 files)

| CalConnect File | Nekt Location | Action |
|-----------------|---------------|--------|
| `/app/providers/SchedulingProvider.tsx` | `/src/app/providers/SchedulingProvider.tsx` | Copy wholesale |
| `/app/providers/TargetUserProvider.tsx` | Adapt concept for Contact page | Adapt pattern for target user |
| `/app/providers/SessionProvider.tsx` | N/A | Skip - Nekt has own session |
| `/app/providers/AuthProvider.tsx` | N/A | Skip - Nekt has own auth |

### 15.5 Hooks (1 file)

| CalConnect File | Nekt Location | Action |
|-----------------|---------------|--------|
| `/app/hooks/useStreamingAI.ts` | `/src/app/hooks/useStreamingAI.ts` | Copy - for AI scheduler streaming |

### 15.6 Types (4 files)

| CalConnect File | Nekt Location | Action |
|-----------------|---------------|--------|
| `/types/index.ts` | Merge into `/src/types/profile.ts` | Merge Calendar, UserLocation, Event, etc. |
| `/types/places.ts` | `/src/types/places.ts` | Copy wholesale |
| `/types/ai-scheduling.ts` | `/src/types/ai-scheduling.ts` | Copy wholesale |
| `/types/next-auth.d.ts` | N/A | Skip - Nekt has own auth types |

### 15.7 Pages (10 files - most NOT needed)

| CalConnect File | Nekt Location | Action |
|-----------------|---------------|--------|
| `/app/[username]/smart-schedule/page.tsx` | `/src/app/contact/[userId]/smart-schedule/page.tsx` | Adapt for Nekt routing |
| `/app/[username]/chat-schedule/page.tsx` | `/src/app/contact/[userId]/ai-schedule/page.tsx` | Adapt for Nekt routing |
| `/app/[username]/page.tsx` | N/A | Skip - concept merged into Contact page |
| `/app/[username]/layout.tsx` | N/A | Skip - Nekt has own layouts |
| `/app/edit-profile/page.tsx` | Merge concepts | Merge calendar/location into Nekt's edit-profile |
| `/app/connections/page.tsx` | N/A | Skip - Nekt has History |
| `/app/onboarding/page.tsx` | N/A | Skip - Different onboarding |
| `/app/oauth-callback/page.tsx` | `/src/app/oauth-callback/page.tsx` | Copy - OAuth return handler |
| `/app/page.tsx` | N/A | Skip - Different home |
| `/app/layout.tsx` | N/A | Skip - Nekt has own |
| `/app/not-found.tsx` | N/A | Skip - Nekt has own |
| **Views (2 files)** | | |
| `/app/components/views/CalConnectView.tsx` | N/A | Skip - Nekt structure different |
| `/app/components/views/SignInView.tsx` | N/A | Skip - Nekt has own auth |

### 15.8 Assets & Icons (8 files)

| CalConnect File | Nekt Location | Action |
|-----------------|---------------|--------|
| `/public/icons/burger.svg` | `/public/icons/burger.svg` | Copy - lunch icon |
| `/public/icons/coffee-simple.svg` | `/public/icons/coffee-simple.svg` | Copy - coffee icon |
| `/public/icons/drinks.svg` | `/public/icons/drinks.svg` | Copy - drinks icon |
| `/public/icons/lightning-charge.svg` | `/public/icons/lightning-charge.svg` | Copy - quick sync icon |
| `/public/icons/people.svg` | `/public/icons/people.svg` | Copy - working session icon |
| `/public/icons/search.svg` | `/public/icons/search.svg` | Copy - deep dive icon |
| `/public/icons/telephone-classic.svg` | `/public/icons/telephone-classic.svg` | Copy - video call icon |
| `/public/icons/utensils.svg` | `/public/icons/utensils.svg` | Copy - dinner icon |

### 15.9 Global CSS Updates

**Add to Nekt's `globals.css`:**

CalConnect uses gradient utilities that need to be adapted to Nekt's teal/green theme:

```css
/* Adapt CalConnect's gradient classes to Nekt's theme colors */
/* Replace CalConnect's red-to-yellow with Nekt's teal/green gradient */

:root {
  /* Update to use Nekt's gradient colors (teal/green theme) */
  --icon-gradient: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); /* light green gradient */
}

/* Utility classes for gradient elements (from CalConnect) */
.gradient-icon {
  background: var(--icon-gradient);
}

/* Gradient text utilities (adapt to Nekt theme if needed) */
.gradient-text {
  background: var(--primary-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Gradient border utilities for focus states (from CalConnect) */
.gradient-border-focus-within {
  position: relative;
}

.gradient-border-focus-within > * {
  position: relative;
  z-index: 2;
}

.gradient-border-focus-within:focus-within {
  border-color: transparent;
  outline: none;
}

.gradient-border-focus-within:focus-within::after {
  content: '';
  position: absolute;
  inset: 2px;
  border-radius: calc(0.5rem - 2px);
  background: white;
  z-index: 1;
}

.gradient-border-focus-within:focus-within::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--primary-gradient);
  border-radius: 0.5rem;
  z-index: 0;
}
```

**Note:** The `gradient-icon` class is used extensively in CalConnect for:
- Meeting type icons (coffee, lunch, etc.)
- Location pin icons
- Calendar icons
- Other decorative icon backgrounds

Adapt the gradient colors to match Nekt's teal/green theme instead of CalConnect's red/yellow theme.

### 15.10 Configuration Updates

**Next.js Config (`next.config.ts`):**
```typescript
// Add to Nekt's next.config.ts
images: {
  domains: [
    ...existing,
    'lh3.googleusercontent.com'  // For Google profile photos
  ]
},
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'Cross-Origin-Opener-Policy',
          value: 'same-origin-allow-popups'  // Required for OAuth popups
        }
      ]
    }
  ];
}
```

**Package.json Dependencies to Add:**
```json
{
  "dependencies": {
    "@upstash/redis": "^1.x",           // For caching (optional but recommended)
    "ical.js": "^2.x",                   // ICS parsing
    "luxon": "^3.x"                      // Timezone handling
  }
}
```

### 15.11 Summary

**Total files to migrate: ~95 files**
- API Routes: 12 files (copy)
- Lib Files: 44 files (copy wholesale, 4 merge)
- Components: 19 files (copy or adapt) - includes LoadingAnimation
- Providers: 1-2 files (copy/adapt)
- Hooks: 1 file (copy)
- Types: 2 files (copy, 1 merge)
- Pages: 3 files (adapt)
- Assets: 8 icon files (copy)
- Config: Next.js config updates

**Files to skip: ~30 files** (auth, existing Nekt equivalents, CalConnect-specific pages)


## 16. Performance Optimization

### 16.1 Lazy Loading

**Code Splitting:**
- Lazy load Smart Schedule page (import with `next/dynamic`)
- Lazy load AI Schedule page
- Lazy load Calendar/Location modals
- Lazy load chat components

```typescript
// Example
const SmartSchedulePage = dynamic(() => import('./SmartSchedulePage'), {
  loading: () => <PageLoader />,
});
```

### 16.2 Caching

**Client-Side:**
- Cache availability data (10-minute TTL)
- Cache place search results (10-minute TTL)
- Cache location detection (session-based)
- Use React Query or SWR for API calls

**Server-Side:**
- Cache Foursquare Places API responses (Redis, 1-hour TTL)
- Cache Radar validation results (1-hour TTL)
- Cache OAuth token refresh (until expiry)

### 16.3 Optimistic UI Updates

**Immediate Feedback:**
- Show calendar as "Connecting..." immediately after OAuth
- Show location as "Saving..." during validation
- Update profile image immediately when changing
- Stream AI responses character-by-character

### 16.4 Prefetching

**Data Prefetching:**
- Prefetch availability when user navigates to Contact page
- Prefetch places when user opens Smart Schedule
- Prefetch contact profile when viewing History list
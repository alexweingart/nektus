# Implementation Plan: Align iOS Edit Profile with Web

## Overview
Make the iOS edit profile page visually and structurally identical to web by copying web components and adapting them for React Native.

## Guiding Principle
**For each file: Copy the web version, then adapt for React Native.** This ensures structural parity and reduces divergence.

---

## File Dependency Order (Bottom-Up)

We must update files in dependency order - leaf components first, then parents.

```
Level 1 (No deps on other custom components):
├── EyeIcon.tsx
├── SocialIcon.tsx (already similar)
├── Button.tsx
├── SecondaryButton.tsx

Level 2 (Depends on Level 1):
├── StaticInput.tsx (uses EyeIcon)
├── ExpandingInput.tsx (uses EyeIcon)
├── ItemChip.tsx (uses icons)

Level 3 (Depends on Level 2):
├── ProfileField.tsx (uses StaticInput, ExpandingInput, SocialIcon)
├── ProfileImageIcon.tsx (uses Button)
├── InlineAddLink.tsx (uses inputs)
├── FieldList.tsx (layout only)
├── FieldSection.tsx (layout only)

Level 4 (Depends on Level 3):
├── SelectedSections.tsx (uses ProfileField, ItemChip, Button, FieldSection, FieldList, InlineAddLink)

Level 5 (Top level):
├── EditProfileView.tsx (uses SelectedSections, StaticInput, ExpandingInput, ProfileImageIcon, PageHeader, ProfileViewSelector)
```

---

## Phase 1: Input Components (Foundation)

### 1.1 StaticInput.tsx
**Path:** `apps/ios-native/src/app/components/ui/inputs/StaticInput.tsx`

**Current iOS Issues:**
- Uses BlurView (different visual than web's `bg-black/40`)
- Different padding/sizing

**Changes (copy from web, adapt):**
- Match web's glassmorphism: `bg-black/40 border border-white/20 rounded-full`
- Height: 56px (3.5rem)
- Icon container: 56px width, centered
- Focus state: `bg-black/50 border-white/40` with glow effect
- Eye button positioning matches web

**React Native Adaptations:**
- Replace `className` with `StyleSheet`
- Replace `<input>` with `<TextInput>`
- Replace `<button>` with `<TouchableOpacity>`
- Convert Tailwind colors to RN: `bg-black/40` → `rgba(0,0,0,0.4)`

---

### 1.2 ExpandingInput.tsx
**Path:** `apps/ios-native/src/app/components/ui/inputs/ExpandingInput.tsx`

**Changes (copy from web, adapt):**
- Match web's styling (glassmorphism, not white background)
- Auto-expanding behavior
- Variants: default, hideable, custom
- Icon + eye button support like StaticInput

**React Native Adaptations:**
- Use `onContentSizeChange` for auto-expand
- Replace `<textarea>` with `<TextInput multiline>`

---

### 1.3 DropdownPhoneInput.tsx
**Path:** `apps/ios-native/src/app/components/ui/inputs/DropdownPhoneInput.tsx`

**Changes:**
- Ensure styling matches StaticInput (glassmorphism pill)
- Country dropdown styling matches web

---

## Phase 2: UI Elements

### 2.1 ProfileField.tsx
**Path:** `apps/ios-native/src/app/components/ui/elements/ProfileField.tsx`

**Current iOS Issues:**
- Simplified structure
- Missing `isDraggable` support (data attributes for drag handles)
- Custom links use wrong variant

**Changes (copy from web, adapt):**
- Match web's exact structure:
  - Phone → DropdownPhoneInput with same props
  - Custom links → ExpandingInput with `variant="hideable"` and icon
  - Default links → StaticInput with `variant="hideable"` and icon
- Add `isDraggable` prop with drag handle data attributes
- Unconfirmed dot positioning matches web

**React Native Adaptations:**
- Replace `data-*` attributes with accessible props or refs for drag detection
- Use RN gesture handling for drag-and-drop (future phase)

---

### 2.2 ProfileImageIcon.tsx
**Path:** `apps/ios-native/src/app/components/ui/elements/ProfileImageIcon.tsx`

**Verify:**
- Click to upload image
- Circular display
- Matches web sizing (fits inside StaticInput icon area)

---

### 2.3 ItemChip.tsx
**Path:** `apps/ios-native/src/app/components/ui/modules/ItemChip.tsx`

**Current iOS Issues:**
- Uses "chevron" action icon
- Web uses "trash" for delete

**Changes (copy from web, adapt):**
- Support both `actionIcon="trash"` and `actionIcon="chevron"`
- Match web's glassmorphism styling
- Loading state for action button (`isActionLoading`)
- Separate `onClick` (chip body) and `onActionClick` (action button)

---

## Phase 3: Layout Components

### 3.1 FieldSection.tsx
**Path:** `apps/ios-native/src/app/components/ui/layout/FieldSection.tsx`

**Changes (copy from web, adapt):**
- Props: `title`, `isEmpty`, `emptyText`, `topContent`, `bottomButton`, `children`
- `topContent` renders ABOVE the field list (for Calendar/Location)
- `bottomButton` renders BELOW the field list (for Add Link)
- Empty state styling matches web

---

### 3.2 FieldList.tsx
**Path:** `apps/ios-native/src/app/components/ui/layout/FieldList.tsx`

**Changes (copy from web, adapt):**
- Vertical stack with consistent spacing (`space-y-5` = 20px gap)
- Children wrapper for consistent field spacing

---

### 3.3 Button.tsx & SecondaryButton.tsx
**Paths:**
- `apps/ios-native/src/app/components/ui/buttons/Button.tsx`
- `apps/ios-native/src/app/components/ui/buttons/SecondaryButton.tsx`

**Verify/Changes:**
- Button variants: `white`, `primary`, etc.
- SecondaryButton variants: `default`, `destructive`
- Sizing matches web
- Used for "Add Calendar", "Add Location", "Add Link", "Sign Out"

---

## Phase 4: SelectedSections View

### 4.1 SelectedSections.tsx
**Path:** `apps/ios-native/src/app/components/views/SelectedSections.tsx`

**This is the core structural change.** Copy web version entirely, then adapt.

**Web Structure:**
```
SelectedSections
├── FieldSection (Current section - Personal or Work)
│   ├── topContent:
│   │   ├── Calendar (ItemChip or Add Button)
│   │   ├── Location (ItemChip or Add Button)
│   │   └── Divider
│   ├── children:
│   │   └── FieldList → ProfileField (for each visible field)
│   └── bottomButton:
│       ├── InlineAddLink (conditional)
│       └── SecondaryButton "Add Link"
│
├── Drag Ghost (Portal for dragging - skip for now)
│
└── FieldSection (Hidden section)
    ├── children:
    │   └── FieldList → ProfileField (for each hidden field)
    └── bottomButton:
        └── SecondaryButton "Sign Out" (destructive)
```

**Props to match web:**
```typescript
interface SelectedSectionsProps {
  viewMode: 'Personal' | 'Work';
  fieldSectionManager: ReturnType<typeof useEditProfileFields>;
  getCalendarForSection: (section: 'personal' | 'work') => Calendar | undefined;
  getLocationForSection: (section: 'personal' | 'work') => UserLocation | undefined;
  handleOpenCalendarModal: (section: 'personal' | 'work') => void;
  handleOpenLocationModal: (section: 'personal' | 'work') => void;
  handleDeleteCalendar: (section: 'personal' | 'work') => void;
  handleDeleteLocation: (section: 'personal' | 'work') => void;
  isDeletingCalendar: { personal: boolean; work: boolean };
  isDeletingLocation: { personal: boolean; work: boolean };
  calRouter: { push: (path: string) => void };  // Navigation
  showInlineAddLink: { personal: boolean; work: boolean };
  handleToggleInlineAddLink: (section: 'personal' | 'work') => void;
  handleLinkAdded: (entries: ContactEntry[]) => void;
  getNextOrderForSection: (sectionName: 'personal' | 'work') => number;
  getFieldValue: (fieldType: string, section?: FieldSection) => string;
  handleFieldChange: (fieldType: string, value: string, section: FieldSection) => void;
  getFieldsForView: (viewMode: 'Personal' | 'Work') => {
    visibleFields: ContactEntry[];
    hiddenFields: ContactEntry[];
  };
}
```

**React Native Adaptations:**
- Replace `useRouter` with React Navigation
- Replace Portal with RN Modal or Animated overlay (for drag ghost - skip initially)
- Skip drag-and-drop initially (Phase 6)

---

## Phase 5: EditProfileView (Main View)

### 5.1 EditProfileView.tsx
**Path:** `apps/ios-native/src/app/components/views/EditProfileView.tsx`

**Copy web version entirely, then adapt.**

**Web Structure:**
```
EditProfileView
├── PageHeader (back + title + save)
├── FieldSection (Universal)
│   ├── StaticInput (Name with ProfileImageIcon as icon)
│   ├── ExpandingInput (Bio)
│   └── FieldList → ProfileField (universal contact fields)
├── Carousel Container
│   ├── Personal View → SelectedSections viewMode="Personal"
│   └── Work View → SelectedSections viewMode="Work"
├── ProfileViewSelector (sticky bottom)
└── Modals (AddCalendarModal, AddLocationModal)
```

**Key Differences from Current iOS:**
1. **No separate Avatar section** - profile image is INSIDE name input
2. **Universal fields use ProfileField** - not manual `renderField()`
3. **Carousel for Personal/Work** - animated horizontal switch
4. **SelectedSections component** - not manual section rendering

**React Native Adaptations:**
- Replace carousel `div` with `Animated.View` + `transform: translateX`
- Replace `useRouter` with `useNavigation`
- Replace `signOut` from next-auth with custom sign out
- Use `KeyboardAvoidingView` wrapper
- Use `ScrollView` for content

---

### 5.2 use-calendar-location-management.ts
**Path:** `apps/ios-native/src/client/hooks/use-calendar-location-management.ts`

**Verify this hook exists and matches web:**
- `getCalendarForSection(section)`
- `getLocationForSection(section)`
- `handleOpenCalendarModal(section)`
- `handleOpenLocationModal(section)`
- `handleDeleteCalendar(section)`
- `handleDeleteLocation(section)`
- `isDeletingCalendar`, `isDeletingLocation` states

**If missing, copy from web and adapt navigation.**

---

## Phase 6: Polish & Advanced Features (Later)

### 6.1 Carousel Animation
- Add `Animated.View` with spring animation for Personal/Work switching
- Match web's `transition-transform duration-300 ease-out`

### 6.2 Drag-and-Drop (Future)
- Implement using `react-native-gesture-handler` + `react-native-reanimated`
- Match web's long-press activation (1 second)
- Visual preview during drag

### 6.3 Image Upload
- Implement image picker (Expo ImagePicker)
- Profile image color extraction

---

## Implementation Checklist

### Phase 1: Inputs
- [ ] StaticInput.tsx - copy web, adapt to RN
- [ ] ExpandingInput.tsx - copy web, adapt to RN
- [ ] DropdownPhoneInput.tsx - verify styling matches

### Phase 2: Elements
- [ ] ProfileField.tsx - copy web, adapt to RN
- [ ] ProfileImageIcon.tsx - verify/update
- [ ] ItemChip.tsx - copy web, adapt to RN (add trash icon support)

### Phase 3: Layout
- [ ] FieldSection.tsx - copy web, adapt to RN (add topContent, bottomButton)
- [ ] FieldList.tsx - copy web, adapt to RN
- [ ] Button.tsx - verify variants
- [ ] SecondaryButton.tsx - verify variants (add destructive)

### Phase 4: Views
- [ ] SelectedSections.tsx - copy web, adapt to RN
- [ ] use-calendar-location-management.ts - verify/copy

### Phase 5: Main View
- [ ] EditProfileView.tsx - copy web, adapt to RN

### Phase 6: Polish
- [ ] Carousel animation
- [ ] Profile image upload
- [ ] Drag-and-drop (optional)

---

## Testing Plan

1. **Visual Comparison**: Screenshot web and iOS side-by-side
2. **Interaction Parity**:
   - Edit name/bio
   - Add/remove calendar
   - Add/remove location
   - Add/edit links
   - Toggle field visibility
   - Switch Personal/Work
   - Sign out
3. **Edge Cases**:
   - Empty states
   - Loading states
   - Error handling

---

## Notes

- **Copy-Paste First**: Always start by copying the web file content, then methodically replace web APIs with React Native equivalents
- **Keep Comments**: Web files have good documentation - preserve it
- **Type Parity**: Ensure TypeScript interfaces match exactly
- **Test Incrementally**: After each component, verify it renders correctly before moving to the next

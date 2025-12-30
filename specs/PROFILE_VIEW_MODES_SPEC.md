# Profile View Modes UX Specification

## Overview
Change the UX for Profile View Modes from three states (All, Personal, Work) to two states (Personal, Work).

## 1. Two States System
- **States**: Personal and Work (remove "All")
- **Default**: Personal is the default selected state

## 2. ProfileViewSelector Component
- **Styling**: Similar to secondary button (size, rounded corners, text styles)
- **Layout**: Two selectable text options: "Personal" and "Work"
- **Width**: Equal width for both options (Work gets extra spacing to match Personal width)
- **Background**: Same as secondary button on modals (white transparent)
- **Selected State**: Lighter transparent background (same as selected social icon)
- **Selected Styling**: Rounded corners matching container, butts against left (Personal) or right (Work)

## 3. Profile View Changes
- **Component Integration**: Add ProfileViewSelector at bottom of section containing name, bio, and social icons
- **New Component**: Create ProfileInfo component for this section
- **Carousel Functionality**: 
  - Horizontal scrollable carousel
  - Tap Work (from Personal) or swipe left → swipe to Work view
  - Tap Personal (from Work) or swipe right → swipe to Personal view
  - Universal items show in both views
- **State Management**: ProfileInfo now powers the profile selection for Nekt button (including caching)
- **Nekt Button Cleanup**: Remove UX and code no longer needed (carrots, secondary text, etc.)

## 4. Edit Page Changes
- **ProfileViewSelector**: Add as floating button at bottom with black transparent gradient background (same as ProfileInfo)
- **Carousel Layout**: Everything below EditTitleBar becomes a carousel
  - Personal view: No Work section visible
  - Work view: No Personal section visible
  - Universal items show in both
- **New Email Field**: Add email field to Universal section (after phone)
- **Field Splitting**: Universal fields (except Name and Edit Background button) can be dragged to Personal or Work
  - **Splitting Logic**: When dragged, field gets "split" - creates new entry for opposite section
  - **Example**: Email dragged to Personal → creates Work email entry too
  - **Independence**: After split, modifying one doesn't affect the other

## Data Model
- **No Major Changes**: Leverage existing schema
- **Field Splitting**: When field is split, create duplicate entries with different `fieldSection` values
  - Original: `fieldSection = "universal"`
  - After split: Two entries with `fieldSection = "personal"` and `fieldSection = "work"`

## Implementation Notes
- Universal items appear in both Personal and Work views
- State synchronization between ProfileView and EditView
- Maintain existing caching mechanisms
- Preserve existing data structure where possible
# iOS Drag and Drop Implementation Plan

## Problem Summary

Drag and drop for reordering profile fields **only works on web**. The iOS implementation is a non-functional placeholder stub.

## Approach: Start from Web Code, Adapt for React Native

**IMPORTANT:** We will copy the equivalent web files and adapt them, NOT write from scratch.

### Why We Can't Copy Web Code Directly

The web implementation uses DOM APIs that don't exist in React Native:
- `document.addEventListener('touchmove', ...)` → No DOM in RN
- `document.querySelector('[data-scrollable="true"]')` → No DOM queries in RN
- `getBoundingClientRect()` → No DOM rects in RN
- `createPortal(children, document.body)` → No DOM portals in RN

### What We WILL Preserve from Web

| Aspect | Web | iOS (Adapted) |
|--------|-----|---------------|
| **File names** | `use-drag-and-drop.ts` | `use-drag-and-drop.ts` (same) |
| **Hook interface** | `UseDragAndDropReturn` | Same interface, adapted internals |
| **Component structure** | `SelectedSections.tsx` | Same structure, RN components |
| **Reorder logic** | Array splice/insert | Identical logic |
| **Visual feedback** | Scale 1.05x, opacity | Same via reanimated |
| **Activation** | 1000ms long-press | Same (library supports this) |

---

## Current State

### Web Files (Source - Working)
```
apps/web/src/client/hooks/use-drag-and-drop.ts          # 388 lines, DOM-based
apps/web/src/app/components/views/SelectedSections.tsx  # Has drag integration
```

### iOS Files (Target - Placeholder)
```
apps/ios-native/src/client/hooks/use-drag-and-drop.ts        # 207 lines, stub only
apps/ios-native/src/app/components/views/SelectedSections.tsx # No drag handling
```

---

## Implementation Plan

### Phase 1: Install Dependencies

```bash
cd apps/ios-native
bun add react-native-draggable-flatlist
cd ios && pod install
```

**Verify:** `react-native-gesture-handler` and `react-native-reanimated` already installed.

---

### Phase 2: Adapt use-drag-and-drop.ts

**Source:** `apps/web/src/client/hooks/use-drag-and-drop.ts`
**Target:** `apps/ios-native/src/client/hooks/use-drag-and-drop.ts`

**Strategy:**
1. Copy the web file as starting point
2. Keep the same interface (`UseDragAndDropReturn`)
3. Replace DOM event handling with DraggableFlatList integration
4. Keep business logic (reorder calculation) identical

**Web interface to preserve:**
```typescript
interface UseDragAndDropReturn {
  isDragMode: boolean;
  ghostField: ContactEntry | null;
  ghostY: number;
  dropTargetIndex: number | null;
  draggedField: ContactEntry | null;
  draggedFieldIndex: number | null;
  startLongPress: (field: ContactEntry, touchY: number) => void;
  cancelLongPress: () => void;
}
```

**Adaptations needed:**
- Remove `GlobalDragManager` (DOM-specific singleton)
- Remove `document.addEventListener` calls
- Remove `scrollContainerRef` DOM queries
- Add `onDragEnd` callback for DraggableFlatList
- Add `renderItem` wrapper for drag styling

---

### Phase 3: Adapt SelectedSections.tsx

**Source:** `apps/web/src/app/components/views/SelectedSections.tsx`
**Target:** `apps/ios-native/src/app/components/views/SelectedSections.tsx`

**Strategy:**
1. Use web file structure as reference
2. Replace `<div ref={containerRef}>` with `<DraggableFlatList>`
3. Replace `Portal` ghost element with DraggableFlatList's built-in drag preview
4. Keep same visual styling (scale, opacity)

**Web code to adapt:**
```tsx
// Web: Manual field mapping with transforms
<div ref={containerRef}>
  <FieldList>
    {visibleFields.map((field, index) => {
      const offset = getFieldOffset(field, index);
      return (
        <div style={{ transform: `translateY(${offset}px)` }}>
          <ProfileField ... isDraggable={true} />
        </div>
      );
    })}
  </FieldList>
</div>
```

**iOS adaptation:**
```tsx
// iOS: DraggableFlatList handles transforms
<DraggableFlatList
  data={visibleFields}
  keyExtractor={(item) => `${item.fieldType}-${item.section}`}
  onDragEnd={({ data }) => fieldSectionManager.updateFieldOrder(sectionName, data)}
  renderItem={({ item, drag, isActive }) => (
    <ScaleDecorator activeScale={1.05}>
      <ProfileField ... isDraggable={true} onLongPress={drag} isActive={isActive} />
    </ScaleDecorator>
  )}
/>
```

---

### Phase 4: Adapt ProfileField.tsx (if needed)

**Source:** `apps/web/src/app/components/ui/elements/ProfileField.tsx`
**Target:** `apps/ios-native/src/app/components/ui/elements/ProfileField.tsx`

**Web drag handle:**
```tsx
<div
  data-drag-handle={isDraggable ? "true" : undefined}
  data-field-type={isDraggable ? fieldType : undefined}
  data-section={isDraggable ? profile.section : undefined}
  style={{ touchAction: isDraggable ? 'none' : undefined }}
>
```

**iOS adaptation:**
```tsx
// Add onLongPress and isActive props
<TouchableOpacity
  onLongPress={isDraggable ? onLongPress : undefined}
  delayLongPress={1000}
  style={[styles.field, isActive && styles.fieldActive]}
>
```

---

## File Mapping

| Web File | iOS File | Action |
|----------|----------|--------|
| `apps/web/.../use-drag-and-drop.ts` | `apps/ios-native/.../use-drag-and-drop.ts` | Copy & adapt |
| `apps/web/.../SelectedSections.tsx` | `apps/ios-native/.../SelectedSections.tsx` | Copy & adapt |
| `apps/web/.../ProfileField.tsx` | `apps/ios-native/.../ProfileField.tsx` | Add props only |

---

## Key Library: react-native-draggable-flatlist

Handles automatically:
- Long-press gesture detection
- Smooth drag animations (via reanimated)
- Auto-scroll when dragging near edges
- Drop position calculation
- Ghost/placeholder rendering

We just need to:
1. Provide `renderItem` with drag trigger
2. Handle `onDragEnd` to persist order
3. Style the active item (scale, shadow)

---

## Testing Checklist

- [ ] Long-press (1s) activates drag mode
- [ ] Field follows finger during drag
- [ ] Other fields animate to show drop position
- [ ] Reorder persists after release
- [ ] Reorder persists after app restart
- [ ] Works in both Work and Personal sections
- [ ] No interference with field tap actions
- [ ] Smooth animations (60fps)
- [ ] Auto-scroll when dragging near top/bottom edges

---

## Notes

- `react-native-reanimated` already installed (required by draggable-flatlist)
- `react-native-gesture-handler` already installed (required by draggable-flatlist)
- Web uses 1000ms long-press - DraggableFlatList supports `delayLongPress` prop
- Keep `moveUp`/`moveDown` functions for accessibility (button-based reordering)

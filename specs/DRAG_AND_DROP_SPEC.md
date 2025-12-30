## Edit Profile Drag & Drop

### Entering Drag Mode

- Long-press 1000ms on a field container with `data-draggable="true"` and `data-field-id="<platform>-<section>"`.
- Phone, email, and all social fields are draggable in the Universal, Personal, and Work sections; only fields shown under the Hidden section are not draggable.
- Haptics: vibrate on enter; switching the active field also vibrates and starts dragging immediately if same field is pressed again.
- A floating clone appears, slightly larger than the others
- Other draggable fields pulse lightly
- A `original` placeholder div (possibly just the hidden original element) is behind the floating clone, so as to avoid any visual flux.

### Dragging

- While in drag mode: native scrolling/context menu are suppressed; tap outside any draggable exits drag mode (not during the initial touch).
- A floating clone follows the finger; position updates to keep it centered on the finger Y. It moves only along Y axis.
- Exactly one reserved space is always shown:
  - `original` keeps the space where the field originated.
  - `target` indicates the current drop location (above/below any draggable field; this could mean between a section header and a field, or at the bottom of the field list, or above “Edit Background” in Universal).
  - The first insertion will add `target` and remove `original`; it is important that does it in that order
  - Insertion point logic is the nearest drop location
  - Insertion point logic: Take the middle of floating clone position as baseline, and compare against: middle of reserved space, middle of draggable field above in the ordered list (which may or may not be in the same section), and middle of the draggable field below in a list of all the draggable fields (which may or may not be in the same section). Visual flux will be minimal. We should be able to use the same state management for field order as edit profile has outside of drag mode (pre save, of course).
- Edge-scroll when finger is within ~100px of top / bottom of viewport edge (smooth programmatic scroll).
- Dragging can occur between Universal and Personal/Work sections; same as usual, the reserved space should be removed from the old and added to the new.
- Dragging works identically in Personal and Work section

### Dropping

- After a valid drop (over a reserved space): visually snaps to fill that reserved space (floating clone disappears, regular field returns in its spot), and updates the order in the page state, and drag mode exits
- On drop (high-level resolution):
  - Universal → Personal/Work: `splitUniversalField(platform, currentValue, targetSection, targetIndex)`. This will keep the same populated value, but add the field not just to the section it was added to, but the other as well. E.g. dragging Universal to Personal will also add to Work. There will be no impact to hidden section on either Personal/Work pages.
  - To Personal/Work → Universal `consolidateToUniversal(platform, fromSection)`. This will keep the same populated value, but remove the field not just from the section it was removed from, but the other as well. E.g. dragging Personal to Work will also remove from Personal. There will be no impact to hidden section on either Personal/Work pages
  - Within Section: `moveField(platform, targetSection, targetIndex, fromSection)` using indices from visible fields in the current view.
- Invalid drops: simply exit drag mode



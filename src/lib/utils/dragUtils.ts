import type { ContactEntry } from '@/types/profile';

/**
 * Utility function to reorder fields array based on drag operation
 * Handles both same-section swaps and cross-section transitions
 */
export const reorderFieldArray = (fields: ContactEntry[], fromId: string, toId: string): ContactEntry[] => {
  const result = [...fields];
  const draggedIndex = result.findIndex(f => `${f.fieldType}-${f.section}` === fromId);
  const targetIndex = result.findIndex(f => `${f.fieldType}-${f.section}` === toId);
  
  if (draggedIndex !== -1 && targetIndex !== -1) {
    const draggedField = result[draggedIndex];
    const targetField = result[targetIndex];
    
    // Detect if this is a cross-section boundary transition
    const dragType = detectDragType(draggedField, targetField);
    
    if (dragType === 'same-section') {
      // Simple swap for same-section drags
      [result[draggedIndex], result[targetIndex]] = [result[targetIndex], result[draggedIndex]];
    } else {
      // Cross-section transition: change section but maintain exact same position
      const newDraggedField = {
        ...draggedField,
        section: targetField.section // Change to target's section
      };
      
      // Simply replace the dragged field at its current position with the new section
      result[draggedIndex] = newDraggedField;
      
      // No position changes needed - the visual order stays exactly the same
      
    }
  }
  
  // Update order properties
  return result.map((field, idx) => ({ ...field, order: idx }));
};

/**
 * Detect the type of drag operation based on source and target fields
 */
export const detectDragType = (
  originalField: ContactEntry,
  targetField: ContactEntry
): 'same-section' | 'universal-to-section' | 'section-to-universal' => {
  if (originalField.section === 'universal' && targetField.section !== 'universal') {
    return 'universal-to-section';
  } else if (originalField.section !== 'universal' && targetField.section === 'universal') {
    return 'section-to-universal';
  } else {
    return 'same-section';
  }
};

/**
 * Calculate the target Y position for drag operations
 */
export const calculateTargetY = (
  touch: { clientY: number },
  dragElement: HTMLElement | null,
  scrollOffset: number
): number => {
  let targetY = touch.clientY + scrollOffset;
  if (dragElement) {
    const dragElementRect = dragElement.getBoundingClientRect();
    const dragElementCenterY = dragElementRect.top + dragElementRect.height / 2;
    targetY = dragElementCenterY + scrollOffset;
  }
  return targetY;
};

/**
 * Find the closest field to a target position
 * Compares only to adjacent fields (above/below the current reserved space)
 */
export const findClosestField = (
  targetY: number,
  visibleFields: ContactEntry[],
  scrollOffset: number,
  reservedSpaceState: Record<string, 'none' | 'above' | 'below'>,
  draggedFieldId?: string
): { targetFieldId: string; direction: 'up' | 'down' } | null => {
  // Find the field that currently has a reserved space using state
  const fieldIdWithReservedSpace = Object.keys(reservedSpaceState).find(
    fieldId => reservedSpaceState[fieldId] !== 'none'
  );

  if (!fieldIdWithReservedSpace) {
    return null;
  }

  // Find the field object that matches the fieldId
  const currentReservedSpaceField = visibleFields.find(field => 
    `${field.fieldType}-${field.section}` === fieldIdWithReservedSpace
  );

  if (!currentReservedSpaceField) {
    return null;
  }

  const currentIndex = visibleFields.findIndex(f => f === currentReservedSpaceField);
  
  // Check if reserved space is above or below the current field using state
  const reservedSpacePosition = reservedSpaceState[fieldIdWithReservedSpace];
  const hasReservedAbove = reservedSpacePosition === 'above';
  const hasReservedBelow = reservedSpacePosition === 'below';
  
  let fieldAbove: ContactEntry | null = null;
  let fieldBelow: ContactEntry | null = null;
  
  if (hasReservedAbove) {
    // Reserved space is above current field
    // Above comparison: field above current field (skip dragged field)
    // Below comparison: current field
    let aboveIndex = currentIndex - 1;
    while (aboveIndex >= 0 && draggedFieldId && `${visibleFields[aboveIndex].fieldType}-${visibleFields[aboveIndex].section}` === draggedFieldId) {
          aboveIndex--;
    }
    fieldAbove = aboveIndex >= 0 ? visibleFields[aboveIndex] : null;
    fieldBelow = currentReservedSpaceField;
  } else if (hasReservedBelow) {
    // Reserved space is below current field  
    // Above comparison: current field
    // Below comparison: field below current field (skip dragged field)
    fieldAbove = currentReservedSpaceField;
    let belowIndex = currentIndex + 1;
    while (belowIndex < visibleFields.length && draggedFieldId && `${visibleFields[belowIndex].fieldType}-${visibleFields[belowIndex].section}` === draggedFieldId) {
      belowIndex++;
    }
    fieldBelow = belowIndex < visibleFields.length ? visibleFields[belowIndex] : null;
  }

  let closestDistance = Infinity;
  let aboveDistance = Infinity;
  let belowDistance = Infinity;
  let abovePixels = 0;
  let belowPixels = 0;

  // Compare to field above (if exists and not the dragged field)
  if (fieldAbove) {
    const fieldId = `${fieldAbove.fieldType}-${fieldAbove.section}`;
    const fieldElement = document.querySelector(`[data-field-id="${fieldId}"]`);
    if (fieldElement) {
      const rect = fieldElement.getBoundingClientRect();
      const fieldCenterY = rect.top + rect.height / 2 + scrollOffset;
      abovePixels = fieldCenterY;
      aboveDistance = Math.abs(targetY - fieldCenterY);
      
      if (aboveDistance < closestDistance) {
        closestDistance = aboveDistance;
      }
    }
  }

  // Compare to field below (if exists and not the dragged field)
  if (fieldBelow) {
    const fieldId = `${fieldBelow.fieldType}-${fieldBelow.section}`;
    const fieldElement = document.querySelector(`[data-field-id="${fieldId}"]`);
    if (fieldElement) {
      const rect = fieldElement.getBoundingClientRect();
      const fieldCenterY = rect.top + rect.height / 2 + scrollOffset;
      belowPixels = fieldCenterY;
      belowDistance = Math.abs(targetY - fieldCenterY);
      
      if (belowDistance < closestDistance) {
        closestDistance = belowDistance;
      }
    }
  }

  // Get reserved space center - calculate from field position instead of searching DOM
  const reservedFieldElement = document.querySelector(`[data-field-id="${fieldIdWithReservedSpace}"]`);
  let reservedSpaceY = 0;
  
  if (reservedFieldElement) {
    const fieldRect = reservedFieldElement.getBoundingClientRect();
    const fieldCenterY = fieldRect.top + fieldRect.height / 2 + scrollOffset;
    
    // Calculate reserved space position based on state (not DOM search)
    if (hasReservedAbove) {
      // Reserved space is above the field - approximate position
      reservedSpaceY = fieldCenterY - 50; // Assume ~50px above field center
    } else if (hasReservedBelow) {
      // Reserved space is below the field - approximate position  
      reservedSpaceY = fieldCenterY + 50; // Assume ~50px below field center
    }
    
  }

  
  // Calculate distances
  const distanceToReserved = Math.abs(targetY - reservedSpaceY);
  const distanceToAbove = fieldAbove ? Math.abs(targetY - abovePixels) : Infinity;
  const distanceToBelow = fieldBelow ? Math.abs(targetY - belowPixels) : Infinity;
  
  
  // Determine if we should swap and the direction
  let result: { targetFieldId: string; direction: 'up' | 'down' } | null = null;
  
  if (distanceToAbove < distanceToReserved && fieldAbove) {
    result = {
      targetFieldId: `${fieldAbove.fieldType}-${fieldAbove.section}`,
      direction: 'up'  // Swapping to field above = going up
    };
  } else if (distanceToBelow < distanceToReserved && fieldBelow) {
    result = {
      targetFieldId: `${fieldBelow.fieldType}-${fieldBelow.section}`,
      direction: 'down'  // Swapping to field below = going down
    };
  }
  
  return result;
};

// TODO: REMOVE - No longer used (replaced by opacity: 0 approach)
export interface ReservedSpace {
  insertionIndex: number; // Direct insertion index: 0 = beginning, 3 = after 3rd field, etc.
}

// TODO: REMOVE - No longer used (simplified drag state in useDragAndDrop hook)
export interface DragState {
  isDragMode: boolean;
  draggedField: string | null;
  isDragging: boolean;
  dragPosition: { x: number; y: number } | null;
  dragElement: HTMLElement | null;
  draggedFieldHeight: number;
  reservedSpace: ReservedSpace | null;
}

/**
 * Get all draggable field elements with their positions and IDs
 * Only returns fields from the CURRENT SECTION (Personal or Work)
 */
// TODO: REMOVE - No longer used (replaced by simpler field filtering in useDragAndDrop)
export const getAllDraggableFields = (): Array<{ element: HTMLElement; fieldId: string; y: number; midY: number }> => {
  // First, determine which section we're in by checking which view is active
  // Look for the active profile view selector or check the carousel position
  document.querySelector('[data-section="personal"]');
  const workSection = document.querySelector('[data-section="work"]');
  
  let currentSection: 'personal' | 'work' | 'universal' = 'personal';
  
  // Check which section is currently visible/active
  if (workSection) {
    const workRect = workSection.getBoundingClientRect();
    // If work section is in viewport, we're on work page
    if (workRect.left >= -100 && workRect.left <= 100) {
      currentSection = 'work';
    }
  }
  
  const draggableFields = document.querySelectorAll('[data-draggable="true"][data-field-id]');
  
  // Debug: Check for duplicate field IDs before filtering
  const allFieldIds = Array.from(draggableFields).map(el => el.getAttribute('data-field-id'));
  const duplicateIds = allFieldIds.filter((id, index) => allFieldIds.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    console.warn('🚨 Duplicate field IDs found in DOM:', duplicateIds);
    console.warn('🚨 All field IDs:', allFieldIds);
  }
  
  return Array.from(draggableFields)
    .filter(element => {
      const fieldId = element.getAttribute('data-field-id') || '';
      const style = window.getComputedStyle(element);
      
      // Parse the field ID to get the section (format: "platform-section")
      const fieldSection = fieldId.split('-').pop(); // Gets 'personal', 'work', or 'universal'
      
      // Only include fields from current section or universal fields
      const isInCurrentSection = fieldSection === currentSection || fieldSection === 'universal';
      
      // Also check basic visibility
      const isVisible = style.display !== 'none';
      const rect = element.getBoundingClientRect();
      const hasSize = rect.width > 0 && rect.height > 0;
      
      return isInCurrentSection && isVisible && hasSize;
    })
    .map(element => {
      const rect = element.getBoundingClientRect();
      const fieldId = element.getAttribute('data-field-id') || '';
      const y = rect.top + window.scrollY;
      const midY = y + rect.height / 2;
      
      return {
        element: element as HTMLElement,
        fieldId,
        y,
        midY
      };
    })
    .sort((a, b) => a.y - b.y); // Sort by Y position
};

/**
 * Calculate reserved space based on floating drag position relative to all fields
 * Returns exactly one reserved space following the spec rules
 */
// Store the initial field order when drag starts
// TODO: REMOVE - No longer used (unused state management)
let initialFieldOrder: string[] | null = null;

// TODO: REMOVE - No longer used (unused state management)
export const setInitialFieldOrder = (order: string[] | null) => {
  initialFieldOrder = order;
};

// TODO: REMOVE - No longer used (unused state management)
export const getInitialFieldOrder = (): string[] | null => {
  return initialFieldOrder;
};

// TODO: REMOVE - No longer used (replaced by opacity: 0 approach)
export const calculateReservedSpace = (
  dragY: number,
  draggedFieldId: string,
  _currentReservedSpace?: ReservedSpace | null
): ReservedSpace => {
  const fields = getAllDraggableFields();
  
  
  // Use initial field order if available, otherwise use current order
  const fieldOrder = initialFieldOrder || fields.map(f => f.fieldId);
  const draggedFieldOriginalIndex = fieldOrder.indexOf(draggedFieldId);
  
  // If no valid drag position, return original position (index where dragged field was)
  if (draggedFieldOriginalIndex === -1) {
    return { insertionIndex: 0 };
  }
  
  // Find the closest field to the drag position
  let closestField = null;
  let minDistance = Infinity;
  
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    // Skip the dragged field itself
    if (field.fieldId === draggedFieldId) continue;
    
    const distance = Math.abs(dragY - field.midY);
    
    if (distance < minDistance) {
      minDistance = distance;
      closestField = field;
    }
  }
  
  // If no closest field found, return to original position
  if (!closestField) {
    return { insertionIndex: draggedFieldOriginalIndex };
  }
  
  // Calculate insertion index by finding which insertion point is closest to the floating element
  const closestFieldIndex = fieldOrder.indexOf(closestField.fieldId);
  if (closestFieldIndex === -1) {
    return { insertionIndex: draggedFieldOriginalIndex };
  }
  
  // Get current position of the dragged field's original location
  const currentPosition = draggedFieldOriginalIndex !== -1 && initialFieldOrder ? 
    fields.find(f => f.fieldId === initialFieldOrder![draggedFieldOriginalIndex])?.midY || dragY : dragY;
  
  // Simple comparison: distance to original vs distance to closest field
  const distanceToOriginal = Math.abs(dragY - currentPosition);
  const distanceToClosestField = Math.abs(dragY - closestField.midY);
  
  
  let insertionIndex;
  if (distanceToClosestField < distanceToOriginal) {
    // Closer to the target field - swap with it
    insertionIndex = closestFieldIndex;
  } else {
    // Closer to original position - stay there
    insertionIndex = draggedFieldOriginalIndex;
  }
  
  return { insertionIndex };
};

/**
 * Create a floating drag element that follows the user's finger
 */
export const createFloatingDragElement = (sourceElement: HTMLElement): HTMLElement => {
  const clone = sourceElement.cloneNode(true) as HTMLElement;
  
  // Get dimensions first
  const fieldWidth = sourceElement.offsetWidth;
  const fieldHeight = sourceElement.offsetHeight;
  
  // Remove draggable attributes so the floating ghost doesn't interfere with drag calculations
  clone.removeAttribute('data-draggable');
  clone.removeAttribute('data-field-id');
  // Also remove from any child elements that might have these attributes
  const childrenWithDraggable = clone.querySelectorAll('[data-draggable]');
  childrenWithDraggable.forEach(child => {
    child.removeAttribute('data-draggable');
    child.removeAttribute('data-field-id');
  });
  
  clone.style.position = 'fixed';
  clone.style.zIndex = '9999';
  clone.style.pointerEvents = 'none';
  clone.style.left = '50%'; // Position left edge at center
  clone.style.marginLeft = '-' + (fieldWidth / 2) + 'px'; // Move left by half width to center
  clone.style.transform = 'scale(1.05)'; // Subtle scaling
  clone.style.transformOrigin = 'center center';
  clone.style.opacity = '0.9';
  clone.style.visibility = 'visible'; // Override any inherited visibility: hidden
  clone.style.display = 'block'; // Force display to be block
  
  clone.style.width = fieldWidth + 'px';
  clone.style.height = fieldHeight + 'px';
  clone.style.minWidth = fieldWidth + 'px';
  clone.style.minHeight = fieldHeight + 'px';
  clone.style.maxWidth = fieldWidth + 'px';
  clone.style.maxHeight = fieldHeight + 'px';
  clone.style.transition = 'none';
  clone.style.overflow = 'hidden'; // Prevent internal content from breaking out
  
  // Add visual enhancement
  clone.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
  clone.style.borderRadius = '9999px';
  
  document.body.appendChild(clone);
  
  
  return clone;
};

/**
 * Update the position of a floating drag element - only Y position (X is CSS-centered)
 */
export const updateFloatingDragElementPosition = (element: HTMLElement, x: number, y: number): void => {
  if (!element) return;
  
  const ghostRect = element.getBoundingClientRect();
  
  // Only update Y position - X is handled by CSS (left: 50% + margin-left)
  const centerY = y - ghostRect.height / 2;
  
  element.style.top = centerY + 'px';
  
};

/**
 * Remove floating drag element from DOM
 */
export const removeFloatingDragElement = (element: HTMLElement | null): void => {
  if (element && element.parentNode) {
    document.body.removeChild(element);
  }
};

/**
 * Convert reserved space to drop information for fieldSectionManager
 */
// TODO: REMOVE - No longer used (unused conversion function)
export const getDropInfo = (reservedSpace: ReservedSpace, allFields: ReturnType<typeof getAllDraggableFields>, draggedFieldId?: string) => {
  // If insertion index is -1, it means no insertion point (return to original)
  if (reservedSpace.insertionIndex === -1) {
    return null; // No drop - return to original position
  }
  
  // Use initial field order if available, otherwise use current order
  const fieldOrder = initialFieldOrder || allFields.map(f => f.fieldId);
  const draggedFieldOriginalIndex = draggedFieldId ? fieldOrder.indexOf(draggedFieldId) : -1;
  
  // If inserting at original position, it's not a real drop
  if (reservedSpace.insertionIndex === draggedFieldOriginalIndex) {
    return null; // No drop - return to original position  
  }
  
  // For the fieldSectionManager, we just need the insertion index
  // The manager will handle the actual reordering logic
  return {
    insertIndex: reservedSpace.insertionIndex
  };
};



/**
 * Animate the floating element to snap to the insertion point
 */
export const animateSnapToPosition = (
  dragElement: HTMLElement,
  insertionPoint: { y: number; targetFieldId?: string },
  onComplete: () => void
): void => {
  if (!dragElement) {
    onComplete();
    return;
  }

  // Simply complete immediately without any animation
  // The field reordering will happen naturally without the confusing visual snap
  onComplete();
}; 
import type { ContactEntry } from '@/types/profile';


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
): { targetFieldId: string; direction: 'up' | 'down'; closestFieldChanged: boolean; isCrossSection: boolean } | null => {
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
  let result: { targetFieldId: string; direction: 'up' | 'down'; closestFieldChanged: boolean; isCrossSection: boolean } | null = null;
  
  // Get dragged field section from ID for cross-section detection
  const draggedFieldSection = draggedFieldId ? draggedFieldId.split('-')[1] : null;
  
  if (distanceToAbove < distanceToReserved && fieldAbove) {
    const newTargetId = `${fieldAbove.fieldType}-${fieldAbove.section}`;
    
    // Self-referential check - don't return dragged field as target
    if (draggedFieldId && newTargetId === draggedFieldId) {
      return null;
    }
    
    const newDirection = 'up';
    const currentReservedSpace = reservedSpaceState[newTargetId];
    const newReservedSpace = newDirection === 'up' ? 'above' : 'below';
    const isCrossSection = draggedFieldSection !== null && draggedFieldSection !== fieldAbove.section;
    
    result = {
      targetFieldId: newTargetId,
      direction: newDirection,
      closestFieldChanged: currentReservedSpace !== newReservedSpace,
      isCrossSection
    };
  } else if (distanceToBelow < distanceToReserved && fieldBelow) {
    const newTargetId = `${fieldBelow.fieldType}-${fieldBelow.section}`;
    
    // Self-referential check - don't return dragged field as target
    if (draggedFieldId && newTargetId === draggedFieldId) {
      return null;
    }
    
    const newDirection = 'down';
    const currentReservedSpace = reservedSpaceState[newTargetId];
    const newReservedSpace = newDirection === 'down' ? 'below' : 'above';
    const isCrossSection = draggedFieldSection !== null && draggedFieldSection !== fieldBelow.section;
    
    result = {
      targetFieldId: newTargetId,
      direction: newDirection,
      closestFieldChanged: currentReservedSpace !== newReservedSpace,
      isCrossSection
    };
  }
  
  return result;
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
 * Handle cross-section drag - only change section, keep same position
 */
export const handleCrossSectionDrag = (
  draggedField: ContactEntry,
  targetField: ContactEntry,
  fieldOrderRef: React.MutableRefObject<ContactEntry[]>,
  setDraggedField: (field: ContactEntry) => void
): void => {
  console.log(`🔄 [Cross-section] ${draggedField.section} → ${targetField.section} (position unchanged)`);
  
  // Update only the section in fieldOrderRef, not the position
  const currentFieldIndex = fieldOrderRef.current.findIndex(f => 
    f.fieldType === draggedField.fieldType && f.section === draggedField.section
  );
  
  if (currentFieldIndex !== -1) {
    const updatedFields = [...fieldOrderRef.current];
    updatedFields[currentFieldIndex] = {
      ...updatedFields[currentFieldIndex],
      section: targetField.section
    };
    fieldOrderRef.current = updatedFields;
    console.log(`🔄 [Cross-section] Updated field section at position ${currentFieldIndex}`);
  }
  
  // Update draggedField state to reflect the new section
  const updatedDraggedField = { ...draggedField, section: targetField.section };
  setDraggedField(updatedDraggedField);
};

/**
 * Handle same-section drag - change position using field order logic
 */
export const handleSameSectionDrag = (
  draggedField: ContactEntry,
  targetField: ContactEntry,
  reservePosition: 'above' | 'below',
  fieldOrderRef: React.MutableRefObject<ContactEntry[]>
): void => {
  console.log(`🔄 [Same-section] Moving ${draggedField.fieldType}-${draggedField.section} ${reservePosition} ${targetField.fieldType}-${targetField.section}`);
  
  const currentOrder = [...fieldOrderRef.current];
  console.log('  Before:', currentOrder.map(f => `${f.fieldType}-${f.section}`));
  
  // Find and remove dragged field
  const draggedIndex = currentOrder.findIndex(f => 
    f.fieldType === draggedField.fieldType && f.section === draggedField.section
  );
  
  if (draggedIndex === -1) {
    console.warn('❌ [handleSameSectionDrag] Dragged field not found in order');
    return;
  }
  
  const draggedFieldObj = currentOrder.splice(draggedIndex, 1)[0];
  
  // Find target field in the updated array (after removal)
  const targetIndex = currentOrder.findIndex(f => 
    f.fieldType === targetField.fieldType && f.section === targetField.section
  );
  
  if (targetIndex === -1) {
    console.warn('❌ [handleSameSectionDrag] Target field not found in order');
    // Re-insert at original position if target not found
    currentOrder.splice(draggedIndex, 0, draggedFieldObj);
    return;
  }
  
  // Insert dragged field at correct position
  const insertIndex = reservePosition === 'above' ? targetIndex : targetIndex + 1;
  currentOrder.splice(insertIndex, 0, draggedFieldObj);
  
  // Update ref (no re-render)
  fieldOrderRef.current = currentOrder;
  console.log('  After:', currentOrder.map(f => `${f.fieldType}-${f.section}`));
};

/**
 * Find the closest draggable parent element
 */
export const findDraggableParent = (element: Element): Element | null => {
  // Check if the touch is on a draggable field or its children
  let draggableFieldElement = element.closest('[data-draggable="true"]');
  
  // If not found, check if the target itself is a draggable element (might be hidden)
  if (!draggableFieldElement) {
    // Check if target has data-draggable attribute (even if hidden)
    let currentElement = element;
    while (currentElement) {
      const hasDataDraggable = (currentElement as HTMLElement).getAttribute?.('data-draggable');
      
      if (hasDataDraggable === 'true') {
        draggableFieldElement = currentElement;
        break;
      }
      const parentEl = currentElement.parentElement;
      if (!parentEl) break;
      currentElement = parentEl;
    }
  }
  
  return draggableFieldElement;
};
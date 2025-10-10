import type { ContactEntry, FieldSection } from '@/types/profile';

/**
 * Capture field midpoints and store them in fieldOrderRef
 * Uses the provided scrollOffset to ensure consistent coordinate system with drag calculations
 */
export const captureFieldMidpoints = (fieldOrderRef: ContactEntry[], scrollOffset: number): void => {
  fieldOrderRef.forEach(field => {
    if (field.isVisible) {
      const fieldId = `${field.fieldType}-${field.section}`;
      const fieldElement = document.querySelector(`[data-field-id="${fieldId}"]`);
      if (fieldElement) {
        const rect = fieldElement.getBoundingClientRect();
        const midpointY = rect.top + rect.height / 2 + scrollOffset;
        // Mutate the field object to add midpoint
        (field as ContactEntry & { midpointY?: number }).midpointY = midpointY;
      }
    }
  });
};

/**
 * Calculate DropZone map for current view mode with renumbered sequential ordering
 * Phase 5: Only draggable fields (Phone, Email, Social, Custom Links) within current section
 */
export const calculateViewDropZoneMap = (
  fields: ContactEntry[],
  currentViewMode: 'Personal' | 'Work',
  draggedField: ContactEntry | null,
  scrollOffset: number
): Array<{
  order: number;
  section: FieldSection;
  belowFieldType: string | 'bottom';
  midpointY?: number;
}> => {
  const currentSectionName = currentViewMode.toLowerCase() as 'personal' | 'work';

  // Phase 5: No universal fields in drag-drop (universal only has name/bio which aren't draggable)
  const universalFields: ContactEntry[] = [];

  // Get current section fields - exclude fixed fields (calendar, location)
  // Only include draggable contact fields (phone, email, social links, custom links)
  const sectionFields = fields
    .filter(f => f.section === currentSectionName && f.isVisible)
    .filter(f => f.fieldType !== 'calendar' && f.fieldType !== 'location') // Phase 5: Calendar and Location are fixed
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  
  const dropZones: Array<{
    order: number;
    section: FieldSection;
    belowFieldType: string | 'bottom';
    midpointY?: number;
  }> = [];
  
  let orderCounter = 0;
  
  // Field height constant (observed to be 76px)
  const FIELD_HEIGHT = 76;
  
  // Phase 5: Only current section fields (no universal fields in drag-drop)
  const completeFieldOrder = sectionFields;

  // Simplified Y position logic - Phase 5: only same-section dragging
  const getDropZoneY = (field: ContactEntry): number => {
    if (!draggedField) return (field as ContactEntry & { midpointY?: number }).midpointY ?? 0;

    // Phase 5: All dragging is within the same section, so no cross-section logic needed
    const draggedIndex = sectionFields.findIndex(f =>
      f.fieldType === draggedField.fieldType && f.section === draggedField.section
    );
    const fieldIndex = sectionFields.findIndex(f =>
      f.fieldType === field.fieldType && f.section === field.section
    );

    // If this field comes after the dragged field, it shifts up
    if (draggedIndex !== -1 && fieldIndex > draggedIndex) {
      // First field after dragged field gets dragged field's position
      if (fieldIndex === draggedIndex + 1) {
        return (draggedField as ContactEntry & { midpointY?: number }).midpointY ?? 0;
      }
      // Subsequent fields get the previous field's ORIGINAL position
      const previousField = sectionFields[fieldIndex - 1];
      return (previousField as ContactEntry & { midpointY?: number }).midpointY ?? 0;
    }

    // Fields before dragged field keep their original Y
    return (field as ContactEntry & { midpointY?: number }).midpointY ?? 0;
  };

  // Phase 5: No universal section drop zones (only draggable fields in current section)

  // Add DropZones for current section only
  sectionFields.forEach((field, _index) => {
    // Skip DropZone below dragged field
    if (draggedField && draggedField.fieldType === field.fieldType && draggedField.section === field.section) {
      return;
    }
    
    // Use simple Y position logic
    const dropZoneY = getDropZoneY(field);
    
    dropZones.push({
      order: orderCounter++,
      section: currentSectionName,
      belowFieldType: field.fieldType,
      midpointY: dropZoneY
    });
  });
  
  // Add final DropZone for current section - Phase 5: simplified logic
  let sectionBottomY: number | undefined;
  if (draggedField && sectionFields.length > 0) {
    const lastField = sectionFields[sectionFields.length - 1];
    const isDraggingLastField = draggedField.fieldType === lastField.fieldType &&
                                draggedField.section === lastField.section;

    if (isDraggingLastField) {
      // If dragging the last field, bottom drop zone should be at the dragged field's original position
      sectionBottomY = (draggedField as ContactEntry & { midpointY?: number }).midpointY ?? 0;
    } else {
      // Use the adjusted position of the last field
      const lastFieldAdjustedY = getDropZoneY(lastField);
      sectionBottomY = lastFieldAdjustedY + FIELD_HEIGHT;
    }
  } else if (sectionFields.length > 0) {
    // No field being dragged - use original position
    const lastField = sectionFields[sectionFields.length - 1];
    sectionBottomY = ((lastField as ContactEntry & { midpointY?: number }).midpointY ?? 0) + FIELD_HEIGHT;
  } else {
    // Empty section - use fixed fields (calendar/location) as reference, or section header
    const sectionHeaderSelector = `[data-section-header="${currentSectionName}"]`;
    const headerElement = document.querySelector(sectionHeaderSelector);

    if (headerElement) {
      const headerRect = headerElement.getBoundingClientRect();
      sectionBottomY = headerRect.top + headerRect.height + scrollOffset + 20; // 20px gap after header
    } else {
      // Fallback
      sectionBottomY = 500; // Default fallback
    }
  }
  
  dropZones.push({
    order: orderCounter++,
    section: currentSectionName,
    belowFieldType: 'bottom',
    midpointY: sectionBottomY
  });
  
  // Log final drop zones for debugging (only when needed)
  // console.log('📍 [DROP ZONES] Final drop zone map:', dropZones.map(dz => `${dz.order}-${dz.section}`));
  
  return dropZones;
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
 * Find the closest DropZone using simplified view-mode logic
 * Compares ghost position to current DropZone and adjacent fields
 */
export const findClosestDropZone = (
  ghostY: number,
  fieldOrderRef: ContactEntry[],
  activeDropZone: { order: number; section: FieldSection; belowFieldType: string | 'bottom'; midpointY: number },
  dropZoneMap: Array<{ order: number; section: FieldSection; belowFieldType: string | 'bottom'; midpointY?: number }>,
  draggedFieldId: string
): {
  newDropZone: { order: number; section: FieldSection; belowFieldType: string | 'bottom'; midpointY: number } | null;
  swapInfo?: { draggedField: ContactEntry; targetField: ContactEntry };
} => {
  // Find adjacent DropZones (order ± 1)
  const aboveDropZone = dropZoneMap.find(dz => dz.order === activeDropZone.order - 1);
  const belowDropZone = dropZoneMap.find(dz => dz.order === activeDropZone.order + 1);
  
  // Calculate distances
  const currentDistance = Math.abs(ghostY - activeDropZone.midpointY);
  const aboveDistance = aboveDropZone?.midpointY ? Math.abs(ghostY - aboveDropZone.midpointY) : Infinity;
  const belowDistance = belowDropZone?.midpointY ? Math.abs(ghostY - belowDropZone.midpointY) : Infinity;
  
  // console.log(`🎯 [findClosestDropZone] Ghost Y: ${Math.round(ghostY)} distances - Current: ${Math.round(currentDistance)} Above: ${Math.round(aboveDistance)} Below: ${Math.round(belowDistance)}`);
  
  // Find dragged field in fieldOrderRef
  const draggedField = fieldOrderRef.find(f => `${f.fieldType}-${f.section}` === draggedFieldId);
  if (!draggedField) {
    return { newDropZone: null };
  }
  
  // Check if should move to adjacent DropZone (with minimum threshold to prevent jitter)
  const DISTANCE_THRESHOLD = 5; // Minimum distance difference to trigger a swap
  if (aboveDistance < currentDistance - DISTANCE_THRESHOLD && aboveDropZone) {
    // Moving up
    if (aboveDropZone.belowFieldType === 'bottom') {
      // Moving to a bottom drop zone - just change section, no swap needed
      
      // Create a pseudo-target that represents section change
      const targetField = { ...draggedField, section: aboveDropZone.section };
      
      return {
        newDropZone: {
          order: aboveDropZone.order,
          section: aboveDropZone.section,
          belowFieldType: aboveDropZone.belowFieldType,
          midpointY: aboveDropZone.midpointY || 0
        },
        swapInfo: { draggedField, targetField }
      };
    } else {
      // Regular field swap
      const targetField = fieldOrderRef.find(f => 
        f.fieldType === aboveDropZone.belowFieldType && f.section === aboveDropZone.section
      );
      
      if (targetField) {
        
        return {
          newDropZone: {
            order: aboveDropZone.order,
            section: aboveDropZone.section,
            belowFieldType: aboveDropZone.belowFieldType,
            midpointY: aboveDropZone.midpointY || 0
          },
          swapInfo: { draggedField, targetField }
        };
      }
    }
  } else if (belowDistance < currentDistance - DISTANCE_THRESHOLD && belowDropZone) {
    // Moving down
    if (activeDropZone.belowFieldType === 'bottom') {
      // Current position is at bottom of section - check if there's a next drop zone
      const nextDropZone = dropZoneMap.find(dz => dz.order === activeDropZone.order + 1);
      if (nextDropZone) {
        
        // Create a pseudo-target that represents section change
        const targetField = { ...draggedField, section: nextDropZone.section as FieldSection };
        
        return {
          newDropZone: {
            ...belowDropZone,
            midpointY: belowDropZone.midpointY ?? 0
          },
          swapInfo: { draggedField, targetField }
        };
      }
    } else {
      // Regular field swap - use the field from the current drop zone
      const targetField = fieldOrderRef.find(f => 
        f.fieldType === activeDropZone.belowFieldType && f.section === activeDropZone.section
      );
      
      if (targetField) {
        
        return {
          newDropZone: {
            order: belowDropZone.order,
            section: belowDropZone.section,
            belowFieldType: belowDropZone.belowFieldType,
            midpointY: belowDropZone.midpointY || 0
          },
          swapInfo: { draggedField, targetField }
        };
      }
    }
  }
  
  return { newDropZone: null };
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
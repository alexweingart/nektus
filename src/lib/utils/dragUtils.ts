export interface InsertionPoint {
  id: string;
  y: number; // Y coordinate from page top
  section: 'universal' | 'personal' | 'work';
  type: 'before-edit-background' | 'section-start' | 'between-fields' | 'after-fields' | 'before-field' | 'after-field';
  beforeField?: string; // field ID that comes after this insertion point
  afterField?: string; // field ID that comes before this insertion point
  relatedField?: string; // field this insertion point relates to (for positional approach)
}

export interface HoverInfo {
  fieldElement: HTMLElement;
  fieldId: string;
  section: 'universal' | 'personal' | 'work';
  rect: DOMRect;
  topHalf: boolean;
}

export interface ReservedSpace {
  type: 'original' | 'target';
  insertionPoint: InsertionPoint;
  fieldId?: string; // For original placeholder, which field it represents
}

export interface DragState {
  isDragMode: boolean;
  draggedField: string | null;
  isDragging: boolean;
  dragPosition: { x: number; y: number } | null;
  dragElement: HTMLElement | null;
  draggedFieldHeight: number;
  activeInsertionPoint: InsertionPoint | null;
}

/**
 * Calculate all possible insertion points in the drag area
 */
export const calculateInsertionPoints = (): InsertionPoint[] => {
  const points: InsertionPoint[] = [];
  let idCounter = 0;
  
  // Get the currently active view mode from localStorage to filter insertion points
  let activeViewMode: 'Personal' | 'Work' = 'Personal';
  try {
    const savedCategory = localStorage.getItem('nekt-sharing-category');
    if (savedCategory === 'Work') {
      activeViewMode = 'Work';
    }
  } catch (error) {
    // Fallback to Personal if localStorage isn't available
  }

  // 1. Before Edit Background button (universal area)
  const editBackgroundButton = Array.from(document.querySelectorAll('button, [role="button"]')).find(el => 
    el.textContent?.includes('Edit Background')
  );
  
  if (editBackgroundButton) {
    const rect = editBackgroundButton.getBoundingClientRect();
    points.push({
      id: `insertion-${idCounter++}`,
      y: rect.top + window.scrollY - 10, // Slightly above the button
      section: 'universal',
      type: 'before-edit-background'
    });
  }

  // 2. Personal Section
  const personalSection = Array.from(document.querySelectorAll('.field-section-title')).find(el => 
    el.textContent?.includes('Personal')
  );
  
  if (personalSection) {
    const rect = personalSection.getBoundingClientRect();
    
    // Section start - right below "Personal" text
    points.push({
      id: `insertion-${idCounter++}`,
      y: rect.bottom + window.scrollY + 5,
      section: 'personal',
      type: 'section-start'
    });

    // Between and after personal fields
    const personalContainer = personalSection.closest('.mb-6');
    if (personalContainer) {
      const draggableFields = personalContainer.querySelectorAll('[data-draggable="true"]');
      
      draggableFields.forEach((field, index) => {
        const fieldRect = field.getBoundingClientRect();
        const fieldId = field.querySelector('input')?.id || '';
        
        // Between fields (before this field)
        if (index === 0) {
          // This is handled by section-start above
        } else {
          points.push({
            id: `insertion-${idCounter++}`,
            y: fieldRect.top + window.scrollY - 10,
            section: 'personal',
            type: 'between-fields',
            beforeField: fieldId
          });
        }
        
        // After last field
        if (index === draggableFields.length - 1) {
          points.push({
            id: `insertion-${idCounter++}`,
            y: fieldRect.bottom + window.scrollY + 10,
            section: 'personal',
            type: 'after-fields',
            afterField: fieldId
          });
        }
      });
      
      // If no personal fields, still add after-fields point
      if (draggableFields.length === 0) {
        points.push({
          id: `insertion-${idCounter++}`,
          y: rect.bottom + window.scrollY + 30,
          section: 'personal',
          type: 'after-fields'
        });
      }
    }
  }

  // 3. Work Section
  const workSection = Array.from(document.querySelectorAll('.field-section-title')).find(el => 
    el.textContent?.includes('Work')
  );
  
  if (workSection) {
    const rect = workSection.getBoundingClientRect();
    
    // Section start - right below "Work" text
    points.push({
      id: `insertion-${idCounter++}`,
      y: rect.bottom + window.scrollY + 5,
      section: 'work',
      type: 'section-start'
    });

    // Between and after work fields
    const workContainer = workSection.closest('.mb-6');
    if (workContainer) {
      const draggableFields = workContainer.querySelectorAll('[data-draggable="true"]');
      
      draggableFields.forEach((field, index) => {
        const fieldRect = field.getBoundingClientRect();
        const fieldId = field.querySelector('input')?.id || '';
        
        // Between fields (before this field)
        if (index === 0) {
          // This is handled by section-start above
        } else {
          points.push({
            id: `insertion-${idCounter++}`,
            y: fieldRect.top + window.scrollY - 10,
            section: 'work',
            type: 'between-fields',
            beforeField: fieldId
          });
        }
        
        // After last field
        if (index === draggableFields.length - 1) {
          points.push({
            id: `insertion-${idCounter++}`,
            y: fieldRect.bottom + window.scrollY + 10,
            section: 'work',
            type: 'after-fields',
            afterField: fieldId
          });
        }
      });
      
      // If no work fields, still add after-fields point
      if (draggableFields.length === 0) {
        points.push({
          id: `insertion-${idCounter++}`,
          y: rect.bottom + window.scrollY + 30,
          section: 'work',
          type: 'after-fields'
        });
      }
    }
  }

  // Sort by Y position to ensure correct order
  return points.sort((a, b) => a.y - b.y);
};

/**
 * Find the nearest insertion point to the given Y coordinate with hysteresis
 */
export const findNearestInsertionPoint = (
  dragY: number, 
  insertionPoints: InsertionPoint[],
  currentInsertionPoint?: InsertionPoint | null
): InsertionPoint | null => {
  if (insertionPoints.length === 0) return null;

  const ACTIVATION_THRESHOLD = 40; // Must be within 40px to activate an insertion point
  const HYSTERESIS_BONUS = 15; // Current point gets 15px bonus to prevent flickering

  let closest: InsertionPoint | null = null;
  let minDistance = Infinity;

  // Find the closest point within threshold
  for (const point of insertionPoints) {
    const distance = Math.abs(dragY - point.y);
    
    // Apply hysteresis bonus to current insertion point to prevent flickering
    const effectiveDistance = (currentInsertionPoint?.id === point.id) 
      ? Math.max(0, distance - HYSTERESIS_BONUS)
      : distance;
    
    // Only consider points within activation threshold
    if (distance <= ACTIVATION_THRESHOLD && effectiveDistance < minDistance) {
      minDistance = effectiveDistance;
      closest = point;
    }
  }

  return closest;
};

/**
 * Create a floating drag element that follows the user's finger
 */
export const createFloatingDragElement = (sourceElement: HTMLElement): HTMLElement => {
  const clone = sourceElement.cloneNode(true) as HTMLElement;
  const rect = sourceElement.getBoundingClientRect();
  
  clone.style.position = 'fixed';
  clone.style.zIndex = '9999';
  clone.style.pointerEvents = 'none';
  clone.style.transform = 'scale(1.05)';
  clone.style.opacity = '0.9';
  clone.style.width = sourceElement.offsetWidth + 'px';
  clone.style.transition = 'none';
  
  // Position at the same X position as the original field
  clone.style.left = rect.left + 'px';
  
  // Add visual enhancement
  clone.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
  clone.style.borderRadius = '9999px';
  
  document.body.appendChild(clone);
  return clone;
};

/**
 * Update the position of a floating drag element
 */
export const updateFloatingDragElementPosition = (element: HTMLElement, y: number): void => {
  if (!element) return;
  
  const rect = element.getBoundingClientRect();
  const centerY = y - rect.height / 2;
  
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
 * Execute the actual field reordering based on insertion point
 */
export const executeFieldDrop = (
  draggedFieldId: string, 
  insertionPoint: InsertionPoint,
  currentSocialProfiles: any[]
): any[] => {
  // Find the dragged field
  const draggedField = currentSocialProfiles.find(profile => profile.platform === draggedFieldId);
  if (!draggedField) return currentSocialProfiles;

  // Remove the dragged field from current position
  const otherFields = currentSocialProfiles.filter(profile => profile.platform !== draggedFieldId);
  
  // Create updated field with new section
  const updatedDraggedField = {
    ...draggedField,
    section: insertionPoint.section === 'universal' ? 'personal' : insertionPoint.section
  };

  // Determine insertion logic based on insertion point type
  switch (insertionPoint.type) {
    case 'before-edit-background':
      // Move to end of personal section (universal area maps to personal)
      return [...otherFields, updatedDraggedField];
      
    case 'section-start':
      // Insert at the beginning of the target section
      const sectionFields = otherFields.filter(p => p.section === insertionPoint.section);
      const nonSectionFields = otherFields.filter(p => p.section !== insertionPoint.section);
      return [...nonSectionFields, updatedDraggedField, ...sectionFields];
      
    case 'between-fields':
      // Insert before the specified field
      if (insertionPoint.beforeField) {
        const beforeIndex = otherFields.findIndex(p => p.platform === insertionPoint.beforeField);
        if (beforeIndex >= 0) {
          const result = [...otherFields];
          result.splice(beforeIndex, 0, updatedDraggedField);
          return result;
        }
      }
      return [...otherFields, updatedDraggedField];
      
    case 'after-fields':
      // Insert after the specified field, or at end of section
      if (insertionPoint.afterField) {
        const afterIndex = otherFields.findIndex(p => p.platform === insertionPoint.afterField);
        if (afterIndex >= 0) {
          const result = [...otherFields];
          result.splice(afterIndex + 1, 0, updatedDraggedField);
          return result;
        }
      }
      // If no afterField specified, add to end of target section
      const targetSectionFields = otherFields.filter(p => p.section === insertionPoint.section);
      const otherSectionFields = otherFields.filter(p => p.section !== insertionPoint.section);
      return [...otherSectionFields, ...targetSectionFields, updatedDraggedField];
      
    default:
      return [...otherFields, updatedDraggedField];
  }
};

/**
 * NEW POSITIONAL APPROACH: Find which field the finger is hovering over
 */
export const findHoveredField = (dragY: number): HoverInfo | null => {
  const ACTIVATION_THRESHOLD = 40;
  
  // Find all draggable fields currently in the DOM
  const draggableFields = document.querySelectorAll('[data-draggable="true"]');
  
  for (const fieldElement of draggableFields) {
    const rect = fieldElement.getBoundingClientRect();
    const fieldY = rect.top + window.scrollY;
    const fieldBottom = fieldY + rect.height;
    
    // Check if finger is within field bounds (with some threshold)
    if (dragY >= fieldY - ACTIVATION_THRESHOLD && dragY <= fieldBottom + ACTIVATION_THRESHOLD) {
      const fieldId = fieldElement.getAttribute('data-field-id') || '';
      const input = fieldElement.querySelector('input');
      
      // Determine section from field ID
      const [platform, section] = fieldId.split('-');
      const sectionType = section as 'universal' | 'personal' | 'work';
      
      // Determine if finger is in top half or bottom half
      const fieldCenter = fieldY + rect.height / 2;
      const topHalf = dragY < fieldCenter;
      
      return {
        fieldElement: fieldElement as HTMLElement,
        fieldId,
        section: sectionType,
        rect,
        topHalf
      };
    }
  }
  
  return null;
};

/**
 * NEW POSITIONAL APPROACH: Calculate insertion point based on hover info
 */
export const calculateInsertionPoint = (hoverInfo: HoverInfo): InsertionPoint => {
  const insertionY = hoverInfo.topHalf ? 
    hoverInfo.rect.top + window.scrollY - 10 : 
    hoverInfo.rect.bottom + window.scrollY + 10;
  
  return {
    id: `${hoverInfo.fieldId}-${hoverInfo.topHalf ? 'above' : 'below'}`,
    y: insertionY,
    section: hoverInfo.section,
    type: hoverInfo.topHalf ? 'before-field' : 'after-field',
    relatedField: hoverInfo.fieldId,
    ...(hoverInfo.topHalf ? { beforeField: hoverInfo.fieldId } : { afterField: hoverInfo.fieldId })
  };
};

/**
 * NEW POSITIONAL APPROACH: Simple threshold check for insertion point activation
 */
export const shouldActivateInsertionPoint = (
  insertionPoint: InsertionPoint,
  dragY: number
): boolean => {
  const ACTIVATION_THRESHOLD = 20;
  return Math.abs(dragY - insertionPoint.y) <= ACTIVATION_THRESHOLD;
};

/**
 * Get all possible insertion points from fields currently in DOM
 */
export const getAllFieldInsertionPoints = (): InsertionPoint[] => {
  const insertionPoints: InsertionPoint[] = [];
  const draggableFields = document.querySelectorAll('[data-draggable="true"]');
  
  for (const fieldElement of draggableFields) {
    const rect = fieldElement.getBoundingClientRect();
    const fieldId = fieldElement.getAttribute('data-field-id') || '';
    const [platform, section] = fieldId.split('-');
    const sectionType = section as 'universal' | 'personal' | 'work';
    
    const fieldY = rect.top + window.scrollY;
    
    // Above insertion point
    insertionPoints.push({
      id: `${fieldId}-above`,
      y: fieldY - 10,
      section: sectionType,
      type: 'before-field',
      relatedField: fieldId,
      beforeField: fieldId
    });
    
    // Below insertion point  
    insertionPoints.push({
      id: `${fieldId}-below`,
      y: fieldY + rect.height + 10,
      section: sectionType,
      type: 'after-field', 
      relatedField: fieldId,
      afterField: fieldId
    });
  }
  
  return insertionPoints;
};

/**
 * CORE LOGIC: Determine reserved space while maintaining exactly one at all times
 */
export const determineReservedSpace = (
  dragY: number,
  draggedFieldId: string,
  currentReservedSpace: ReservedSpace | null
): ReservedSpace => {
  // Get all possible target insertion points
  const allFieldInsertionPoints = getAllFieldInsertionPoints();
  
  // Include current reserved space as a candidate (if it's a target type)
  const allCandidates = [...allFieldInsertionPoints];
  if (currentReservedSpace?.type === 'target') {
    allCandidates.push(currentReservedSpace.insertionPoint);
  }
  
  // Find nearest insertion point
  let nearestPoint: InsertionPoint | null = null;
  let minDistance = Infinity;
  
  for (const point of allCandidates) {
    const distance = Math.abs(dragY - point.y);
    const ACTIVATION_THRESHOLD = 40;
    
    // Only consider points within reasonable distance
    if (distance <= ACTIVATION_THRESHOLD && distance < minDistance) {
      minDistance = distance;
      nearestPoint = point;
    }
  }
  
  // If we found a nearby target insertion point, use it
  if (nearestPoint) {
    return {
      type: 'target',
      insertionPoint: nearestPoint
    };
  }
  
  // Otherwise, show original placeholder (ALWAYS have exactly one reserved space)
  const originalInsertionPoint: InsertionPoint = {
    id: `${draggedFieldId}-original`,
    y: dragY, // Doesn't matter for original placeholder positioning
    section: 'universal', // Will be determined by field location
    type: 'before-field',
    relatedField: draggedFieldId
  };
  
  return {
    type: 'original',
    insertionPoint: originalInsertionPoint,
    fieldId: draggedFieldId
  };
};

/**
 * Animate the floating element to snap to the insertion point
 */
export const animateSnapToPosition = (
  dragElement: HTMLElement,
  insertionPoint: InsertionPoint,
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
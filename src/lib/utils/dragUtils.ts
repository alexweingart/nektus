export interface InsertionPoint {
  id: string;
  y: number; // Y coordinate from page top
  section: 'universal' | 'personal' | 'work';
  type: 'before-edit-background' | 'section-start' | 'between-fields' | 'after-fields';
  beforeField?: string; // field ID that comes after this insertion point
  afterField?: string; // field ID that comes before this insertion point
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
 * Find the nearest insertion point to the given Y coordinate
 */
export const findNearestInsertionPoint = (
  dragY: number, 
  insertionPoints: InsertionPoint[]
): InsertionPoint | null => {
  if (insertionPoints.length === 0) return null;

  let closest = insertionPoints[0];
  let minDistance = Math.abs(dragY - closest.y);

  // Find the closest point
  for (const point of insertionPoints) {
    const distance = Math.abs(dragY - point.y);
    if (distance < minDistance) {
      minDistance = distance;
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
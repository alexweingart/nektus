'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ContactEntry, FieldSection } from '@/types/profile';

// Global drag state singleton to prevent multiple hook instances from conflicting
class GlobalDragManager {
  private static instance: GlobalDragManager;
  private isActive = false;
  private listeners: {
    touchMove?: (e: TouchEvent) => void;
    preventScrolling?: (e: TouchEvent) => void;
  } = {};

  static getInstance() {
    if (!GlobalDragManager.instance) {
      GlobalDragManager.instance = new GlobalDragManager();
    }
    return GlobalDragManager.instance;
  }

  activateDrag(handlers: { touchMove: (e: TouchEvent) => void }) {
    if (this.isActive) {
      return;
    }

    this.isActive = true;

    // Prevent scrolling
    const preventScrolling = (e: TouchEvent) => {
      if (e.cancelable) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    this.listeners.touchMove = handlers.touchMove;
    this.listeners.preventScrolling = preventScrolling;

    document.addEventListener('touchmove', handlers.touchMove, { passive: false });
    document.addEventListener('touchmove', preventScrolling, { passive: false });
    document.body.style.touchAction = 'none';
  }

  deactivateDrag() {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;

    if (this.listeners.touchMove) {
      document.removeEventListener('touchmove', this.listeners.touchMove);
    }
    if (this.listeners.preventScrolling) {
      document.removeEventListener('touchmove', this.listeners.preventScrolling);
    }

    document.body.style.touchAction = '';
    this.listeners = {};
  }
}

// Helper: Create floating ghost element
function createFloatingGhost(sourceElement: HTMLElement): HTMLElement {
  const clone = sourceElement.cloneNode(true) as HTMLElement;

  const fieldWidth = sourceElement.offsetWidth;
  const fieldHeight = sourceElement.offsetHeight;

  // Remove draggable attributes
  clone.removeAttribute('data-draggable');
  clone.removeAttribute('data-field-id');
  clone.querySelectorAll('[data-draggable]').forEach(child => {
    child.removeAttribute('data-draggable');
    child.removeAttribute('data-field-id');
  });

  clone.style.position = 'fixed';
  clone.style.zIndex = '9999';
  clone.style.pointerEvents = 'none';
  clone.style.left = '50%';
  clone.style.marginLeft = '-' + (fieldWidth / 2) + 'px';
  clone.style.transform = 'scale(1.05)';
  clone.style.transformOrigin = 'center center';
  clone.style.opacity = '0.9';
  clone.style.visibility = 'visible';
  clone.style.display = 'block';

  clone.style.width = fieldWidth + 'px';
  clone.style.height = fieldHeight + 'px';
  clone.style.minWidth = fieldWidth + 'px';
  clone.style.minHeight = fieldHeight + 'px';
  clone.style.maxWidth = fieldWidth + 'px';
  clone.style.maxHeight = fieldHeight + 'px';
  clone.style.transition = 'none';
  clone.style.overflow = 'hidden';

  clone.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
  clone.style.borderRadius = '9999px';

  document.body.appendChild(clone);

  return clone;
}

// Helper: Update ghost Y position
function updateGhostPosition(element: HTMLElement, _x: number, y: number): void {
  if (!element) return;

  const ghostRect = element.getBoundingClientRect();
  const centerY = y - ghostRect.height / 2;

  element.style.top = centerY + 'px';
}

// Helper: Remove ghost element
function removeGhost(element: HTMLElement | null): void {
  if (element && element.parentNode) {
    document.body.removeChild(element);
  }
}

// Helper: Capture field midpoints
function captureFieldMidpoints(fields: ContactEntry[], scrollOffset: number): ContactEntry[] {
  return fields.map(field => {
    const fieldId = `${field.fieldType}-${field.section}`;
    const fieldElement = document.querySelector(`[data-field-id="${fieldId}"]`);

    if (fieldElement) {
      const rect = fieldElement.getBoundingClientRect();
      const midpointY = rect.top + rect.height / 2 + scrollOffset;
      return { ...field, frozenMidpointY: midpointY };
    }

    return { ...field, frozenMidpointY: 0 };
  });
}

// Helper: Find closest field to ghost
function findClosestField(
  ghostY: number,
  fields: (ContactEntry & { frozenMidpointY?: number })[]
): { field: ContactEntry & { frozenMidpointY?: number }, insertAfter: boolean } | null {
  let closest: (ContactEntry & { frozenMidpointY?: number }) | null = null;
  let minDistance = Infinity;

  fields.forEach(field => {
    if (field.isPlaceholder) return;
    const distance = Math.abs(ghostY - (field.frozenMidpointY || 0));
    if (distance < minDistance) {
      minDistance = distance;
      closest = field;
    }
  });

  if (!closest) return null;

  return {
    field: closest,
    insertAfter: ghostY > (closest.frozenMidpointY || 0)
  };
}

export interface DragDropInfo {
  fields: ContactEntry[];
  draggedField: ContactEntry;
  originalField: ContactEntry;
}

interface UseDragAndDropProps {
  initialFields?: ContactEntry[];
  currentSection?: 'Personal' | 'Work';
  onDragStateChange?: (isDragging: boolean) => void;
  onFieldArrayDrop?: (dropInfo: DragDropInfo) => void;
}

interface UseDragAndDropReturn {
  isDragMode: boolean;
  draggedField: ContactEntry | null;
  dragFields: ContactEntry[];

  onTouchStart: (fieldId: string) => (event: React.TouchEvent) => void;
  onTouchMove: (event: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

export const useDragAndDrop = ({
  initialFields = [],
  currentSection = 'Personal',
  onDragStateChange,
  onFieldArrayDrop
}: UseDragAndDropProps = {}): UseDragAndDropReturn => {

  // State
  const [dragState, setDragState] = useState<'idle' | 'dragging'>('idle');
  const [draggedField, setDraggedField] = useState<ContactEntry | null>(null);
  const [dragFields, setDragFields] = useState<ContactEntry[]>([]);
  const [ghostElement, setGhostElement] = useState<HTMLElement | null>(null);

  // Touch interaction state
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);

  // Refs
  const currentSectionRef = useRef(currentSection);
  const onFieldArrayDropRef = useRef(onFieldArrayDrop);
  const initialFieldsRef = useRef(initialFields);
  const lastSwapTimeRef = useRef<number>(0);
  const handleTouchMoveRef = useRef<((event: React.TouchEvent) => void) | null>(null);

  // Update refs
  currentSectionRef.current = currentSection;
  onFieldArrayDropRef.current = onFieldArrayDrop;
  initialFieldsRef.current = initialFields;

  // Derived state
  const isDragMode = dragState === 'dragging';

  // Notify parent of drag state changes
  useEffect(() => {
    onDragStateChange?.(isDragMode);
  }, [isDragMode, onDragStateChange]);

  // Get scroll offset
  const getScrollOffset = useCallback(() => {
    return window.scrollY;
  }, []);

  // Start long press for drag initiation
  const startLongPress = useCallback((fieldId: string, event: React.TouchEvent) => {
    const touch = event.touches[0];
    setTouchStartPos({ x: touch.clientX, y: touch.clientY });

    const timer = setTimeout(() => {
      // Get current section fields
      const currentSectionName = currentSectionRef.current.toLowerCase() as 'personal' | 'work';
      const sectionFields = initialFieldsRef.current.filter(f =>
        f.section === currentSectionName &&
        f.isVisible &&
        f.fieldType !== 'calendar' &&
        f.fieldType !== 'location'
      ).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      // Find dragged field
      const draggedField = sectionFields.find(f => `${f.fieldType}-${f.section}` === fieldId);
      if (!draggedField) {
        console.warn('[startLongPress] Field not found:', fieldId);
        return;
      }

      // Create ghost element
      const sourceElement = document.querySelector(`[data-field-id="${fieldId}"]`) as HTMLElement;
      let ghost: HTMLElement | null = null;

      if (sourceElement) {
        ghost = createFloatingGhost(sourceElement);
        const rect = sourceElement.getBoundingClientRect();
        updateGhostPosition(ghost, rect.left + rect.width / 2, rect.top + rect.height / 2);
        setGhostElement(ghost);
      }

      // Capture midpoints and create dragFields
      const scrollOffset = getScrollOffset();
      const fieldsWithMidpoints = captureFieldMidpoints(sectionFields, scrollOffset);

      // Remove dragged field and insert placeholder
      const draggedIndex = fieldsWithMidpoints.findIndex(f =>
        f.fieldType === draggedField.fieldType && f.section === draggedField.section
      );

      const fieldsWithoutDragged = fieldsWithMidpoints.filter((_, i) => i !== draggedIndex);

      // Insert placeholder at dragged position
      const placeholder: ContactEntry & { isPlaceholder?: boolean; frozenMidpointY?: number } = {
        fieldType: '__PLACEHOLDER__',
        section: currentSectionName,
        value: '',
        confirmed: false,
        isVisible: true,
        order: draggedField.order,
        isPlaceholder: true,
        frozenMidpointY: fieldsWithMidpoints[draggedIndex]?.frozenMidpointY || 0
      };

      fieldsWithoutDragged.splice(draggedIndex, 0, placeholder);

      // Set state
      setDragState('dragging');
      setDraggedField(draggedField);
      setDragFields(fieldsWithoutDragged);

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 1000); // 1 second long press

    setLongPressTimer(timer);
  }, [getScrollOffset]);

  // Cancel long press
  const cancelLongPress = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setTouchStartPos(null);
  }, [longPressTimer]);

  // Move placeholder
  const movePlaceholder = useCallback((ghostY: number) => {
    const closest = findClosestField(ghostY, dragFields);
    if (!closest) return;

    const placeholderIndex = dragFields.findIndex(f => f.isPlaceholder);
    const targetIndex = dragFields.findIndex(f =>
      f.fieldType === closest.field.fieldType && f.section === closest.field.section
    );

    if (placeholderIndex === -1 || targetIndex === -1) return;

    const newPlaceholderOrder = closest.insertAfter
      ? (dragFields[targetIndex].order ?? 0) + 1
      : dragFields[targetIndex].order ?? 0;

    const currentPlaceholder = dragFields[placeholderIndex];
    if (currentPlaceholder.order === newPlaceholderOrder) return; // No change

    // Throttle swaps
    const now = Date.now();
    if (now - lastSwapTimeRef.current < 100) return;
    lastSwapTimeRef.current = now;

    // Swap orders
    const newDragFields = dragFields.map(field => {
      if (field.isPlaceholder) {
        return { ...field, order: newPlaceholderOrder };
      }
      if (field.order === newPlaceholderOrder) {
        return { ...field, order: currentPlaceholder.order };
      }
      return field;
    });

    // Sort by order
    newDragFields.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    setDragFields(newDragFields);
  }, [dragFields]);

  // Handle touch move
  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];

    if (!touchStartPos) return;

    const deltaX = Math.abs(touch.clientX - touchStartPos.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.y);

    // Cancel long press if finger moves too much during initial press
    if (dragState === 'idle' && (deltaX > 10 || deltaY > 10)) {
      cancelLongPress();
      return;
    }

    // If not in drag mode yet, don't process drag logic
    if (dragState === 'idle' || !draggedField) {
      return;
    }

    // Update ghost position
    if (ghostElement) {
      if (!document.body.contains(ghostElement)) {
        setGhostElement(null);
        return;
      }
      updateGhostPosition(ghostElement, touch.clientX, touch.clientY);
    }

    // Calculate ghost Y with scroll offset
    const scrollOffset = getScrollOffset();
    const ghostY = touch.clientY + scrollOffset;

    // Move placeholder if needed
    movePlaceholder(ghostY);
  }, [touchStartPos, draggedField, ghostElement, cancelLongPress, dragState, movePlaceholder, getScrollOffset]);

  // Handle touch end (drop)
  const handleTouchEnd = useCallback(() => {
    // Check if this is a valid drop scenario
    const isValidDrop = dragState === 'dragging' && draggedField && ghostElement;

    if (isValidDrop) {
      // Get placeholder's final order
      const placeholder = dragFields.find(f => f.isPlaceholder);
      if (!placeholder) {
        console.warn('[handleTouchEnd] No placeholder found');
        return;
      }

      const finalOrder = placeholder.order;

      // Remove placeholder and add dragged field
      const sectionFieldsReordered = dragFields
        .filter(f => !f.isPlaceholder)
        .concat({
          ...draggedField,
          order: finalOrder
        })
        .map(f => {
          const { frozenMidpointY, isPlaceholder, ...cleanField } = f as ContactEntry & { frozenMidpointY?: number; isPlaceholder?: boolean };
          return cleanField;
        });

      // Sort by order
      sectionFieldsReordered.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      // Recalculate orders to be sequential
      sectionFieldsReordered.forEach((f, i) => {
        f.order = i;
      });

      // Merge with all fields
      const currentSectionName = currentSectionRef.current.toLowerCase() as 'personal' | 'work';
      const allFieldsUpdated = initialFieldsRef.current
        .filter(f => f.section !== currentSectionName)
        .concat(sectionFieldsReordered);

      // Send to parent
      if (onFieldArrayDropRef.current) {
        onFieldArrayDropRef.current({
          fields: allFieldsUpdated,
          draggedField: { ...draggedField, order: finalOrder },
          originalField: draggedField
        });
      }
    }

    // Cleanup
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setTouchStartPos(null);
    setDragState('idle');
    setDraggedField(null);
    setDragFields([]);
    removeGhost(ghostElement);
    setGhostElement(null);
  }, [dragState, draggedField, ghostElement, dragFields, longPressTimer]);

  // Assign function to ref
  handleTouchMoveRef.current = handleTouchMove;

  // Handle global drag interactions
  useEffect(() => {
    const globalManager = GlobalDragManager.getInstance();

    if (dragState === 'dragging') {
      const globalTouchMove = (e: TouchEvent) => {
        if (e.touches.length > 0) {
          const syntheticEvent = {
            touches: Array.from(e.touches).map(touch => ({
              clientX: touch.clientX,
              clientY: touch.clientY,
              pageX: touch.pageX,
              pageY: touch.pageY
            }))
          } as unknown as React.TouchEvent<Element>;

          const currentHandler = handleTouchMoveRef.current;
          if (currentHandler) {
            currentHandler(syntheticEvent);
          }
        }
      };

      const preventContextMenu = (e: Event) => {
        e.preventDefault();
      };

      globalManager.activateDrag({ touchMove: globalTouchMove });
      document.addEventListener('contextmenu', preventContextMenu);

      return () => {
        globalManager.deactivateDrag();
        document.removeEventListener('contextmenu', preventContextMenu);
      };
    } else {
      globalManager.deactivateDrag();
    }
  }, [dragState]);

  // Create touch start handler
  const onTouchStart = useCallback((fieldId: string) => (event: React.TouchEvent) => {
    startLongPress(fieldId, event);
  }, [startLongPress]);

  return {
    isDragMode,
    draggedField,
    dragFields,
    onTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd
  };
};

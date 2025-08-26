'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

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
import type { ContactEntry } from '@/types/profile';
import {
  createFloatingDragElement,
  updateFloatingDragElementPosition,
  removeFloatingDragElement,
  animateSnapToPosition,
  detectDragType,
  findClosestField,
  calculateTargetY
} from '@/lib/utils/dragUtils';
// No need for hardcoded platform order anymore

export interface DragDropInfo {
  fields: ContactEntry[];
  draggedField: ContactEntry;
  dragType: 'same-section' | 'universal-to-section' | 'section-to-universal';
}

interface UseDragAndDropProps {
  initialFields?: ContactEntry[];  // Pass in initial fields for field array approach
  currentSection?: 'Personal' | 'Work'; // Current tab section
  onDragStateChange?: (isDragging: boolean) => void;
  onFieldArrayDrop?: (dropInfo: DragDropInfo) => void; // Enhanced with drag context
}

interface UseDragAndDropReturn {
  // State
  isDragMode: boolean; // Derived from dragState
  draggedField: string | null;
  reservedSpaceState: Record<string, 'none' | 'above' | 'below'>;
  reservedSpaceHeight: number;
  currentSwap: {from: string, to: string} | null;
  
  // Handlers for draggable elements
  onTouchStart: (fieldId: string) => (event: React.TouchEvent) => void;
  onTouchMove: (event: React.TouchEvent) => void;
  onTouchEnd: () => void;
  
  // Control functions
  exitDragMode: () => void;
}

export const useDragAndDrop = ({ 
  initialFields = [], 
  currentSection = 'Personal',
  onDragStateChange, 
  onFieldArrayDrop 
}: UseDragAndDropProps = {}): UseDragAndDropReturn => {
  
  // Simplified drag state
  type DragState = 'idle' | 'dragging';
  const [dragState, setDragState] = useState<DragState>('idle');
  const [draggedField, setDraggedField] = useState<string | null>(null);
  const [dragElement, setDragElement] = useState<HTMLElement | null>(null);
  
  // Track current swap (only one at a time for simplicity)
  const [currentSwap, setCurrentSwap] = useState<{from: string, to: string} | null>(null);
  
  // Reserved space state for visual feedback (triggers re-renders for spacing only)
  const [reservedSpaceState, setReservedSpaceState] = useState<Record<string, 'none' | 'above' | 'below'>>({});
  
  // Height measurement for reserved space
  const reservedSpaceHeightRef = useRef<number>(0);
  
  // Touch interaction state
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);
  
  
  // Create stable refs for values used in callbacks but shouldn't trigger callback recreation
  const currentSectionRef = useRef(currentSection);
  const initialFieldsRef = useRef(initialFields);
  const onFieldArrayDropRef = useRef(onFieldArrayDrop);
  
  // Update refs on every render (doesn't trigger re-renders)
  currentSectionRef.current = currentSection;
  initialFieldsRef.current = initialFields;
  onFieldArrayDropRef.current = onFieldArrayDrop;
  
  // Stabilized refs updated (logging removed for clarity)
  
  
  // Phase 4: Reserved space application system
  const updateReservedSpace = useCallback((
    targetFieldType: string,
    direction: 'up' | 'down'
  ) => {
    setReservedSpaceState(prev => {
      // Much simpler approach: clone prev and just change what we need
      const reset = { ...prev };
      
      // Reset everything to 'none'
      Object.keys(reset).forEach(key => {
        reset[key] = 'none';
      });
      
      // Set the target field
      const targetFieldId = targetFieldType.includes('-') ? targetFieldType : `${targetFieldType}-${currentSectionRef.current.toLowerCase()}`;
      const reservedSpaceValue = direction === 'up' ? 'above' : 'below';
      reset[targetFieldId] = reservedSpaceValue;
      
      return reset;
    });
  }, []);
  
  // Set initial reserved space when entering drag mode
  const setInitialReservedSpace = useCallback((draggedFieldId: string) => {
    const currentFieldOrder = fieldOrderRef.current;
    const draggedIndex = currentFieldOrder.findIndex(f => `${f.fieldType}-${f.section}` === draggedFieldId);
    
    if (draggedIndex === -1) {
      console.warn('[useDragAndDrop] ⚠️ Could not find dragged field in order:', draggedFieldId);
      return;
    }
    
    const draggedField = currentFieldOrder[draggedIndex];
    
    // Check if this is the only visible field in its section (special case)
    const visibleFieldsInSameSection = currentFieldOrder.filter(f => 
      f.section === draggedField.section && f.isVisible
    );
    
    if (visibleFieldsInSameSection.length === 1 && visibleFieldsInSameSection[0] === draggedField) {
      // Special case: only field in section - target itself with space above
      console.log(`[setInitialReservedSpace] ${draggedFieldId} -> ${draggedFieldId} (above) [only field in section]`);
      updateReservedSpace(draggedFieldId, 'up');
      return;
    }
    
    // Normal case: multiple fields in section
    let targetFieldId: string | null = null;
    let reservedSpacePosition: 'above' | 'below' = 'above';
    
    // Check if this is the last VISIBLE field in its section
    const nextVisibleFieldInSection = currentFieldOrder
      .slice(draggedIndex + 1)
      .find(f => f.section === draggedField.section && f.isVisible);
    
    const isLastVisibleInSection = !nextVisibleFieldInSection;
    
    if (isLastVisibleInSection && draggedIndex > 0) {
      // Last visible in section: use field ABOVE the dragged field, put reserved space BELOW it
      const prevField = currentFieldOrder[draggedIndex - 1];
      targetFieldId = `${prevField.fieldType}-${prevField.section}`;
      reservedSpacePosition = 'below';
    } else if (nextVisibleFieldInSection) {
      // Normal case: use next VISIBLE field BELOW the dragged field, put reserved space ABOVE it
      targetFieldId = `${nextVisibleFieldInSection.fieldType}-${nextVisibleFieldInSection.section}`;
      reservedSpacePosition = 'above';
    }
    
    if (targetFieldId) {
      console.log(`[setInitialReservedSpace] ${draggedFieldId} -> ${targetFieldId} (${reservedSpacePosition})`);
      updateReservedSpace(targetFieldId, reservedSpacePosition === 'above' ? 'up' : 'down');
    }
  }, [updateReservedSpace]);
  
  
  // Field order tracking - using ref to avoid re-renders
  const fieldOrderRef = useRef<ContactEntry[]>([]);
  
  // Initialize and update fieldOrder ref when initialFields change
  useEffect(() => {
    if (!initialFields || initialFields.length === 0) {
      fieldOrderRef.current = [];
      return;
    }
    
    // Filter to only fields from current section or universal
    const sectionName = currentSection.toLowerCase() as 'personal' | 'work';
    const filteredFields = initialFields.filter(field => {
      // Only include fields from current section or universal fields (but include both visible and hidden)
      const isInCurrentSection = field.section === sectionName || field.section === 'universal';
      return isInCurrentSection;
    });
    
    fieldOrderRef.current = [...filteredFields];
  }, [initialFields, currentSection]); // Only depend on initialFields and currentSection, NOT currentSwap
  
  // Continuous edge scroll refs
  const scrollAnimationFrame = useRef<number | null>(null);
  const edgeScrollDirection = useRef<'up' | 'down' | null>(null);

  // Continuous edge scroll helpers
  const scrollSpeed = 12; // px per frame

  // Reference to the scrollable container (PullToRefresh root)
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  // Helper to get current scroll offset
  const getScrollOffset = useCallback(() => {
    return scrollContainerRef.current ? scrollContainerRef.current.scrollTop : window.scrollY;
  }, []);

  // Store last touch Y for edge scroll updates
  const lastClientYRef = useRef<number>(0);
  
  // Create refs to avoid circular dependencies and enable persistent event handlers
  const handleEdgeScrollRef = useRef<((clientY: number) => void) | null>(null);
  const exitDragModeRef = useRef<(() => void) | null>(null);
  const handleTouchMoveRef = useRef<((event: React.TouchEvent) => void) | null>(null);

  // Derive backward-compatible value
  const isDragMode = dragState === 'dragging';

  // Notify parent of drag state changes
  useEffect(() => {
    onDragStateChange?.(isDragMode);
  }, [isDragMode, onDragStateChange]);

  // Cleanup when exiting drag mode
  useEffect(() => {
    if (dragState === 'idle') {
      setCurrentSwap(null); // Clear swap
      setReservedSpaceState({}); // Clear all reserved spaces
    }
  }, [dragState]);

  // Start long press for drag initiation
  const startLongPress = useCallback((fieldId: string, event: React.TouchEvent) => {
    
    // If already in drag mode, exit current drag and start new one
    if (dragState === 'dragging') {
      // Clean up current drag
      exitDragModeRef.current?.();
      
      // Small delay to ensure cleanup completes, then start new drag
      setTimeout(() => {
        startLongPress(fieldId, event);
      }, 50);
      return;
    }

    const touch = event.touches[0];
    setTouchStartPos({ x: touch.clientX, y: touch.clientY });

    const timer = setTimeout(() => {
      // Create ghost BEFORE setting drag mode (while element is still visible)
      const sourceElement = document.querySelector(`[data-field-id="${fieldId}"]`) as HTMLElement;
      let dragEl: HTMLElement | null = null;
      
      if (sourceElement) {
        // Measure field height for reserved space
        const fieldHeight = sourceElement.offsetHeight;
        reservedSpaceHeightRef.current = fieldHeight;
        
        // Create the ghost while the element is still visible
        dragEl = createFloatingDragElement(sourceElement);
        const rect = sourceElement.getBoundingClientRect();
        updateFloatingDragElementPosition(dragEl, rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
      
      // NOW set drag mode which will make the original field invisible
      setDragState('dragging');
      setDraggedField(fieldId);
      
      // Store the drag element
      if (dragEl) {
        setDragElement(dragEl);
      }
      
      // Set initial reserved space to show where the dragged item "came from"
      setInitialReservedSpace(fieldId);
      
      // Add haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 1000); // 1 second long press

    setLongPressTimer(timer);
  }, [dragState, setInitialReservedSpace]);

  // Handle touch end - either cancel long press or execute drop
  const handleTouchEnd = useCallback(() => {
    
    // Check if this is a valid drop scenario - if there's a current swap
    const isValidDrop = dragState === 'dragging' && currentSwap && draggedField && dragElement;
    
    
    if (isValidDrop) {
      // Execute snap animation and drop
      animateSnapToPosition(dragElement, { y: 0 }, () => {
        
        // Call field array drop callback with enhanced context - USE REF
        if (onFieldArrayDropRef.current && draggedField && currentSwap) {
          const draggedFieldData = fieldOrderRef.current.find(f => `${f.fieldType}-${f.section}` === currentSwap.from);
          if (draggedFieldData) {
            // Determine drag type using utility function - USE REF
            const originalField = initialFieldsRef.current?.find(f => `${f.fieldType}-${f.section}` === currentSwap.from);
            const targetField = fieldOrderRef.current.find(f => `${f.fieldType}-${f.section}` === currentSwap.to);
            
            if (!originalField || !targetField) return;
            
            const dragType = detectDragType(originalField, targetField);
            
            onFieldArrayDropRef.current({
              fields: fieldOrderRef.current,
              draggedField: draggedFieldData,
              dragType
            });
          }
        }
        
        
        // Clean up drag state
        setDragState('idle');
        setDraggedField(null);
        removeFloatingDragElement(dragElement);
        setDragElement(null);
        
        // Clean up touch state
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          setLongPressTimer(null);
        }
        setTouchStartPos(null);
        
      });
    } else {
      
      // Regular cancel long press behavior
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
      
      setTouchStartPos(null);
    }
  }, [dragState, currentSwap, draggedField, dragElement, longPressTimer]); // Removed onFieldArrayDrop and fieldOrder - using refs

  // Cancel long press (for cases where we need to cancel without drop logic)
  const cancelLongPress = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    setTouchStartPos(null);
  }, [longPressTimer]);

  // Shared swap detection logic
  const handleSwapDetection = useCallback((targetY: number, draggedField: string) => {
    // Get current visible fields for swap detection - USE REFS
    const sectionName = currentSectionRef.current.toLowerCase() as 'personal' | 'work';
    let allVisibleFields = initialFieldsRef.current.filter(f => f.isVisible && 
      (f.section === sectionName || f.section === 'universal'));
    
    // Special case: if dragged field is the only field in its section, include it as a target
    const draggedFieldData = initialFieldsRef.current.find(f => `${f.fieldType}-${f.section}` === draggedField);
    if (draggedFieldData) {
      const draggedFieldSection = draggedFieldData.section;
      // Count all fields in section, treating the dragged field as visible for this check
      const fieldsInSameSection = initialFieldsRef.current.filter(f => 
        f.section === draggedFieldSection && 
        (f.isVisible || `${f.fieldType}-${f.section}` === draggedField)
      );
      
      // If only one field in section (the dragged field), include it as target
      if (fieldsInSameSection.length === 1) {
        // Need to insert it in the correct position based on original field order
        // Find where it should be inserted based on initialFieldsRef order
        const draggedOriginalIndex = initialFieldsRef.current.findIndex(f => 
          `${f.fieldType}-${f.section}` === draggedField
        );
        
        // Find the insertion point in visibleFields
        let insertIndex = allVisibleFields.length;
        for (let i = 0; i < allVisibleFields.length; i++) {
          const visibleFieldOriginalIndex = initialFieldsRef.current.findIndex(f => 
            f.fieldType === allVisibleFields[i].fieldType && f.section === allVisibleFields[i].section
          );
          if (visibleFieldOriginalIndex > draggedOriginalIndex) {
            insertIndex = i;
            break;
          }
        }
        
        // Check if already added to prevent duplicates
        const alreadyAdded = allVisibleFields.some(f => `${f.fieldType}-${f.section}` === draggedField);
        if (!alreadyAdded) {
          // Create new array with the dragged field inserted at correct position
          const draggedFieldForDetection = { ...draggedFieldData, isVisible: true };
          allVisibleFields = [
            ...allVisibleFields.slice(0, insertIndex),
            draggedFieldForDetection,
            ...allVisibleFields.slice(insertIndex)
          ];
          console.log(`[handleSwapDetection] Added single field ${draggedField} at index ${insertIndex}`);
        } else {
          console.log(`[handleSwapDetection] Field ${draggedField} already in visible fields, skipping`);
        }
      }
    }
    
    // Calculate target position and find closest field
    const scrollOffset = getScrollOffset();
    console.log(`[handleSwapDetection] Finding closest field for Y:${targetY}, with ${allVisibleFields.length} visible fields`);
    const swapResult = findClosestField(targetY, allVisibleFields, scrollOffset, draggedField);
    
    if (!swapResult) {
      console.log('[handleSwapDetection] No swap result found');
      return;
    }
    
    console.log(`[handleSwapDetection] Swap result:`, swapResult);
    
    // Only proceed if we have a swap result
    // Special case: allow targeting the dragged field itself (return to origin)
    if (swapResult) {
      const currentTarget = currentSwap?.to;
      
      // Check if this is a cross-section drag
      // Important: Use currentSwap.to to determine current section if we're in a swap
      const effectiveDraggedField = currentSwap?.to || draggedField;
      const draggedSection = effectiveDraggedField.split('-')[1];
      const targetSection = swapResult.targetFieldId.split('-')[1];
      const isCrossSection = draggedSection !== targetSection;
      
      // For cross-section drags: up -> below, down -> above
      let finalDirection = swapResult.direction;
      if (isCrossSection) {
        finalDirection = swapResult.direction === 'up' ? 'down' : 'up';
      }
      
      // Special case: if target is the dragged field (only field in section), force "above"
      if (swapResult.targetFieldId === draggedField) {
        finalDirection = 'up'; // Always above for "return to origin"
      }
      
      // Get current reserved space position for the target field
      const currentReservedSpace = reservedSpaceState[swapResult.targetFieldId];
      const newReservedSpace = finalDirection === 'up' ? 'above' : 'below';
      
      // Update if target field changed OR direction changed
      if (currentTarget !== swapResult.targetFieldId || currentReservedSpace !== newReservedSpace) {
        console.log(`[handleSwapDetection] Updating: ${draggedField} (effective: ${effectiveDraggedField}) -> ${swapResult.targetFieldId} (${finalDirection})`);
        console.log(`  Cross-section: ${isCrossSection}, Original direction: ${swapResult.direction}, Final direction: ${finalDirection}`);
        console.log(`  Current reserved: ${currentReservedSpace}, New reserved: ${newReservedSpace}`);
        
        // Single atomic operation: update reserved space directly
        updateReservedSpace(swapResult.targetFieldId, finalDirection);
        setCurrentSwap({ from: draggedField, to: swapResult.targetFieldId });
      } else {
        console.log(`[handleSwapDetection] No update needed:`);
        console.log(`  Current target: ${currentTarget}, New target: ${swapResult.targetFieldId}`);
        console.log(`  Current reserved: ${currentReservedSpace}, New reserved: ${newReservedSpace}`);
      }
    }
  }, [getScrollOffset, currentSwap, updateReservedSpace, reservedSpaceState]);

  // Handle touch move during drag
  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    
    if (!touchStartPos) return;
    
    const deltaX = Math.abs(touch.clientX - touchStartPos.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.y);

    // Cancel long press if finger moves too much during initial press
    if (dragState === 'idle' && (deltaX > 10 || deltaY > 10)) {
      console.log('[handleTouchMove] Canceling long press due to movement');
      cancelLongPress();
      return;
    }

    // If not in drag mode yet, don't process drag logic
    if (dragState === 'idle' || !draggedField) {
      console.log('[handleTouchMove] Not in drag mode or no dragged field');
      return;
    }

    // Already in dragging state, process drag logic
    if (dragState === 'dragging') {
      console.log('[handleTouchMove] Processing drag movement at Y:', touch.clientY);
      
      // Update floating drag element position
      if (dragElement) {
        // Check if drag element is still valid after DOM changes
        if (!document.body.contains(dragElement)) {
          console.warn('[handleTouchMove] Drag element no longer in DOM');
          setDragElement(null);
          exitDragModeRef.current?.();
          return;
        }
        updateFloatingDragElementPosition(dragElement, touch.clientX, touch.clientY);
      }

      // Record last client Y for edge scrolling
      lastClientYRef.current = touch.clientY;
      
      const scrollOffset = getScrollOffset();
      console.log('[handleTouchMove] Scroll offset:', scrollOffset);
      
      // Track swaps based on drag position
      if (draggedField) {
        const targetY = calculateTargetY(touch, dragElement, scrollOffset);
        console.log('[handleTouchMove] Calculated targetY:', targetY, 'for field:', draggedField);
        handleSwapDetection(targetY, draggedField);
      }
      
      // Handle edge scrolling
      handleEdgeScrollRef.current?.(touch.clientY);
    }
  }, [touchStartPos, draggedField, dragElement, cancelLongPress, getScrollOffset, dragState, handleSwapDetection]);

  // Stop edge scroll
  const stopEdgeScroll = useCallback(() => {
    if (scrollAnimationFrame.current !== null) {
      cancelAnimationFrame(scrollAnimationFrame.current);
      scrollAnimationFrame.current = null;
    }
    edgeScrollDirection.current = null;
  }, []);

  // Start edge scroll
  const startEdgeScroll = useCallback((direction: 'up' | 'down') => {
    if (edgeScrollDirection.current === direction) return; // already scrolling this way
    stopEdgeScroll();
    edgeScrollDirection.current = direction;

    const step = () => {
      if (edgeScrollDirection.current === null) return; // stopped
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollBy(0, direction === 'up' ? -scrollSpeed : scrollSpeed);
      } else {
        window.scrollBy(0, direction === 'up' ? -scrollSpeed : scrollSpeed);
      }
      
      // Recalculate swaps during edge scroll
      const fingerY = lastClientYRef.current;
      
      if (draggedField) {
        const scrollOffset = getScrollOffset();
        const targetY = calculateTargetY({ clientY: fingerY }, dragElement, scrollOffset);
        handleSwapDetection(targetY, draggedField);
      }
      
      scrollAnimationFrame.current = requestAnimationFrame(step);
    };

    step();
  }, [stopEdgeScroll, getScrollOffset, draggedField, dragElement, handleSwapDetection]);

  // Handle edge scrolling when dragging near viewport edges
  const handleEdgeScroll = useCallback((clientY: number) => {
    if (dragState === 'idle') {
      stopEdgeScroll();
      return;
    }

    const viewportHeight = window.innerHeight;
    const scrollZone = 100; // pixels from edge to trigger scroll

    if (clientY < scrollZone) {
      startEdgeScroll('up');
    } else if (clientY > viewportHeight - scrollZone) {
      startEdgeScroll('down');
    } else {
      // Not in edge zones -> stop scrolling
      stopEdgeScroll();
    }
  }, [dragState, startEdgeScroll, stopEdgeScroll]);

  // Assign the function to ref to avoid circular dependencies
  handleEdgeScrollRef.current = handleEdgeScroll;

  // Exit drag mode and clean up
  const exitDragMode = useCallback(() => {
    setDragState('idle');
    setDraggedField(null);

    // Stop any ongoing edge scroll
    stopEdgeScroll();
    
    // Clean up drag element
    removeFloatingDragElement(dragElement);
    setDragElement(null);
    
    // Clean up touch state
    cancelLongPress();
  }, [dragElement, cancelLongPress, stopEdgeScroll]);
  
  // Assign functions to refs for persistent access
  exitDragModeRef.current = exitDragMode;
  handleTouchMoveRef.current = handleTouchMove;
  
  // Handle drag mode interactions using GlobalDragManager singleton
  useEffect(() => {
    const globalManager = GlobalDragManager.getInstance();
    
    if (dragState === 'dragging') {
      
      // Global touch move handler to capture movements during drag - STABLE REFERENCE
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
          
          // Call the current handler via ref to get latest logic
          const currentHandler = handleTouchMoveRef.current;
          if (currentHandler) {
            currentHandler(syntheticEvent);
          }
        }
      };

      const handleClickOutside = (e: TouchEvent) => {
        const target = e.target as Element;
        
        // Check if the touch is on a draggable field or its children
        let draggableFieldElement = target.closest('[data-draggable="true"]');
        
        // If not found, check if the target itself is a draggable element (might be hidden)
        if (!draggableFieldElement) {
          // Check if target has data-draggable attribute (even if hidden)
          let currentElement = target as Element;
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
        
        // Only exit drag mode if the touch is NOT on any draggable field
        // If it is on a draggable field, let the startLongPress function handle it
        if (!draggableFieldElement) {
          exitDragModeRef.current?.();
        }
      };

      const preventContextMenu = (e: Event) => {
        e.preventDefault();
      };

      // Activate drag via singleton
      globalManager.activateDrag({ touchMove: globalTouchMove });
      
      // Add additional non-touchmove listeners directly
      document.addEventListener('contextmenu', preventContextMenu);
      document.addEventListener('touchstart', handleClickOutside, { passive: true });

      return () => {
        globalManager.deactivateDrag();
        
        // Remove additional listeners
        document.removeEventListener('contextmenu', preventContextMenu);
        document.removeEventListener('touchstart', handleClickOutside);

        // Ensure edge scrolling loop is cancelled
        stopEdgeScroll();
        
      };
    } else {
      
      // Ensure manager is deactivated when not dragging
      globalManager.deactivateDrag();
    }
  }, [dragState, stopEdgeScroll]); // handleTouchMove and exitDragMode accessed via refs for stability

  // Create touch start handler for a specific field
  const onTouchStart = useCallback((fieldId: string) => (event: React.TouchEvent) => {
    startLongPress(fieldId, event);
  }, [startLongPress]);

  // Determine scroll container on first mount
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const el = document.querySelector('[data-scrollable="true"]') as HTMLElement | null;
      scrollContainerRef.current = el;
    }
  }, []);

  return {
    // State
    isDragMode,
    draggedField,
    reservedSpaceState,
    reservedSpaceHeight: reservedSpaceHeightRef.current,
    currentSwap,
    
    // Handlers
    onTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    
    // Control
    exitDragMode,
  };
}; 
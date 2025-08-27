'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { FieldSection } from '@/types/profile';

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
  detectDragType,
  findClosestField,
  calculateTargetY,
  handleCrossSectionDrag,
  handleSameSectionDrag,
  findDraggableParent
} from '@/lib/utils/dragUtils';
// No need for hardcoded platform order anymore

export interface DragDropInfo {
  fields: ContactEntry[];
  draggedField: ContactEntry;
  originalField: ContactEntry;
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
  draggedField: ContactEntry | null;
  // Removed reserved space props - now using DOM-only drop zones
  
  // Handlers for draggable elements
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
  
  // Simplified drag state
  type DragState = 'idle' | 'dragging';
  const [dragState, setDragState] = useState<DragState>('idle');
  const [draggedField, setDraggedField] = useState<ContactEntry | null>(null);
  const [dragElement, setDragElement] = useState<HTMLElement | null>(null);
  
  // Derived state for frequently used values
  const draggedFieldId = draggedField ? `${draggedField.fieldType}-${draggedField.section}` : null;
  
  // Track current swap (only one at a time for simplicity)
  // Removed currentSwap state - simplified to use direct field order updates
  // Removed reservedSpaceState - now using DOM-only drop zones
  
  // Touch interaction state
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);
  
  
  // Create stable refs for values used in callbacks but shouldn't trigger callback recreation
  const currentSectionRef = useRef(currentSection);
  const onFieldArrayDropRef = useRef(onFieldArrayDrop);
  
  // Update refs on every render (doesn't trigger re-renders)
  currentSectionRef.current = currentSection;
  onFieldArrayDropRef.current = onFieldArrayDrop;  
  
  // Drop zone application system - DOM only, no React state
  const updateReservedSpace = useCallback((dropZoneId: string) => {
    // Pure DOM manipulation - no React re-renders
    document.querySelectorAll('[data-drop-zone]').forEach(el => {
      el.classList.remove('active');
    });
    
    const targetDropZone = document.querySelector(`[data-drop-zone="${dropZoneId}"]`);
    if (targetDropZone) {
      targetDropZone.classList.add('active');
    }
  }, []);
  
  // Set initial reserved space when entering drag mode
  const setInitialReservedSpace = useCallback((draggedFieldId: string) => {
    const currentFieldOrder = fieldOrderRef.current;
    const draggedIndex = currentFieldOrder.findIndex(f => `${f.fieldType}-${f.section}` === draggedFieldId);
    
    if (draggedIndex === -1) {
      console.warn('[setInitialReservedSpace] ⚠️ Could not find dragged field in order:', draggedFieldId);
      return;
    }
    
    const draggedField = currentFieldOrder[draggedIndex];
    
    // Check if this is the only visible field in its section (special case)
    const visibleFieldsInSameSection = currentFieldOrder.filter(f => 
      f.section === draggedField.section && f.isVisible
    );
    
    if (visibleFieldsInSameSection.length === 1 && visibleFieldsInSameSection[0] === draggedField) {
      // Special case: only field in section - target itself with space above
      updateReservedSpace(draggedFieldId, 'above');
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
      updateReservedSpace(targetFieldId, reservedSpacePosition);
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
    
    // Use complete field array (all sections and all fields)
    fieldOrderRef.current = [...initialFields];
  }, [initialFields]); // Remove currentSection dependency since we now use complete arrays
  
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

    // Find the ContactEntry object for this fieldId
    const draggedField = fieldOrderRef.current.find(f => `${f.fieldType}-${f.section}` === fieldId);
    if (!draggedField) {
      console.warn('❌ [startLongPress] Field not found in fieldOrderRef:', fieldId);
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
      setDraggedField(draggedField); // Use ContactEntry object
      
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
    
    // Check if this is a valid drop scenario - if we're dragging
    const isValidDrop = dragState === 'dragging' && draggedField && dragElement;
    
    if (isValidDrop) {
      console.log('🎯 [DROP] Valid drop detected');
      console.log('  - Dragged field:', draggedFieldId);
      
      // Simple drop - no animation, just pass the final field order
      console.log('📍 [DROP] Executing drop with final field order');
      
      // Execute drop with callback
      if (onFieldArrayDropRef.current && fieldOrderRef.current.length > 0) {
        cleanupDragState({ executeDropCallback: true });
      } else {
        console.warn('❌ [DROP] Missing callback or empty field order');
        cleanupDragState();
      }
    } else if (dragState === 'dragging' && draggedField && dragElement) {
      // No swap detected - clean up without drop
      console.log('↩️ [DROP] No swap detected, cleaning up drag state');
      cleanupDragState();
      console.log('✅ [DROP] Snap-back completed');
    } else {
      // Regular cancel long press behavior - just cleanup touch state
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
      setTouchStartPos(null);
    }
  }, [dragState, draggedField, dragElement, longPressTimer]); // Removed onFieldArrayDrop and fieldOrder - using refs, cleanupDragState defined later

  // Cancel long press (for cases where we need to cancel without drop logic)
  const cancelLongPress = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    setTouchStartPos(null);
  }, [longPressTimer]);

  // Shared swap detection logic
  const handleSwapDetection = useCallback((touch: { clientY: number }, dragElement: HTMLElement | null, draggedField: ContactEntry) => {
    // Use fieldOrderRef directly - filter for current section + universal, visible only
    const sectionName = currentSectionRef.current.toLowerCase() as 'personal' | 'work';
    const visibleFields = fieldOrderRef.current.filter(f => f.isVisible && 
      (f.section === sectionName || f.section === 'universal'));
    
    // Calculate target position and find closest field
    const scrollOffset = getScrollOffset();
    const targetY = calculateTargetY(touch, dragElement, scrollOffset);
    const swapResult = findClosestField(targetY, visibleFields, scrollOffset, reservedSpaceState, draggedFieldId!);
    
    
    if (!swapResult) {
      return;
    }
    
    // Find the target field object from visible fields
    const targetField = visibleFields.find(f => `${f.fieldType}-${f.section}` === swapResult.targetFieldId);
    if (!targetField) {
      console.warn('❌ [handleSwapDetection] Target field not found in visible fields');
      return;
    }
    
    // Use cross-section detection from findClosestField
    const isCrossSection = swapResult.isCrossSection;
    
    // Calculate reserved space position: ordinarily up=above, down=below
    // But for cross-section drags, it's reversed: up=below, down=above
    const reservePosition: 'above' | 'below' = isCrossSection 
      ? (swapResult.direction === 'up' ? 'below' : 'above')
      : (swapResult.direction === 'up' ? 'above' : 'below');
    
    // Only update if the closest field changed (determined by findClosestField)
    if (swapResult.closestFieldChanged) {
      
      // Update visual feedback (reserved space)
      updateReservedSpace(swapResult.targetFieldId, reservePosition);
      
      if (isCrossSection) {
        handleCrossSectionDrag(draggedField, targetField, fieldOrderRef, setDraggedField);
      } else {
        handleSameSectionDrag(draggedField, targetField, reservePosition, fieldOrderRef);
      }
      
      console.log('🔄 [handleSwapDetection] Updated fieldOrderRef, current state:', fieldOrderRef.current.map(f => `${f.fieldType}-${f.section}`));
    }
  }, [getScrollOffset, updateReservedSpace, reservedSpaceState]);

  // Handle touch move during drag
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

    // Already in dragging state, process drag logic
    if (dragState === 'dragging') {
      // Update floating drag element position
      if (dragElement) {
        // Check if drag element is still valid after DOM changes
        if (!document.body.contains(dragElement)) {
          setDragElement(null);
          exitDragModeRef.current?.();
          return;
        }
        updateFloatingDragElementPosition(dragElement, touch.clientX, touch.clientY);
      }

      // Record last client Y for edge scrolling
      lastClientYRef.current = touch.clientY;
      
      // Track swaps based on drag position
      if (draggedField) {
        handleSwapDetection(touch, dragElement, draggedField);
      }
      
      // Handle edge scrolling
      handleEdgeScrollRef.current?.(touch.clientY);
    }
  }, [touchStartPos, draggedField, dragElement, cancelLongPress, dragState, handleSwapDetection]);

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
      if (draggedField) {
        const fingerY = lastClientYRef.current;
        handleSwapDetection({ clientY: fingerY }, dragElement, draggedField);
      }
      
      scrollAnimationFrame.current = requestAnimationFrame(step);
    };

    step();
  }, [stopEdgeScroll, draggedField, dragElement, handleSwapDetection]);

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

  // Centralized drag state cleanup
  const cleanupDragState = useCallback((options: {
    executeDropCallback?: boolean;
    includeEdgeScrollCleanup?: boolean;
  } = {}) => {
    // Execute drop callback if requested (before state cleanup)
    if (options.executeDropCallback && onFieldArrayDropRef.current && fieldOrderRef.current.length > 0) {
      console.log('🔄 [cleanupDragState] Calling onFieldArrayDrop with final field order');
      
      onFieldArrayDropRef.current({
        fields: fieldOrderRef.current,
        draggedField: draggedField!, // Non-null when executeDropCallback is true
        originalField: draggedField! // Same as dragged field
      });
      
      console.log('✅ [cleanupDragState] onFieldArrayDrop completed');
    }
    
    // Common state cleanup
    setDragState('idle');
    setDraggedField(null);
    removeFloatingDragElement(dragElement);
    setDragElement(null);
    
    // Conditional edge scroll cleanup
    if (options.includeEdgeScrollCleanup) {
      stopEdgeScroll();
    }
    
    // Touch state cleanup (always needed)
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setTouchStartPos(null);
    
    console.log('🧹 [cleanupDragState] Drag state cleaned up');
  }, [draggedField, dragElement, stopEdgeScroll, longPressTimer]);

  // Exit drag mode and clean up
  const exitDragMode = useCallback(() => {
    cleanupDragState({ includeEdgeScrollCleanup: true });
  }, [cleanupDragState]);
  
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
        const draggableFieldElement = findDraggableParent(target);
        
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
    
    // Handlers
    onTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd
  };
};
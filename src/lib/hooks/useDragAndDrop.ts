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
  captureFieldMidpoints,
  calculateViewDropZoneMap,
  findClosestDropZone,
  calculateTargetY,
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
  activeDropZone: {order: number, section: string} | null;
  
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
  
  // Derived state for frequently used values - removed unused draggedFieldId
  
  // Visual feedback for drag operations with new simplified structure
  const [activeDropZone, setActiveDropZone] = useState<{
    order: number;
    section: FieldSection;
    belowFieldType: string | 'bottom';
    midpointY: number;
  } | null>(null);
  
  
  // Store DropZone map for current view
  const dropZoneMapRef = useRef<Array<{
    order: number;
    section: FieldSection;
    belowFieldType: string | 'bottom';
    midpointY?: number;
  }>>([]);
  
  
  // Touch interaction state
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);
  
  
  // Create stable refs for values used in callbacks but shouldn't trigger callback recreation
  const currentSectionRef = useRef(currentSection);
  const onFieldArrayDropRef = useRef(onFieldArrayDrop);
  
  // Update refs on every render (doesn't trigger re-renders)
  currentSectionRef.current = currentSection;
  onFieldArrayDropRef.current = onFieldArrayDrop;  
  
  // Simplified field swap function
  const swapFieldsInOrder = useCallback((draggedField: ContactEntry, targetField: ContactEntry) => {
    // Check if this is a section change (same field, different section)
    if (draggedField.fieldType === targetField.fieldType && draggedField.section !== targetField.section) {
      // Just track the intended section change - don't modify anything during drag
      pendingSectionChangeRef.current = {
        fieldType: draggedField.fieldType,
        originalSection: draggedField.section,
        newSection: targetField.section
      };
      console.log(`🔄 [SECTION CHANGE TRACKED] ${draggedField.fieldType} from ${draggedField.section} to ${targetField.section} (will apply on drop)`);
      return;
    }
    
    const draggedIndex = fieldOrderRef.current.findIndex(f => 
      f.fieldType === draggedField.fieldType && f.section === draggedField.section
    );
    const targetIndex = fieldOrderRef.current.findIndex(f => 
      f.fieldType === targetField.fieldType && f.section === targetField.section
    );
    
    if (draggedIndex === -1 || targetIndex === -1) {
      console.warn('❌ [swapFieldsInOrder] Could not find fields to swap');
      return;
    }
    
    // Swap the two fields in the array
    const newFieldOrder = [...fieldOrderRef.current];
    [newFieldOrder[draggedIndex], newFieldOrder[targetIndex]] = 
    [newFieldOrder[targetIndex], newFieldOrder[draggedIndex]];
    
    fieldOrderRef.current = newFieldOrder;
    
    // Also swap their midpoints
    const temp = (draggedField as ContactEntry & { midpointY?: number }).midpointY;
    (draggedField as ContactEntry & { midpointY?: number }).midpointY = (targetField as ContactEntry & { midpointY?: number }).midpointY;
    (targetField as ContactEntry & { midpointY?: number }).midpointY = temp;
    
    console.log(`🔄 [SWAP] ${draggedField.fieldType}-${draggedField.section} ↔ ${targetField.fieldType}-${targetField.section}`);
  }, []);

  // Field order tracking - using ref to avoid re-renders
  const fieldOrderRef = useRef<ContactEntry[]>([]);
  
  // Initialize and update fieldOrder ref when initialFields change
  useEffect(() => {
    if (!initialFields || initialFields.length === 0) {
      fieldOrderRef.current = [];
      return;
    }
    
    fieldOrderRef.current = [...initialFields];
  }, [initialFields]);
  
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
  
  // Track last swap time to prevent rapid consecutive swaps
  const lastSwapTimeRef = useRef<number>(0);
  
  // Track pending section change during drag
  const pendingSectionChangeRef = useRef<{
    fieldType: string;
    originalSection: string;
    newSection: string;
  } | null>(null);
  
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
      setActiveDropZone(null); // Clear active drop zone
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
        // Create the ghost while the element is still visible
        dragEl = createFloatingDragElement(sourceElement);
        const rect = sourceElement.getBoundingClientRect();
        updateFloatingDragElementPosition(dragEl, rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
      
      // Capture midpoints WHILE field is still visible (before drag state)
      captureFieldMidpoints(fieldOrderRef.current);
      
      // NOW set drag state (field hides and drop zones show in single render)
      setDragState('dragging');
      setDraggedField(draggedField); // Use ContactEntry object
      
      // Store the drag element
      if (dragEl) {
        setDragElement(dragEl);
      }
      
      // Calculate DropZone map for current view (will adjust positions internally)
      const dropZoneMap = calculateViewDropZoneMap(
        fieldOrderRef.current,
        currentSectionRef.current,
        draggedField
      );
      dropZoneMapRef.current = dropZoneMap;
      
      // Find initial DropZone
      const currentSectionName = currentSectionRef.current.toLowerCase();
      const universalFields = fieldOrderRef.current.filter(f => 
        f.section === 'universal' && !['name', 'bio'].includes(f.fieldType) && f.isVisible
      );
      const currentSectionFields = fieldOrderRef.current.filter(f => 
        f.section === currentSectionName && f.isVisible
      );
    
      let expectedDropZoneOrder = 0;
      if (draggedField.section === 'universal') {
        const draggedIndex = universalFields.findIndex(f => 
          f.fieldType === draggedField.fieldType && f.section === draggedField.section
        );
        if (draggedIndex !== -1) {
          for (let i = 0; i < draggedIndex; i++) {
            const field = universalFields[i];
            if (field.fieldType !== draggedField.fieldType || field.section !== draggedField.section) {
              expectedDropZoneOrder++;
            }
          }
        }
      } else if (draggedField.section === currentSectionName) {
        expectedDropZoneOrder = universalFields.filter(f => 
          !(f.fieldType === draggedField.fieldType && f.section === draggedField.section)
        ).length + 1;
        const draggedIndex = currentSectionFields.findIndex(f => 
          f.fieldType === draggedField.fieldType && f.section === draggedField.section
        );
        if (draggedIndex !== -1) {
          for (let i = 0; i < draggedIndex; i++) {
            const field = currentSectionFields[i];
            if (field.fieldType !== draggedField.fieldType || field.section !== draggedField.section) {
              expectedDropZoneOrder++;
            }
          }
        }
      }
      
      const initialDropZone = dropZoneMap.find(dz => dz.order === expectedDropZoneOrder);
      if (initialDropZone) {
        setActiveDropZone({
          order: initialDropZone.order,
          section: initialDropZone.section,
          belowFieldType: initialDropZone.belowFieldType,
          midpointY: initialDropZone.midpointY || 0
        });
        
        console.log(`🏁 [startLongPress] Dragging ${draggedField.fieldType}-${draggedField.section}`);
        console.log(`  - Initial DropZone: ${initialDropZone.order}-${initialDropZone.section}`);
      }
      
      // Add haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 1000); // 1 second long press

    setLongPressTimer(timer);
  }, [dragState]);

  // Handle touch end - either cancel long press or execute drop
  const handleTouchEnd = useCallback(() => {
    
    // Check if this is a valid drop scenario - if we're dragging
    const isValidDrop = dragState === 'dragging' && draggedField && dragElement;
    
    if (isValidDrop) {
      if (onFieldArrayDropRef.current && fieldOrderRef.current.length > 0) {
        cleanupDragState({ executeDropCallback: true });
      } else {
        cleanupDragState();
      }
    } else if (dragState === 'dragging' && draggedField && dragElement) {
      cleanupDragState();
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

  // With DropZone approach, no complex swap detection needed during drag
  // DropZone shows original position, field order changes only happen on drop

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
      
      if (draggedField && activeDropZone && dropZoneMapRef.current.length > 0) {
        const scrollOffset = getScrollOffset();
        const ghostY = calculateTargetY(touch, dragElement, scrollOffset);
        
        const result = findClosestDropZone(
          ghostY,
          fieldOrderRef.current,
          activeDropZone,
          dropZoneMapRef.current,
          `${draggedField.fieldType}-${draggedField.section}`
        );
        
        if (result.newDropZone) {
          // Update activeDropZone to new position
          setActiveDropZone(result.newDropZone);
          
          // Perform field swap if needed (with throttling to prevent rapid consecutive swaps)
          if (result.swapInfo) {
            const now = Date.now();
            const timeSinceLastSwap = now - lastSwapTimeRef.current;
            
            // Only allow swaps if enough time has passed (100ms threshold)
            if (timeSinceLastSwap > 100) {
              swapFieldsInOrder(result.swapInfo.draggedField, result.swapInfo.targetField);
              lastSwapTimeRef.current = now;
            } else {
              console.log(`⏸️ [handleTouchMove] Swap throttled (${timeSinceLastSwap}ms since last swap)`);
            }
          }
          
          console.log(`🎯 [handleTouchMove] Moved to DropZone ${result.newDropZone.order}-${result.newDropZone.section}`);
        }
      }
      
      // Handle edge scrolling
      handleEdgeScrollRef.current?.(touch.clientY);
    }
  }, [touchStartPos, draggedField, dragElement, cancelLongPress, dragState, activeDropZone, swapFieldsInOrder, getScrollOffset]);

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
      
      // With DropZone approach: no swap detection during edge scroll needed
      
      scrollAnimationFrame.current = requestAnimationFrame(step);
    };

    step();
  }, [stopEdgeScroll, draggedField, dragElement]);

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
      // Apply pending section change before executing drop callback
      if (pendingSectionChangeRef.current) {
        const { fieldType, originalSection, newSection } = pendingSectionChangeRef.current;
        const fieldIndex = fieldOrderRef.current.findIndex(f => 
          f.fieldType === fieldType && f.section === originalSection
        );
        
        if (fieldIndex !== -1) {
          fieldOrderRef.current[fieldIndex].section = newSection as FieldSection;
          console.log(`🔄 [SECTION CHANGE APPLIED] ${fieldType} moved from ${originalSection} to ${newSection}`);
        }
      }
      
      console.log(`📤 [DROP] Executing drop callback with ${fieldOrderRef.current.length} fields`);
      console.log(`  - Dragged: ${draggedField?.fieldType}-${draggedField?.section}`);
      console.log(`  - Current fieldOrderRef:`, fieldOrderRef.current.map(f => `${f.fieldType}-${f.section}`));
      
      onFieldArrayDropRef.current({
        fields: fieldOrderRef.current,
        draggedField: draggedField!, // Non-null when executeDropCallback is true
        originalField: draggedField! // Same as dragged field
      });
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
    
    // Clear active drop zone
    setActiveDropZone(null);
    
    // Clear pending section change
    pendingSectionChangeRef.current = null;
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
    activeDropZone,
    
    // Handlers
    onTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd
  };
};
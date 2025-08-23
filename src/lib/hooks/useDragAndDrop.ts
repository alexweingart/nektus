'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { ContactEntry } from '@/types/profile';
import {
  createFloatingDragElement,
  updateFloatingDragElementPosition,
  removeFloatingDragElement,
  animateSnapToPosition,
  reorderFieldArray,
  detectDragType,
  findClosestField,
  calculateTargetY
} from '@/lib/utils/dragUtils';
// No need for hardcoded platform order anymore

interface DragDropInfo {
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
  fieldOrder: ContactEntry[];
  
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
  
  // No need for ref anymore - use initialFields directly
  
  // Track current swap (only one at a time for simplicity)
  const [currentSwap, setCurrentSwap] = useState<{from: string, to: string} | null>(null);
  
  // Compute field order on-demand based on initialFields + swaps
  const fieldOrder = useMemo(() => {
    if (!initialFields || initialFields.length === 0) {
      return [];
    }
    
    // Filter to only fields from current section or universal
    const sectionName = currentSection.toLowerCase() as 'personal' | 'work';
    const filteredFields = initialFields.filter(field => {
      // Only include fields from current section or universal fields (but include both visible and hidden)
      const isInCurrentSection = field.section === sectionName || field.section === 'universal';
      return isInCurrentSection;
    });
    // Fields are already in correct order from initialFields
    let result = [...filteredFields];
    
    // Apply current swap if exists
    if (currentSwap) {
      result = reorderFieldArray(result, currentSwap.from, currentSwap.to);
    }
    
    return result;
  }, [currentSwap, initialFields, currentSection]); // Depend on swap, initialFields, and current section
    
  // Touch interaction state
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);

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
    }
  }, [dragState]);

  // Start long press for drag initiation
  const startLongPress = useCallback((fieldId: string, event: React.TouchEvent) => {
    
    // If already in drag mode, exit current drag and start new one
    if (dragState === 'dragging') {
      // Clean up current drag
      exitDragMode();
      
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
      
      // Add haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 1000); // 1 second long press

    setLongPressTimer(timer);
  }, [dragState]);

  // Handle touch end - either cancel long press or execute drop
  const handleTouchEnd = useCallback(() => {
    // Check if this is a valid drop scenario - if there's a current swap
    const isValidDrop = dragState === 'dragging' && currentSwap && draggedField && dragElement;
    
    if (isValidDrop) {
      // Execute snap animation and drop
      animateSnapToPosition(dragElement, null, () => {
        // Call field array drop callback with enhanced context
        if (onFieldArrayDrop && draggedField && currentSwap) {
          const draggedFieldData = fieldOrder.find(f => `${f.fieldType}-${f.section}` === currentSwap.from);
          if (draggedFieldData) {
            // Determine drag type using utility function
            const originalField = initialFields?.find(f => `${f.fieldType}-${f.section}` === currentSwap.from);
            const targetField = fieldOrder.find(f => `${f.fieldType}-${f.section}` === currentSwap.to);
            
            if (!originalField || !targetField) return;
            
            const dragType = detectDragType(originalField, targetField);
            
            onFieldArrayDrop({
              fields: fieldOrder,
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
  }, [dragState, currentSwap, draggedField, dragElement, onFieldArrayDrop, fieldOrder, longPressTimer]);

  // Cancel long press (for cases where we need to cancel without drop logic)
  const cancelLongPress = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    setTouchStartPos(null);
  }, [longPressTimer]);

  // Handle touch move during drag
  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (!touchStartPos) return;

    const touch = event.touches[0];
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
          exitDragMode();
          return;
        }
        updateFloatingDragElementPosition(dragElement, touch.clientX, touch.clientY);
      }

      // Record last client Y for edge scrolling
      lastClientYRef.current = touch.clientY;
      
      const scrollOffset = getScrollOffset();
      
      // Track swaps based on drag position
      if (draggedField) {
        // Get current visible fields for swap detection
        const sectionName = currentSection.toLowerCase() as 'personal' | 'work';
        const visibleFields = initialFields.filter(f => f.isVisible && 
          (f.section === sectionName || f.section === 'universal'));
        
        // Calculate target position and find closest field
        const targetY = calculateTargetY(touch, dragElement, scrollOffset);
        const targetFieldId = findClosestField(targetY, visibleFields, scrollOffset);
        
        // Create swap if we found a different target
        if (targetFieldId && targetFieldId !== draggedField) {
          setCurrentSwap({ from: draggedField, to: targetFieldId });
        }
      }
      
      // Handle edge scrolling
      handleEdgeScroll(touch.clientY);
    }
  }, [touchStartPos, draggedField, dragElement, cancelLongPress, getScrollOffset]);

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
      const scrollOffset = getScrollOffset();
      const fingerY = lastClientYRef.current;
      
      if (draggedField) {
        // Get current visible fields for swap detection
        const sectionName = currentSection.toLowerCase() as 'personal' | 'work';
        const visibleFields = initialFields.filter(f => f.isVisible && 
          (f.section === sectionName || f.section === 'universal'));
        
        // Calculate target position and find closest field
        const targetY = calculateTargetY({ clientY: fingerY }, dragElement, scrollOffset);
        const targetFieldId = findClosestField(targetY, visibleFields, scrollOffset);
        
        // Create swap if we found a different target
        if (targetFieldId && targetFieldId !== draggedField) {
          setCurrentSwap({ from: draggedField, to: targetFieldId });
        }
      }

      scrollAnimationFrame.current = requestAnimationFrame(step);
    };

    step();
  }, [stopEdgeScroll, getScrollOffset, draggedField, dragElement]);

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

  // Handle drag mode interactions (prevent scrolling, context menu, etc.)
  useEffect(() => {
    if (dragState === 'dragging') {
      
      const preventContextMenu = (e: Event) => {
        e.preventDefault();
      };

      const preventScrolling = (e: TouchEvent) => {
        // Always prevent native scrolling while in drag mode so the gesture stays in drag context
        if (e.cancelable) {
          e.preventDefault();
          e.stopPropagation();
        }
      };

      // Global touch move handler to capture movements during drag
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
          handleTouchMove(syntheticEvent);
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
          exitDragMode();
        }
      };

      // Prevent context menu during drag mode
      document.addEventListener('contextmenu', preventContextMenu);
      
      // Prevent all touch actions to disable scrolling during drag mode
      document.body.style.touchAction = 'none';

      // Prevent all native scrolling – we will handle paging programmatically
      document.addEventListener('touchmove', preventScrolling, { passive: false });
      
      // Add global touch move handler to capture drag movements
      document.addEventListener('touchmove', globalTouchMove, { passive: false });
      
      // Handle click outside to exit drag mode
      document.addEventListener('touchstart', handleClickOutside, { passive: true });

      return () => {
        document.removeEventListener('contextmenu', preventContextMenu);
        document.removeEventListener('touchmove', preventScrolling);
        document.removeEventListener('touchmove', globalTouchMove);
        document.removeEventListener('touchstart', handleClickOutside);

        // Restore original touch action
        document.body.style.touchAction = '';

        // Ensure edge scrolling loop is cancelled
        stopEdgeScroll();
      };
    }
  }, [dragState, exitDragMode, handleTouchMove]);

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
    fieldOrder,
    
    // Handlers
    onTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    
    // Control
    exitDragMode,
  };
}; 
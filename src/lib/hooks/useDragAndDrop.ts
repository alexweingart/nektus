'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { DragState, InsertionPoint, ReservedSpace } from '@/lib/utils/dragUtils';
import {
  calculateInsertionPoints,
  findNearestInsertionPoint,
  createFloatingDragElement,
  updateFloatingDragElementPosition,
  removeFloatingDragElement,
  executeFieldDrop,
  animateSnapToPosition,
  findHoveredField,
  calculateInsertionPoint,
  shouldActivateInsertionPoint,
  determineReservedSpace
} from '@/lib/utils/dragUtils';

interface UseDragAndDropProps {
  onDragStateChange?: (isDragging: boolean) => void;
  onDrop?: (draggedFieldId: string, insertionPoint: InsertionPoint) => void;
}

interface UseDragAndDropReturn {
  // State
  isDragMode: boolean;
  draggedField: string | null;
  isDragging: boolean;
  activeInsertionPoint: InsertionPoint | null; // Keep for backward compatibility
  currentReservedSpace: ReservedSpace | null; // New primary state
  shouldShowPlaceholder: (fieldId: string) => boolean;
  
  // Handlers for draggable elements
  onTouchStart: (fieldId: string) => (event: React.TouchEvent) => void;
  onTouchMove: (event: React.TouchEvent) => void;
  onTouchEnd: () => void;
  
  // Control functions
  exitDragMode: () => void;
}

export const useDragAndDrop = ({ onDragStateChange, onDrop }: UseDragAndDropProps = {}): UseDragAndDropReturn => {
  // Drag state
  const [isDragMode, setIsDragMode] = useState(false);
  const [draggedField, setDraggedField] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragElement, setDragElement] = useState<HTMLElement | null>(null);
  const [draggedFieldHeight, setDraggedFieldHeight] = useState(0);
  const [currentReservedSpace, setCurrentReservedSpace] = useState<ReservedSpace | null>(null);

  // Test: Add a permanent global touchmove listener to see if touchmove works at all
  useEffect(() => {
    const alwaysActiveTouchMove = (e: TouchEvent) => {
      console.log('🟠 ALWAYS ACTIVE: touchmove detected - isDragMode:', isDragMode);
    };
    document.addEventListener('touchmove', alwaysActiveTouchMove, { passive: true });

    return () => {
      document.removeEventListener('touchmove', alwaysActiveTouchMove);
    };
  }, [isDragMode]);
  
  // Backward compatibility: derive activeInsertionPoint from currentReservedSpace
  const activeInsertionPoint = currentReservedSpace?.type === 'target' ? currentReservedSpace.insertionPoint : null;
  
  // Touch interaction state
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);
  const [isInInitialTouch, setIsInInitialTouch] = useState(false);
  
  // Insertion points cache
  const insertionPointsRef = useRef<InsertionPoint[]>([]);
  const recalculateTimer = useRef<NodeJS.Timeout | null>(null);
  const currentInsertionPointRef = useRef<InsertionPoint | null>(null);

  // Continuous edge scroll refs
  const scrollAnimationFrame = useRef<number | null>(null);
  const edgeScrollDirection = useRef<'up' | 'down' | null>(null);

  // Continuous edge scroll helpers
  const scrollSpeed = 12; // px per frame

  // Reference to the scrollable container (PullToRefresh root)
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  // Helper to get current scroll offset depending on container
  const getScrollOffset = useCallback(() => {
    return scrollContainerRef.current ? scrollContainerRef.current.scrollTop : window.scrollY;
  }, []);

  // Store last touch Y to allow edge-scroll updates without new touch events
  const lastClientYRef = useRef<number>(0);

  // Notify parent of drag state changes
  useEffect(() => {
    onDragStateChange?.(isDragMode);
  }, [isDragMode, onDragStateChange]);

  // Recalculate insertion points when drag mode starts or layout changes
  const recalculateInsertionPoints = useCallback(() => {
    if (recalculateTimer.current) {
      clearTimeout(recalculateTimer.current);
    }
    
    recalculateTimer.current = setTimeout(() => {
      const points = calculateInsertionPoints();
      insertionPointsRef.current = points;
    }, 100); // Small delay to let DOM settle
  }, []);

  // Initialize/cleanup reserved space when entering/exiting drag mode
  useEffect(() => {
    if (isDragMode && draggedField) {
      // Initialize with original placeholder
      const initialReservedSpace: ReservedSpace = {
        type: 'original',
        insertionPoint: {
          id: `${draggedField}-original`,
          y: 0,
          section: 'universal',
          type: 'before-field',
          relatedField: draggedField
        },
        fieldId: draggedField
      };
      setCurrentReservedSpace(initialReservedSpace);
    } else {
      // Clean up when exiting drag mode
      insertionPointsRef.current = [];
      setCurrentReservedSpace(null);
      currentInsertionPointRef.current = null;
    }
  }, [isDragMode, draggedField, recalculateInsertionPoints]);

  // Keep ref in sync with state
  useEffect(() => {
    currentInsertionPointRef.current = currentReservedSpace?.type === 'target' ? currentReservedSpace.insertionPoint : null;
  }, [currentReservedSpace]);

  // Start long press for drag initiation
  const startLongPress = useCallback((fieldId: string, event: React.TouchEvent) => {
    // Set flag to prevent handleClickOutside from interfering
    setIsInInitialTouch(true);
    
    // If already in drag mode, handle field switching
    if (isDragMode) {
      // If trying to switch to the same field, start dragging immediately  
      if (draggedField === fieldId) {
        console.log('🔄 Same field selected, starting immediate drag');
        
        // Clear any existing timer and start dragging immediately
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          setLongPressTimer(null);
        }
        
        setIsInInitialTouch(false);
        setIsDragging(true);
        
        // Set touch position for move tracking
        const touch = event.touches[0];
        setTouchStartPos({ x: touch.clientX, y: touch.clientY });
        
        if (navigator.vibrate) {
          navigator.vibrate(30);
        }
        return;
      }
      
      // Clean up previous drag element
      removeFloatingDragElement(dragElement);
      setDragElement(null);
      
      setDraggedField(fieldId);
      
      // Create new drag element for switched field
      const sourceElement = document.getElementById(fieldId)?.closest('.mb-5') as HTMLElement;
      if (sourceElement) {
        setDraggedFieldHeight(sourceElement.offsetHeight);
        const dragEl = createFloatingDragElement(sourceElement);
        setDragElement(dragEl);
        
        // Position it exactly over the original field
        const rect = sourceElement.getBoundingClientRect();
        updateFloatingDragElementPosition(dragEl, rect.top + rect.height / 2);
      }
      
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
      
      // Clear the initial touch flag after switching
      setIsInInitialTouch(false);
      return;
    }

    const touch = event.touches[0];
    setTouchStartPos({ x: touch.clientX, y: touch.clientY });

    const timer = setTimeout(() => {
      setIsDragMode(true);
      setDraggedField(fieldId);
      setIsInInitialTouch(false); // Clear the flag when entering drag mode
      
      // Create drag element immediately on long press
      const sourceElement = document.getElementById(fieldId)?.closest('.mb-5') as HTMLElement;
      if (sourceElement) {
        setDraggedFieldHeight(sourceElement.offsetHeight);
        const dragEl = createFloatingDragElement(sourceElement);
        setDragElement(dragEl);
        
        // Position it exactly over the original field
        const rect = sourceElement.getBoundingClientRect();
        updateFloatingDragElementPosition(dragEl, rect.top + rect.height / 2);
      }
      
      // Add haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 1000); // 1 second long press

    setLongPressTimer(timer);
  }, [isDragMode, dragElement]);

  // Handle touch end - either cancel long press or execute drop
  const handleTouchEnd = useCallback(() => {
    // Check if this is a valid drop scenario (only drop if we have a target insertion point)
    const isValidDrop = isDragMode && isDragging && 
                       currentReservedSpace?.type === 'target' && 
                       draggedField && dragElement;
    
    if (isValidDrop && onDrop && currentReservedSpace) {
      // Execute snap animation and drop
      animateSnapToPosition(dragElement, currentReservedSpace.insertionPoint, () => {
        // After animation completes, execute the drop and clean up
        onDrop(draggedField, currentReservedSpace.insertionPoint);
        
        // Clean up drag state
        setIsDragMode(false);
        setDraggedField(null);
        setIsDragging(false);
        setCurrentReservedSpace(null);
        removeFloatingDragElement(dragElement);
        setDragElement(null);
        
        // Clean up touch state
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          setLongPressTimer(null);
        }
        setTouchStartPos(null);
        setIsInInitialTouch(false);
      });
    } else {
      // Regular cancel long press behavior
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
      setTouchStartPos(null);
      setIsInInitialTouch(false);
    }
  }, [isDragMode, isDragging, currentReservedSpace, draggedField, dragElement, onDrop, longPressTimer]);

  // Cancel long press (for cases where we need to cancel without drop logic)
  const cancelLongPress = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    setTouchStartPos(null);
    setIsInInitialTouch(false);
  }, [longPressTimer]);

  // Handle touch move during drag
  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    console.log('🔵 handleTouchMove called - isDragMode:', isDragMode, 'draggedField:', draggedField, 'touchStartPos:', !!touchStartPos);
    
    if (!touchStartPos || !isDragMode || !draggedField) {
      console.log('🔵 Exiting touchMove early - missing required state');
      return;
    }

    const touch = event.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.y);
    
    console.log('🔵 Touch move - clientX:', touch.clientX, 'clientY:', touch.clientY, 'deltaX:', deltaX, 'deltaY:', deltaY);

    // Cancel long press if finger moves too much during initial press
    if (!isDragMode && (deltaX > 10 || deltaY > 10)) {
      console.log('🔵 Canceling long press due to finger movement - deltaX:', deltaX, 'deltaY:', deltaY);
      cancelLongPress();
      return;
    }

    // Start dragging if we've moved beyond threshold
    if (isDragMode && !isDragging && (deltaX > 5 || deltaY > 5)) {
      console.log('🔵 Starting actual dragging - deltaX:', deltaX, 'deltaY:', deltaY);
      setIsDragging(true);
      
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    }

    // Update drag position and find nearest insertion point
    if (isDragging) {
      console.log('🔵 Updating drag position - touch.clientY:', touch.clientY, 'dragElement exists:', !!dragElement);
      
      // Update floating drag element position
      if (dragElement) {
        updateFloatingDragElementPosition(dragElement, touch.clientY);
        console.log('🔵 Updated floating element position to Y:', touch.clientY);
      }

      // Record last client Y
      lastClientYRef.current = touch.clientY;
      
      const scrollOffset = getScrollOffset();
      // NEW ALWAYS-ONE-RESERVED-SPACE LOGIC: Determine reserved space
      const currentY = touch.clientY + scrollOffset;
      
      if (draggedField) {
        const newReservedSpace = determineReservedSpace(currentY, draggedField, currentReservedSpace);
        
        // Only update if there's a change to prevent unnecessary re-renders
        if (newReservedSpace.insertionPoint.id !== currentReservedSpace?.insertionPoint.id) {
          setCurrentReservedSpace(newReservedSpace);
          currentInsertionPointRef.current = newReservedSpace.type === 'target' ? newReservedSpace.insertionPoint : null;
        }
      }
      
      // Handle edge scrolling
      handleEdgeScroll(touch.clientY);
    }
  }, [touchStartPos, isDragMode, draggedField, isDragging, dragElement, cancelLongPress, activeInsertionPoint, getScrollOffset]);

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
      
      // Recalculate reserved space during edge scroll
      const scrollOffset = getScrollOffset();
      const fingerY = lastClientYRef.current;
      const currentY = fingerY + scrollOffset;
      
      if (draggedField) {
        const newReservedSpace = determineReservedSpace(currentY, draggedField, currentReservedSpace);
        if (newReservedSpace.insertionPoint.id !== currentReservedSpace?.insertionPoint.id) {
          setCurrentReservedSpace(newReservedSpace);
          currentInsertionPointRef.current = newReservedSpace.type === 'target' ? newReservedSpace.insertionPoint : null;
        }
      }

      scrollAnimationFrame.current = requestAnimationFrame(step);
    };

    step();
  }, [stopEdgeScroll, getScrollOffset, draggedField, currentReservedSpace]);

  // Handle edge scrolling when dragging near viewport edges
  const handleEdgeScroll = useCallback((clientY: number) => {
    if (!isDragMode) {
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
  }, [isDragMode, startEdgeScroll, stopEdgeScroll]);

  // Exit drag mode and clean up
  const exitDragMode = useCallback(() => {
    setIsDragMode(false);
    setDraggedField(null);
    setIsDragging(false);
    setCurrentReservedSpace(null);

    // Stop any ongoing edge scroll
    stopEdgeScroll();
    
    // Clean up drag element
    removeFloatingDragElement(dragElement);
    setDragElement(null);
    
    // Clean up touch state
    cancelLongPress();
    if (recalculateTimer.current) {
      clearTimeout(recalculateTimer.current);
      recalculateTimer.current = null;
    }
  }, [dragElement, cancelLongPress, stopEdgeScroll]);

  // Handle drag mode interactions (prevent scrolling, context menu, etc.)
  useEffect(() => {
    console.log('🔵 useEffect for drag mode - isDragMode:', isDragMode);
    if (isDragMode) {
      console.log('🔵 Setting up global event listeners for drag mode');
      
      const preventContextMenu = (e: Event) => {
        e.preventDefault();
      };

      const preventScrolling = (e: TouchEvent) => {
        console.log('🔵 Global preventScrolling called');
        // Always prevent native scrolling while in drag mode so the gesture stays in drag context
        if (e.cancelable) {
          e.preventDefault();
          e.stopPropagation();
        }
      };

      // Global touch move handler to capture movements during drag
      const globalTouchMove = (e: TouchEvent) => {
        console.log('🔵 Global touchmove captured during drag mode');
        if (e.touches.length > 0) {
          const syntheticEvent = {
            touches: Array.from(e.touches).map(touch => ({
              clientX: touch.clientX,
              clientY: touch.clientY,
              pageX: touch.pageX,
              pageY: touch.pageY
            }))
          } as React.TouchEvent;
          handleTouchMove(syntheticEvent);
        }
      };

      const handleClickOutside = (e: TouchEvent) => {
        const target = e.target as Element;
        
        // Don't exit drag mode during initial touch phase
        if (isInInitialTouch) {
          return;
        }
        
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
      
      // NOTE: Removed document.body.style.touchAction = 'none' because it blocks ALL touchmove events

      // Prevent all native scrolling – we will handle paging programmatically
      document.addEventListener('touchmove', preventScrolling, { passive: false });
      
      // Add global touch move handler to capture drag movements
      document.addEventListener('touchmove', globalTouchMove, { passive: false });
      
      // Test: Add a simple global touchmove listener to see if ANY touchmove events fire
      const testTouchMove = (e: TouchEvent) => {
        console.log('🔴 TEST: ANY touchmove event detected globally');
      };
      document.addEventListener('touchmove', testTouchMove, { passive: true });
      
      // Handle click outside to exit drag mode
      document.addEventListener('touchstart', handleClickOutside, { passive: true });

      return () => {
        document.removeEventListener('contextmenu', preventContextMenu);
        document.removeEventListener('touchmove', preventScrolling);
        document.removeEventListener('touchmove', globalTouchMove);
        document.removeEventListener('touchmove', testTouchMove);
        document.removeEventListener('touchstart', handleClickOutside);

        // NOTE: No need to restore touchAction since we don't set it anymore

        // Ensure edge scrolling loop is cancelled
        stopEdgeScroll();
      };
    }
  }, [isDragMode, isDragging, exitDragMode, isInInitialTouch, draggedField]);

  // Create touch start handler for a specific field
  const onTouchStart = useCallback((fieldId: string) => (event: React.TouchEvent) => {
    startLongPress(fieldId, event);
  }, [startLongPress]);

  // Determine if placeholder should be shown for a field
  const shouldShowPlaceholder = useCallback((fieldId: string) => {
    if (!isDragMode || draggedField !== fieldId) return false;
    
    // Show placeholder when reserved space is of type 'original' for this field
    return currentReservedSpace?.type === 'original' && currentReservedSpace?.fieldId === fieldId;
  }, [isDragMode, draggedField, currentReservedSpace]);

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
    isDragging,
    activeInsertionPoint, // Backward compatibility
    currentReservedSpace, // New primary state
    shouldShowPlaceholder,
    
    // Handlers
    onTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    
    // Control
    exitDragMode,
  };
}; 
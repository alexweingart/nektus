'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { DragState, InsertionPoint } from '@/lib/utils/dragUtils';
import {
  calculateInsertionPoints,
  findNearestInsertionPoint,
  createFloatingDragElement,
  updateFloatingDragElementPosition,
  removeFloatingDragElement,
  executeFieldDrop,
  animateSnapToPosition
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
  activeInsertionPoint: InsertionPoint | null;
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
  const [activeInsertionPoint, setActiveInsertionPoint] = useState<InsertionPoint | null>(null);
  
  // Touch interaction state
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [touchStartPos, setTouchStartPos] = useState<{ x: number; y: number } | null>(null);
  const [isInInitialTouch, setIsInInitialTouch] = useState(false);
  
  // Insertion points cache
  const insertionPointsRef = useRef<InsertionPoint[]>([]);
  const recalculateTimer = useRef<NodeJS.Timeout | null>(null);

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

  // Recalculate insertion points when entering drag mode
  useEffect(() => {
    if (isDragMode) {
      recalculateInsertionPoints();
    } else {
      insertionPointsRef.current = [];
      setActiveInsertionPoint(null);
    }
  }, [isDragMode, recalculateInsertionPoints]);

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
    // Check if this is a valid drop scenario
    const isValidDrop = isDragMode && isDragging && activeInsertionPoint && draggedField && dragElement;
    
    if (isValidDrop && onDrop) {
      // Execute snap animation and drop
      animateSnapToPosition(dragElement, activeInsertionPoint, () => {
        // After animation completes, execute the drop and clean up
        onDrop(draggedField, activeInsertionPoint);
        
        // Clean up drag state
        setIsDragMode(false);
        setDraggedField(null);
        setIsDragging(false);
        setActiveInsertionPoint(null);
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
  }, [isDragMode, isDragging, activeInsertionPoint, draggedField, dragElement, onDrop, longPressTimer]);

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
    if (!touchStartPos || !isDragMode || !draggedField) return;

    const touch = event.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.y);

    // Cancel long press if finger moves too much during initial press
    if (!isDragMode && (deltaX > 10 || deltaY > 10)) {
      cancelLongPress();
      return;
    }

    // Start dragging if we've moved beyond threshold
    if (isDragMode && !isDragging && (deltaX > 5 || deltaY > 5)) {
      setIsDragging(true);
      
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    }

    // Update drag position and find nearest insertion point
    if (isDragging) {
      // Update floating drag element position
      if (dragElement) {
        updateFloatingDragElementPosition(dragElement, touch.clientY);
      }

      // Record last client Y
      lastClientYRef.current = touch.clientY;
      
      const scrollOffset = getScrollOffset();
      // Find nearest insertion point - recalculate fresh to account for layout shifts
      const currentY = touch.clientY + scrollOffset;
      const delta = scrollOffset - window.scrollY;
      const currentInsertionPoints = calculateInsertionPoints().map(p => ({ ...p, y: p.y + delta }));
      const nearestPoint = findNearestInsertionPoint(currentY, currentInsertionPoints);
      
      // Only update if there's a change to prevent unnecessary re-renders
      setActiveInsertionPoint(nearestPoint);
      
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
      
      // Recalculate insertion points and active point relative to finger
      const scrollOffset = getScrollOffset();
      const delta = scrollOffset - window.scrollY;
      const updatedPoints = calculateInsertionPoints().map(p => ({ ...p, y: p.y + delta }));
      const fingerY = lastClientYRef.current;
      const currentY = fingerY + scrollOffset;
      const nearestPoint = findNearestInsertionPoint(currentY, updatedPoints);
      setActiveInsertionPoint(nearestPoint);

      scrollAnimationFrame.current = requestAnimationFrame(step);
    };

    step();
  }, [recalculateInsertionPoints, stopEdgeScroll, getScrollOffset]);

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
    setActiveInsertionPoint(null);

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
    if (isDragMode) {
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
      
      // Disable touch-action to tell browser this gesture is not for scrolling
      document.body.style.touchAction = 'none';

      // Prevent all native scrolling – we will handle paging programmatically
      document.addEventListener('touchmove', preventScrolling, { passive: false });
      
      // Handle click outside to exit drag mode
      document.addEventListener('touchstart', handleClickOutside, { passive: true });

      return () => {
        document.removeEventListener('contextmenu', preventContextMenu);
        document.removeEventListener('touchmove', preventScrolling);
        document.removeEventListener('touchstart', handleClickOutside);

        // Restore default touch-action
        document.body.style.touchAction = '';

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
    
    // Show placeholder when in drag mode but not actively dragging,
    // or when actively dragging but no insertion point is active
    return !isDragging || !activeInsertionPoint;
  }, [isDragMode, draggedField, isDragging, activeInsertionPoint]);

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
    activeInsertionPoint,
    shouldShowPlaceholder,
    
    // Handlers
    onTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    
    // Control
    exitDragMode,
  };
}; 
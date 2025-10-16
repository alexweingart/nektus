'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ContactEntry } from '@/types/profile';

interface UseDragAndDropProps {
  section: 'personal' | 'work';
  getVisibleFields: () => ContactEntry[];
  onReorder?: (newList: ContactEntry[]) => void;
}

interface UseDragAndDropReturn {
  // State
  isDragMode: boolean;
  ghostField: ContactEntry | null;
  ghostY: number;
  dropTargetIndex: number | null;
  draggedField: ContactEntry | null;
  draggedFieldIndex: number | null;

  // Methods to call from event delegation
  startLongPress: (field: ContactEntry, touchY: number) => void;
  cancelLongPress: () => void;
}

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

    // CRITICAL: Find and disable PullToRefresh scrollable container
    const scrollableContainer = document.querySelector('[data-scrollable="true"]') as HTMLElement;
    if (scrollableContainer) {
      scrollableContainer.style.overflow = 'hidden';
      scrollableContainer.style.touchAction = 'none';
    }

    // CRITICAL: Separate listener JUST for preventing scrolling
    const preventScrolling = (e: TouchEvent) => {
      if (e.cancelable) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    this.listeners.touchMove = handlers.touchMove;
    this.listeners.preventScrolling = preventScrolling;

    // CRITICAL: Add listeners in CAPTURE phase to intercept BEFORE PullToRefresh container
    document.addEventListener('touchmove', handlers.touchMove, { passive: false, capture: true });
    document.addEventListener('touchmove', preventScrolling, { passive: false, capture: true });
    document.body.style.touchAction = 'none';
  }

  deactivateDrag() {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;

    // Re-enable scrollable container
    const scrollableContainer = document.querySelector('[data-scrollable="true"]') as HTMLElement;
    if (scrollableContainer) {
      scrollableContainer.style.overflow = '';
      scrollableContainer.style.touchAction = '';
    }

    if (this.listeners.touchMove) {
      // Remove with capture: true to match how we added them
      document.removeEventListener('touchmove', this.listeners.touchMove, { capture: true } as any);
    }
    if (this.listeners.preventScrolling) {
      document.removeEventListener('touchmove', this.listeners.preventScrolling, { capture: true } as any);
    }

    document.body.style.touchAction = '';
    this.listeners = {};
  }
}

export const useDragAndDrop = ({
  section,
  getVisibleFields,
  onReorder
}: UseDragAndDropProps): UseDragAndDropReturn => {

  const [isDragMode, setIsDragMode] = useState(false);
  const [draggedField, setDraggedField] = useState<ContactEntry | null>(null);
  const [draggedFieldIndex, setDraggedFieldIndex] = useState<number | null>(null);
  const [ghostY, setGhostY] = useState(0);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDragModeRef = useRef(false);
  const globalManager = GlobalDragManager.getInstance();
  const containerTopRef = useRef<number>(0); // Store container top position when drag starts
  const initialScrollTopRef = useRef<number>(0); // Store initial scroll position when drag starts
  const dropTargetIndexRef = useRef<number | null>(null); // Track latest drop target

  // Auto-scroll refs
  const scrollAnimationFrame = useRef<number | null>(null);
  const edgeScrollDirection = useRef<'up' | 'down' | null>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const scrollSpeed = 12; // px per frame

  // Removed verbose hook render log

  // Sync refs with state
  isDragModeRef.current = isDragMode;
  dropTargetIndexRef.current = dropTargetIndex;

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

      scrollAnimationFrame.current = requestAnimationFrame(step);
    };

    step();
  }, [stopEdgeScroll]);

  // Handle edge scrolling when dragging near viewport edges
  const handleEdgeScroll = useCallback((clientY: number) => {
    if (!isDragModeRef.current) {
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
  }, [startEdgeScroll, stopEdgeScroll]);

  // Calculate drop target based on ghost Y position using midpoint distance comparison
  const updateDropTarget = useCallback((currentY: number, currentDraggedIndex: number, currentDropTarget: number) => {
    const visibleFields = getVisibleFields();

    // Get current scroll position and calculate delta from initial position
    const currentScrollTop = scrollContainerRef.current?.scrollTop || 0;
    const scrollDelta = currentScrollTop - initialScrollTopRef.current;

    // Adjust container top for scroll changes
    const containerTop = containerTopRef.current - scrollDelta;

    // Field height + space-y-5 gap (3.5rem field + 1.25rem gap = 56px + 20px = 76px)
    const FIELD_HEIGHT = 76;

    // Calculate midpoints for each field position
    const getMidpoint = (index: number) => containerTop + (index * FIELD_HEIGHT) + (FIELD_HEIGHT / 2);

    // Find the field whose midpoint is closest to the ghost position
    // Compare: current drop target, item above, item below
    let closestIndex = currentDropTarget;
    let closestDistance = Math.abs(currentY - getMidpoint(currentDropTarget));

    // Check item above current drop target (if exists)
    if (currentDropTarget > 0) {
      const aboveDistance = Math.abs(currentY - getMidpoint(currentDropTarget - 1));
      if (aboveDistance < closestDistance) {
        closestIndex = currentDropTarget - 1;
        closestDistance = aboveDistance;
      }
    }

    // Check item below current drop target (if exists)
    if (currentDropTarget < visibleFields.length - 1) {
      const belowDistance = Math.abs(currentY - getMidpoint(currentDropTarget + 1));
      if (belowDistance < closestDistance) {
        closestIndex = currentDropTarget + 1;
        closestDistance = belowDistance;
      }
    }

    setDropTargetIndex(closestIndex);
  }, [getVisibleFields]);

  const draggedFieldIndexRef = useRef<number | null>(null);

  // Keep dragged index in sync
  useEffect(() => {
    draggedFieldIndexRef.current = draggedFieldIndex;
  }, [draggedFieldIndex]);

  // CRITICAL: Add listeners on MOUNT, before any touches happen
  useEffect(() => {
    const persistentTouchMoveHandler = (e: TouchEvent) => {
      const dragModeActive = isDragModeRef.current;

      // Check ref (not state) to avoid stale closure
      if (dragModeActive) {
        // Prevent scrolling
        if (e.cancelable) {
          e.preventDefault();
          e.stopPropagation();
        }

        // Update ghost position and drop target
        const touchY = e.touches[0].clientY;
        setGhostY(touchY);

        // Handle edge scrolling
        handleEdgeScroll(touchY);

        // Pass the current dragged index and drop target
        const currentDraggedIndex = draggedFieldIndexRef.current;
        const currentDropTarget = dropTargetIndexRef.current;
        if (currentDraggedIndex !== null && currentDropTarget !== null) {
          updateDropTarget(touchY, currentDraggedIndex, currentDropTarget);
        }
      }
    };

    // CRITICAL: Use capture:true to intercept touchmove BEFORE it reaches children
    document.addEventListener('touchmove', persistentTouchMoveHandler, {
      passive: false,
      capture: true
    });

    return () => {
      document.removeEventListener('touchmove', persistentTouchMoveHandler, { capture: true } as any);
      globalManager.deactivateDrag();
      stopEdgeScroll();
    };
  }, [globalManager, updateDropTarget, handleEdgeScroll, stopEdgeScroll]);

  // Update overflow and touch-action when drag mode changes
  useEffect(() => {
    const scrollableContainer = document.querySelector('[data-scrollable="true"]') as HTMLElement;

    if (isDragMode) {
      // Disable scrolling during drag
      if (scrollableContainer) {
        scrollableContainer.style.overflow = 'hidden';
        scrollableContainer.style.touchAction = 'none';
      }
      document.body.style.touchAction = 'none';
    } else {
      // Re-enable scrolling when not dragging
      if (scrollableContainer) {
        scrollableContainer.style.overflow = '';
        scrollableContainer.style.touchAction = '';
      }
      document.body.style.touchAction = '';
      stopEdgeScroll();
      globalManager.deactivateDrag();
    }
  }, [isDragMode, section, globalManager, stopEdgeScroll]);

  // Enter drag mode
  const enterDragMode = useCallback((field: ContactEntry, touchY: number) => {
    const visibleFields = getVisibleFields();
    const draggedIndex = visibleFields.findIndex(
      f => f.fieldType === field.fieldType && f.section === field.section
    );

    // Store the container top position when drag starts (before any transforms)
    const fieldElements = document.querySelectorAll('[data-field-id]');
    if (fieldElements.length > 0) {
      const firstFieldRect = fieldElements[0].getBoundingClientRect();
      containerTopRef.current = firstFieldRect.top;
    }

    // Store reference to scrollable container for auto-scroll
    const scrollableContainer = document.querySelector('[data-scrollable="true"]') as HTMLElement;
    scrollContainerRef.current = scrollableContainer;

    // Store initial scroll position to track scroll delta during drag
    initialScrollTopRef.current = scrollableContainer?.scrollTop || 0;

    // Add touchend listener - capture current values in closure
    const touchEndHandler = () => {
      // Get fresh values at drop time using ref (not stale state from closure)
      const currentVisibleFields = getVisibleFields();
      const currentDropIndex = dropTargetIndexRef.current; // Use ref for latest value

      // Calculate final field order if we have a valid drop target
      if (currentDropIndex !== null && draggedIndex !== -1 && onReorder) {
        // Compute the preview order (same as what's shown during drag)
        const previewOrder = [...currentVisibleFields];
        const [removed] = previewOrder.splice(draggedIndex, 1);
        previewOrder.splice(currentDropIndex, 0, removed);

        onReorder(previewOrder);
      }

      // Stop edge scrolling
      stopEdgeScroll();

      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      setIsDragMode(false);
      setDraggedField(null);
      setDraggedFieldIndex(null);
      setGhostY(0);
      setDropTargetIndex(null);
      document.removeEventListener('touchend', touchEndHandler);
    };

    document.addEventListener('touchend', touchEndHandler, { passive: true, once: true });

    // Set drag mode state (this will trigger ref update and styles)
    setIsDragMode(true);
    setDraggedField(field);
    setDraggedFieldIndex(draggedIndex);
    setGhostY(touchY);
    setDropTargetIndex(draggedIndex); // Start with current position
  }, [getVisibleFields, section, onReorder, stopEdgeScroll]);

  // Start long press timer - called from event delegation
  const startLongPress = useCallback((field: ContactEntry, touchY: number) => {
    // Clear existing timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    // Start timer
    longPressTimerRef.current = setTimeout(() => {
      enterDragMode(field, touchY);
    }, 1000);
  }, [section, enterDragMode]);

  // Cancel long press timer - called when user moves finger (scrolling)
  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, [section]);

  return {
    isDragMode,
    ghostField: draggedField,
    ghostY,
    dropTargetIndex,
    draggedField,
    draggedFieldIndex,
    startLongPress,
    cancelLongPress
  };
};

/**
 * Drag and Drop Hook for iOS
 * Adapted from: apps/web/src/client/hooks/use-drag-and-drop.ts
 *
 * Changes from web:
 * - Uses react-native-draggable-flatlist instead of DOM events
 * - Much simpler since library handles gestures, animations, and drop detection
 * - Preserves same interface where possible for consistency
 */

import { useState, useCallback } from 'react';
import type { ContactEntry } from '@nektus/shared-types';

interface UseDragAndDropProps {
  section: 'personal' | 'work';
  getVisibleFields: () => ContactEntry[];
  onReorder?: (newList: ContactEntry[]) => void;
}

interface UseDragAndDropReturn {
  // State - matches web interface
  isDragMode: boolean;
  draggedField: ContactEntry | null;
  draggedFieldIndex: number | null;

  // Handlers for DraggableFlatList
  onDragBegin: (index: number) => void;
  onDragEnd: (data: { data: ContactEntry[]; from: number; to: number }) => void;

  // Accessibility functions (keep from original)
  moveUp: (index: number) => void;
  moveDown: (index: number) => void;
}

export function useDragAndDrop({
  section: _section,
  getVisibleFields,
  onReorder,
}: UseDragAndDropProps): UseDragAndDropReturn {
  const [isDragMode, setIsDragMode] = useState(false);
  const [draggedField, setDraggedField] = useState<ContactEntry | null>(null);
  const [draggedFieldIndex, setDraggedFieldIndex] = useState<number | null>(null);

  /**
   * Called when drag begins
   * DraggableFlatList triggers this via onDragBegin prop
   */
  const onDragBegin = useCallback(
    (index: number) => {
      const visibleFields = getVisibleFields();
      const field = visibleFields[index];

      setIsDragMode(true);
      setDraggedField(field || null);
      setDraggedFieldIndex(index);
    },
    [getVisibleFields]
  );

  /**
   * Called when drag ends
   * DraggableFlatList provides the reordered data array
   */
  const onDragEnd = useCallback(
    ({ data, from, to }: { data: ContactEntry[]; from: number; to: number }) => {
      // Reset drag state
      setIsDragMode(false);
      setDraggedField(null);
      setDraggedFieldIndex(null);

      // Only call onReorder if position actually changed
      if (from !== to && onReorder) {
        // Update order field on each item to match new positions
        const updatedData = data.map((item, index) => ({
          ...item,
          order: index,
        }));
        onReorder(updatedData);
      }
    },
    [onReorder]
  );

  /**
   * Move item up in the list (for accessibility/button-based reordering)
   */
  const moveUp = useCallback(
    (index: number) => {
      if (index <= 0 || !onReorder) return;

      const items = getVisibleFields();
      const reorderedItems = [...items];
      const [movedItem] = reorderedItems.splice(index, 1);
      reorderedItems.splice(index - 1, 0, movedItem);

      // Update order field on each item
      const updatedItems = reorderedItems.map((item, idx) => ({
        ...item,
        order: idx,
      }));

      onReorder(updatedItems);
    },
    [getVisibleFields, onReorder]
  );

  /**
   * Move item down in the list (for accessibility/button-based reordering)
   */
  const moveDown = useCallback(
    (index: number) => {
      const items = getVisibleFields();
      if (index >= items.length - 1 || !onReorder) return;

      const reorderedItems = [...items];
      const [movedItem] = reorderedItems.splice(index, 1);
      reorderedItems.splice(index + 1, 0, movedItem);

      // Update order field on each item
      const updatedItems = reorderedItems.map((item, idx) => ({
        ...item,
        order: idx,
      }));

      onReorder(updatedItems);
    },
    [getVisibleFields, onReorder]
  );

  return {
    // State
    isDragMode,
    draggedField,
    draggedFieldIndex,

    // Handlers for DraggableFlatList
    onDragBegin,
    onDragEnd,

    // Accessibility
    moveUp,
    moveDown,
  };
}

export default useDragAndDrop;

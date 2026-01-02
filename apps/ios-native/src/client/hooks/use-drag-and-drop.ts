/**
 * Drag and Drop Hook for iOS
 * NEW file for iOS - web version uses DOM-based drag and drop
 *
 * This hook provides drag-and-drop functionality for reordering fields
 * using react-native-draggable-flatlist (to be installed when needed)
 *
 * Note: This is a placeholder implementation. Full drag-and-drop
 * requires react-native-draggable-flatlist or similar library.
 */

import { useState, useCallback } from 'react';
import type { ContactEntry } from '@nektus/shared-types';

interface UseDragAndDropProps {
  items: ContactEntry[];
  onReorder: (reorderedItems: ContactEntry[]) => void;
  isEnabled?: boolean;
}

interface DragAndDropState {
  isDragging: boolean;
  draggedIndex: number | null;
  targetIndex: number | null;
}

export function useDragAndDrop({
  items,
  onReorder,
  isEnabled = true,
}: UseDragAndDropProps) {
  const [state, setState] = useState<DragAndDropState>({
    isDragging: false,
    draggedIndex: null,
    targetIndex: null,
  });

  /**
   * Handle drag start
   */
  const handleDragStart = useCallback(
    (index: number) => {
      if (!isEnabled) return;

      setState({
        isDragging: true,
        draggedIndex: index,
        targetIndex: index,
      });
    },
    [isEnabled]
  );

  /**
   * Handle drag over (updating target position)
   */
  const handleDragOver = useCallback(
    (index: number) => {
      if (!state.isDragging) return;

      setState((prev) => ({
        ...prev,
        targetIndex: index,
      }));
    },
    [state.isDragging]
  );

  /**
   * Handle drag end - reorder items
   */
  const handleDragEnd = useCallback(() => {
    if (!state.isDragging || state.draggedIndex === null || state.targetIndex === null) {
      setState({
        isDragging: false,
        draggedIndex: null,
        targetIndex: null,
      });
      return;
    }

    const { draggedIndex, targetIndex } = state;

    // If dropped in same position, no change needed
    if (draggedIndex === targetIndex) {
      setState({
        isDragging: false,
        draggedIndex: null,
        targetIndex: null,
      });
      return;
    }

    // Reorder the items
    const reorderedItems = [...items];
    const [movedItem] = reorderedItems.splice(draggedIndex, 1);
    reorderedItems.splice(targetIndex, 0, movedItem);

    // Update order field on each item
    const updatedItems = reorderedItems.map((item, index) => ({
      ...item,
      order: index,
    }));

    // Call the reorder callback
    onReorder(updatedItems);

    // Reset state
    setState({
      isDragging: false,
      draggedIndex: null,
      targetIndex: null,
    });
  }, [state, items, onReorder]);

  /**
   * Handle drag cancel
   */
  const handleDragCancel = useCallback(() => {
    setState({
      isDragging: false,
      draggedIndex: null,
      targetIndex: null,
    });
  }, []);

  /**
   * Move item up in the list
   */
  const moveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;

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
    [items, onReorder]
  );

  /**
   * Move item down in the list
   */
  const moveDown = useCallback(
    (index: number) => {
      if (index >= items.length - 1) return;

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
    [items, onReorder]
  );

  /**
   * Render callback for use with FlatList/DraggableFlatList
   * Returns props to be spread onto list items
   */
  const getItemProps = useCallback(
    (index: number) => ({
      onDragStart: () => handleDragStart(index),
      onDragOver: () => handleDragOver(index),
      onDragEnd: handleDragEnd,
      isDragged: state.draggedIndex === index,
      isTarget: state.targetIndex === index && state.draggedIndex !== index,
    }),
    [handleDragStart, handleDragOver, handleDragEnd, state]
  );

  return {
    // State
    isDragging: state.isDragging,
    draggedIndex: state.draggedIndex,
    targetIndex: state.targetIndex,

    // Handlers
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,

    // Simple move functions (for accessibility/buttons)
    moveUp,
    moveDown,

    // Helper for FlatList items
    getItemProps,
  };
}

export default useDragAndDrop;

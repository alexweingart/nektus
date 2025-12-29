/**
 * SelectedSections - Renders the currently selected profile section (Personal/Work)
 * and the Hidden fields section. This component is used twice in the carousel
 * (once for Personal mode, once for Work mode).
 */

'use client';

import React, { useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import type { ContactEntry, FieldSection, Calendar, UserLocation } from '@/types/profile';
import { useEditProfileFields } from '@/lib/hooks/use-edit-profile-fields';
import { useDragAndDrop } from '@/lib/hooks/use-drag-and-drop';
import { Button } from '../ui/buttons/Button';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import { FieldSection as FieldSectionComponent } from '../ui/layout/FieldSection';
import { FieldList } from '../ui/layout/FieldList';
import { ProfileField } from '../ui/elements/ProfileField';
import { ItemChip } from '../ui/modules/ItemChip';
import { InlineAddLink } from '../ui/modules/InlineAddLink';

// Portal helper component
const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return typeof window !== 'undefined'
    ? createPortal(children, document.body)
    : null;
};

interface SelectedSectionsProps {
  viewMode: 'Personal' | 'Work';
  fieldSectionManager: ReturnType<typeof useEditProfileFields>;
  getCalendarForSection: (section: 'personal' | 'work') => Calendar | undefined;
  getLocationForSection: (section: 'personal' | 'work') => UserLocation | undefined;
  handleOpenCalendarModal: (section: 'personal' | 'work') => void;
  handleOpenLocationModal: (section: 'personal' | 'work') => void;
  handleDeleteCalendar: (section: 'personal' | 'work') => void;
  handleDeleteLocation: (section: 'personal' | 'work') => void;
  isDeletingCalendar: { personal: boolean; work: boolean };
  isDeletingLocation: { personal: boolean; work: boolean };
  calRouter: ReturnType<typeof useRouter>;
  showInlineAddLink: { personal: boolean; work: boolean };
  handleToggleInlineAddLink: (section: 'personal' | 'work') => void;
  handleLinkAdded: (entries: ContactEntry[]) => void;
  getNextOrderForSection: (sectionName: 'personal' | 'work') => number;
  getFieldValue: (fieldType: string, section?: FieldSection) => string;
  handleFieldChange: (fieldType: string, value: string, section: FieldSection) => void;
  getFieldsForView: (viewMode: 'Personal' | 'Work') => {
    visibleFields: ContactEntry[];
    hiddenFields: ContactEntry[];
  };
}

export const SelectedSections: React.FC<SelectedSectionsProps> = ({
  viewMode,
  fieldSectionManager,
  getCalendarForSection,
  getLocationForSection,
  handleOpenCalendarModal,
  handleOpenLocationModal,
  handleDeleteCalendar,
  handleDeleteLocation,
  isDeletingCalendar,
  isDeletingLocation,
  calRouter,
  showInlineAddLink,
  handleToggleInlineAddLink,
  handleLinkAdded,
  getNextOrderForSection,
  getFieldValue,
  handleFieldChange,
  getFieldsForView
}) => {
  const { visibleFields, hiddenFields } = getFieldsForView(viewMode);
  const sectionName = viewMode.toLowerCase() as 'personal' | 'work';

  // Get calendar and location for this section
  const calendar = getCalendarForSection(sectionName);
  const location = getLocationForSection(sectionName);

  // Drag & Drop hook
  const dragAndDrop = useDragAndDrop({
    section: sectionName,
    getVisibleFields: () => fieldSectionManager.getVisibleFields(sectionName),
    onReorder: (newOrder: ContactEntry[]) => {
      fieldSectionManager.updateFieldOrder(sectionName, newOrder);
    }
  });

  // Event delegation for drag handles
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number>(0);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as Element;
      const dragHandle = target.closest('[data-drag-handle="true"]');
      if (!dragHandle) return;

      const fieldType = dragHandle.getAttribute('data-field-type');
      const section = dragHandle.getAttribute('data-section');
      if (!fieldType || !section) return;

      // Find the field
      const field = visibleFields.find(f => f.fieldType === fieldType && f.section === section);
      if (!field) return;

      const touchY = e.touches[0].clientY;
      touchStartYRef.current = touchY;

      dragAndDrop.startLongPress(field, touchY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragAndDrop.isDragMode) {
        // During long press detection - cancel if user moves too much (scrolling)
        const touchY = e.touches[0].clientY;
        const moveDistance = Math.abs(touchY - touchStartYRef.current);
        if (moveDistance > 10) {
          dragAndDrop.cancelLongPress();
        }
      }
    };

    const handleTouchEnd = (_e: TouchEvent) => {
      if (!dragAndDrop.isDragMode) {
        // User released before 1 second - cancel the long press timer
        dragAndDrop.cancelLongPress();
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [visibleFields, dragAndDrop, sectionName]);

  // Compute preview order for CSS transforms
  const computePreviewOrder = useCallback((): ContactEntry[] => {
    if (!dragAndDrop.isDragMode || dragAndDrop.draggedFieldIndex === null || dragAndDrop.dropTargetIndex === null) {
      return visibleFields;
    }

    const previewOrder = [...visibleFields];
    const [draggedItem] = previewOrder.splice(dragAndDrop.draggedFieldIndex, 1);
    previewOrder.splice(dragAndDrop.dropTargetIndex, 0, draggedItem);

    return previewOrder;
  }, [visibleFields, dragAndDrop.isDragMode, dragAndDrop.draggedFieldIndex, dragAndDrop.dropTargetIndex]);

  // Calculate CSS transform offset for each field
  const getFieldOffset = useCallback((field: ContactEntry, originalIndex: number): number => {
    if (!dragAndDrop.isDragMode) return 0;

    const previewOrder = computePreviewOrder();
    const targetIndex = previewOrder.findIndex(
      f => f.fieldType === field.fieldType && f.section === field.section
    );

    if (targetIndex === -1) {
      console.warn('[getFieldOffset] Field not found in preview order:', field.fieldType);
      return 0;
    }

    // Field height + space-y-5 gap (3.5rem field + 1.25rem gap = 56px + 20px = 76px)
    const FIELD_HEIGHT = 76;
    const offset = (targetIndex - originalIndex) * FIELD_HEIGHT;

    return offset;
  }, [dragAndDrop.isDragMode, computePreviewOrder]);

  return (
    <>
      {/* Current Section */}
      <FieldSectionComponent
        title={viewMode}
        isEmpty={visibleFields.length === 0}
        emptyText={`You have no ${viewMode} networks right now. Add a link to get started.`}
        topContent={
          <>
            {/* Calendar UI */}
            {calendar ? (
              <div className="w-full">
                <ItemChip
                  icon={
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  }
                  title={`${calendar.provider.charAt(0).toUpperCase() + calendar.provider.slice(1)} Calendar`}
                  subtitle={calendar.email}
                  onClick={() => calRouter.push(`/edit/calendar?id=${calendar.id}`)}
                  onActionClick={() => handleDeleteCalendar(sectionName)}
                  actionIcon="trash"
                  isActionLoading={isDeletingCalendar[sectionName]}
                />
              </div>
            ) : (
              <div className="w-full">
                <Button
                  variant="white"
                  size="lg"
                  className="w-full"
                  onClick={() => handleOpenCalendarModal(sectionName)}
                >
                  Add Calendar
                </Button>
              </div>
            )}

            {/* Location UI */}
            {location ? (
              <div className="w-full mt-5">
                <ItemChip
                  icon={
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  }
                  title={`${location.city}${location.region ? ', ' + location.region : ''}`}
                  subtitle={location.address}
                  onClick={() => calRouter.push(`/edit/location?id=${location.id}`)}
                  onActionClick={() => handleDeleteLocation(sectionName)}
                  actionIcon="trash"
                  isActionLoading={isDeletingLocation[sectionName]}
                />
              </div>
            ) : (
              <div className="w-full mt-5">
                <Button
                  variant="white"
                  size="lg"
                  className="w-full"
                  onClick={() => handleOpenLocationModal(sectionName)}
                >
                  Add Location
                </Button>
              </div>
            )}

            {/* Divider */}
            <div className="w-full border-t border-white/10 mt-5" />
          </>
        }
        bottomButton={
          <>
            {/* Inline Add Link Component */}
            {showInlineAddLink[sectionName] && (
              <div className="mb-4">
                <InlineAddLink
                  section={sectionName}
                  onLinkAdded={handleLinkAdded}
                  nextOrder={getNextOrderForSection(sectionName)}
                  onCancel={() => handleToggleInlineAddLink(sectionName)}
                />
              </div>
            )}

            {/* Add Link Button */}
            <div className="text-center">
              <SecondaryButton
                className="cursor-pointer"
                onClick={() => handleToggleInlineAddLink(sectionName)}
              >
                {showInlineAddLink[sectionName] ? 'Cancel' : 'Add Link'}
              </SecondaryButton>
            </div>
          </>
        }
      >
        <div ref={containerRef}>
          <FieldList>
            {visibleFields.map((field, index) => {
              const isBeingDragged =
                dragAndDrop.isDragMode &&
                dragAndDrop.draggedField?.fieldType === field.fieldType &&
                dragAndDrop.draggedField?.section === field.section;

              // Apply offset to all fields including dragged (so reserved space moves correctly)
              const offset = getFieldOffset(field, index);

              return (
                <div
                  key={`${field.fieldType}-${field.section}`}
                  data-field-id={`${field.fieldType}-${field.section}`}
                  style={{
                    transform: `translateY(${offset}px)`,
                    transition: dragAndDrop.isDragMode ? 'transform 0.2s ease-out' : 'none',
                    visibility: isBeingDragged ? 'hidden' : 'visible'
                  }}
                >
                  <ProfileField
                    profile={field}
                    fieldSectionManager={fieldSectionManager}
                    getValue={getFieldValue}
                    onChange={handleFieldChange}
                    isUnconfirmed={fieldSectionManager.isChannelUnconfirmed}
                    onConfirm={fieldSectionManager.markChannelAsConfirmed}
                    currentViewMode={viewMode}
                    isDraggable={true}
                  />
                </div>
              );
            })}
          </FieldList>
        </div>
      </FieldSectionComponent>

      {/* Drag Ghost */}
      {dragAndDrop.isDragMode && dragAndDrop.ghostField && (
        <Portal>
          <div
            style={{
              position: 'fixed',
              top: dragAndDrop.ghostY,
              left: '50%',
              transform: 'translate(-50%, -50%) scale(1.05)',
              zIndex: 9999,
              width: 'min(448px, calc(100% - 32px))',
              pointerEvents: 'none',
              opacity: 0.95
            }}
          >
            {/* Focused field styling wrapper */}
            <div
              className="relative"
              style={{
                width: '100%',
                height: '3.5rem',
                minHeight: '3.5rem',
              }}
            >
              {/* Background with focused styles */}
              <div
                className="absolute inset-0 rounded-full border bg-black/50 border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                style={{
                  transition: 'all 0.2s ease-in-out',
                  pointerEvents: 'none'
                }}
              />
              {/* Field content */}
              <div className="relative z-10">
                <ProfileField
                  profile={dragAndDrop.ghostField}
                  fieldSectionManager={fieldSectionManager}
                  getValue={getFieldValue}
                  onChange={() => {}}
                  isUnconfirmed={fieldSectionManager.isChannelUnconfirmed}
                  onConfirm={() => {}}
                  currentViewMode={viewMode}
                  isDraggable={false}
                />
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Hidden Fields - Always show with Sign Out button */}
      <FieldSectionComponent
        title="Hidden"
        isEmpty={hiddenFields.length === 0}
        emptyText="Tap the hide button on any field if you're about to Nekt and don't want to share that link."
        bottomButton={
          <div className="text-center">
            <SecondaryButton
              variant="destructive"
              className="cursor-pointer"
              onClick={() => signOut({ callbackUrl: '/' })}
            >
              Sign Out
            </SecondaryButton>
          </div>
        }
      >
        <FieldList>
          {hiddenFields.map((field, index) => (
            <ProfileField
              key={`hidden-${field.fieldType}-${index}`}
              profile={field}
              fieldSectionManager={fieldSectionManager}
              getValue={getFieldValue}
              onChange={handleFieldChange}
              isUnconfirmed={fieldSectionManager.isChannelUnconfirmed}
              onConfirm={fieldSectionManager.markChannelAsConfirmed}
              currentViewMode={viewMode}
            />
          ))}
        </FieldList>
      </FieldSectionComponent>
    </>
  );
};

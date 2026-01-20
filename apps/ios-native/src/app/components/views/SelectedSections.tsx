/**
 * SelectedSections for iOS
 * Adapted from: apps/web/src/app/components/views/SelectedSections.tsx
 *
 * Changes from web:
 * - Uses React Native components
 * - Uses react-native-draggable-flatlist for drag-and-drop
 * - Uses React Navigation instead of Next.js router
 * - Replaced signOut with iOS auth
 */

import React, { useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import type { RootStackParamList } from '../../../../App';
import type { ContactEntry, FieldSection, Calendar, UserLocation } from '@nektus/shared-types';
import { useSession } from '../../providers/SessionProvider';
import { useDragAndDrop } from '../../../client/hooks/use-drag-and-drop';
import { Button } from '../ui/buttons/Button';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import { FieldSection as FieldSectionComponent } from '../ui/layout/FieldSection';
import { FieldList } from '../ui/layout/FieldList';
import { ProfileField } from '../ui/elements/ProfileField';
import { ItemChip } from '../ui/modules/ItemChip';
import { InlineAddLink } from '../ui/modules/InlineAddLink';
import Svg, { Path } from 'react-native-svg';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface FieldSectionManager {
  isFieldHidden: (fieldType: string, viewMode: 'Personal' | 'Work') => boolean;
  toggleFieldVisibility: (fieldType: string, viewMode: 'Personal' | 'Work') => void;
  isChannelUnconfirmed: (fieldType: string) => boolean;
  markChannelAsConfirmed: (fieldType: string) => void;
  getVisibleFields: (section: 'personal' | 'work') => ContactEntry[];
  updateFieldOrder: (section: 'personal' | 'work', newOrder: ContactEntry[]) => void;
}

interface SelectedSectionsProps {
  viewMode: 'Personal' | 'Work';
  fieldSectionManager: FieldSectionManager;
  getCalendarForSection: (section: 'personal' | 'work') => Calendar | undefined;
  getLocationForSection: (section: 'personal' | 'work') => UserLocation | undefined;
  handleOpenCalendarModal: (section: 'personal' | 'work') => void;
  handleOpenLocationModal: (section: 'personal' | 'work') => void;
  handleDeleteCalendar: (section: 'personal' | 'work') => void;
  handleDeleteLocation: (section: 'personal' | 'work') => void;
  isDeletingCalendar: { personal: boolean; work: boolean };
  isDeletingLocation: { personal: boolean; work: boolean };
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
  /** Tint color for the selectors (from profile.backgroundColors[2]) */
  tintColor?: string;
}

// Calendar icon component
function CalendarIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2}>
      <Path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </Svg>
  );
}

// Location icon component
function LocationIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2}>
      <Path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <Path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </Svg>
  );
}

export function SelectedSections({
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
  showInlineAddLink,
  handleToggleInlineAddLink,
  handleLinkAdded,
  getNextOrderForSection,
  getFieldValue,
  handleFieldChange,
  getFieldsForView,
  tintColor,
}: SelectedSectionsProps) {
  const navigation = useNavigation<NavigationProp>();
  const { signOut } = useSession();
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
    },
  });

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      // Navigation will be handled by SessionProvider updating auth state
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }, [signOut]);

  const handleCalendarPress = useCallback(() => {
    if (calendar) {
      navigation.navigate('Calendar', { section: sectionName });
    }
  }, [calendar, navigation, sectionName]);

  const handleLocationPress = useCallback(() => {
    if (location) {
      navigation.navigate('Location', { section: sectionName });
    }
  }, [location, navigation, sectionName]);

  return (
    <>
      {/* Current Section */}
      <FieldSectionComponent
        title={viewMode}
        isEmpty={visibleFields.length === 0}
        emptyText={`You have no ${viewMode} networks right now. Add a link to get started.`}
        topContent={
          <View style={styles.topContent}>
            {/* Calendar UI */}
            {calendar ? (
              <ItemChip
                icon={<CalendarIcon />}
                title={`${calendar.provider.charAt(0).toUpperCase() + calendar.provider.slice(1)} Calendar`}
                subtitle={calendar.email}
                onPress={handleCalendarPress}
                onActionClick={() => handleDeleteCalendar(sectionName)}
                actionIcon="trash"
                isActionLoading={isDeletingCalendar[sectionName]}
              />
            ) : (
              <Button
                variant="white"
                size="lg"
                onPress={() => handleOpenCalendarModal(sectionName)}
                style={styles.addButton}
              >
                Add Calendar
              </Button>
            )}

            {/* Location UI */}
            <View style={styles.locationContainer}>
              {location ? (
                <ItemChip
                  icon={<LocationIcon />}
                  title={`${location.city}${location.region ? ', ' + location.region : ''}`}
                  subtitle={location.address}
                  onPress={handleLocationPress}
                  onActionClick={() => handleDeleteLocation(sectionName)}
                  actionIcon="trash"
                  isActionLoading={isDeletingLocation[sectionName]}
                />
              ) : (
                <Button
                  variant="white"
                  size="lg"
                  onPress={() => handleOpenLocationModal(sectionName)}
                  style={styles.addButton}
                >
                  Add Location
                </Button>
              )}
            </View>

            {/* Divider */}
            <View style={styles.divider} />
          </View>
        }
        bottomButton={
          <View>
            {/* Inline Add Link Component */}
            {showInlineAddLink[sectionName] && (
              <View style={styles.inlineAddLink}>
                <InlineAddLink
                  section={sectionName}
                  onLinkAdded={handleLinkAdded}
                  nextOrder={getNextOrderForSection(sectionName)}
                  onCancel={() => handleToggleInlineAddLink(sectionName)}
                  tintColor={tintColor}
                />
              </View>
            )}

            {/* Add Link Button */}
            <View style={styles.addLinkButton}>
              <SecondaryButton
                onPress={() => handleToggleInlineAddLink(sectionName)}
              >
                {showInlineAddLink[sectionName] ? 'Cancel' : 'Add Link'}
              </SecondaryButton>
            </View>
          </View>
        }
      >
        <DraggableFlatList
          data={visibleFields}
          keyExtractor={(item) => `${item.fieldType}-${item.section}`}
          onDragBegin={dragAndDrop.onDragBegin}
          onDragEnd={dragAndDrop.onDragEnd}
          activationDistance={0}
          dragItemOverflow={true}
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
          renderItem={({ item, drag, isActive }: RenderItemParams<ContactEntry>) => (
            <ScaleDecorator activeScale={1.05}>
              <View
                style={[
                  styles.draggableItem,
                  isActive && styles.draggableItemActive,
                ]}
              >
                <ProfileField
                  profile={item}
                  fieldSectionManager={fieldSectionManager}
                  getValue={getFieldValue}
                  onChange={handleFieldChange}
                  isUnconfirmed={fieldSectionManager.isChannelUnconfirmed}
                  onConfirm={fieldSectionManager.markChannelAsConfirmed}
                  currentViewMode={viewMode}
                  isDraggable={true}
                  onDragStart={drag}
                  isBeingDragged={isActive}
                />
              </View>
            </ScaleDecorator>
          )}
        />
      </FieldSectionComponent>

      {/* Hidden Fields - Always show with Sign Out button */}
      <View style={styles.hiddenSection}>
        <FieldSectionComponent
          title="Hidden"
          isEmpty={hiddenFields.length === 0}
          emptyText="Tap the hide button on any field if you're about to Nekt and don't want to share that link."
          bottomButton={
            <View style={styles.signOutContainer}>
              <SecondaryButton
                variant="destructive"
                onPress={handleSignOut}
              >
                Sign Out
              </SecondaryButton>
            </View>
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
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  topContent: {
    width: '100%',
  },
  locationContainer: {
    marginTop: 20,
  },
  addButton: {
    width: '100%',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 20,
  },
  inlineAddLink: {
    marginBottom: 16,
  },
  addLinkButton: {
    alignItems: 'center',
  },
  hiddenSection: {
    marginTop: 40,
  },
  signOutContainer: {
    alignItems: 'center',
  },
  // Drag and drop styles
  itemSeparator: {
    height: 20, // Match FieldList gap (space-y-5 = 1.25rem = 20px)
  },
  draggableItem: {
    opacity: 1,
  },
  draggableItemActive: {
    opacity: 0.95,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
});

export default SelectedSections;

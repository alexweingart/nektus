/**
 * EditProfileView for iOS
 * Adapted from: apps/web/src/app/components/views/EditProfileView.tsx
 *
 * Changes from web:
 * - Uses React Native components (ScrollView, KeyboardAvoidingView)
 * - Uses React Navigation instead of Next.js router
 * - Uses Animated.View for carousel instead of CSS transform
 * - Uses expo-image-picker for profile image upload
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { NestableScrollContainer } from 'react-native-draggable-flatlist';
import { useScreenRefresh } from '../../../client/hooks/use-screen-refresh';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenTransition, useGoBackWithFade } from '../ui/layout/ScreenTransition';
import type { RootStackParamList } from '../../../../App';
import type { ContactEntry, FieldSection } from '@nektus/shared-types';
import { useSession } from '../../providers/SessionProvider';
import { useProfile } from '../../context/ProfileContext';
import { useEditProfileFields, useProfileViewMode } from '../../../client/hooks/use-edit-profile-fields';
import { useCalendarLocationManagement } from '../../../client/hooks/use-calendar-location-management';
import { PageHeader } from '../ui/layout/PageHeader';
import { ProfileViewSelector } from '../ui/controls/ProfileViewSelector';
import { StaticInput } from '../ui/inputs/StaticInput';
import { ExpandingInput } from '../ui/inputs/ExpandingInput';
import { FieldSection as FieldSectionComponent } from '../ui/layout/FieldSection';
import { FieldList } from '../ui/layout/FieldList';
import { ProfileField } from '../ui/elements/ProfileField';
import { ProfileImageIcon } from '../ui/elements/ProfileImageIcon';
import { AddCalendarModal } from '../ui/modals/AddCalendarModal';
import { AddLocationModal } from '../ui/modals/AddLocationModal';
import { SelectedSections } from './SelectedSections';

type EditProfileNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EditProfile'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const CONTENT_PADDING = 16;
const CAROUSEL_WIDTH = SCREEN_WIDTH - (CONTENT_PADDING * 2);

export function EditProfileView() {
  const navigation = useNavigation<EditProfileNavigationProp>();
  const goBackWithFade = useGoBackWithFade();
  const { data: session } = useSession();
  const { profile, saveProfile, isSaving, refreshProfile } = useProfile();

  // Carousel animation
  const carouselAnimValue = useRef(new Animated.Value(0)).current;

  // Profile view mode (Personal/Work)
  const { selectedMode, loadFromStorage, handleModeChange: baseModeChange } = useProfileViewMode();

  // Inline add link state
  const [showInlineAddLink, setShowInlineAddLink] = useState<{ personal: boolean; work: boolean }>({
    personal: false,
    work: false,
  });

  // Field management
  const fieldManager = useEditProfileFields({
    profile,
    session,
    initialImages: { profileImage: profile?.profileImage || '' },
  });

  // Calendar and location management
  const {
    isCalendarModalOpen,
    isLocationModalOpen,
    modalSection,
    setIsCalendarModalOpen,
    setIsLocationModalOpen,
    isDeletingCalendar,
    isDeletingLocation,
    getCalendarForSection,
    getLocationForSection,
    handleOpenCalendarModal,
    handleOpenLocationModal,
    handleCalendarAdded,
    handleLocationAdded,
    handleDeleteCalendar,
    handleDeleteLocation,
  } = useCalendarLocationManagement({
    profile,
    saveProfile,
    onCalendarAddedViaOAuth: refreshProfile,
  });

  // Pull-to-refresh - reloads profile and resets form
  const { isRefreshing, handleRefresh } = useScreenRefresh({
    onRefresh: async () => {
      await refreshProfile();
      // The fieldManager will get fresh profile data on next render
    },
  });

  // Load saved mode on mount and sync carousel position
  useEffect(() => {
    const loadAndSyncCarousel = async () => {
      const loadedMode = await loadFromStorage();
      // Snap carousel to match the loaded mode (no animation on initial load)
      const toValue = loadedMode === 'Personal' ? 0 : -CAROUSEL_WIDTH;
      carouselAnimValue.setValue(toValue);
    };
    loadAndSyncCarousel();
  }, [loadFromStorage, carouselAnimValue]);

  // Handle mode change with carousel animation
  const handleModeChange = useCallback((mode: 'Personal' | 'Work') => {
    const toValue = mode === 'Personal' ? 0 : -CAROUSEL_WIDTH;
    Animated.spring(carouselAnimValue, {
      toValue,
      useNativeDriver: true,
      friction: 20,
      tension: 100,
    }).start();
    baseModeChange(mode);
  }, [baseModeChange, carouselAnimValue]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    goBackWithFade();
  }, [goBackWithFade]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      const profileData = {
        contactEntries: fieldManager.getAllFields(),
        profileImage: fieldManager.getImageValue('profileImage') || profile?.profileImage || '',
      };

      await saveProfile(profileData);
      goBackWithFade();
    } catch (error) {
      console.error('[EditProfileView] Save failed:', error);
    }
  }, [session, fieldManager, profile, saveProfile, goBackWithFade]);

  // Handle profile image upload
  // When backgroundColors are provided (from API), refresh the profile to pick up the new colors
  const handleProfileImageUpload = useCallback((uri: string, backgroundColors?: string[]) => {
    fieldManager.setImageValue('profileImage', uri);

    // If colors were extracted, refresh profile to pick up the saved colors from Firestore
    if (backgroundColors && backgroundColors.length > 0) {
      console.log('[EditProfileView] Background colors extracted, refreshing profile...');
      refreshProfile();
    }
  }, [fieldManager, refreshProfile]);

  // Debug: log profile backgroundColors
  React.useEffect(() => {
    console.log('[EditProfileView] profile.backgroundColors:', profile?.backgroundColors);
  }, [profile?.backgroundColors]);

  // Handle field input change
  const handleFieldChange = useCallback((fieldType: string, value: string, section: FieldSection) => {
    fieldManager.markChannelAsConfirmed(fieldType);
    fieldManager.updateFieldValue(fieldType, value, section);
  }, [fieldManager]);

  // Toggle inline add link
  const handleToggleInlineAddLink = useCallback((section: 'personal' | 'work') => {
    setShowInlineAddLink(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  // Handle link added
  const handleLinkAdded = useCallback((entries: ContactEntry[]) => {
    fieldManager.addFields(entries);
    entries.forEach(entry => {
      fieldManager.markChannelAsConfirmed(entry.fieldType);
    });
    setShowInlineAddLink({ personal: false, work: false });
  }, [fieldManager]);

  // Get field value using unified state
  const getFieldValue = useCallback((fieldType: string, section?: FieldSection): string => {
    if (section) {
      const field = fieldManager.getFieldData(fieldType, section);
      return field?.value || '';
    }
    return fieldManager.getFieldValue(fieldType);
  }, [fieldManager]);

  // Get fields for view
  const getFieldsForView = useCallback((viewMode: 'Personal' | 'Work') => {
    const sectionName = viewMode.toLowerCase() as 'personal' | 'work';
    return {
      visibleFields: fieldManager.getVisibleFields(sectionName),
      hiddenFields: fieldManager.getHiddenFieldsForView(viewMode),
    };
  }, [fieldManager]);

  // Calculate next order for section
  const getNextOrderForSection = useCallback((sectionName: 'personal' | 'work') => {
    const { visibleFields } = getFieldsForView(sectionName === 'personal' ? 'Personal' : 'Work');
    const maxOrder = Math.max(0, ...visibleFields.map(f => f.order || 0));
    return maxOrder + 1;
  }, [getFieldsForView]);

  // Get universal fields for the top section
  const universalFields = fieldManager.getFieldsBySection('universal');
  const universalContactFields = universalFields.filter(field => !['name', 'bio'].includes(field.fieldType));

  return (
    <ScreenTransition>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <NestableScrollContainer
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#22c55e"
            />
          }
        >
          {/* Header */}
          <PageHeader
            title="Edit Profile"
            onBack={handleBack}
            onSave={handleSave}
            isSaving={isSaving}
          />

          <View style={styles.content}>
            {/* Universal Section */}
            <FieldSectionComponent
              isEmpty={false}
              emptyText=""
            >
              {/* Name Input with Profile Image */}
              <View style={styles.nameInputContainer}>
                <StaticInput
                  value={fieldManager.getFieldValue('name')}
                  onChangeText={(value) => fieldManager.setFieldValue('name', value)}
                  placeholder="Full Name"
                  icon={
                    <ProfileImageIcon
                      imageUrl={fieldManager.getImageValue('profileImage')}
                      onUpload={handleProfileImageUpload}
                      size={32}
                    />
                  }
                />
              </View>

              {/* Bio Input */}
              <View style={styles.bioInputContainer}>
                <ExpandingInput
                  value={fieldManager.getFieldValue('bio')}
                  onChange={(value) => fieldManager.setFieldValue('bio', value)}
                  placeholder="Add a short bio..."
                  maxLength={280}
                />
              </View>

              {/* Universal Fields List */}
              {universalContactFields.length > 0 && (
                <FieldList>
                  {universalContactFields.map((field, index) => (
                    <ProfileField
                      key={`universal-${field.fieldType}-${index}`}
                      profile={field}
                      fieldSectionManager={fieldManager}
                      getValue={getFieldValue}
                      onChange={handleFieldChange}
                      isUnconfirmed={fieldManager.isChannelUnconfirmed}
                      onConfirm={fieldManager.markChannelAsConfirmed}
                      currentViewMode={selectedMode}
                    />
                  ))}
                </FieldList>
              )}
            </FieldSectionComponent>

            {/* Carousel Container */}
            <View style={styles.carouselContainer}>
              <Animated.View
                style={[
                  styles.carousel,
                  {
                    transform: [{ translateX: carouselAnimValue }],
                  },
                ]}
              >
                {/* Personal View */}
                <View style={[styles.carouselSlide, { width: CAROUSEL_WIDTH }]}>
                  <SelectedSections
                    viewMode="Personal"
                    fieldSectionManager={fieldManager}
                    getCalendarForSection={getCalendarForSection}
                    getLocationForSection={getLocationForSection}
                    handleOpenCalendarModal={handleOpenCalendarModal}
                    handleOpenLocationModal={handleOpenLocationModal}
                    handleDeleteCalendar={handleDeleteCalendar}
                    handleDeleteLocation={handleDeleteLocation}
                    isDeletingCalendar={isDeletingCalendar}
                    isDeletingLocation={isDeletingLocation}
                    showInlineAddLink={showInlineAddLink}
                    handleToggleInlineAddLink={handleToggleInlineAddLink}
                    handleLinkAdded={handleLinkAdded}
                    getNextOrderForSection={getNextOrderForSection}
                    getFieldValue={getFieldValue}
                    handleFieldChange={handleFieldChange}
                    getFieldsForView={getFieldsForView}
                    tintColor={profile?.backgroundColors?.[2]}
                  />
                </View>

                {/* Work View */}
                <View style={[styles.carouselSlide, { width: CAROUSEL_WIDTH }]}>
                  <SelectedSections
                    viewMode="Work"
                    fieldSectionManager={fieldManager}
                    getCalendarForSection={getCalendarForSection}
                    getLocationForSection={getLocationForSection}
                    handleOpenCalendarModal={handleOpenCalendarModal}
                    handleOpenLocationModal={handleOpenLocationModal}
                    handleDeleteCalendar={handleDeleteCalendar}
                    handleDeleteLocation={handleDeleteLocation}
                    isDeletingCalendar={isDeletingCalendar}
                    isDeletingLocation={isDeletingLocation}
                    showInlineAddLink={showInlineAddLink}
                    handleToggleInlineAddLink={handleToggleInlineAddLink}
                    handleLinkAdded={handleLinkAdded}
                    getNextOrderForSection={getNextOrderForSection}
                    getFieldValue={getFieldValue}
                    handleFieldChange={handleFieldChange}
                    getFieldsForView={getFieldsForView}
                    tintColor={profile?.backgroundColors?.[2]}
                  />
                </View>
              </Animated.View>
            </View>

            {/* Bottom spacing for selector */}
            <View style={styles.bottomSpacer} />
          </View>
        </NestableScrollContainer>

        {/* Sticky Profile View Selector */}
        <View style={styles.selectorContainer}>
          <ProfileViewSelector
            selected={selectedMode}
            onSelect={handleModeChange}
            tintColor={profile?.backgroundColors?.[2]}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Add Calendar Modal */}
      <AddCalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        section={modalSection}
        userEmail={session?.user?.email || ''}
        onCalendarAdded={handleCalendarAdded}
      />

      {/* Add Location Modal */}
      <AddLocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        section={modalSection}
        userId={session?.user?.id || ''}
        onLocationAdded={handleLocationAdded}
      />
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: CONTENT_PADDING,
    paddingBottom: 120, // Space for selector
  },
  content: {
    flex: 1,
    gap: 20,
  },
  nameInputContainer: {
    width: '100%',
    maxWidth: 448,
    alignSelf: 'center',
  },
  bioInputContainer: {
    width: '100%',
    maxWidth: 448,
    alignSelf: 'center',
  },
  carouselContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  carousel: {
    flexDirection: 'row',
  },
  carouselSlide: {
    flexShrink: 0,
  },
  bottomSpacer: {
    height: 40,
  },
  selectorContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});

export default EditProfileView;

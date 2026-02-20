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
  ScrollView,
} from 'react-native';
import { useScreenRefresh } from '../../../client/hooks/use-screen-refresh';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenTransition, useGoBackWithFade } from '../ui/layout/ScreenTransition';
import type { RootStackParamList } from '../../../../App';
import { ANIMATION } from '@nektus/shared-client';
import type { ContactEntry, FieldSection } from '@nektus/shared-types';
import { useSession } from '../../providers/SessionProvider';
import { useProfile } from '../../context/ProfileContext';
import { useEditProfileFields } from '../../../client/hooks/use-edit-profile-fields';
import { useCalendarLocationManagement } from '../../../client/hooks/use-calendar-location-management';
import { PageHeader } from '../ui/layout/PageHeader';
import { ProfileViewSelector } from '../ui/controls/ProfileViewSelector';
import { SingleLineInput } from '../ui/inputs/SingleLineInput';
import { ExpandingInput } from '../ui/inputs/ExpandingInput';
import { FieldSection as FieldSectionComponent } from '../ui/modules/FieldSection';
import { FieldList } from '../ui/modules/FieldList';
import { ProfileField } from '../ui/elements/ProfileField';
import { ProfileImageIcon } from '../ui/elements/ProfileImageIcon';
import { AddCalendarModal } from '../ui/modals/AddCalendarModal';
import { AddLocationModal } from '../ui/modals/AddLocationModal';
import { SelectedSections } from './SelectedSections';

type EditProfileNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EditProfile'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const CONTENT_PADDING = 16;

type EditProfileRouteProp = RouteProp<RootStackParamList, 'EditProfile'>;

export function EditProfileView() {
  const navigation = useNavigation<EditProfileNavigationProp>();
  const route = useRoute<EditProfileRouteProp>();
  const goBackWithFade = useGoBackWithFade();
  const { data: session } = useSession();
  const { profile, saveProfile, isSaving, sharingCategory, setSharingCategory } = useProfile();

  // Slide animation for view switching (0 = Personal, 1 = Work)
  const slideAnim = useRef(new Animated.Value(sharingCategory === 'Work' ? 1 : 0)).current;

  // Ref for scroll container (needed for drag gesture coordination)
  const scrollRef = useRef(null);

  // selectedMode alias for readability in this component
  const selectedMode = sharingCategory;

  // Track backgroundColors received from image upload API (ensures save includes them
  // even if onSnapshot hasn't fired yet with the API-saved colors)
  const [uploadedBackgroundColors, setUploadedBackgroundColors] = useState<string[] | undefined>(undefined);

  // Inline add link state
  const [showInlineAddLink, setShowInlineAddLink] = useState<{ personal: boolean; work: boolean }>({
    personal: false,
    work: false,
  });

  // Drag state - disables scroll during drag so DraggableFlatList can handle pan gesture
  const [isDragging, setIsDragging] = useState(false);

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
    onCalendarAddedViaOAuth: () => {}, // Profile auto-updates via onSnapshot
  });

  // Pull-to-refresh — profile is live via onSnapshot, just reset local form state
  const { isRefreshing, handleRefresh } = useScreenRefresh({
    onRefresh: async () => {
      // fieldManager will pick up fresh profile data on next render
    },
  });

  // Handle deep link to auto-open inline add link
  useEffect(() => {
    const section = route.params?.openInlineAddLink;
    if (section) {
      setShowInlineAddLink(prev => ({ ...prev, [section]: true }));
      if (section === 'work' && selectedMode !== 'Work') {
        const toValue = 1;
        Animated.timing(slideAnim, { toValue, duration: ANIMATION.UI_MS, useNativeDriver: true }).start();
        setSharingCategory('Work');
      } else if (section === 'personal' && selectedMode !== 'Personal') {
        const toValue = 0;
        Animated.timing(slideAnim, { toValue, duration: ANIMATION.UI_MS, useNativeDriver: true }).start();
        setSharingCategory('Personal');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle mode change with slide animation
  const handleModeChange = useCallback((mode: 'Personal' | 'Work') => {
    const toValue = mode === 'Work' ? 1 : 0;

    Animated.timing(slideAnim, {
      toValue,
      duration: ANIMATION.UI_MS,
      useNativeDriver: true,
    }).start();

    setSharingCategory(mode);
  }, [setSharingCategory, slideAnim]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    goBackWithFade();
  }, [goBackWithFade]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      const profileData: Record<string, any> = {
        contactEntries: fieldManager.getAllFields(),
        profileImage: fieldManager.getImageValue('profileImage') || profile?.profileImage || '',
      };

      // Include uploaded backgroundColors so save includes the latest colors
      if (uploadedBackgroundColors) {
        profileData.backgroundColors = uploadedBackgroundColors;
      }

      await saveProfile(profileData);
      goBackWithFade();
    } catch (error) {
      console.error('[EditProfileView] Save failed:', error);
    }
  }, [session, fieldManager, profile, saveProfile, goBackWithFade, uploadedBackgroundColors]);

  // Handle profile image upload
  // When backgroundColors are provided (from API), immediately save to profile context + Firestore
  // so ProfileView has the new image/colors before any navigation (Save or Back).
  // This matches the web pattern where saveProfile is called right when the upload API returns.
  const handleProfileImageUpload = useCallback((uri: string, backgroundColors?: string[]) => {
    console.log('[EditProfileView] handleProfileImageUpload called:', { uri: uri?.substring(0, 60), backgroundColors });
    fieldManager.setImageValue('profileImage', uri);
    if (backgroundColors) {
      console.log('[EditProfileView] Setting uploadedBackgroundColors:', backgroundColors);
      setUploadedBackgroundColors(backgroundColors);
      // Save immediately: updates profile context (optimistic) and writes to Firestore (partial)
      saveProfile({ profileImage: uri, backgroundColors });
    }
  }, [fieldManager, saveProfile]);

  // Use uploaded colors instantly, fall back to profile colors from Firestore
  const activeTintColor = uploadedBackgroundColors?.[2] || profile?.backgroundColors?.[2];
  console.log('[EditProfileView] activeTintColor:', activeTintColor, '| uploadedBgColors:', uploadedBackgroundColors, '| profileBgColors:', profile?.backgroundColors);

  // Handle field input change
  const handleFieldChange = useCallback((fieldType: string, value: string, section: FieldSection) => {
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
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
          nestedScrollEnabled={true}
          scrollEnabled={!isDragging}
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
                <SingleLineInput
                  value={fieldManager.getFieldValue('name')}
                  onChangeText={(value) => fieldManager.setFieldValue('name', value)}
                  placeholder="Full Name"
                  icon={
                    <ProfileImageIcon
                      imageUrl={fieldManager.getImageValue('profileImage')}
                      onUpload={handleProfileImageUpload}
                      size={32}
                      alt={fieldManager.getFieldValue('name')}
                      profileColors={profile?.backgroundColors as [string, string, string] | undefined}
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
                      currentViewMode={selectedMode}
                    />
                  ))}
                </FieldList>
              )}
            </FieldSectionComponent>

            {/* Views with slide animation - both always rendered, positioned with transforms */}
            <View style={{ overflow: 'visible' }}>
              {/* Personal View */}
              <Animated.View
                style={{
                  overflow: 'visible',
                  transform: [{
                    translateX: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -SCREEN_WIDTH],
                    }),
                  }],
                }}
                pointerEvents={selectedMode === 'Personal' ? 'auto' : 'none'}
              >
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
                  tintColor={activeTintColor}
                  onDragStateChange={setIsDragging}
                />
              </Animated.View>

              {/* Work View - positioned absolute, overlapping Personal */}
              <Animated.View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  overflow: 'visible',
                  transform: [{
                    translateX: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [SCREEN_WIDTH, 0],
                    }),
                  }],
                }}
                pointerEvents={selectedMode === 'Work' ? 'auto' : 'none'}
              >
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
                  tintColor={activeTintColor}
                  onDragStateChange={setIsDragging}
                />
              </Animated.View>
            </View>

            {/* Bottom spacing for selector */}
            <View style={styles.bottomSpacer} />
          </View>
        </ScrollView>

        {/* Sticky Profile View Selector */}
        <View style={styles.selectorContainer}>
          <ProfileViewSelector
            selected={selectedMode}
            onSelect={handleModeChange}
            tintColor={activeTintColor}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Add Calendar Modal */}
      <AddCalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        section={modalSection}
        userEmail={session?.user?.email || profile?.contactEntries?.find((f: any) => f.fieldType === 'email')?.value || ''}
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
    paddingBottom: 120, // Space for selector
  },
  content: {
    flex: 1,
    gap: 20,
    paddingHorizontal: CONTENT_PADDING,
    overflow: 'visible',
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

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../../App';
import type { ContactEntry, FieldSection, Calendar, UserLocation } from '@nektus/shared-types';
import { useSession } from '../../providers/SessionProvider';
import { useProfile } from '../../context/ProfileContext';
import { useEditProfileFields, useProfileViewMode } from '../../../client/hooks/use-edit-profile-fields';
import { PageHeader } from '../ui/layout/PageHeader';
import { ProfileViewSelector } from '../ui/controls/ProfileViewSelector';
import Avatar from '../ui/elements/Avatar';
import SocialIcon from '../ui/elements/SocialIcon';
import { AddCalendarModal } from '../ui/modals/AddCalendarModal';
import { AddLocationModal } from '../ui/modals/AddLocationModal';
import { ItemChip } from '../ui/modules/ItemChip';

type EditProfileNavigationProp = NativeStackNavigationProp<RootStackParamList, 'EditProfile'>;

/**
 * Get field display name
 */
const getFieldDisplayName = (fieldType: string): string => {
  const displayNames: Record<string, string> = {
    name: 'Name',
    bio: 'Bio',
    phone: 'Phone',
    email: 'Email',
    instagram: 'Instagram',
    twitter: 'Twitter',
    linkedin: 'LinkedIn',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    snapchat: 'Snapchat',
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
  };
  return displayNames[fieldType] || fieldType.charAt(0).toUpperCase() + fieldType.slice(1);
};

// Calendar icon
const CalendarIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2}>
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </Svg>
);

// Location icon
const LocationIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth={2}>
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

// Plus icon
const PlusIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={2}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </Svg>
);

/**
 * Get provider display name
 */
const getProviderName = (provider: string): string => {
  switch (provider) {
    case 'google': return 'Google Calendar';
    case 'microsoft': return 'Microsoft Calendar';
    case 'apple': return 'Apple Calendar';
    default: return 'Calendar';
  }
};

export function EditProfileView() {
  const navigation = useNavigation<EditProfileNavigationProp>();
  const { data: session } = useSession();
  const { profile, saveProfile, isSaving, refreshProfile } = useProfile();

  // Profile view mode (Personal/Work)
  const { selectedMode, loadFromStorage, handleModeChange } = useProfileViewMode();

  // Modal state
  const [showAddCalendarModal, setShowAddCalendarModal] = useState(false);
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);

  // Field management
  const fieldManager = useEditProfileFields({
    profile,
    session,
    initialImages: { profileImage: profile?.profileImage || '' },
  });

  // Load saved mode on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Get calendars and locations for current section
  const currentSection = selectedMode.toLowerCase() as 'personal' | 'work';
  const sectionCalendars = (profile?.calendars || []).filter(
    (cal: Calendar) => cal.section === currentSection
  );
  const sectionLocations = (profile?.locations || []).filter(
    (loc: UserLocation) => loc.section === currentSection
  );

  // Handle back navigation
  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      const profileData = {
        contactEntries: fieldManager.getAllFields(),
        profileImage: fieldManager.getImageValue('profileImage') || profile?.profileImage || '',
      };

      await saveProfile(profileData);
      navigation.goBack();
    } catch (error) {
      console.error('[EditProfileView] Save failed:', error);
    }
  }, [session, fieldManager, profile, saveProfile, navigation]);

  // Get fields for current view
  const universalFields = fieldManager.getFieldsBySection('universal');
  const currentSectionFields = fieldManager.getVisibleFields(
    selectedMode.toLowerCase() as 'personal' | 'work'
  );

  // Filter out name and bio from universal (they have dedicated inputs)
  const universalContactFields = universalFields.filter(
    f => !['name', 'bio'].includes(f.fieldType)
  );

  // Render a field input
  const renderField = (field: ContactEntry, index: number) => {
    const isUniversal = field.section === 'universal';

    return (
      <View key={`${field.section}-${field.fieldType}-${index}`} style={styles.fieldContainer}>
        <View style={styles.fieldRow}>
          <View style={styles.fieldIcon}>
            <SocialIcon platform={field.fieldType} size="sm" />
          </View>
          <View style={styles.fieldInputContainer}>
            <Text style={styles.fieldLabel}>{getFieldDisplayName(field.fieldType)}</Text>
            <TextInput
              style={styles.fieldInput}
              value={field.value}
              onChangeText={(value) => {
                if (isUniversal) {
                  fieldManager.setFieldValue(field.fieldType, value);
                } else {
                  fieldManager.updateFieldValue(field.fieldType, value, field.section);
                }
                fieldManager.markChannelAsConfirmed(field.fieldType);
              }}
              placeholder={`Enter ${getFieldDisplayName(field.fieldType).toLowerCase()}`}
              placeholderTextColor="#9CA3AF"
              autoCapitalize={field.fieldType === 'email' ? 'none' : 'words'}
              keyboardType={
                field.fieldType === 'email' ? 'email-address' :
                field.fieldType === 'phone' ? 'phone-pad' : 'default'
              }
            />
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <PageHeader
            title="Edit Profile"
            onBack={handleBack}
            onSave={handleSave}
            isSaving={isSaving}
          />

          {/* Profile Image */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={() => {
                // TODO: Implement image picker
                console.log('[EditProfileView] Profile image tap');
              }}
            >
              <Avatar
                src={fieldManager.getImageValue('profileImage') || profile?.profileImage}
                alt={fieldManager.getFieldValue('name')}
                size="lg"
              />
              <View style={styles.editBadge}>
                <Text style={styles.editBadgeText}>Edit</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Name Input */}
          <View style={styles.nameSection}>
            <TextInput
              style={styles.nameInput}
              value={fieldManager.getFieldValue('name')}
              onChangeText={(value) => fieldManager.setFieldValue('name', value)}
              placeholder="Full Name"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
            />
          </View>

          {/* Bio Input */}
          <View style={styles.bioSection}>
            <TextInput
              style={styles.bioInput}
              value={fieldManager.getFieldValue('bio')}
              onChangeText={(value) => fieldManager.setFieldValue('bio', value)}
              placeholder="Add a short bio..."
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={280}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>
              {fieldManager.getFieldValue('bio').length}/280
            </Text>
          </View>

          {/* Universal Contact Fields */}
          {universalContactFields.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact Info</Text>
              {universalContactFields.map((field, index) => renderField(field, index))}
            </View>
          )}

          {/* Section-specific Fields */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {selectedMode} Links
            </Text>
            {currentSectionFields.length > 0 ? (
              currentSectionFields.map((field, index) => renderField(field, index))
            ) : (
              <Text style={styles.emptyText}>
                No {selectedMode.toLowerCase()} links yet. Add some to share with your contacts.
              </Text>
            )}
          </View>

          {/* Calendars Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {selectedMode} Calendars
            </Text>
            {sectionCalendars.map((calendar: Calendar) => (
              <ItemChip
                key={calendar.id}
                icon={
                  <View style={styles.chipIconContainer}>
                    <CalendarIcon />
                  </View>
                }
                title={getProviderName(calendar.provider)}
                subtitle={calendar.email}
                onClick={() => navigation.navigate('Calendar', { section: currentSection })}
                actionIcon="chevron"
              />
            ))}
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddCalendarModal(true)}
            >
              <PlusIcon />
              <Text style={styles.addButtonText}>Add Calendar</Text>
            </TouchableOpacity>
          </View>

          {/* Locations Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {selectedMode} Location
            </Text>
            {sectionLocations.map((location: UserLocation) => (
              <ItemChip
                key={location.id}
                icon={
                  <View style={styles.chipIconContainer}>
                    <LocationIcon />
                  </View>
                }
                title={location.city}
                subtitle={`${location.region}${location.country ? ', ' + location.country : ''}`}
                onClick={() => navigation.navigate('Location', { section: currentSection })}
                actionIcon="chevron"
              />
            ))}
            {sectionLocations.length === 0 && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowAddLocationModal(true)}
              >
                <PlusIcon />
                <Text style={styles.addButtonText}>Add Location</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Bottom spacing for selector */}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Sticky Profile View Selector */}
        <View style={styles.selectorContainer}>
          <ProfileViewSelector
            selected={selectedMode}
            onSelect={handleModeChange}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Add Calendar Modal */}
      <AddCalendarModal
        isOpen={showAddCalendarModal}
        onClose={() => setShowAddCalendarModal(false)}
        section={currentSection}
        userEmail={session?.user?.email || ''}
        onCalendarAdded={() => {
          setShowAddCalendarModal(false);
          refreshProfile();
        }}
      />

      {/* Add Location Modal */}
      <AddLocationModal
        isOpen={showAddLocationModal}
        onClose={() => setShowAddLocationModal(false)}
        section={currentSection}
        userId={session?.user?.id || ''}
        onLocationAdded={async (locations) => {
          // Save locations to profile
          const existingLocations = profile?.locations || [];
          // Filter out any locations with the same ID (replacing)
          const locationIds = locations.map(l => l.id);
          const filteredLocations = existingLocations.filter(
            (l: UserLocation) => !locationIds.includes(l.id)
          );
          await saveProfile({ locations: [...filteredLocations, ...locations] });
          setShowAddLocationModal(false);
        }}
      />
    </>
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
    paddingHorizontal: 16,
    paddingBottom: 100, // Space for selector
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  editBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  nameSection: {
    marginBottom: 12,
  },
  nameInput: {
    backgroundColor: '#ffffff',
    borderRadius: 9999,
    paddingVertical: 16,
    paddingHorizontal: 24,
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  bioSection: {
    marginBottom: 24,
  },
  bioInput: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#000000',
    minHeight: 100,
  },
  charCount: {
    textAlign: 'right',
    marginTop: 4,
    marginRight: 8,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  fieldContainer: {
    marginBottom: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  fieldIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fieldInputContainer: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  fieldInput: {
    fontSize: 16,
    color: '#000000',
    padding: 0,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    paddingVertical: 20,
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
  chipIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addButtonText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    marginLeft: 8,
  },
});

export default EditProfileView;

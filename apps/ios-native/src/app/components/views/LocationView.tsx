/**
 * LocationView - View and edit a saved location
 * Allows editing address fields and deleting the location
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useScreenRefresh } from '../../../client/hooks/use-screen-refresh';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../../App';
import type { UserLocation } from '@nektus/shared-types';
import { getApiBaseUrl } from '@nektus/shared-client';
import { useProfile } from '../../context/ProfileContext';
import { PageHeader } from '../ui/layout/PageHeader';
import { ScreenTransition, useGoBackWithFade } from '../ui/layout/ScreenTransition';
import { SecondaryButton } from '../ui/buttons/SecondaryButton';
import { ValidatedInput } from '../ui/inputs/ValidatedInput';

type LocationViewNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Location'>;
type LocationViewRouteProp = RouteProp<RootStackParamList, 'Location'>;

export function LocationView() {
  const navigation = useNavigation<LocationViewNavigationProp>();
  const route = useRoute<LocationViewRouteProp>();
  const goBackWithFade = useGoBackWithFade();
  const { section } = route.params;
  const { profile, saveProfile, refreshProfile, isLoading: profileLoading } = useProfile();
  const apiBaseUrl = getApiBaseUrl();

  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [editedLocation, setEditedLocation] = useState<UserLocation | null>(null);

  // Find the location for this section
  const location = profile?.locations?.find((loc: UserLocation) => loc.section === section);

  // Pull-to-refresh - reloads profile and resets edits
  const { refreshControl } = useScreenRefresh({
    onRefresh: async () => {
      await refreshProfile();
      // Reset edited location to reload from fresh profile
      const freshLocation = profile?.locations?.find((loc: UserLocation) => loc.section === section);
      setEditedLocation(freshLocation ? { ...freshLocation } : null);
      setValidationError('');
    },
  });

  // Initialize edited location when location is loaded
  useEffect(() => {
    if (location && !editedLocation) {
      setEditedLocation({ ...location });
    }
  }, [location, editedLocation]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    goBackWithFade();
  }, [goBackWithFade]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!editedLocation || !profile) return;

    // Client-side validation
    if (!editedLocation.city.trim() || !editedLocation.region.trim() || !editedLocation.country?.trim()) {
      setValidationError('City, region, and country are required');
      return;
    }

    setIsSaving(true);
    setValidationError('');

    try {
      // Validate with Radar API
      const response = await fetch(`${apiBaseUrl}/api/location/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: editedLocation.address?.trim(),
          city: editedLocation.city.trim(),
          region: editedLocation.region.trim(),
          zip: editedLocation.zip?.trim(),
          country: editedLocation.country?.trim(),
        }),
      });

      const data = await response.json();

      if (!data.success || !data.valid) {
        setValidationError(data.error || 'Address validation failed');
        setIsSaving(false);
        return;
      }

      // Check confidence level
      if (data.confidence === 'low') {
        setValidationError('Address confidence is low. Please verify your address.');
        setIsSaving(false);
        return;
      }

      // Update location with validated data
      const updatedLocation: UserLocation = {
        ...editedLocation,
        address: data.formatted?.address || editedLocation.address,
        city: data.formatted?.city || editedLocation.city,
        region: data.formatted?.region || editedLocation.region,
        zip: data.formatted?.zip || editedLocation.zip,
        country: data.formatted?.country || editedLocation.country,
        coordinates: data.coordinates || editedLocation.coordinates,
        validated: true,
        radarPlaceId: data.radarPlaceId || editedLocation.radarPlaceId,
        updatedAt: new Date(),
      };

      // Update location in profile
      const updatedLocations = profile.locations?.map((loc: UserLocation) =>
        loc.section === section ? updatedLocation : loc
      );

      await saveProfile({ locations: updatedLocations });
      goBackWithFade();
    } catch (error) {
      console.error('[LocationView] Error saving location:', error);
      setValidationError('Failed to save location. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [editedLocation, profile, section, apiBaseUrl, saveProfile, goBackWithFade]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!location || !profile) return;

    Alert.alert(
      'Delete Location',
      'Are you sure you want to remove this location?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsSaving(true);
            try {
              // Remove location from profile
              const updatedLocations = profile.locations?.filter(
                (loc: UserLocation) => loc.section !== section
              );

              await saveProfile({ locations: updatedLocations });
              goBackWithFade();
            } catch (error) {
              console.error('[LocationView] Error deleting location:', error);
              setValidationError('Failed to delete location. Please try again.');
            } finally {
              setIsSaving(false);
            }
          },
        },
      ]
    );
  }, [location, profile, section, saveProfile, goBackWithFade]);

  // Loading state
  if (profileLoading) {
    return (
      <ScreenTransition>
        <View style={styles.container}>
          <PageHeader title="Location" onBack={handleBack} />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        </View>
      </ScreenTransition>
    );
  }

  // Location not found
  if (!location || !editedLocation) {
    return (
      <ScreenTransition>
        <View style={styles.container}>
          <PageHeader title="Location" onBack={handleBack} />
          <View style={styles.errorContainer}>
            <Text style={styles.notFoundText}>Location not found</Text>
          </View>
        </View>
      </ScreenTransition>
    );
  }

  return (
    <ScreenTransition>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          <PageHeader
            title="Location"
            onBack={handleBack}
            onSave={handleSave}
            isSaving={isSaving}
          />

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          >
            {/* Address Fields */}
            <View style={styles.fieldsContainer}>
              <ValidatedInput
                value={editedLocation.address || ''}
                onChangeText={(text) =>
                  setEditedLocation({ ...editedLocation, address: text })
                }
                placeholder="Address"
                isRequired={false}
                saveAttempted={isSaving}
              />

              <ValidatedInput
                value={editedLocation.city}
                onChangeText={(text) =>
                  setEditedLocation({ ...editedLocation, city: text })
                }
                placeholder="City"
                isRequired={true}
                saveAttempted={isSaving}
              />

              <ValidatedInput
                value={editedLocation.region}
                onChangeText={(text) =>
                  setEditedLocation({ ...editedLocation, region: text })
                }
                placeholder="State/Region"
                isRequired={true}
                saveAttempted={isSaving}
              />

              <ValidatedInput
                value={editedLocation.zip || ''}
                onChangeText={(text) =>
                  setEditedLocation({ ...editedLocation, zip: text })
                }
                placeholder="Postal Code"
                isRequired={false}
                saveAttempted={isSaving}
              />

              <ValidatedInput
                value={editedLocation.country || ''}
                onChangeText={(text) =>
                  setEditedLocation({ ...editedLocation, country: text })
                }
                placeholder="Country"
                isRequired={true}
                saveAttempted={isSaving}
              />

              {/* Validation Error */}
              {validationError && (
                <Text style={styles.errorText}>{validationError}</Text>
              )}
            </View>

            {/* Delete Button */}
            <View style={styles.footer}>
              <SecondaryButton
                variant="destructive"
                onPress={handleDelete}
                disabled={isSaving}
              >
                {isSaving ? 'Deleting...' : 'Delete'}
              </SecondaryButton>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </ScreenTransition>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  fieldsContainer: {
    gap: 16,
  },
  errorText: {
    color: '#F87171',
    fontSize: 14,
    marginTop: 8,
  },
  footer: {
    paddingTop: 24,
    alignItems: 'center',
  },
});

export default LocationView;

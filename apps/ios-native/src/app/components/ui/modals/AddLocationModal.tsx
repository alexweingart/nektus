/**
 * AddLocationModal - Modal for adding a location with device location and Radar validation
 * Uses expo-location for device location access
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import { StandardModal } from './StandardModal';
import { ValidatedInput } from '../inputs/ValidatedInput';
import type { FieldSection, UserLocation } from '@nektus/shared-types';
import { getApiBaseUrl } from '@nektus/shared-client';

interface AddLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: FieldSection;
  userId: string;
  onLocationAdded: (locations: UserLocation[]) => void;
}

export function AddLocationModal({
  isOpen,
  onClose,
  section,
  userId,
  onLocationAdded,
}: AddLocationModalProps) {
  const apiBaseUrl = getApiBaseUrl();

  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [zip, setZip] = useState('');
  const [country, setCountry] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [radarPlaceId, setRadarPlaceId] = useState<string | undefined>();

  const [duplicateToOther, setDuplicateToOther] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState('');

  const otherSection = section === 'personal' ? 'work' : 'personal';

  // Reset form
  const resetForm = useCallback(() => {
    setAddress('');
    setCity('');
    setRegion('');
    setZip('');
    setCountry('');
    setCoordinates(null);
    setRadarPlaceId(undefined);
    setDuplicateToOther(false);
    setValidationError('');
  }, []);

  // Request device location on modal open
  useEffect(() => {
    if (isOpen) {
      requestDeviceLocation();
    } else {
      resetForm();
    }
  }, [isOpen, resetForm]);

  const requestDeviceLocation = async () => {
    setIsLoadingLocation(true);

    try {
      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('[AddLocationModal] Location permission denied');
        setIsLoadingLocation(false);
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      console.log('[AddLocationModal] Got device location:', latitude, longitude);

      // Reverse geocode with Radar API
      const response = await fetch(`${apiBaseUrl}/api/location/reverse-geocode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: latitude, lng: longitude }),
      });

      const data = await response.json();

      if (data.success && data.city && data.region && data.country) {
        console.log('[AddLocationModal] Auto-filled from device location');
        setAddress(data.address || '');
        setCity(data.city);
        setRegion(data.region);
        setZip(data.zip || '');
        setCountry(data.country);
        setCoordinates({ lat: latitude, lng: longitude });
        setRadarPlaceId(data.radarPlaceId);
        // Default to ON for live location - save to both sections
        setDuplicateToOther(true);
      } else {
        console.warn('[AddLocationModal] Reverse geocoding failed:', data.error);
      }
    } catch (error) {
      console.log('[AddLocationModal] Device location failed:', error);
      // Silent fail - user can still enter manually
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleSave = async () => {
    // Client-side validation
    if (!city.trim() || !region.trim() || !country.trim()) {
      setValidationError('City, region, and country are required');
      return;
    }

    setIsSaving(true);
    setValidationError('');

    try {
      // If we already have coordinates and radarPlaceId from device location,
      // skip validation (it's already been validated by reverse geocoding)
      if (coordinates && radarPlaceId) {
        console.log('[AddLocationModal] Using pre-validated location from device');

        const baseLocation: Omit<UserLocation, 'id' | 'section'> = {
          userId,
          address: address.trim() || '',
          city: city.trim() || '',
          region: region.trim() || '',
          zip: zip.trim() || '',
          country: country.trim() || 'United States',
          coordinates: coordinates,
          validated: true,
          radarPlaceId: radarPlaceId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const locations: UserLocation[] = [];

        // Add location for current section
        locations.push({
          ...baseLocation,
          id: `${userId}_${section}_location`,
          section: section as 'personal' | 'work',
        });

        // Add location for other section if duplicate is enabled
        if (duplicateToOther) {
          locations.push({
            ...baseLocation,
            id: `${userId}_${otherSection}_location`,
            section: otherSection as 'personal' | 'work',
          });
        }

        console.log('[AddLocationModal] Saving locations:', locations);
        onLocationAdded(locations);
        onClose();
        return;
      }

      // Otherwise, validate with Radar
      const response = await fetch(`${apiBaseUrl}/api/location/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: address.trim(),
          city: city.trim(),
          region: region.trim(),
          zip: zip.trim(),
          country: country.trim(),
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

      // Create location objects
      const baseLocation: Omit<UserLocation, 'id' | 'section'> = {
        userId,
        address: data.formatted?.address || address.trim(),
        city: data.formatted?.city || city.trim(),
        region: data.formatted?.region || region.trim(),
        zip: data.formatted?.zip || zip.trim(),
        country: data.formatted?.country || country.trim(),
        coordinates: data.coordinates || coordinates || undefined,
        validated: true,
        radarPlaceId: data.radarPlaceId || radarPlaceId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const locations: UserLocation[] = [];

      // Add location for current section
      locations.push({
        ...baseLocation,
        id: `${userId}_${section}_location`,
        section: section as 'personal' | 'work',
      });

      // Add location for other section if duplicate is enabled
      if (duplicateToOther) {
        locations.push({
          ...baseLocation,
          id: `${userId}_${otherSection}_location`,
          section: otherSection as 'personal' | 'work',
        });
      }

      console.log('[AddLocationModal] Saving locations:', locations);
      onLocationAdded(locations);
      onClose();
    } catch (error) {
      console.error('[AddLocationModal] Save error:', error);
      setValidationError('Failed to save location. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Location"
      subtitle={
        isLoadingLocation
          ? 'Detecting your location...'
          : 'Nekt uses your location to find things to do close to where you live and work'
      }
      showPrimaryButton={true}
      primaryButtonText={isSaving ? 'Validating...' : 'Save'}
      onPrimaryButtonClick={handleSave}
      primaryButtonDisabled={isSaving || isLoadingLocation}
      showSecondaryButton={true}
      secondaryButtonText="Cancel"
      showCloseButton={false}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.fieldsContainer}>
            <ValidatedInput
              value={address}
              onChangeText={setAddress}
              placeholder="Address"
              editable={!isLoadingLocation}
              isRequired={false}
              saveAttempted={isSaving}
            />

            <ValidatedInput
              value={city}
              onChangeText={setCity}
              placeholder="City"
              editable={!isLoadingLocation}
              isRequired={true}
              saveAttempted={isSaving}
            />

            <ValidatedInput
              value={region}
              onChangeText={setRegion}
              placeholder="State/Region"
              editable={!isLoadingLocation}
              isRequired={true}
              saveAttempted={isSaving}
            />

            <ValidatedInput
              value={zip}
              onChangeText={setZip}
              placeholder="Postal Code"
              editable={!isLoadingLocation}
              isRequired={false}
              saveAttempted={isSaving}
            />

            <ValidatedInput
              value={country}
              onChangeText={setCountry}
              placeholder="Country"
              editable={!isLoadingLocation}
              isRequired={true}
              saveAttempted={isSaving}
            />

            {/* Duplicate to Other Section Toggle */}
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>
                Use location for {otherSection} too
              </Text>
              <Switch
                value={duplicateToOther}
                onValueChange={setDuplicateToOther}
                disabled={isLoadingLocation}
                trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: '#4ADE80' }}
                thumbColor={duplicateToOther ? '#ffffff' : '#f4f3f4'}
              />
            </View>

            {/* Validation Error */}
            {validationError && (
              <Text style={styles.errorText}>{validationError}</Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </StandardModal>
  );
}

const styles = StyleSheet.create({
  fieldsContainer: {
    gap: 16,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  toggleLabel: {
    color: '#ffffff',
    fontSize: 14,
    flex: 1,
  },
  errorText: {
    color: '#F87171',
    fontSize: 14,
    marginTop: 8,
  },
});

export default AddLocationModal;

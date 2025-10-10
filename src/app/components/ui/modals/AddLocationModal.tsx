/**
 * AddLocationModal - Modal for adding a location with browser geolocation and Radar validation
 * Part of Phase 4: Location Management
 */

'use client';

import React, { useState, useEffect } from 'react';
import { StandardModal } from '../StandardModal';
import { Text } from '../Typography';
import { ToggleSetting } from '../ToggleSetting';
import ValidatedTextInput from '../inputs/ValidatedTextInput';
import { validateCompleteAddress } from '@/lib/location/address-validation';
import type { FieldSection, UserLocation, AddressValidation } from '@/types/profile';
import type { RadarAddressValidationResponse } from '@/app/api/location/validate/route';
import type { ReverseGeocodeResponse } from '@/app/api/location/reverse-geocode/route';

interface AddLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: FieldSection;  // 'personal' | 'work'
  userId: string;
  onLocationAdded: (locations: UserLocation[]) => void;
}

export const AddLocationModal: React.FC<AddLocationModalProps> = ({
  isOpen,
  onClose,
  section,
  userId,
  onLocationAdded
}) => {
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
  const [validation, setValidation] = useState<AddressValidation | null>(null);

  const otherSection = section === 'personal' ? 'work' : 'personal';

  // Request browser location on modal open
  useEffect(() => {
    if (isOpen) {
      requestBrowserLocation();
    } else {
      // Reset form when modal closes
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setAddress('');
    setCity('');
    setRegion('');
    setZip('');
    setCountry('');
    setCoordinates(null);
    setRadarPlaceId(undefined);
    setDuplicateToOther(false);
    setValidationError('');
    setValidation(null);
  };

  const handleInputBlur = () => {
    const newValidation = validateCompleteAddress({
      address,
      city,
      region,
      zip,
      country
    });
    setValidation(newValidation);
  };

  const requestBrowserLocation = async () => {
    if (!navigator.geolocation) {
      console.log('[AddLocationModal] Geolocation not supported');
      return;
    }

    setIsLoadingLocation(true);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
          enableHighAccuracy: true
        });
      });

      const { latitude, longitude } = position.coords;
      console.log('[AddLocationModal] Got browser location:', latitude, longitude);

      // Reverse geocode with Radar
      const response = await fetch('/api/location/reverse-geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: latitude, lng: longitude })
      });

      const data: ReverseGeocodeResponse = await response.json();

      if (data.success && data.city && data.region && data.country) {
        console.log('[AddLocationModal] Auto-filled from browser location');
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
      console.log('[AddLocationModal] Browser location failed:', error);
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
      // If we already have coordinates and radarPlaceId from browser location,
      // skip validation (it's already been validated by reverse geocoding)
      if (coordinates && radarPlaceId) {
        console.log('[AddLocationModal] Using pre-validated location from browser');

        const baseLocation: Omit<UserLocation, 'id' | 'section'> = {
          userId,
          address: address.trim() || '',
          city: city.trim() || '',
          region: region.trim() || '',
          zip: zip.trim() || '',
          country: country.trim() || 'United States', // Default if missing
          coordinates: coordinates,
          validated: true,
          radarPlaceId: radarPlaceId,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const locations: UserLocation[] = [];

        // Add location for current section
        locations.push({
          ...baseLocation,
          id: `${userId}_${section}_location`,
          section: section as 'personal' | 'work'
        });

        // Add location for other section if duplicate is enabled
        if (duplicateToOther) {
          locations.push({
            ...baseLocation,
            id: `${userId}_${otherSection}_location`,
            section: otherSection as 'personal' | 'work'
          });
        }

        console.log('[AddLocationModal] Saving locations:', locations);
        onLocationAdded(locations);
        onClose();
        return;
      }

      // Otherwise, validate with Radar
      const response = await fetch('/api/location/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: address.trim(),
          city: city.trim(),
          region: region.trim(),
          zip: zip.trim(),
          country: country.trim()
        })
      });

      const data: RadarAddressValidationResponse = await response.json();

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
        updatedAt: new Date()
      };

      const locations: UserLocation[] = [];

      // Add location for current section
      locations.push({
        ...baseLocation,
        id: `${userId}_${section}_location`,
        section: section as 'personal' | 'work'
      });

      // Add location for other section if duplicate is enabled
      if (duplicateToOther) {
        locations.push({
          ...baseLocation,
          id: `${userId}_${otherSection}_location`,
          section: otherSection as 'personal' | 'work'
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

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Location"
      subtitle={isLoadingLocation ? 'Detecting your location...' : 'Nekt uses your location to find you things to do close to where you live and work'}
      showPrimaryButton={true}
      primaryButtonText={isSaving ? 'Validating...' : 'Save'}
      onPrimaryButtonClick={handleSave}
      primaryButtonDisabled={isSaving || isLoadingLocation}
      showSecondaryButton={true}
      secondaryButtonText="Cancel"
      showCloseButton={false}
    >
      <div className="space-y-4">
            <ValidatedTextInput
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onBlur={handleInputBlur}
              placeholder="Address"
              disabled={isLoadingLocation}
              validation={validation?.address}
              isRequired={false}
              saveAttempted={isSaving}
            />

            <ValidatedTextInput
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onBlur={handleInputBlur}
              placeholder="City"
              disabled={isLoadingLocation}
              validation={validation?.city}
              isRequired={true}
              saveAttempted={isSaving}
            />

            <ValidatedTextInput
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              onBlur={handleInputBlur}
              placeholder="State/Region"
              disabled={isLoadingLocation}
              validation={validation?.region}
              isRequired={true}
              saveAttempted={isSaving}
            />

            <ValidatedTextInput
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              onBlur={handleInputBlur}
              placeholder="Postal"
              disabled={isLoadingLocation}
              validation={validation?.zip}
              isRequired={false}
              saveAttempted={isSaving}
            />

            {/* Duplicate to Other Section Toggle */}
            <ToggleSetting
              label={`Use location for ${otherSection} too`}
              enabled={duplicateToOther}
              onChange={setDuplicateToOther}
              disabled={isLoadingLocation}
            />

            {/* Validation Error */}
            {validationError && (
              <Text variant="small" className="text-red-400">
                {validationError}
              </Text>
            )}
          </div>
    </StandardModal>
  );
};

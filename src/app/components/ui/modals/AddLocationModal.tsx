/**
 * AddLocationModal - Modal for adding a location with browser geolocation and Radar validation
 * Part of Phase 4: Location Management
 */

'use client';

import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Heading, Text } from '../Typography';
import { Button } from '../buttons/Button';
import { SecondaryButton } from '../buttons/SecondaryButton';
import { CustomInput } from '../inputs/CustomInput';
import type { FieldSection, UserLocation } from '@/types/profile';
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
      // Validate with Radar
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
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 backdrop-blur-sm animate-in fade-in-0 z-[2000]" />
        <Dialog.Content
          className="fixed left-[50%] top-[50%] z-[2000] grid w-[calc(100%-2rem)] max-w-[var(--max-content-width,448px)] translate-x-[-50%] translate-y-[-50%] gap-6 bg-black/80 border border-white/20 p-8 shadow-lg duration-200 animate-in fade-in-0 zoom-in-95 rounded-2xl max-h-[90vh] overflow-y-auto"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Header */}
          <div className="text-center space-y-2">
            <Dialog.Title asChild>
              <Heading as="h2">Add Location</Heading>
            </Dialog.Title>
            <Dialog.Description asChild>
              <Text variant="small" className="text-white/60">
                {isLoadingLocation ? 'Detecting your location...' : `Add your ${section} location`}
              </Text>
            </Dialog.Description>
          </div>

          {/* Address Fields */}
          <div className="space-y-4">
            <CustomInput
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street Address (optional)"
              disabled={isLoadingLocation}
            />

            <CustomInput
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City *"
              disabled={isLoadingLocation}
              required
            />

            <CustomInput
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              }
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="State/Region *"
              disabled={isLoadingLocation}
              required
            />

            <CustomInput
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="ZIP/Postal Code (optional)"
              disabled={isLoadingLocation}
            />

            <CustomInput
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Country * (USA, Canada, Australia)"
              disabled={isLoadingLocation}
              required
            />

            {/* Duplicate to Other Section Toggle */}
            <div className="flex items-center justify-between p-4 bg-white/10 border border-white/20 rounded-xl">
              <Text variant="small" className="text-white">
                Use location for {otherSection} too
              </Text>
              <button
                type="button"
                onClick={() => setDuplicateToOther(!duplicateToOther)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  duplicateToOther ? 'bg-green-500' : 'bg-white/20'
                }`}
                disabled={isLoadingLocation}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    duplicateToOther ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Validation Error */}
            {validationError && (
              <Text variant="small" className="text-red-400">
                {validationError}
              </Text>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              variant="white"
              className="w-full"
              onClick={handleSave}
              disabled={isSaving || isLoadingLocation}
            >
              {isSaving ? 'Validating...' : 'Save'}
            </Button>

            <SecondaryButton
              variant="dark"
              className="w-full"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </SecondaryButton>
          </div>

          {/* Close button */}
          <Dialog.Close asChild>
            <button
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none"
              aria-label="Close"
              onClick={onClose}
            >
              <span className="sr-only">Close</span>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

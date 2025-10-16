'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/app/context/ProfileContext';
import PageHeader from '@/app/components/ui/layout/PageHeader';
import { Text } from '@/app/components/ui/Typography';
import { SecondaryButton } from '@/app/components/ui/buttons/SecondaryButton';
import { ValidatedInput } from '@/app/components/ui/inputs/ValidatedInput';
import { validateCompleteAddress } from '@/lib/location/address-validation';
import type { UserLocation, AddressValidation } from '@/types/profile';
import type { RadarAddressValidationResponse } from '@/app/api/location/validate/route';

interface LocationViewProps {
  locationId: string;
}

export default function LocationView({ locationId }: LocationViewProps) {
  const router = useRouter();
  const { profile, saveProfile, isLoading } = useProfile();
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [validation, setValidation] = useState<AddressValidation | null>(null);

  // Find the location
  const location = profile?.locations?.find(loc => loc.id === locationId);
  const [editedLocation, setEditedLocation] = useState<UserLocation | null>(null);

  // Initialize edited location when location is loaded
  useEffect(() => {
    if (location && !editedLocation) {
      setEditedLocation({ ...location });
    }
  }, [location, editedLocation]);

  const handleInputBlur = () => {
    if (!editedLocation) return;
    const newValidation = validateCompleteAddress({
      address: editedLocation.address || '',
      city: editedLocation.city,
      region: editedLocation.region,
      zip: editedLocation.zip || '',
      country: editedLocation.country || ''
    });
    setValidation(newValidation);
  };

  const handleSave = async () => {
    if (!editedLocation || !profile) return;

    // Client-side validation
    if (!editedLocation.city.trim() || !editedLocation.region.trim() || !editedLocation.country?.trim()) {
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
          address: editedLocation.address?.trim(),
          city: editedLocation.city.trim(),
          region: editedLocation.region.trim(),
          zip: editedLocation.zip?.trim(),
          country: editedLocation.country?.trim()
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
        updatedAt: new Date()
      };

      // Update location in profile
      const updatedLocations = profile.locations?.map(loc =>
        loc.id === locationId ? updatedLocation : loc
      );

      await saveProfile({ locations: updatedLocations });
      router.push('/edit');
    } catch (error) {
      console.error('Error saving location:', error);
      setValidationError('Failed to save location. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!location || !profile) return;

    setIsSaving(true);
    try {
      // Remove location from profile
      const updatedLocations = profile.locations?.filter(loc => loc.id !== locationId);

      await saveProfile({ locations: updatedLocations });
      router.push('/edit');
    } catch (error) {
      console.error('Error deleting location:', error);
      setValidationError('Failed to delete location. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center px-4 py-2 pb-8 relative">
        <div className="w-full max-w-[var(--max-content-width,448px)] space-y-5">
          <PageHeader onBack={() => router.back()} title="Location" />
          <Text className="text-white/60">Loading...</Text>
        </div>
      </div>
    );
  }

  if (!location || !editedLocation) {
    return (
      <div className="flex flex-col items-center px-4 py-2 pb-8 relative">
        <div className="w-full max-w-[var(--max-content-width,448px)] space-y-5">
          <PageHeader onBack={() => router.back()} title="Location" />
          <Text className="text-white/60">Location not found</Text>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-4 py-2 pb-8 relative">
      <div className="w-full max-w-[var(--max-content-width,448px)] space-y-5">
        <PageHeader
          onBack={() => router.back()}
          title="Location"
          onSave={handleSave}
          isSaving={isSaving}
        />

        {/* Address Fields */}
        <div className="space-y-4">
          <ValidatedInput
            type="text"
            value={editedLocation.address || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditedLocation({ ...editedLocation, address: e.target.value })}
            onBlur={handleInputBlur}
            placeholder="Address"
            validation={validation?.address}
            isRequired={false}
            saveAttempted={isSaving}
          />

          <ValidatedInput
            type="text"
            value={editedLocation.city}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditedLocation({ ...editedLocation, city: e.target.value })}
            onBlur={handleInputBlur}
            placeholder="City"
            validation={validation?.city}
            isRequired={true}
            saveAttempted={isSaving}
          />

          <ValidatedInput
            type="text"
            value={editedLocation.region}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditedLocation({ ...editedLocation, region: e.target.value })}
            onBlur={handleInputBlur}
            placeholder="State/Region"
            validation={validation?.region}
            isRequired={true}
            saveAttempted={isSaving}
          />

          <ValidatedInput
            type="text"
            value={editedLocation.zip || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditedLocation({ ...editedLocation, zip: e.target.value })}
            onBlur={handleInputBlur}
            placeholder="Postal"
            validation={validation?.zip}
            isRequired={false}
            saveAttempted={isSaving}
          />

          {/* Validation Error */}
          {validationError && (
            <Text variant="small" className="text-red-400">
              {validationError}
            </Text>
          )}
        </div>

        {/* Actions */}
        <div className="mt-5 text-center">
          <SecondaryButton
            variant="destructive"
            onClick={handleDelete}
            disabled={isSaving}
          >
            {isSaving ? 'Deleting...' : 'Delete'}
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}

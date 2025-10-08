/**
 * Edit Location Page - Edit or delete a location
 * Part of Phase 4: Location Management
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useProfile } from '@/app/context/ProfileContext';
import { PageContainer } from '@/app/components/ui/PageContainer';
import { TopBar } from '@/app/components/ui/TopBar';
import { Heading, Text } from '@/app/components/ui/Typography';
import { Button } from '@/app/components/ui/buttons/Button';
import { SecondaryButton } from '@/app/components/ui/buttons/SecondaryButton';
import { CustomInput } from '@/app/components/ui/inputs/CustomInput';
import type { UserLocation } from '@/types/profile';
import type { RadarAddressValidationResponse } from '@/app/api/location/validate/route';

export default function EditLocationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, saveProfile, isLoading } = useProfile();
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Get location ID from URL params
  const locationId = searchParams.get('id');

  // Find the location
  const location = profile?.locations?.find(loc => loc.id === locationId);

  const [editedLocation, setEditedLocation] = useState<UserLocation | null>(null);

  // Initialize edited location when location is loaded
  useEffect(() => {
    if (location && !editedLocation) {
      setEditedLocation({ ...location });
    }
  }, [location, editedLocation]);

  const handleSave = async () => {
    if (!editedLocation || !profile) return;

    // Client-side validation
    if (!editedLocation.city.trim() || !editedLocation.region.trim() || !editedLocation.country.trim()) {
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
          country: editedLocation.country.trim()
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
      router.push('/edit-profile');
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
      router.push('/edit-profile');
    } catch (error) {
      console.error('Error deleting location:', error);
      setValidationError('Failed to delete location. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <TopBar title="Edit Location" backButton />
        <div className="p-6">
          <Text className="text-white/60">Loading...</Text>
        </div>
      </PageContainer>
    );
  }

  if (!location || !editedLocation) {
    return (
      <PageContainer>
        <TopBar title="Edit Location" backButton />
        <div className="p-6">
          <Text className="text-white/60">Location not found</Text>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <TopBar title="Edit Location" backButton />

      <div className="p-6 space-y-6">
        {/* Location Info */}
        <div>
          <Heading as="h3" className="mb-4">
            {editedLocation.section === 'personal' ? 'Personal' : 'Work'} Location
          </Heading>
          <Text variant="small" className="text-white/60">
            {editedLocation.city}, {editedLocation.region}
          </Text>
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
            value={editedLocation.address || ''}
            onChange={(e) => setEditedLocation({ ...editedLocation, address: e.target.value })}
            placeholder="Street Address (optional)"
          />

          <CustomInput
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
            value={editedLocation.city}
            onChange={(e) => setEditedLocation({ ...editedLocation, city: e.target.value })}
            placeholder="City *"
            required
          />

          <CustomInput
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            }
            value={editedLocation.region}
            onChange={(e) => setEditedLocation({ ...editedLocation, region: e.target.value })}
            placeholder="State/Region *"
            required
          />

          <CustomInput
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
            value={editedLocation.zip || ''}
            onChange={(e) => setEditedLocation({ ...editedLocation, zip: e.target.value })}
            placeholder="ZIP/Postal Code (optional)"
          />

          <CustomInput
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            value={editedLocation.country || ''}
            onChange={(e) => setEditedLocation({ ...editedLocation, country: e.target.value })}
            placeholder="Country * (USA, Canada, Australia)"
            required
          />

          {/* Validation Error */}
          {validationError && (
            <Text variant="small" className="text-red-400">
              {validationError}
            </Text>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-4">
          <Button
            variant="white"
            className="w-full"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>

          {!showDeleteConfirm ? (
            <SecondaryButton
              variant="dark"
              className="w-full text-red-500"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete Location
            </SecondaryButton>
          ) : (
            <div className="space-y-2">
              <Text variant="small" className="text-center text-red-400">
                Are you sure? This will permanently remove this location.
              </Text>
              <div className="flex gap-2">
                <SecondaryButton
                  variant="dark"
                  className="flex-1"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </SecondaryButton>
                <Button
                  variant="white"
                  className="flex-1 !bg-red-500 !text-white hover:!bg-red-600"
                  onClick={handleDelete}
                  disabled={isSaving}
                >
                  {isSaving ? 'Deleting...' : 'Confirm Delete'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

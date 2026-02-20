/**
 * JavaScript wrapper for MeCard native module
 *
 * Provides React Native access to the iOS Contacts framework
 * to retrieve the user's personal contact information (the "Me" card).
 */

import { NativeModules, Platform } from "react-native";

const { MeCardModule } = NativeModules;

/**
 * Result from getMeCard call
 */
export interface MeCardResult {
  firstName: string;
  lastName: string;
  phoneNumbers: string[];
  emails: string[];
  hasImage: boolean;
}

/**
 * Get the user's "Me" card from the Contacts store
 *
 * Returns the user's contact info if the Me card is configured,
 * or null if not available.
 *
 * Note: Contacts permission must be granted before calling this.
 */
export async function getMeCard(): Promise<MeCardResult | null> {
  if (Platform.OS !== "ios") {
    console.log("[MeCardWrapper] Not available on this platform");
    return null;
  }

  if (!MeCardModule) {
    console.warn("[MeCardWrapper] Native module not available");
    return null;
  }

  try {
    const result = await MeCardModule.getMeCard();
    if (result) {
      console.log("[MeCardWrapper] Retrieved Me card:", result.firstName, result.lastName);
    } else {
      console.log("[MeCardWrapper] No Me card found");
    }
    return result;
  } catch (error) {
    console.error("[MeCardWrapper] Error getting Me card:", error);
    return null;
  }
}

/**
 * Get the profile image from the Me card as a file:// URI
 *
 * Returns a file path to a temp JPEG file with the image data,
 * or null if not available.
 */
export async function getMeCardImage(): Promise<string | null> {
  if (Platform.OS !== "ios") {
    console.log("[MeCardWrapper] Not available on this platform");
    return null;
  }

  if (!MeCardModule) {
    console.warn("[MeCardWrapper] Native module not available");
    return null;
  }

  try {
    const fileUri = await MeCardModule.getMeCardImage();
    if (fileUri) {
      console.log("[MeCardWrapper] Retrieved Me card image file:", fileUri);
    } else {
      console.log("[MeCardWrapper] No Me card image found");
    }
    return fileUri;
  } catch (error) {
    console.error("[MeCardWrapper] Error getting Me card image:", error);
    return null;
  }
}

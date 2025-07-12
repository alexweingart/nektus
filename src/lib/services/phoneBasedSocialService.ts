import { SocialProfile } from '@/types/profile';

export interface PhoneBasedSocialResult {
  whatsapp: SocialProfile | null;
  telegram: SocialProfile | null;
  success: boolean;
  profilesGenerated: number;
  profilesVerified: number;
}

export class PhoneBasedSocialService {
  /**
   * Generate phone-based social media profiles with verification
   * Note: Only WhatsApp is generated from phone numbers. Telegram and WeChat are user-added only.
   */
  static async generatePhoneBasedSocials(phoneNumber: string): Promise<PhoneBasedSocialResult> {
    try {
      console.log(`[PhoneBasedSocialService] Generating phone-based socials for phone: ${phoneNumber}`);
      
      // Clean phone number (remove non-digits)
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      
      if (!cleanPhone || cleanPhone.length < 10) {
        console.warn(`[PhoneBasedSocialService] Invalid phone number: ${phoneNumber}`);
        return {
          whatsapp: null,
          telegram: null,
          success: false,
          profilesGenerated: 0,
          profilesVerified: 0
        };
      }
      
      // Generate only WhatsApp profile
      const whatsappProfile = this.createPhoneProfile(cleanPhone, 'whatsapp');
      
      // Verify WhatsApp profile
      const whatsappVerified = await this.verifyPhoneProfile('whatsapp', whatsappProfile);
      
      const profilesGenerated = 1; // Only WhatsApp
      const profilesVerified = whatsappVerified ? 1 : 0;
      
      console.log(`[PhoneBasedSocialService] Generation completed for ${phoneNumber}`, {
        profilesGenerated,
        profilesVerified
      });
      
      return {
        whatsapp: whatsappVerified,
        telegram: null, // Telegram is user-added only (like WeChat)
        success: true,
        profilesGenerated,
        profilesVerified
      };
    } catch (error) {
      console.error(`[PhoneBasedSocialService] Error generating phone-based socials:`, error);
      return {
        whatsapp: null,
        telegram: null,
        success: false,
        profilesGenerated: 0,
        profilesVerified: 0
      };
    }
  }
  
  /**
   * Create a phone-based social profile
   * Note: Only supports WhatsApp now
   */
  private static createPhoneProfile(cleanPhone: string, platform: 'whatsapp'): SocialProfile {
    const urlPatterns = {
      whatsapp: `https://wa.me/${cleanPhone}`
    };
    
    return {
      username: cleanPhone,
      url: urlPatterns[platform],
      userConfirmed: false,
      automatedVerification: false, // Will be set during verification
      discoveryMethod: 'phone-guess',
      fieldSection: {
        section: 'personal',
        order: 6 // WhatsApp order
      }
    };
  }
  
  /**
   * Verify phone-based profile
   * Note: Only supports WhatsApp now
   */
  private static async verifyPhoneProfile(
    platform: 'whatsapp',
    profile: SocialProfile
  ): Promise<SocialProfile | null> {
    try {
      const isValid = await this.performPhoneVerification(platform, profile.username);
      
      if (isValid) {
        return {
          ...profile,
          automatedVerification: true
        };
      } else {
        console.log(`[PhoneBasedSocialService] Failed verification for ${platform}: ${profile.username}`);
        return null; // Failed verification becomes null (auto-hidden)
      }
    } catch (error) {
      console.error(`[PhoneBasedSocialService] Verification error for ${platform}:`, error);
      return null; // Error during verification becomes null
    }
  }
  
  /**
   * Perform verification for phone-based platforms using server-side API
   * Note: Only supports WhatsApp now
   */
  private static async performPhoneVerification(
    platform: 'whatsapp',
    phoneNumber: string
  ): Promise<boolean> {
    try {
      // Phone number format validation
      const phoneRegex = /^\d{10,15}$/;
      if (!phoneRegex.test(phoneNumber)) {
        return false;
      }
      
      console.log(`[PhoneBasedSocialService] Verifying ${platform} via server-side API`);
      
      // Use server-side verification API to bypass CORS limitations
      const response = await fetch('/api/verify-phone-socials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber,
          platforms: [platform]
        })
      });
      
      if (!response.ok) {
        console.error(`[PhoneBasedSocialService] Verification API failed: ${response.status}`);
        return false;
      }
      
      const data = await response.json();
      const result = data.results?.find((r: any) => r.platform === platform);
      
      if (result) {
        if (result.error) {
          console.warn(`[PhoneBasedSocialService] Verification warning for ${platform}: ${result.error}`);
        }
        return result.verified;
      }
      
      console.warn(`[PhoneBasedSocialService] No result found for ${platform}`);
      return false;
      
    } catch (error) {
      console.error(`[PhoneBasedSocialService] Verification failed for ${platform}/${phoneNumber}:`, error);
      // Fallback to format validation if server verification fails
      return true;
    }
  }
  
  /**
   * Create empty phone-based social profiles (for cases where phone is not available)
   * Note: Only creates WhatsApp profile now. Telegram and WeChat are user-added only.
   */
  static createEmptyPhoneProfiles(): { whatsapp: SocialProfile; telegram: SocialProfile } {
    return {
      whatsapp: {
        username: '',
        url: '',
        userConfirmed: false,
        automatedVerification: false,
        discoveryMethod: 'manual',
        fieldSection: {
          section: 'hidden', // Empty profiles are hidden
          order: 6
        }
      },
      telegram: {
        username: '',
        url: '',
        userConfirmed: false,
        automatedVerification: false,
        discoveryMethod: 'manual',
        fieldSection: {
          section: 'hidden', // Empty profiles are hidden  
          order: 7
        }
      }
    };
  }
} 
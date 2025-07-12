import { NextRequest, NextResponse } from 'next/server';

interface VerificationRequest {
  phoneNumber: string;
  platforms: ('whatsapp')[];
}

interface VerificationResult {
  platform: 'whatsapp';
  verified: boolean;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, platforms }: VerificationRequest = await request.json();
    
    if (!phoneNumber || !platforms || platforms.length === 0) {
      return NextResponse.json({ error: 'Missing phoneNumber or platforms' }, { status: 400 });
    }
    
    // Phone number format validation
    const phoneRegex = /^\d{10,15}$/;
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    if (!phoneRegex.test(cleanPhone)) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
    }
    
    console.log(`[API/VERIFY-PHONE-SOCIALS] Verifying platforms ${platforms.join(', ')} for phone: ${cleanPhone}`);
    
    // Perform verifications in parallel
    const verifications = await Promise.allSettled(
      platforms.map(platform => verifyPhonePlatform(platform, cleanPhone))
    );
    
    const results: VerificationResult[] = verifications.map((result, index) => {
      const platform = platforms[index];
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          platform,
          verified: false,
          error: result.reason?.message || 'Verification failed'
        };
      }
    });
    
    console.log(`[API/VERIFY-PHONE-SOCIALS] Verification completed:`, results);
    
    return NextResponse.json({ results });
    
  } catch (error) {
    console.error('[API/VERIFY-PHONE-SOCIALS] Error:', error);
    return NextResponse.json(
      { error: 'Verification failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Verify a specific phone-based platform
 * Note: Only supports WhatsApp now. Telegram is user-added only.
 */
async function verifyPhonePlatform(
  platform: 'whatsapp',
  phoneNumber: string
): Promise<VerificationResult> {
  const timeoutMs = 10000; // 10 second timeout for server-side requests
  
  try {
    switch (platform) {
      case 'whatsapp':
        return await verifyWhatsApp(phoneNumber, timeoutMs);
      default:
        return { platform, verified: false, error: 'Unknown platform' };
    }
  } catch (error) {
    console.error(`[API/VERIFY-PHONE-SOCIALS] Error verifying ${platform}:`, error);
    return {
      platform,
      verified: false,
      error: error instanceof Error ? error.message : 'Verification failed'
    };
  }
}

/**
 * Verify WhatsApp number
 * HEAD https://wa.me/<phone> (no redirect follow) → status < 400 ⇒ exists
 */
async function verifyWhatsApp(phoneNumber: string, timeoutMs: number): Promise<VerificationResult> {
  try {
    const url = `https://wa.me/${phoneNumber}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ProfileBot/1.0)',
      },
      redirect: 'manual', // Don't follow redirects
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Accept 2xx and 3xx status codes (redirects are common)
    const verified = response.status >= 200 && response.status < 400;
    
    return {
      platform: 'whatsapp',
      verified
    };
  } catch (error) {
    console.error('[API/VERIFY-PHONE-SOCIALS] WhatsApp verification failed:', error);
    return {
      platform: 'whatsapp',
      verified: false,
      error: error instanceof Error ? error.message : 'Verification failed'
    };
  }
} 
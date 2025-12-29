import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

interface VerificationResult {
  platform: string;
  verified: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { phoneNumber, platforms } = body;

    console.log(`[API/VERIFY-PHONE-SOCIALS] Starting verification for user ${userId}`, {
      phoneNumber: phoneNumber ? 'provided' : 'missing',
      platforms
    });

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    if (!platforms || !Array.isArray(platforms)) {
      return NextResponse.json({ error: 'Platforms array is required' }, { status: 400 });
    }

    const results: VerificationResult[] = [];

    // Process each requested platform
    for (const platform of platforms) {
      if (platform === 'whatsapp') {
        // Verify phone number format (basic validation)
        const digitsOnly = phoneNumber.replace(/\D/g, '');
        const isValid = digitsOnly.length >= 10 && digitsOnly.length <= 15;

        results.push({
          platform: 'whatsapp',
          verified: isValid
        });

        console.log(`[API/VERIFY-PHONE-SOCIALS] WhatsApp verification for ${userId}:`, {
          phoneNumber: digitsOnly,
          verified: isValid,
          digitCount: digitsOnly.length
        });
      }
    }

    return NextResponse.json({ results });

  } catch (error) {
    console.error('[API/VERIFY-PHONE-SOCIALS] Error in verification:', error);

    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json(
      { error: 'Failed to verify phone-based socials', details: message },
      { status: 500 }
    );
  }
}

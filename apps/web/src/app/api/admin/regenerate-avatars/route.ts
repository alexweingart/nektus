import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin, uploadImageBuffer } from '@/server/config/firebase';
import { AdminProfileService } from '@/server/profile/firebase-admin';
import { getFieldValue } from '@/client/profile/transforms';
import { generateInitialsAvatar, dataUrlToBuffer } from '@/client/profile/avatar';
import { generateProfileColors } from '@/shared/colors';

/**
 * POST /api/admin/regenerate-avatars
 *
 * Regenerates initials avatars with white text for all users who currently
 * have SVG initials (colored text from accent2). Skips users with AI-generated
 * or user-uploaded JPG profile images.
 *
 * Auth: Bearer token must match CRON_SECRET env var.
 *
 * Query params:
 *   ?dry=true   — preview which users would be updated without making changes
 *   ?limit=N    — cap the number of profiles to process (default: all)
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get('dry') === 'true';
  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;

  try {
    const { db } = await getFirebaseAdmin();
    const profilesSnap = await db.collection('profiles').get();

    const results: { userId: string; name: string; action: string }[] = [];
    let processed = 0;

    for (const doc of profilesSnap.docs) {
      if (limit && processed >= limit) break;

      const userId = doc.id;
      const profile = doc.data();
      const profileImage: string | undefined = profile.profileImage;

      // Only regenerate SVG initials avatars — skip JPG (AI-generated / user-uploaded)
      // Also regenerate if profileImage is missing entirely
      const isSvg = profileImage && profileImage.includes('.svg');
      const isMissing = !profileImage;

      if (!isSvg && !isMissing) {
        results.push({ userId, name: getFieldValue(profile.contactEntries, 'name') || '(unknown)', action: 'skipped — has JPG image' });
        continue;
      }

      const name = getFieldValue(profile.contactEntries, 'name') || 'User';
      const colors = generateProfileColors(name);

      if (dryRun) {
        results.push({ userId, name, action: isMissing ? 'would regenerate (no image)' : 'would regenerate (SVG)' });
        processed++;
        continue;
      }

      // Generate new SVG with white initials
      const svgDataUrl = generateInitialsAvatar(name, 1024, [colors[0], colors[1]], '#FFFFFF');
      const buffer = dataUrlToBuffer(svgDataUrl);
      const newUrl = await uploadImageBuffer(buffer, userId, 'profile');
      const cacheBustedUrl = `${newUrl}?t=${Date.now()}`;

      await AdminProfileService.updateProfile(userId, {
        profileImage: cacheBustedUrl,
        backgroundColors: colors,
      });

      results.push({ userId, name, action: 'regenerated' });
      processed++;
    }

    const summary = {
      dryRun,
      total: profilesSnap.size,
      processed,
      regenerated: results.filter(r => r.action === 'regenerated').length,
      skipped: results.filter(r => r.action.startsWith('skipped')).length,
      results,
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('[ADMIN/REGENERATE-AVATARS] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to regenerate avatars', details: message }, { status: 500 });
  }
}

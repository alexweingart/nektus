import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin, uploadImageBuffer } from '@/server/config/firebase';
import { AdminProfileService } from '@/server/profile/firebase-admin';
import { getFieldValue } from '@/client/profile/transforms';
import { generateInitialsAvatar, dataUrlToBuffer } from '@/client/profile/avatar';
import { generateProfileColors } from '@/shared/colors';

/**
 * POST /api/admin/regenerate-avatars
 *
 * Two-phase migration:
 *
 * Phase 1 — Regenerate any SVG initials avatars on profiles (colored text → white).
 * Phase 2 — Walk every user's contacts subcollection and refresh each contact's
 *           profileImage from the contact's current profile, so stale colored-text
 *           SVG snapshots are replaced with the up-to-date image.
 *
 * Auth: Bearer token must match CRON_SECRET env var.
 *
 * Query params:
 *   ?dry=true   — preview changes without writing
 *   ?limit=N    — cap the number of profiles to process
 *   ?phase=1|2  — run only one phase (default: both)
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get('dry') === 'true';
  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;
  const phaseParam = request.nextUrl.searchParams.get('phase');
  const runPhase1 = !phaseParam || phaseParam === '1';
  const runPhase2 = !phaseParam || phaseParam === '2';

  try {
    const { db } = await getFirebaseAdmin();

    // ── Phase 1: Regenerate SVG profile images ──────────────────────────
    const phase1Results: { userId: string; name: string; action: string }[] = [];

    if (runPhase1) {
      const profilesSnap = await db.collection('profiles').get();
      let processed = 0;

      for (const doc of profilesSnap.docs) {
        if (limit && processed >= limit) break;

        const userId = doc.id;
        const profile = doc.data();
        const profileImage: string | undefined = profile.profileImage;

        const isSvg = profileImage && profileImage.includes('.svg');
        const isMissing = !profileImage;

        if (!isSvg && !isMissing) {
          phase1Results.push({ userId, name: getFieldValue(profile.contactEntries, 'name') || '(unknown)', action: 'skipped — has JPG image' });
          continue;
        }

        const name = getFieldValue(profile.contactEntries, 'name') || 'User';
        const colors = generateProfileColors(name);

        if (dryRun) {
          phase1Results.push({ userId, name, action: isMissing ? 'would regenerate (no image)' : 'would regenerate (SVG)' });
          processed++;
          continue;
        }

        const svgDataUrl = generateInitialsAvatar(name, 1024, [colors[0], colors[1]], '#FFFFFF');
        const buffer = dataUrlToBuffer(svgDataUrl);
        const newUrl = await uploadImageBuffer(buffer, userId, 'profile');
        const cacheBustedUrl = `${newUrl}?t=${Date.now()}`;

        await AdminProfileService.updateProfile(userId, {
          profileImage: cacheBustedUrl,
          backgroundColors: colors,
        });

        phase1Results.push({ userId, name, action: 'regenerated' });
        processed++;
      }
    }

    // ── Phase 2: Refresh stale contact snapshots ────────────────────────
    const phase2Results: { ownerId: string; contactId: string; contactName: string; action: string }[] = [];

    if (runPhase2) {
      // Build a lookup of current profile images
      const profilesSnap = await db.collection('profiles').get();
      const profileImageMap = new Map<string, string>();
      for (const doc of profilesSnap.docs) {
        const data = doc.data();
        if (data.profileImage) {
          profileImageMap.set(doc.id, data.profileImage);
        }
      }

      let processed = 0;

      for (const profileDoc of profilesSnap.docs) {
        if (limit && processed >= limit) break;

        const ownerId = profileDoc.id;
        const contactsSnap = await db.collection('profiles').doc(ownerId).collection('contacts').get();

        for (const contactDoc of contactsSnap.docs) {
          const contact = contactDoc.data();
          const contactId = contactDoc.id;
          const contactImage: string | undefined = contact.profileImage;
          const contactName = getFieldValue(contact.contactEntries, 'name') || '(unknown)';

          // Get the contact's current profile image
          const currentImage = profileImageMap.get(contactId);

          // Skip if the contact already has the current image
          if (contactImage && currentImage && stripCacheBuster(contactImage) === stripCacheBuster(currentImage)) {
            phase2Results.push({ ownerId, contactId, contactName, action: 'skipped — already current' });
            continue;
          }

          // Skip if there's no current profile image to update to
          if (!currentImage) {
            phase2Results.push({ ownerId, contactId, contactName, action: 'skipped — contact has no profile' });
            continue;
          }

          if (dryRun) {
            const reason = !contactImage ? 'no image' : contactImage.includes('.svg') ? 'stale SVG' : 'stale JPG';
            phase2Results.push({ ownerId, contactId, contactName, action: `would refresh (${reason})` });
            continue;
          }

          // Update the contact document with the current profile image
          await db.collection('profiles').doc(ownerId).collection('contacts').doc(contactId).update({
            profileImage: currentImage,
          });

          phase2Results.push({ ownerId, contactId, contactName, action: 'refreshed' });
        }

        processed++;
      }
    }

    const summary = {
      dryRun,
      phase1: runPhase1 ? {
        total: phase1Results.length,
        regenerated: phase1Results.filter(r => r.action === 'regenerated' || r.action.startsWith('would')).length,
        skipped: phase1Results.filter(r => r.action.startsWith('skipped')).length,
        results: phase1Results,
      } : 'skipped',
      phase2: runPhase2 ? {
        totalContacts: phase2Results.length,
        refreshed: phase2Results.filter(r => r.action === 'refreshed' || r.action.startsWith('would')).length,
        skipped: phase2Results.filter(r => r.action.startsWith('skipped')).length,
        results: phase2Results,
      } : 'skipped',
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error('[ADMIN/REGENERATE-AVATARS] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to regenerate avatars', details: message }, { status: 500 });
  }
}

/** Strip ?t=... cache buster from URL for comparison */
function stripCacheBuster(url: string): string {
  return url.replace(/\?t=\d+$/, '');
}

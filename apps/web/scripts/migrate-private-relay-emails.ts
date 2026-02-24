/**
 * Migration: Move Apple private relay emails from contactEntries to authEmail
 *
 * Phase 1 — Profiles:
 *   For each profile where any email contactEntry contains @privaterelay.appleid.com:
 *     - Copy the private relay email to the authEmail field
 *     - Clear the contactEntry value to ''
 *
 * Phase 2 — Saved contacts:
 *   For each saved contact (/profiles/{uid}/contacts/{contactId}):
 *     - If any email contactEntry contains @privaterelay.appleid.com, clear it to ''
 *     - (No authEmail on saved contacts — they're profile snapshots, not auth records)
 *
 * Usage:
 *   npx tsx scripts/migrate-private-relay-emails.ts --dry-run
 *   npx tsx scripts/migrate-private-relay-emails.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load env vars from .env.local (same as Next.js dev)
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { getFirebaseAdmin } from '../src/server/config/firebase';

const DRY_RUN = process.argv.includes('--dry-run');

type EntryLike = { fieldType: string; value: string; [key: string]: unknown };

function hasPrivateRelayEmail(entries: EntryLike[]): boolean {
  return entries.some(
    (e) => e.fieldType === 'email' && e.value?.endsWith('@privaterelay.appleid.com')
  );
}

function clearRelayEmails(entries: EntryLike[]): EntryLike[] {
  return entries.map((entry) => {
    if (entry.fieldType === 'email' && entry.value?.endsWith('@privaterelay.appleid.com')) {
      return { ...entry, value: '' };
    }
    return entry;
  });
}

async function main() {
  console.log(`\n🔄 Starting private relay email migration${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);

  const { db } = await getFirebaseAdmin();

  // ── Phase 1: Profiles ──────────────────────────────────────────────
  console.log('── Phase 1: Profiles ──');
  const profilesSnap = await db.collection('profiles').get();

  let totalProfiles = 0;
  let profilesAffected = 0;
  let profilesClean = 0;
  let profileErrors = 0;

  for (const doc of profilesSnap.docs) {
    totalProfiles++;
    const userId = doc.id;
    const data = doc.data();
    const contactEntries = data.contactEntries as EntryLike[] | undefined;

    if (!contactEntries || !hasPrivateRelayEmail(contactEntries)) {
      profilesClean++;
      continue;
    }

    const relayEmail = contactEntries.find(
      (e) => e.fieldType === 'email' && e.value?.endsWith('@privaterelay.appleid.com')
    )!.value;
    console.log(`  📧 ${userId}: found private relay email ${relayEmail}`);

    const updatedEntries = clearRelayEmails(contactEntries);

    if (!DRY_RUN) {
      try {
        await db.collection('profiles').doc(userId).update({
          authEmail: relayEmail,
          contactEntries: updatedEntries,
        });
        profilesAffected++;
      } catch (error) {
        console.error(`  ❌ Error updating profile ${userId}:`, error);
        profileErrors++;
      }
    } else {
      profilesAffected++;
    }
  }

  console.log(`\n  Profiles — total: ${totalProfiles}, affected: ${profilesAffected}, clean: ${profilesClean}, errors: ${profileErrors}\n`);

  // ── Phase 2: Saved contacts ────────────────────────────────────────
  console.log('── Phase 2: Saved contacts ──');
  let totalContacts = 0;
  let contactsAffected = 0;
  let contactsClean = 0;
  let contactErrors = 0;

  for (const profileDoc of profilesSnap.docs) {
    const userId = profileDoc.id;
    const contactsSnap = await db
      .collection('profiles')
      .doc(userId)
      .collection('contacts')
      .get();

    for (const contactDoc of contactsSnap.docs) {
      totalContacts++;
      const contactData = contactDoc.data();
      const entries = contactData.contactEntries as EntryLike[] | undefined;

      if (!entries || !hasPrivateRelayEmail(entries)) {
        contactsClean++;
        continue;
      }

      console.log(`  📇 ${userId}/contacts/${contactDoc.id}: clearing private relay email`);
      const updatedEntries = clearRelayEmails(entries);

      if (!DRY_RUN) {
        try {
          await db
            .collection('profiles')
            .doc(userId)
            .collection('contacts')
            .doc(contactDoc.id)
            .update({ contactEntries: updatedEntries });
          contactsAffected++;
        } catch (error) {
          console.error(`  ❌ Error updating contact ${userId}/contacts/${contactDoc.id}:`, error);
          contactErrors++;
        }
      } else {
        contactsAffected++;
      }
    }
  }

  console.log(`\n  Saved contacts — total: ${totalContacts}, affected: ${contactsAffected}, clean: ${contactsClean}, errors: ${contactErrors}\n`);

  // ── Summary ────────────────────────────────────────────────────────
  console.log(`\n✅ Migration complete${DRY_RUN ? ' (DRY RUN)' : ''}:`);
  console.log(`   Profiles affected: ${profilesAffected}`);
  console.log(`   Saved contacts affected: ${contactsAffected}`);
  console.log(`   Total errors: ${profileErrors + contactErrors}`);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

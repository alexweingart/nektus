/**
 * Migration: Backfill backgroundColors on profiles created before Feb 2 2026
 *
 * For each profile missing backgroundColors (or with < 3 entries):
 *   - Extract the user's name from contactEntries
 *   - Generate deterministic colors via generateProfileColors(name)
 *   - Update the profile doc with backgroundColors
 *
 * Usage:
 *   npx tsx scripts/migrate-background-colors.ts --dry-run
 *   npx tsx scripts/migrate-background-colors.ts
 */

import { getFirebaseAdmin } from '../src/server/config/firebase';
import { generateProfileColors } from '../src/shared/colors';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`\n🔄 Starting backgroundColors migration${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);

  const { db } = await getFirebaseAdmin();
  const profilesSnap = await db.collection('profiles').get();

  let totalProfiles = 0;
  let alreadyHasColors = 0;
  let backfilled = 0;
  let noName = 0;
  let errors = 0;

  for (const doc of profilesSnap.docs) {
    totalProfiles++;
    const userId = doc.id;
    const data = doc.data();
    const existing = data.backgroundColors as string[] | undefined;

    if (existing && existing.length >= 3) {
      alreadyHasColors++;
      continue;
    }

    // Extract name from contactEntries
    const contactEntries = data.contactEntries as Array<{ fieldType: string; value: string }> | undefined;
    const name = contactEntries?.find(e => e.fieldType === 'name')?.value;

    if (!name) {
      noName++;
      console.log(`  ⚠️  ${userId}: no name in contactEntries, skipping`);
      continue;
    }

    const colors = generateProfileColors(name);
    console.log(`  🎨 ${userId} (${name}): ${colors.join(', ')}`);

    if (!DRY_RUN) {
      try {
        await db.collection('profiles').doc(userId).update({ backgroundColors: colors });
        console.log(`      ✅ Updated`);
      } catch (err) {
        console.error(`      ❌ Error:`, err);
        errors++;
        continue;
      }
    }

    backfilled++;
  }

  console.log(`\n📊 Profile Summary${DRY_RUN ? ' (DRY RUN)' : ''}:`);
  console.log(`   Total profiles:       ${totalProfiles}`);
  console.log(`   Already had colors:   ${alreadyHasColors}`);
  console.log(`   Backfilled:           ${backfilled}`);
  console.log(`   No name (skipped):    ${noName}`);
  console.log(`   Errors:               ${errors}`);

  // --- Pass 2: Backfill saved contacts subcollections ---
  console.log(`\n🔄 Starting saved contacts backfill${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);

  let totalContacts = 0;
  let contactsAlreadyHasColors = 0;
  let contactsBackfilled = 0;
  let contactsNoName = 0;
  let contactsErrors = 0;

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
      const existingColors = contactData.backgroundColors as string[] | undefined;

      if (existingColors && existingColors.length >= 3) {
        contactsAlreadyHasColors++;
        continue;
      }

      // Extract name from contactEntries
      const contactEntries = contactData.contactEntries as Array<{ fieldType: string; value: string }> | undefined;
      const name = contactEntries?.find(e => e.fieldType === 'name')?.value;

      if (!name) {
        contactsNoName++;
        continue;
      }

      const colors = generateProfileColors(name);
      console.log(`  🎨 ${userId}/contacts/${contactDoc.id} (${name}): ${colors.join(', ')}`);

      if (!DRY_RUN) {
        try {
          await db
            .collection('profiles')
            .doc(userId)
            .collection('contacts')
            .doc(contactDoc.id)
            .update({ backgroundColors: colors });
          console.log(`      ✅ Updated`);
        } catch (err) {
          console.error(`      ❌ Error:`, err);
          contactsErrors++;
          continue;
        }
      }

      contactsBackfilled++;
    }
  }

  console.log(`\n📊 Saved Contacts Summary${DRY_RUN ? ' (DRY RUN)' : ''}:`);
  console.log(`   Total contacts:       ${totalContacts}`);
  console.log(`   Already had colors:   ${contactsAlreadyHasColors}`);
  console.log(`   Backfilled:           ${contactsBackfilled}`);
  console.log(`   No name (skipped):    ${contactsNoName}`);
  console.log(`   Errors:               ${contactsErrors}`);
  console.log('');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

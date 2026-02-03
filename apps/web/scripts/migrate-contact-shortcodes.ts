/**
 * Migration: Backfill shortCode on saved contacts
 *
 * For each contact in profiles/{userId}/contacts subcollections:
 *   - If missing shortCode, look up profiles/{contact.userId}.shortCode and copy it over
 *
 * Run migrate-shortcodes.ts first so all profiles have shortCodes.
 *
 * Usage:
 *   npx tsx scripts/migrate-contact-shortcodes.ts --dry-run
 *   npx tsx scripts/migrate-contact-shortcodes.ts
 */

import { getFirebaseAdmin } from '../src/server/config/firebase';

const DRY_RUN = process.argv.includes('--dry-run');

// Cache profile shortCodes to avoid repeated reads
const shortCodeCache = new Map<string, string | null>();

async function getShortCode(db: FirebaseFirestore.Firestore, userId: string): Promise<string | null> {
  if (shortCodeCache.has(userId)) return shortCodeCache.get(userId)!;

  const doc = await db.collection('profiles').doc(userId).get();
  const code = (doc.data()?.shortCode as string) || null;
  shortCodeCache.set(userId, code);
  return code;
}

async function main() {
  console.log(`\n🔄 Starting contact shortCode migration${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);

  const { db } = await getFirebaseAdmin();
  const profilesSnap = await db.collection('profiles').get();

  let totalContacts = 0;
  let alreadyHasCode = 0;
  let updated = 0;
  let noProfileCode = 0;
  let errors = 0;

  for (const profileDoc of profilesSnap.docs) {
    const ownerId = profileDoc.id;
    const contactsSnap = await db.collection('profiles').doc(ownerId).collection('contacts').get();

    for (const contactDoc of contactsSnap.docs) {
      totalContacts++;
      const data = contactDoc.data();

      if (data.shortCode) {
        alreadyHasCode++;
        continue;
      }

      const contactUserId = data.userId as string;
      if (!contactUserId) {
        console.log(`  ⚠️  ${ownerId}/contacts/${contactDoc.id}: no userId field`);
        errors++;
        continue;
      }

      const shortCode = await getShortCode(db, contactUserId);

      if (!shortCode) {
        noProfileCode++;
        console.log(`  ⚠️  ${ownerId}/contacts/${contactDoc.id}: profile ${contactUserId} has no shortCode`);
        continue;
      }

      console.log(`  📌 ${ownerId}/contacts/${contactDoc.id}: setting shortCode=${shortCode}`);

      if (!DRY_RUN) {
        try {
          await contactDoc.ref.update({ shortCode });
          updated++;
        } catch (err) {
          console.error(`      ❌ Error:`, err);
          errors++;
        }
      } else {
        updated++;
      }
    }
  }

  console.log(`\n📊 Summary${DRY_RUN ? ' (DRY RUN)' : ''}:`);
  console.log(`   Total contacts:       ${totalContacts}`);
  console.log(`   Already had code:     ${alreadyHasCode}`);
  console.log(`   Updated:              ${updated}`);
  console.log(`   Profile missing code: ${noProfileCode}`);
  console.log(`   Errors:               ${errors}`);
  console.log('');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

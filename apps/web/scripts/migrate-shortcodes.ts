/**
 * Migration: Backfill shortCodes on all profiles
 *
 * For each profile missing a shortCode:
 *   - Generate one, write to shortCodes collection + update profile
 * For profiles that already have a shortCode:
 *   - Verify the shortCodes reverse index exists, create if missing
 *
 * Usage:
 *   npx tsx scripts/migrate-shortcodes.ts --dry-run
 *   npx tsx scripts/migrate-shortcodes.ts
 */

import { getFirebaseAdmin } from '../src/server/config/firebase';

const DRY_RUN = process.argv.includes('--dry-run');

function generateShortCode(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

async function main() {
  console.log(`\n🔄 Starting shortCode migration${DRY_RUN ? ' (DRY RUN)' : ''}...\n`);

  const { db } = await getFirebaseAdmin();
  const profilesSnap = await db.collection('profiles').get();

  let totalProfiles = 0;
  let alreadyHasCode = 0;
  let missingCode = 0;
  let indexMissing = 0;
  let errors = 0;

  for (const doc of profilesSnap.docs) {
    totalProfiles++;
    const userId = doc.id;
    const data = doc.data();
    const existingCode = data.shortCode as string | undefined;

    if (existingCode) {
      alreadyHasCode++;

      // Verify reverse-index entry exists
      const indexDoc = await db.collection('shortCodes').doc(existingCode).get();
      if (!indexDoc.exists) {
        indexMissing++;
        console.log(`  ⚠️  ${userId}: reverse index missing for ${existingCode}`);
        if (!DRY_RUN) {
          await db.collection('shortCodes').doc(existingCode).set({ userId });
          console.log(`      ✅ Created reverse index`);
        }
      }
    } else {
      missingCode++;

      // Generate + reserve a new shortCode
      const MAX_ATTEMPTS = 5;
      let reserved = false;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const code = generateShortCode();
        const ref = db.collection('shortCodes').doc(code);
        const existing = await ref.get();

        if (existing.exists) {
          console.log(`  🔁 Collision on ${code}, retrying...`);
          continue;
        }

        console.log(`  📌 ${userId}: assigning ${code}`);

        if (!DRY_RUN) {
          try {
            await db.runTransaction(async (tx) => {
              const check = await tx.get(ref);
              if (check.exists) throw new Error('COLLISION');
              tx.set(ref, { userId });
              tx.update(db.collection('profiles').doc(userId), { shortCode: code });
            });
            console.log(`      ✅ Done`);
          } catch (err) {
            if ((err as Error).message === 'COLLISION') {
              console.log(`  🔁 Transaction collision on ${code}, retrying...`);
              continue;
            }
            console.error(`      ❌ Error:`, err);
            errors++;
          }
        }

        reserved = true;
        break;
      }

      if (!reserved) {
        console.error(`  ❌ ${userId}: failed to reserve shortCode after ${MAX_ATTEMPTS} attempts`);
        errors++;
      }
    }
  }

  console.log(`\n📊 Summary${DRY_RUN ? ' (DRY RUN)' : ''}:`);
  console.log(`   Total profiles:       ${totalProfiles}`);
  console.log(`   Already had code:     ${alreadyHasCode}`);
  console.log(`   Missing code:         ${missingCode}`);
  console.log(`   Reverse index fixed:  ${indexMissing}`);
  console.log(`   Errors:               ${errors}`);
  console.log('');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

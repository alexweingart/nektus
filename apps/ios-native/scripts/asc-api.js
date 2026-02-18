#!/usr/bin/env node

// ─────────────────────────────────────────────────────────────────
// App Store Connect API — Direct API calls for fields EAS can't set
// Sets: Copyright, Age Rating, App Clip Experience + Header Image
//
// Usage:
//   node scripts/asc-api.js <command>
//
// Commands:
//   test              Test API connection
//   set-copyright     Set copyright string
//   set-age-rating    Set age rating (all None = 4+)
//   set-app-clip      Configure default App Clip experience
//   set-clip-image    Generate & upload App Clip header image
//   set-clip-review   Set App Clip review invocation URLs
//   all               Run all of the above
// ─────────────────────────────────────────────────────────────────

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Config from environment
const KEY_ID = process.env.ASC_KEY_ID;
const ISSUER_ID = process.env.ASC_ISSUER_ID;
const KEY_PATH = (process.env.ASC_KEY_PATH || '').replace('~', process.env.HOME);
const APP_ID = '6756943273'; // Nekt app ID from eas.json

const APP_CLIP_SUBTITLE = 'Exchange contacts & socials instantly';

if (!KEY_ID || !ISSUER_ID || !KEY_PATH) {
  console.error('Missing ASC_KEY_ID, ASC_ISSUER_ID, or ASC_KEY_PATH in environment');
  console.error('Source .env.local first: source .env.local && export ASC_KEY_ID ASC_ISSUER_ID ASC_KEY_PATH');
  process.exit(1);
}

// ─── JWT Generation ───

function generateJWT() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: KEY_ID, typ: 'JWT' };
  const payload = { iss: ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' };

  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const signingInput = `${headerB64}.${payloadB64}`;

  const privateKey = crypto.createPrivateKey(fs.readFileSync(KEY_PATH, 'utf8'));
  const signature = crypto.sign('SHA256', Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363', // raw r||s format (no DER conversion needed)
  });
  const signatureB64 = signature.toString('base64url');

  return `${signingInput}.${signatureB64}`;
}

// ─── HTTP Client ───

function apiCall(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const token = generateJWT();
    const options = {
      hostname: 'api.appstoreconnect.apple.com',
      path: urlPath,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const parsed = data ? JSON.parse(data) : {};
        if (res.statusCode >= 400) {
          reject({ status: res.statusCode, errors: parsed.errors || parsed });
        } else {
          resolve({ status: res.statusCode, data: parsed });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Raw HTTP PUT for upload operations (supports both http and https)
function httpPut(url, headers, bodyBuffer) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Length': bodyBuffer.length,
      },
    };

    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.write(bodyBuffer);
    req.end();
  });
}

// ─── Commands ───

async function testConnection() {
  console.log('→ Testing API connection...');
  const res = await apiCall('GET', `/v1/apps/${APP_ID}`);
  const name = res.data.data?.attributes?.name;
  console.log(`  ✓ Connected! App: ${name} (${APP_ID})`);
  return res;
}

async function setCopyright() {
  console.log('→ Setting copyright...');

  // Get appInfos for the app
  const infosRes = await apiCall('GET', `/v1/apps/${APP_ID}/appInfos`);
  const appInfoId = infosRes.data.data?.[0]?.id;
  if (!appInfoId) throw new Error('No appInfo found');

  // Get appInfoLocalizations
  const locsRes = await apiCall('GET', `/v1/appInfos/${appInfoId}/appInfoLocalizations`);
  const enLoc = locsRes.data.data?.find(l => l.attributes.locale === 'en-US');

  if (!enLoc) throw new Error('No en-US localization found');

  // Copyright is on the appStoreVersion, not appInfo
  const versionsRes = await apiCall('GET', `/v1/apps/${APP_ID}/appStoreVersions?filter[appStoreState]=PREPARE_FOR_SUBMISSION,READY_FOR_SALE`);
  const version = versionsRes.data.data?.[0];
  if (!version) throw new Error('No editable app store version found');

  // Update copyright on the version
  await apiCall('PATCH', `/v1/appStoreVersions/${version.id}`, {
    data: {
      type: 'appStoreVersions',
      id: version.id,
      attributes: {
        copyright: '2025 Alexander Weingart',
      },
    },
  });

  console.log('  ✓ Copyright set: "2025 Alexander Weingart"');
}

async function setAgeRating() {
  console.log('→ Setting age rating (4+)...');

  // Get the current app store version
  const versionsRes = await apiCall('GET', `/v1/apps/${APP_ID}/appStoreVersions?filter[appStoreState]=PREPARE_FOR_SUBMISSION,READY_FOR_SALE`);
  const version = versionsRes.data.data?.[0];
  if (!version) throw new Error('No editable app store version found');

  // Get the age rating declaration
  const arRes = await apiCall('GET', `/v1/appStoreVersions/${version.id}/ageRatingDeclaration`);
  const arId = arRes.data.data?.id;
  if (!arId) throw new Error('No age rating declaration found');

  // Set all to NONE / false
  await apiCall('PATCH', `/v1/ageRatingDeclarations/${arId}`, {
    data: {
      type: 'ageRatingDeclarations',
      id: arId,
      attributes: {
        alcoholTobaccoOrDrugUseOrReferences: 'NONE',
        contests: 'NONE',
        gamblingSimulated: 'NONE',
        gunsOrOtherWeapons: 'NONE',
        horrorOrFearThemes: 'NONE',
        matureOrSuggestiveThemes: 'NONE',
        medicalOrTreatmentInformation: 'NONE',
        profanityOrCrudeHumor: 'NONE',
        sexualContentGraphicAndNudity: 'NONE',
        sexualContentOrNudity: 'NONE',
        violenceCartoonOrFantasy: 'NONE',
        violenceRealistic: 'NONE',
        violenceRealisticProlongedGraphicOrSadistic: 'NONE',
        advertising: false,
        ageAssurance: false,
        gambling: false,
        healthOrWellnessTopics: false,
        lootBox: false,
        messagingAndChat: true,
        parentalControls: false,
        unrestrictedWebAccess: false,
        userGeneratedContent: true,
      },
    },
  });

  console.log('  ✓ Age rating set to 4+ (all None)');
}

// Helper to get the App Clip localization ID (used by both subtitle and image commands)
async function getAppClipLocalization() {
  const clipsRes = await apiCall('GET', `/v1/apps/${APP_ID}/appClips`);
  const appClip = clipsRes.data.data?.[0];
  if (!appClip) throw new Error('No App Clip found. Upload a build with an App Clip target first.');

  console.log(`  Found App Clip: ${appClip.attributes.bundleId}`);

  const expRes = await apiCall('GET', `/v1/appClips/${appClip.id}/appClipDefaultExperiences`);
  const exp = expRes.data.data?.[0];
  if (!exp) throw new Error('No default App Clip experience found. Run set-app-clip first.');

  const locsRes = await apiCall('GET', `/v1/appClipDefaultExperiences/${exp.id}/appClipDefaultExperienceLocalizations`);
  const enLoc = locsRes.data.data?.find(l => l.attributes.locale === 'en-US');
  if (!enLoc) throw new Error('No en-US localization found for App Clip experience.');

  return { appClip, exp, enLoc };
}

async function setAppClipExperience() {
  console.log('→ Configuring App Clip experience...');

  const clipsRes = await apiCall('GET', `/v1/apps/${APP_ID}/appClips`);
  const appClip = clipsRes.data.data?.[0];

  if (!appClip) {
    console.log('  ⚠ No App Clip found. Upload a build with an App Clip target first.');
    return;
  }

  console.log(`  Found App Clip: ${appClip.attributes.bundleId}`);

  // Check for existing default experience
  const expRes = await apiCall('GET', `/v1/appClips/${appClip.id}/appClipDefaultExperiences`);
  const existingExp = expRes.data.data?.[0];

  if (existingExp) {
    console.log(`  Default experience already exists (${existingExp.id})`);
    // Update localization
    const locsRes = await apiCall('GET', `/v1/appClipDefaultExperiences/${existingExp.id}/appClipDefaultExperienceLocalizations`);
    const enLoc = locsRes.data.data?.find(l => l.attributes.locale === 'en-US');

    if (enLoc) {
      await apiCall('PATCH', `/v1/appClipDefaultExperienceLocalizations/${enLoc.id}`, {
        data: {
          type: 'appClipDefaultExperienceLocalizations',
          id: enLoc.id,
          attributes: {
            subtitle: APP_CLIP_SUBTITLE,
          },
        },
      });
      console.log(`  ✓ Updated App Clip subtitle: "${APP_CLIP_SUBTITLE}"`);
    }

    // Update action
    await apiCall('PATCH', `/v1/appClipDefaultExperiences/${existingExp.id}`, {
      data: {
        type: 'appClipDefaultExperiences',
        id: existingExp.id,
        attributes: {
          action: 'OPEN',
        },
      },
    });
    console.log('  ✓ Updated App Clip action to "Open"');
  } else {
    // Create default experience
    const createRes = await apiCall('POST', '/v1/appClipDefaultExperiences', {
      data: {
        type: 'appClipDefaultExperiences',
        attributes: {
          action: 'OPEN',
        },
        relationships: {
          appClip: { data: { type: 'appClips', id: appClip.id } },
        },
      },
    });
    const newExpId = createRes.data.data?.id;

    // Create the localization separately
    if (newExpId) {
      await apiCall('POST', '/v1/appClipDefaultExperienceLocalizations', {
        data: {
          type: 'appClipDefaultExperienceLocalizations',
          attributes: {
            locale: 'en-US',
            subtitle: APP_CLIP_SUBTITLE,
          },
          relationships: {
            appClipDefaultExperience: {
              data: { type: 'appClipDefaultExperiences', id: newExpId },
            },
          },
        },
      });
    }
    console.log(`  ✓ Created default App Clip experience with subtitle: "${APP_CLIP_SUBTITLE}"`);
  }
}

async function setAppClipImage() {
  console.log('→ Generating & uploading App Clip header image...');

  // Generate the 1800x1200 image from OG source
  const sharp = require('sharp');
  const ogImagePath = path.resolve(__dirname, '../../web/public/og-image.png');
  const outputPath = path.resolve(__dirname, '../assets/app-clip-card.png');

  if (!fs.existsSync(ogImagePath)) {
    throw new Error(`OG image not found at ${ogImagePath}`);
  }

  // Resize OG image (1536x1024) to App Clip card size (1800x1200)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await sharp(ogImagePath)
    .resize(1800, 1200, { fit: 'cover' })
    .png()
    .toFile(outputPath);

  console.log('  ✓ Generated 1800x1200 App Clip card image');

  // Get App Clip localization
  const { enLoc } = await getAppClipLocalization();

  // Check for existing header image and delete it
  try {
    const existingRes = await apiCall('GET', `/v1/appClipDefaultExperienceLocalizations/${enLoc.id}/appClipHeaderImage`);
    const existingImage = existingRes.data.data;
    if (existingImage) {
      console.log('  Deleting existing header image...');
      await apiCall('DELETE', `/v1/appClipHeaderImages/${existingImage.id}`);
      console.log('  ✓ Deleted old header image');
    }
  } catch (e) {
    // No existing image, that's fine
  }

  // Step 1: Reserve image slot
  const imageBuffer = fs.readFileSync(outputPath);
  const reserveRes = await apiCall('POST', '/v1/appClipHeaderImages', {
    data: {
      type: 'appClipHeaderImages',
      attributes: {
        fileName: 'app-clip-card.png',
        fileSize: imageBuffer.length,
      },
      relationships: {
        appClipDefaultExperienceLocalization: {
          data: {
            type: 'appClipDefaultExperienceLocalizations',
            id: enLoc.id,
          },
        },
      },
    },
  });

  const imageResource = reserveRes.data.data;
  const uploadOps = imageResource.attributes.uploadOperations;
  console.log(`  ✓ Reserved image slot (${uploadOps.length} upload operation(s))`);

  // Step 2: Upload binary data via upload operations
  for (const op of uploadOps) {
    const chunk = imageBuffer.slice(op.offset, op.offset + op.length);
    const headers = {};
    for (const h of op.requestHeaders) {
      headers[h.name] = h.value;
    }
    const uploadRes = await httpPut(op.url, headers, chunk);
    if (uploadRes.status >= 400) {
      throw new Error(`Upload failed with status ${uploadRes.status}: ${uploadRes.data}`);
    }
  }
  console.log('  ✓ Uploaded image data');

  // Step 3: Commit the upload
  const checksum = crypto.createHash('md5').update(imageBuffer).digest('hex');
  await apiCall('PATCH', `/v1/appClipHeaderImages/${imageResource.id}`, {
    data: {
      type: 'appClipHeaderImages',
      id: imageResource.id,
      attributes: {
        sourceFileChecksum: checksum,
        uploaded: true,
      },
    },
  });
  console.log('  ✓ Committed App Clip header image upload');
}

async function setAppClipReviewUrls() {
  console.log('→ Setting App Clip review invocation URLs...');

  const { exp } = await getAppClipLocalization();

  const invocationUrls = [
    'https://nekt.us/x/demo',
    'https://nekt.us/x/',
  ];

  // Check for existing review detail
  let reviewDetail;
  try {
    const res = await apiCall('GET', `/v1/appClipDefaultExperiences/${exp.id}/appClipAppStoreReviewDetail`);
    reviewDetail = res.data.data;
  } catch (e) {
    // No existing review detail
  }

  if (reviewDetail) {
    await apiCall('PATCH', `/v1/appClipAppStoreReviewDetails/${reviewDetail.id}`, {
      data: {
        type: 'appClipAppStoreReviewDetails',
        id: reviewDetail.id,
        attributes: { invocationUrls },
      },
    });
    console.log('  ✓ Updated review invocation URLs');
  } else {
    await apiCall('POST', '/v1/appClipAppStoreReviewDetails', {
      data: {
        type: 'appClipAppStoreReviewDetails',
        attributes: { invocationUrls },
        relationships: {
          appClipDefaultExperience: {
            data: { type: 'appClipDefaultExperiences', id: exp.id },
          },
        },
      },
    });
    console.log('  ✓ Created review invocation URLs');
  }

  for (const url of invocationUrls) {
    console.log(`    - ${url}`);
  }
}

// ─── Main ───

async function main() {
  const command = process.argv[2] || 'all';

  try {
    switch (command) {
      case 'test':
        await testConnection();
        break;
      case 'set-copyright':
        await setCopyright();
        break;
      case 'set-age-rating':
        await setAgeRating();
        break;
      case 'set-app-clip':
        await setAppClipExperience();
        break;
      case 'set-clip-image':
        await setAppClipImage();
        break;
      case 'set-clip-review':
        await setAppClipReviewUrls();
        break;
      case 'all':
        await testConnection();
        await setCopyright();
        await setAgeRating();
        await setAppClipExperience();
        await setAppClipImage();
        await setAppClipReviewUrls();
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Commands: test, set-copyright, set-age-rating, set-app-clip, set-clip-image, set-clip-review, all');
        process.exit(1);
    }
    console.log('\n✓ Done!');
  } catch (err) {
    console.error('\n✖ Error:', err.errors || err.message || err);
    process.exit(1);
  }
}

main();

const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────
// Composite raw simulator screenshots into App Store marketing images.
// Adds dark gradient background + bold caption text above the screenshot.
//
// Usage:
//   node composite-screenshots.js [--device=promax|pro]
//
// Reads from:  screenshots/raw/<slug>_<device>.png
// Writes to:   screenshots/final/<device>/<slug>.png
// ─────────────────────────────────────────────────────────────────

// Register SF Pro Display Bold
const fontPath = '/Library/Fonts/SF-Pro-Display-Bold.otf';
if (fs.existsSync(fontPath)) {
  registerFont(fontPath, { family: 'SF Pro Display', weight: 'bold' });
}

// Device configs
const DEVICES = {
  promax: { name: 'iPhone 16 Pro Max', width: 1320, height: 2868 },
  pro:    { name: 'iPhone 16 Pro',     width: 1206, height: 2622 },
};

// Screenshot definitions
const SCREENSHOTS = [
  { slug: '01-profile',        caption: 'Share Who You Are' },
  { slug: '02-exchange',       caption: 'Bump to Connect' },
  { slug: '03-appclip',        caption: 'Connect Without the App' },
  { slug: '04-contact',        caption: 'Save Contact & Text Instantly' },
  { slug: '05-history',        caption: 'Keep Every Connection' },
  { slug: '06-smart-schedule', caption: 'Find Time to Meet' },
  { slug: '07-ai-schedule',    caption: 'Let AI Plan It' },
];

// Design
const BG_DARK  = { r: 10, g: 15, b: 26 };   // #0a0f1a
const BG_GREEN = { r: 20, g: 88, b: 53 };    // #145835

function lerp(a, b, t) { return a + (b - a) * t; }

function mixColors(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  return {
    r: Math.round(lerp(a.r, b.r, t)),
    g: Math.round(lerp(a.g, b.g, t)),
    b: Math.round(lerp(a.b, b.b, t)),
  };
}

function drawGradientBackground(ctx, width, height) {
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);
    // Symmetric: dark → green → dark
    const color = t <= 0.5
      ? mixColors(BG_DARK, BG_GREEN, t / 0.5)
      : mixColors(BG_GREEN, BG_DARK, (t - 0.5) / 0.5);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i]     = color.r;
      data[i + 1] = color.g;
      data[i + 2] = color.b;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function compositeScreenshot(rawPath, caption, outputPath, device) {
  const { width, height } = device;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 1. Draw gradient background
  drawGradientBackground(ctx, width, height);

  // 2. Load and place screenshot (bottom 80%, with padding)
  const textRegionHeight = Math.round(height * 0.18);
  const padding = Math.round(width * 0.04);
  const cornerRadius = Math.round(width * 0.03);

  const ssMaxWidth = width - padding * 2;
  const ssMaxHeight = height - textRegionHeight - padding * 1.5;

  const rawImage = await loadImage(rawPath);
  const rawAspect = rawImage.width / rawImage.height;

  let drawW, drawH;
  if (ssMaxWidth / ssMaxHeight > rawAspect) {
    drawH = ssMaxHeight;
    drawW = drawH * rawAspect;
  } else {
    drawW = ssMaxWidth;
    drawH = drawW / rawAspect;
  }

  const drawX = (width - drawW) / 2;
  const drawY = height - drawH - padding;

  // Draw screenshot with rounded corners
  ctx.save();
  roundRect(ctx, drawX, drawY, drawW, drawH, cornerRadius);
  ctx.clip();
  ctx.drawImage(rawImage, drawX, drawY, drawW, drawH);
  ctx.restore();

  // 3. Draw caption text
  const fontSize = Math.round(height * 0.035);
  ctx.font = `bold ${fontSize}px "SF Pro Display", "Helvetica Neue", Arial`;
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(caption, width / 2, textRegionHeight * 0.55);

  // 4. Save
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`  ✓ ${path.basename(outputPath)}`);
}

async function main() {
  const args = process.argv.slice(2);
  const deviceKey = args.find(a => a.startsWith('--device='))?.split('=')[1] || 'promax';
  const device = DEVICES[deviceKey];

  if (!device) {
    console.error(`Unknown device: ${deviceKey}. Use --device=promax or --device=pro`);
    process.exit(1);
  }

  const scriptsDir = __dirname;
  const projectDir = path.dirname(scriptsDir);
  const rawDir = path.join(projectDir, 'screenshots', 'raw');
  const finalDir = path.join(projectDir, 'screenshots', 'final', device.name);

  fs.mkdirSync(finalDir, { recursive: true });

  console.log(`\nCompositing screenshots for ${device.name} (${device.width}x${device.height})\n`);

  let composited = 0;
  let skipped = 0;

  for (const { slug, caption } of SCREENSHOTS) {
    const rawFile = path.join(rawDir, `${slug}_${device.name.replace(/ /g, '-')}.png`);
    const finalFile = path.join(finalDir, `${slug}.png`);

    if (!fs.existsSync(rawFile)) {
      console.log(`  ⚠ Missing: ${path.basename(rawFile)} — skipping`);
      skipped++;
      continue;
    }

    await compositeScreenshot(rawFile, caption, finalFile, device);
    composited++;
  }

  console.log(`\nDone! ${composited} composited, ${skipped} skipped.`);
  console.log(`Output: ${finalDir}/\n`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

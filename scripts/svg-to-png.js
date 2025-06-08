const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Ensure the sharp package is installed
// If not available, this script will fail and we'll need to install it

const inputPath = path.join(__dirname, '../public/favicon.svg');

// Convert favicon.svg to favicon.png (192x192)
const faviconImage = sharp(inputPath)
  .resize(192, 192)
  .png();

faviconImage
  .toFile(path.join(__dirname, '../public/favicon.png'), (err) => {
    if (err) throw err;
    console.log('favicon.png (192x192) created successfully');
  });

// Convert favicon.svg to nektus-logo-pwa-192x192.png
const resizeImage = sharp(inputPath)
  .resize(192, 192)
  .png();

resizeImage
  .toFile(path.join(__dirname, '../public/pwa/nektus-logo-pwa-192x192.png'), (err) => {
    if (err) throw err;
    console.log('nektus-logo-pwa-192x192.png created successfully');
  });

// Convert favicon.svg to nektus-logo-pwa-512x512.png
const resizeImage512 = sharp(inputPath)
  .resize(512, 512)
  .png();

resizeImage512
  .toFile(path.join(__dirname, '../public/pwa/nektus-logo-pwa-512x512.png'), (err) => {
    if (err) throw err;
    console.log('nektus-logo-pwa-512x512.png created successfully');
  });

// Copy SVG as nektus-logo-pwa-192x192.svg
fs.copyFileSync(inputPath, path.join(__dirname, '../public/pwa/nektus-logo-pwa-192x192.svg'));
console.log('nektus-logo-pwa-192x192.svg created successfully');

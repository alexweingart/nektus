const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Ensure the sharp package is installed
// If not available, this script will fail and we'll need to install it

const inputPath = path.join(__dirname, '../public/favicon.svg');

// Convert favicon.svg to nektus-logo-pwa-192x192.png
const faviconImage = sharp(inputPath)
  .resize(192, 192)
  .png();

faviconImage
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


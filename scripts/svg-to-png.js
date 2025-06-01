const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Ensure the sharp package is installed
// If not available, this script will fail and we'll need to install it

// Convert favicon.svg to favicon.png (192x192)
fs.readFile(path.join(__dirname, '../public/favicon.svg'), (err, data) => {
  if (err) throw err;
  
  sharp(data)
    .resize(192, 192)
    .toFile(path.join(__dirname, '../public/favicon.png'), (err) => {
      if (err) throw err;
      console.log('favicon.png (192x192) created successfully');
    });
});

// Convert favicon.svg to icon-192x192.png
fs.readFile(path.join(__dirname, '../public/favicon.svg'), (err, data) => {
  if (err) throw err;
  
  sharp(data)
    .resize(192, 192)
    .toFile(path.join(__dirname, '../public/icons/icon-192x192.png'), (err) => {
      if (err) throw err;
      console.log('icon-192x192.png created successfully');
    });
});

// Convert favicon.svg to icon-512x512.png
fs.readFile(path.join(__dirname, '../public/favicon.svg'), (err, data) => {
  if (err) throw err;
  
  sharp(data)
    .resize(512, 512)
    .toFile(path.join(__dirname, '../public/icons/icon-512x512.png'), (err) => {
      if (err) throw err;
      console.log('icon-512x512.png created successfully');
    });
});

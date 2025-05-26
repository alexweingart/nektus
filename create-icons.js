const fs = require('fs');
const path = require('path');

// Define the paths to the icon files
const smallIconPath = path.join(__dirname, 'public', 'icons', 'icon-192x192.png');
const largeIconPath = path.join(__dirname, 'public', 'icons', 'icon-512x512.png');

// Get source image - using a local image from the project
const defaultAvatarPath = path.join(__dirname, 'public', 'default-avatar.png');

// Simple copy approach since we can't resize easily without libraries
try {
  // Copy the default avatar to both icon locations
  fs.copyFileSync(defaultAvatarPath, smallIconPath);
  fs.copyFileSync(defaultAvatarPath, largeIconPath);
  
  console.log('Icons created successfully:');
  console.log(`- ${smallIconPath}`);
  console.log(`- ${largeIconPath}`);
} catch (error) {
  console.error('Error creating icons:', error);
}

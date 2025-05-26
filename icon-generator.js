const fs = require('fs');
const path = require('path');
const https = require('https');

// Define the URL of a default icon to use
const iconUrl = 'https://raw.githubusercontent.com/nextui-org/nextui/main/apps/docs/public/favicon.png';
const iconsDir = path.join(__dirname, 'public', 'icons');

// Ensure the icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Download the icon
const download = (url, filePath) => {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download icon: ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(filePath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`Downloaded to ${filePath}`);
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.unlink(filePath, () => {}); // Delete the file on error
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
};

// Download icons
async function downloadIcons() {
  try {
    await download(iconUrl, path.join(iconsDir, 'icon-192x192.png'));
    await download(iconUrl, path.join(iconsDir, 'icon-512x512.png'));
    console.log('Icons downloaded successfully');
  } catch (error) {
    console.error('Error downloading icons:', error);
  }
}

downloadIcons();

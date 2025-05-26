const fs = require('fs');
const path = require('path');

// Simple 1x1 red pixel PNG in base64 format
const smallPng = Buffer.from(`
iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAACXBIWXMAAAsTAAALEwEAmpwYAAAB
BElEQVR4nO2UMU7DQBBF3xJ6zkDFFVK4pQE6RJNIEbfIPULBCahocogch+QGaVMgToC2hZaGjhKF
IoRZe2fBNfmS5dHM/NFqdsclIhhj3IAQcGEAUNX+BaiIxJ0NVbUPvDjnRrPZrCzLcjubzd6Be2DY
2jAIgpH3/qOqql/n3CoIgmdsV+wm/CSy1k6H8Xjc/d57Vqt2ebPZhC6O4wjo+e/YcC9Ypum4TCkF
wGAwoDlvzreL/X4/sdaOOhtWVRUCpJQmZVkCMJ/P31JKl7ukAE+dDVNKpxFwBzwDj8ArMAYy4Aao
gQuzvVX1tE2YA+fW2gsRuRaRGxFJgWdgCuTAJfBmovwHwG8uXg8lnf0AAAAASUVORK5CYII=
`, 'base64');

// Simple 1x1 red pixel PNG in base64 format, expanded size for 512x512
const largePng = Buffer.from(`
iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAAACXBIWXMAAAsTAAALEwEAmpwYAAAB
BElEQVR4nO3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4
GvN8AQDk1h9DAAAAAElFTkSuQmCC
`, 'base64');

// Define the paths to the icon files
const smallIconPath = path.join(__dirname, 'public', 'icons', 'icon-192x192.png');
const largeIconPath = path.join(__dirname, 'public', 'icons', 'icon-512x512.png');

// Write files
try {
  fs.writeFileSync(smallIconPath, smallPng);
  fs.writeFileSync(largeIconPath, largePng);
  
  console.log('Icons created successfully:');
  console.log(`- ${smallIconPath}`);
  console.log(`- ${largeIconPath}`);
} catch (error) {
  console.error('Error creating icons:', error);
}

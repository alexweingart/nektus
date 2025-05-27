const fs = require('fs');
const { createCanvas } = require('canvas');

// Create a canvas
const canvas = createCanvas(192, 192);
const ctx = canvas.getContext('2d');

// Draw a simple gradient background
const gradient = ctx.createLinearGradient(0, 0, 192, 192);
gradient.addColorStop(0, '#4f46e5');
gradient.addColorStop(1, '#7c3aed');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 192, 192);

// Add text
ctx.fillStyle = '#ffffff';
ctx.font = 'bold 48px sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('N', 96, 96);

// Save as PNG
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('public/icons/icon-192x192.png', buffer);
console.log('Created new 192x192 icon');

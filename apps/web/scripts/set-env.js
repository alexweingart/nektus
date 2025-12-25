#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get command line arguments
const args = process.argv.slice(2);
const protocol = args.includes('--https') ? 'https' : 'http';
let host = 'localhost';

if (args.includes('--ip')) {
  console.warn('⚠️  Warning: Google OAuth does not allow IP addresses in redirect URIs.');
  console.warn('   Consider using --local-domain instead or adding to /etc/hosts:');
  console.warn('   192.168.86.241 local.nekt.us');
  host = '192.168.86.241';
} else if (args.includes('--local-domain')) {
  host = 'local.nekt.us';
}

const port = args.find(arg => arg.startsWith('--port='))?.split('=')[1] || '3000';
const nextauthUrl = `${protocol}://${host}:${port}`;

// Read current .env.local
const envPath = path.join(__dirname, '..', '.env.local');
let envContent = fs.readFileSync(envPath, 'utf8');

// Update NEXTAUTH_URL
envContent = envContent.replace(
  /NEXTAUTH_URL=.*/,
  `NEXTAUTH_URL=${nextauthUrl}`
);

// Write back to file
fs.writeFileSync(envPath, envContent);

console.log(`✅ Updated NEXTAUTH_URL to: ${nextauthUrl}`);
if (host === '192.168.86.241') {
  console.log(`❌ Cannot add IP address to Google Console`);
  console.log(`   For network testing, add to /etc/hosts: 192.168.86.241 local.nekt.us`);
  console.log(`   Then use: ${protocol}://local.nekt.us:${port}/api/auth/callback/google`);
} else {
  console.log(`   Add this to Google Console: ${nextauthUrl}/api/auth/callback/google`);
}

#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Function to update .env.local with ngrok URL
function updateEnvWithNgrokUrl(ngrokUrl) {
  const envPath = path.join(__dirname, '..', '.env.local');
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Update NEXTAUTH_URL
  envContent = envContent.replace(
    /NEXTAUTH_URL=.*/,
    `NEXTAUTH_URL=${ngrokUrl}`
  );
  
  fs.writeFileSync(envPath, envContent);
  console.log(`✅ Updated NEXTAUTH_URL to: ${ngrokUrl}`);
  console.log(`🔗 Add this to Google Console: ${ngrokUrl}/api/auth/callback/google`);
}

// Function to extract ngrok URL from output
function extractNgrokUrl(output) {
  // First try to match the specific domain we're using
  const bedbugMatch = output.match(/https:\/\/bedbug-fond-pleasantly\.ngrok-free\.app/);
  if (bedbugMatch) return bedbugMatch[0];

  // Fallback to any ngrok URL
  const httpsMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.ngrok-free\.app/);
  return httpsMatch ? httpsMatch[0] : null;
}

// Start ngrok tunnel
console.log('🚀 Starting ngrok tunnel...');
const ngrok = spawn('ngrok', ['http', '3000', '--domain=bedbug-fond-pleasantly.ngrok-free.app', '--log', 'stdout'], { stdio: ['pipe', 'pipe', 'pipe'] });

let urlFound = false;

ngrok.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(output);
  
  if (!urlFound) {
    const ngrokUrl = extractNgrokUrl(output);
    if (ngrokUrl) {
      urlFound = true;
      updateEnvWithNgrokUrl(ngrokUrl);
    }
  }
});

ngrok.stderr.on('data', (data) => {
  console.error(`Error: ${data}`);
});

ngrok.on('close', (code) => {
  console.log(`ngrok process exited with code ${code}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down ngrok...');
  ngrok.kill();
  process.exit();
});

#!/usr/bin/env node

/**
 * Simplified pre-deployment check script for Nekt.Us
 * This script runs basic checks before deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Running simplified pre-deployment checks for Nekt.Us...');

// Check critical files exist
const requiredFiles = [
  'next.config.js',
  'package.json',
  'src/app/layout.tsx',
  'src/app/page.tsx'
];

console.log('✓ Checking required files...');
requiredFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    console.error(`❌ Missing required file: ${file}`);
    process.exit(1);
  }
  console.log(`   ✓ Found ${file}`);
});

// Check package.json has required dependencies
console.log('✓ Checking package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredDeps = ['next', 'react', 'react-dom', 'next-auth'];
  
  requiredDeps.forEach(dep => {
    if (!packageJson.dependencies?.[dep]) {
      console.error(`❌ Missing required dependency: ${dep}`);
      process.exit(1);
    }
    console.log(`   ✓ Found dependency: ${dep}`);
  });
} catch (error) {
  console.error('❌ Error reading package.json:', error.message);
  process.exit(1);
}

// Check environment variables
console.log('✓ Checking environment variables...');
const requiredEnvVars = [
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
];

const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}
console.log('   ✓ All required environment variables are set');

console.log('🚀 All pre-deployment checks passed!');

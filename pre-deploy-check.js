#!/usr/bin/env node

/**
 * Pre-deployment check script for Nekt.Us
 * Validates required files, dependencies, and environment variables
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

console.log('🔍 Running pre-deployment checks for Nekt.Us...');

// 1. Check critical files exist
const requiredFiles = [
  'next.config.js',
  'package.json',
  'src/app/layout.tsx',
  'src/app/page.tsx',
  '.env.local'
];

console.log('✓ Checking required files...');
requiredFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    console.error(`❌ Missing required file: ${file}`);
    process.exit(1);
  }
  console.log(`   ✓ Found ${file}`);
});

// 2. Validate package.json
console.log('\n✓ Checking package.json...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredDeps = ['next', 'react', 'react-dom', 'next-auth', 'firebase'];
  
  requiredDeps.forEach(dep => {
    const hasDep = packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep];
    if (!hasDep) {
      console.error(`❌ Missing required dependency: ${dep}`);
      process.exit(1);
    }
    console.log(`   ✓ Found dependency: ${dep}`);
  });
} catch (error) {
  console.error('❌ Error reading package.json:', error.message);
  process.exit(1);
}

// 3. Validate environment variables
console.log('\n✓ Validating environment variables...');
const requiredEnvVars = [
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
];

const missingVars = [];
const invalidVars = [];

requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    missingVars.push(envVar);
  } else if (process.env[envVar].trim() === '') {
    invalidVars.push(envVar);
  }
});

if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  console.log('   ℹ️  Please check your .env.local file');
  process.exit(1);
}

if (invalidVars.length > 0) {
  console.error(`❌ Empty environment variables found: ${invalidVars.join(', ')}`);
  process.exit(1);
}

// Mask sensitive values for logging
const maskedVars = requiredEnvVars.map(envVar => {
  const value = process.env[envVar] || '';
  const maskedValue = value.length > 8 
    ? `${value.substring(0, 2)}...${value.substring(value.length - 2)}`
    : '***';
  return `${envVar}=${maskedValue}`;
});

console.log('   ✓ All required environment variables are set and valid');
console.log('   ℹ️  Variables found:', maskedVars.join(', '));

console.log('\n🚀 All pre-deployment checks passed!');
console.log('   You can now proceed with the build process.');

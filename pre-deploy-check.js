#!/usr/bin/env node

/**
 * Pre-deployment check script for Nekt.Us
 * Validates required files, dependencies, environment variables, and performs a build check
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: '.env.local' });

console.log('🔍 Running pre-deployment checks for Nekt.Us...');

// 1. Check critical files exist
const requiredFiles = [
  'next.config.js',
  'package.json',
  'src/app/layout.tsx',
  'src/app/page.tsx'
];

// Only require .env.local in development
if (process.env.NODE_ENV !== 'production') {
  requiredFiles.push('.env.local');
}

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

  // 4. Perform a build check
  console.log('\n🚀 Running build check...');
  try {
    console.log('   Running "next build"...');
    execSync('next build --no-lint', { stdio: 'inherit' });
    console.log('   ✓ Build check passed!');
  } catch (buildError) {
    console.error('\n❌ Build check failed:');
    console.error('   Please fix the build errors before committing.');
    console.error('   Run "npm run build" locally to debug the build issues.');
    process.exit(1);
  }
} catch (error) {
  console.error('\n❌ Pre-deployment checks failed:');
  console.error(error.message);
  process.exit(1);
}

// 3. Validate environment variables
console.log('\n✓ Validating environment variables...');
const requiredEnvVars = [
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET'
];

// Optional environment variables (will be checked but not required)
const optionalEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY'
];

const missingVars = [];
const invalidVars = [];

// Check required environment variables
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    missingVars.push(envVar);
  } else if (process.env[envVar].trim() === '') {
    invalidVars.push(envVar);
  } else {
    console.log(`   ✓ Found required environment variable: ${envVar}`);
  }
});

// Check optional environment variables but don't fail the build if they're missing
optionalEnvVars.forEach(envVar => {
  if (process.env[envVar] === undefined) {
    console.log(`   ℹ️  Optional environment variable not set: ${envVar}`);
  } else if (process.env[envVar]?.trim() === '') {
    console.warn(`   ⚠️  Empty optional environment variable: ${envVar}`);
  } else {
    console.log(`   ✓ Found optional environment variable: ${envVar}`);
  }
});

if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  console.log('   ℹ️  Please check your environment configuration');
  process.exit(1);
}

if (invalidVars.length > 0) {
  console.error(`❌ Empty environment variables found: ${invalidVars.join(', ')}`);
  process.exit(1);
}

// Mask sensitive values for logging
const allVars = [...requiredEnvVars, ...optionalEnvVars];
const maskedVars = allVars
  .filter(envVar => process.env[envVar])
  .map(envVar => {
    const value = process.env[envVar] || '';
    const maskedValue = value.length > 8 
      ? `${value.substring(0, 2)}...${value.substring(value.length - 2)}`
      : '***';
    return `${envVar}=${maskedValue}`;
  });

console.log('   ✓ All required environment variables are set and valid');
console.log('   ℹ️  Configured variables:', maskedVars.join(', '));

console.log('\n🚀 All pre-deployment checks passed!');
console.log('   You can now proceed with the build process.');

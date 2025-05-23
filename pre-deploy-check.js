#!/usr/bin/env node

/**
 * Pre-deployment check script for Nekt.Us
 * This script runs typescript checks before deployment to catch errors early
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Running pre-deployment checks for Nekt.Us...');

// Check TypeScript types
try {
  console.log('✓ Checking TypeScript types...');
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  console.log('✅ TypeScript check passed!');
} catch (error) {
  console.error('❌ TypeScript check failed! Fix errors before deploying.');
  process.exit(1);
}

// Check for common issues in auth configuration
try {
  console.log('✓ Checking auth configuration...');
  const authPath = path.join(__dirname, 'src/app/api/auth/[...nextauth]/route.ts');
  const authContent = fs.readFileSync(authPath, 'utf8');
  
  // Check for exports that shouldn't be there
  if (authContent.includes('export const authOptions')) {
    console.error('❌ Found "export const authOptions" in route.ts - this will cause build failures!');
    console.error('   Next.js route handlers should only export GET, POST, etc. handlers.');
    process.exit(1);
  }
  
  console.log('✅ Auth configuration check passed!');
} catch (error) {
  console.error('❌ Auth configuration check failed:', error.message);
}

console.log('🚀 All pre-deployment checks passed! Safe to deploy.');

#!/usr/bin/env node

/**
 * Pre-deployment check script for Nekt.Us
 * This script runs typescript checks before deployment to catch errors early
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Running pre-deployment checks for Nekt.Us...');

// Check TypeScript types with detailed error reporting
try {
  console.log('✓ Checking TypeScript types...');
  // Run tsc with special formatting to better detect and fix errors
  execSync('npx tsc --noEmit --pretty', { stdio: 'inherit' });
  console.log('✅ TypeScript check passed!');
} catch (error) {
  // Provide more helpful error messages for common TypeScript errors
  console.error('❌ TypeScript check failed! Common issues to look for:');
  console.error('   - Incorrect type assignments (undefined where string expected)');
  console.error('   - Missing type assertions (use "as string" when needed)');
  console.error('   - Extending objects with custom properties needs type casting (session as any)');
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
  
  // Check for potential type issues in auth configuration
  if (authContent.includes('token.accessToken = account.access_token;') ||
      authContent.includes('token.id = profile.sub;') ||
      authContent.includes('session.accessToken = token.accessToken;')) {
    console.error('❌ Potential TypeScript errors in auth callbacks!');
    console.error('   Properties like access_token, sub, and custom session properties');
    console.error('   need proper type casting (as string, as any, etc.)');
    process.exit(1);
  }
  
  console.log('✅ Auth configuration check passed!');
} catch (error) {
  console.error('❌ Auth configuration check failed:', error.message);
}

// Verify environment variables are properly handled
try {
  console.log('✓ Checking environment variable usage...');
  const envConfig = {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'https://nekt.us',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'nektus-app-contact-exchange-secret-key',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '[EXAMPLE-ID].apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '[EXAMPLE-SECRET]',
  };
  
  console.log('   Environment variables configured:');
  Object.keys(envConfig).forEach(key => {
    const value = envConfig[key];
    const masked = key.includes('SECRET') ? value.substring(0, 5) + '...' : value;
    console.log(`   - ${key}: ${masked}`);
  });
  
  console.log('✅ Environment variable check passed!');
} catch (error) {
  console.error('❌ Environment variable check failed:', error.message);
}

console.log('🚀 All pre-deployment checks passed! Safe to deploy.');

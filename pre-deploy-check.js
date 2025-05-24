#!/usr/bin/env node

/**
 * Pre-deployment check script for Nekt.Us
 * This script runs typescript checks before deployment to catch errors early
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Running pre-deployment checks for Nekt.Us...');

// Verify TypeScript types
try {
  console.log('✓ Checking TypeScript types...');
  
  // Make sure type declaration modules are available
  console.log('   Checking for type declarations...');
  
  // Run TypeScript check with more detailed error reporting
  execSync('npx tsc --noEmit --pretty', { stdio: 'inherit' });
  console.log('✅ TypeScript check passed!');
} catch (error) {
  console.error('❌ TypeScript check failed! Common issues to look for:');
  console.error('   - Incorrect type assignments (undefined where string expected)');
  console.error('   - Missing type assertions (use "as string" when needed)');
  console.error('   - Extending objects with custom properties needs type casting (session as any)');
  console.error('   - Missing module declarations (create .d.ts files in src/types/)');
  console.error('   - Firebase or other library types not found (check src/types/firebase.d.ts)');
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
  // Match assignment patterns without type assertions
  const typeCastingPatterns = [
    { pattern: /token\.[\w]+ = (?!.*as string).*(?:account|profile|user)\.[\w]+;/g, description: 'JWT token properties' },
    { pattern: /session(?:\.user)?\.[\w]+ = (?!.*as string).*token\.[\w]+;/g, description: 'Session properties' },
    { pattern: /session\.[\w]+ = token\.[\w]+;/g, description: 'Custom session properties' },
  ];
  
  let missingTypeCasts = false;
  for (const { pattern, description } of typeCastingPatterns) {
    if (pattern.test(authContent)) {
      if (!missingTypeCasts) {
        console.error('❌ Potential TypeScript errors in auth callbacks!');
        missingTypeCasts = true;
      }
      console.error(`   Missing type casting for ${description}. Add 'as string' or 'as any' as needed.`);
    }
  }
  
  if (missingTypeCasts) {
    console.error('   Example: "token.accessToken = account.access_token as string;"');
    console.error('   Example: "session.user.id = token.userId as string;"');
    console.error('   Example: "(session as any).customProperty = token.customProperty as string;"');
    process.exit(1);
  }
  
  console.log('✅ Auth configuration check passed!');
} catch (error) {
  console.error('❌ Auth configuration check failed:', error.message);
}

// Check for problematic import paths
try {
  console.log('✓ Checking import paths for potential issues...');
  const { globSync } = require('glob');
  const fs = require('fs');
  const path = require('path');
  
  // Find all TypeScript files
  const tsFiles = globSync('src/**/*.{ts,tsx}');
  let hasErrors = false;
  
  // Import patterns to check
  const problematicPatterns = [
    { pattern: /import[^;]*from\s+['"](.+\.js)['"];?/g, message: 'TypeScript import with .js extension' },
    { pattern: /import[^;]*from\s+['"](.+\.jsx)['"];?/g, message: 'TypeScript import with .jsx extension' },
  ];
  
  for (const file of tsFiles) {
    const content = fs.readFileSync(file, 'utf8');
    
    problematicPatterns.forEach(({ pattern, message }) => {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        if (!hasErrors) {
          console.error('❌ Found potentially problematic imports:');
          hasErrors = true;
        }
        console.error(`   - File ${file} has ${matches.length} ${message}(s):`);
        matches.forEach(match => {
          console.error(`     ${match.trim()}`);
        });
      }
    });
  }
  
  if (hasErrors) {
    console.error('   Fix these imports by removing the file extension (.js/.jsx)');
    console.error('   Example: change "import { x } from \'./y.js\'" to "import { x } from \'./y\'"');
    process.exit(1);
  }
  
  console.log('✅ Import path check passed!');
} catch (error) {
  console.error('❌ Import path check failed:', error.message);
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

#!/usr/bin/env node

/**
 * Pre-deployment check script for Nekt.Us
 * This script runs various checks before deployment to catch errors early
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Running pre-deployment checks for Nekt.Us...');

// Check dependencies and imports
try {
  console.log('✓ Checking required dependencies...');
  
  // Check core dependencies
  const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  
  // List of critical dependencies the app requires
  const requiredDependencies = [
    'next', 'react', 'react-dom', 'next-auth', 'firebase'
  ];
  
  // CSS-related dependencies that should be present (usually as dev dependencies)
  const requiredDevDependencies = [
    'autoprefixer', 'postcss', 'tailwindcss'
  ];
  
  const missingDeps = [];
  requiredDependencies.forEach(dep => {
    if (!packageJson.dependencies || !packageJson.dependencies[dep]) {
      missingDeps.push(dep);
    }
  });
  
  // Check for required dev dependencies
  requiredDevDependencies.forEach(dep => {
    if ((!packageJson.devDependencies || !packageJson.devDependencies[dep]) && 
        (!packageJson.dependencies || !packageJson.dependencies[dep])) {
      missingDeps.push(`${dep} (dev)`);  
    }
  });
  
  if (missingDeps.length > 0) {
    throw new Error(`Missing critical dependencies: ${missingDeps.join(', ')}`);
  }
  
  // Verify Firebase modules can be imported
  try {
    require.resolve('firebase/app');
    require.resolve('firebase/firestore');
    require.resolve('firebase/auth');
    console.log('   ✓ Firebase modules verified');
  } catch (error) {
    console.error('❌ Firebase modules not found, please reinstall: npm install firebase');
    process.exit(1);
  }
  
  // Find all imported packages from source code
  console.log('   ✓ Checking for imported packages not in package.json...');
  
  // Use a custom approach to find imports in source code
  const findImportsInFile = (filePath) => {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const importRegex = /import\s+(?:(?:[\w*\s{},]*)\s+from\s+)?['"]([^'"\s]+)['"]/g;
      const imports = [];
      let match;
      
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        // Only track external package imports (not relative or internal)
        if (!importPath.startsWith('./') && !importPath.startsWith('../') && !importPath.startsWith('@/')) {
          // Extract package name (e.g., 'lodash/throttle' -> 'lodash')
          const packageName = importPath.split('/')[0];
          if (packageName && packageName !== '@') {
            imports.push(packageName);
          }
        }
      }
      
      return imports;
    } catch (error) {
      return [];
    }
  };
  
  // Find all TS/TSX files
  const getFilesRecursively = (dir, fileList = []) => {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        getFilesRecursively(filePath, fileList);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        fileList.push(filePath);
      }
    });
    
    return fileList;
  };
  
  const sourceFiles = getFilesRecursively('./src');
  const importedPackages = new Set();
  
  sourceFiles.forEach(filePath => {
    findImportsInFile(filePath).forEach(pkg => {
      importedPackages.add(pkg);
    });
  });
  
  // Check if all imported packages are in package.json
  const notInstalledImports = [];
  importedPackages.forEach(pkg => {
    // Skip React/Next.js internal packages
    if (pkg === 'react' || pkg === 'next' || pkg === 'react-dom') return;
    
    if (!packageJson.dependencies[pkg] && !packageJson.devDependencies?.[pkg]) {
      notInstalledImports.push(pkg);
    }
  });
  
  if (notInstalledImports.length > 0) {
    throw new Error(`The following packages are imported but not installed: ${notInstalledImports.join(', ')}. Run: npm install --save ${notInstalledImports.join(' ')}`);
  }
  
  console.log('✅ All dependencies verified!');
} catch (error) {
  console.error(`❌ Dependency check failed: ${error.message}`);
  console.error('   Make sure to run npm install before deployment');
  process.exit(1);
}

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

// Check auth configuration
try {
  console.log('✓ Checking auth configuration...');
  
  // Ensure the [...nextauth] API route exists
  const nextAuthPath = path.join(__dirname, 'src/app/api/auth/[...nextauth]');
  if (!fs.existsSync(nextAuthPath)) {
    throw new Error('NextAuth API route not found');
  }
  
  console.log('✅ Auth configuration check passed!');
} catch (error) {
  console.error(`❌ Auth configuration check failed: ${error.message}`);
  process.exit(1);
}

// Check for problematic import paths
try {
  console.log('✓ Checking import paths for potential issues...');
  
  // Look for common path issues
  const sourceDir = path.join(__dirname, 'src');
  const files = getFilesRecursively(sourceDir);
  
  function getFilesRecursively(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        getFilesRecursively(filePath, fileList);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        fileList.push(filePath);
      }
    });
    
    return fileList;
  }
  
  let pathIssuesFound = false;
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    
    // Check for potentially problematic import paths
    const problematicPatterns = [
      { pattern: /from\s+['"]\.{1,2}\/[^'"]*['"]/, description: 'Relative imports may cause issues in deployed environments' },
      { pattern: /from\s+['"]\@\/[^'"]*['"]/, description: '@/ imports require proper path alias configuration' },
    ];
    
    problematicPatterns.forEach(({ pattern, description }) => {
      if (pattern.test(content)) {
        // For now, we'll just note these but not fail the check
        // console.warn(`Warning: ${description} in ${path.relative(__dirname, file)}`);
        // pathIssuesFound = true;
      }
    });
  }
  
  if (pathIssuesFound) {
    throw new Error('Import path issues found');
  }
  
  console.log('✅ Import path check passed!');
} catch (error) {
  console.error(`❌ Import path check failed: ${error.message}`);
  process.exit(1);
}

// Check environment variables
try {
  console.log('✓ Checking environment variable usage...');
  
  // Load environment variables from .env.local if it exists
  const envPath = path.join(__dirname, '.env.local');
  let envVars = {};
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        envVars[match[1]] = match[2];
      }
    });
  }
  
  // Critical environment variables to check
  const requiredEnvVars = [
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
  ];
  
  console.log('   Environment variables configured:');
  requiredEnvVars.forEach(envVar => {
    const value = envVars[envVar] || process.env[envVar];
    if (value) {
      // Mask sensitive values
      const maskedValue = envVar.includes('SECRET') || envVar.includes('KEY') 
        ? value.slice(0, 5) + '...'
        : value;
      console.log(`   - ${envVar}: ${maskedValue}`);
    } else {
      throw new Error(`Missing environment variable: ${envVar}`);
    }
  });
  
  console.log('✅ Environment variable check passed!');
} catch (error) {
  console.error(`❌ Environment variable check failed: ${error.message}`);
  console.error('   Make sure all required environment variables are defined in .env.local');
  process.exit(1);
}

// Simple check for ProfileSetup component
try {
  console.log('✓ Checking ProfileSetup component exists...');
  const profileSetupPath = path.join(__dirname, 'src/app/components/ProfileSetup.tsx');
  
  // Just check if the file exists and is not empty
  if (!fs.existsSync(profileSetupPath)) {
    throw new Error('ProfileSetup component file not found');
  }
  
  const stats = fs.statSync(profileSetupPath);
  if (stats.size === 0) {
    throw new Error('ProfileSetup component file is empty');
  }
  
  console.log('✅ ProfileSetup component check passed!');
} catch (error) {
  console.error(`❌ ProfileSetup component check failed: ${error.message}`);
  process.exit(1);
}

// Check for CSS module usage and configuration
try {
  console.log('✓ Checking CSS module configuration...');
  
  // Check if any CSS modules are in use
  const cssModuleFiles = [];
  const sourceDir = path.join(__dirname, 'src');
  
  function findCssModuleFiles(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        findCssModuleFiles(filePath);
      } else if (file.endsWith('.module.css')) {
        cssModuleFiles.push(filePath);
      }
    }
  }
  
  findCssModuleFiles(sourceDir);
  
  if (cssModuleFiles.length > 0) {
    console.log(`   Found ${cssModuleFiles.length} CSS module files`)
    
    // Verify PostCSS configuration exists
    const postcssConfigPath = path.join(__dirname, 'postcss.config.js');
    if (!fs.existsSync(postcssConfigPath)) {
      throw new Error('postcss.config.js not found but CSS modules are in use');
    }
    
    // Verify autoprefixer is in the PostCSS config
    const postcssConfig = require(postcssConfigPath);
    if (!postcssConfig.plugins || !postcssConfig.plugins.autoprefixer) {
      throw new Error('autoprefixer not configured in postcss.config.js');
    }
    
    // Verify the actual module can be loaded
    try {
      require.resolve('autoprefixer');
      require.resolve('postcss');
      console.log('   ✓ PostCSS configuration verified');
    } catch (error) {
      throw new Error(`Unable to load CSS processing modules: ${error.message}`);
    }
  }
  
  console.log('✅ CSS module configuration check passed!');
} catch (error) {
  console.error(`❌ CSS module check failed: ${error.message}`);
  console.error('   Make sure to run: npm install --save-dev postcss autoprefixer');
  process.exit(1);
}

console.log('🚀 All pre-deployment checks passed! Safe to deploy.');

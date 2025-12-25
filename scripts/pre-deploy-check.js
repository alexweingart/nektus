#!/usr/bin/env node

/**
 * Pre-deploy validation script for Nektus monorepo
 * Validates web and iOS apps before deployment
 *
 * Usage:
 *   node scripts/pre-deploy-check.js          # Validate all apps
 *   node scripts/pre-deploy-check.js --web    # Validate web only
 *   node scripts/pre-deploy-check.js --ios    # Validate iOS only
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const WEB_DIR = path.join(ROOT_DIR, 'apps/web');
const IOS_DIR = path.join(ROOT_DIR, 'apps/ios-native');

// Parse CLI args
const args = process.argv.slice(2);
const validateWeb = args.length === 0 || args.includes('--web') || args.includes('--all');
const validateIos = args.length === 0 || args.includes('--ios') || args.includes('--all');

let hasErrors = false;

function log(message, type = 'info') {
  const prefix = {
    info: '\x1b[36m[INFO]\x1b[0m',
    success: '\x1b[32m[OK]\x1b[0m',
    error: '\x1b[31m[ERROR]\x1b[0m',
    warn: '\x1b[33m[WARN]\x1b[0m',
  };
  console.log(`${prefix[type]} ${message}`);
}

function checkFileExists(filePath, description) {
  if (fs.existsSync(filePath)) {
    log(`${description}: exists`, 'success');
    return true;
  } else {
    log(`${description}: MISSING - ${filePath}`, 'error');
    hasErrors = true;
    return false;
  }
}

function checkJsonField(filePath, fieldPath, validator, description) {
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const fields = fieldPath.split('.');
    let value = content;
    for (const field of fields) {
      value = value?.[field];
    }

    if (validator(value)) {
      log(`${description}: valid`, 'success');
      return true;
    } else {
      log(`${description}: INVALID - ${fieldPath} = ${JSON.stringify(value)}`, 'error');
      hasErrors = true;
      return false;
    }
  } catch (e) {
    log(`${description}: FAILED - ${e.message}`, 'error');
    hasErrors = true;
    return false;
  }
}

function checkEnvVar(name, required = true) {
  const value = process.env[name];
  if (value) {
    // Mask sensitive values
    const masked = value.length > 8 ? value.slice(0, 4) + '****' + value.slice(-4) : '****';
    log(`Env ${name}: set (${masked})`, 'success');
    return true;
  } else if (required) {
    log(`Env ${name}: MISSING`, 'error');
    hasErrors = true;
    return false;
  } else {
    log(`Env ${name}: not set (optional)`, 'warn');
    return false;
  }
}

// ============== WEB APP VALIDATION ==============
function validateWebApp() {
  console.log('\n\x1b[1m=== Validating Web App ===\x1b[0m\n');

  // Required files
  checkFileExists(path.join(WEB_DIR, 'package.json'), 'package.json');
  checkFileExists(path.join(WEB_DIR, 'next.config.js'), 'next.config.js');
  checkFileExists(path.join(WEB_DIR, 'src/app/layout.tsx'), 'src/app/layout.tsx');
  checkFileExists(path.join(WEB_DIR, 'src/app/page.tsx'), 'src/app/page.tsx');

  // Check dependencies in package.json
  const pkgPath = path.join(WEB_DIR, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    const requiredDeps = ['next', 'react', 'react-dom', 'next-auth', 'firebase'];
    for (const dep of requiredDeps) {
      if (deps[dep]) {
        log(`Dependency ${dep}: installed (${deps[dep]})`, 'success');
      } else {
        log(`Dependency ${dep}: MISSING`, 'error');
        hasErrors = true;
      }
    }
  }

  // Check env vars (only if .env.local exists or in CI)
  console.log('\n\x1b[1mEnvironment Variables:\x1b[0m');
  checkEnvVar('NEXTAUTH_URL', false);
  checkEnvVar('NEXTAUTH_SECRET', false);
  checkEnvVar('GOOGLE_CLIENT_ID', false);
  checkEnvVar('GOOGLE_CLIENT_SECRET', false);
  checkEnvVar('FIREBASE_PROJECT_ID', false);
}

// ============== iOS APP VALIDATION ==============
function validateIosApp() {
  console.log('\n\x1b[1m=== Validating iOS App ===\x1b[0m\n');

  // Required files
  checkFileExists(path.join(IOS_DIR, 'package.json'), 'package.json');
  checkFileExists(path.join(IOS_DIR, 'app.json'), 'app.json');
  checkFileExists(path.join(IOS_DIR, 'eas.json'), 'eas.json');
  checkFileExists(path.join(IOS_DIR, 'App.tsx'), 'App.tsx');

  // Validate app.json
  const appJsonPath = path.join(IOS_DIR, 'app.json');
  if (fs.existsSync(appJsonPath)) {
    console.log('\n\x1b[1mapp.json Configuration:\x1b[0m');

    checkJsonField(
      appJsonPath,
      'expo.ios.bundleIdentifier',
      (v) => v && v !== 'com.example.app' && !v.includes('placeholder'),
      'Bundle identifier'
    );

    checkJsonField(
      appJsonPath,
      'expo.extra.eas.projectId',
      (v) => v && v !== 'your-eas-project-id' && !v.includes('placeholder'),
      'EAS Project ID'
    );

    checkJsonField(
      appJsonPath,
      'expo.owner',
      (v) => v && v !== 'your-expo-username',
      'Expo owner'
    );
  }

  // Validate eas.json
  const easJsonPath = path.join(IOS_DIR, 'eas.json');
  if (fs.existsSync(easJsonPath)) {
    console.log('\n\x1b[1meas.json Configuration:\x1b[0m');

    checkJsonField(
      easJsonPath,
      'submit.production.ios.appleId',
      (v) => !v || (v !== 'your-apple-id@email.com' && !v.includes('placeholder')),
      'Apple ID (submit config)'
    );
  }
}

// ============== MAIN ==============
console.log('\x1b[1m\x1b[34m');
console.log('╔════════════════════════════════════════╗');
console.log('║   Nektus Pre-Deploy Validation Check   ║');
console.log('╚════════════════════════════════════════╝');
console.log('\x1b[0m');

if (validateWeb) {
  validateWebApp();
}

if (validateIos) {
  validateIosApp();
}

// Summary
console.log('\n\x1b[1m=== Summary ===\x1b[0m\n');

if (hasErrors) {
  log('Validation FAILED - please fix the errors above', 'error');
  process.exit(1);
} else {
  log('All validations passed!', 'success');
  process.exit(0);
}

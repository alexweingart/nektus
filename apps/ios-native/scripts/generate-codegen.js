#!/usr/bin/env node

/**
 * This script generates React Native codegen files for all third-party libraries.
 *
 * React Native's built-in codegen discovery doesn't work properly with Bun's
 * package manager structure (node_modules/.bun/package@version+hash/...).
 *
 * This script runs from the monorepo root where require.resolve works correctly.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Determine if we're running from the ios-native directory or repo root
const cwd = process.cwd();
const isInIosNative = cwd.includes('ios-native');

// Navigate to monorepo root
const repoRoot = isInIosNative ? path.resolve(cwd, '../..') : cwd;
const iosNativePath = path.join(repoRoot, 'apps/ios-native');

console.log('==========================================');
console.log('Generating React Native Codegen');
console.log('==========================================');
console.log('Repo root:', repoRoot);
console.log('iOS native path:', iosNativePath);

// Find the react-native codegen script
let rnPath;
const bunPath = path.join(repoRoot, 'node_modules/.bun');

if (fs.existsSync(bunPath)) {
  // Bun package manager structure
  const rnDirs = fs.readdirSync(bunPath).filter(d => d.startsWith('react-native@'));
  if (rnDirs.length > 0) {
    rnPath = path.join(bunPath, rnDirs[0], 'node_modules/react-native');
  }
}

if (!rnPath || !fs.existsSync(rnPath)) {
  // Fallback to standard structure
  rnPath = path.join(repoRoot, 'node_modules/react-native');
}

const codegenScript = path.join(rnPath, 'scripts/generate-codegen-artifacts.js');

if (!fs.existsSync(codegenScript)) {
  console.error('Error: Codegen script not found at', codegenScript);
  process.exit(1);
}

console.log('Found codegen script at:', codegenScript);

// Generate codegen to temp directory
const outputDir = '/tmp/codegen-output';
fs.mkdirSync(outputDir, { recursive: true });

console.log('Running codegen for apps/ios-native...');
try {
  execSync(
    `node "${codegenScript}" --path apps/ios-native --targetPlatform ios --outputPath "${outputDir}"`,
    { cwd: repoRoot, stdio: 'inherit' }
  );
} catch (error) {
  console.error('Codegen generation failed:', error.message);
  process.exit(1);
}

// Copy generated files to iOS project
const sourceDir = path.join(outputDir, 'build/generated/ios');
const destDir = path.join(iosNativePath, 'ios/build/generated/ios');

console.log('Copying generated codegen files...');
fs.mkdirSync(destDir, { recursive: true });

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

copyRecursive(sourceDir, destDir);

console.log('Codegen files generated successfully!');
console.log('Contents of ios/build/generated/ios/:');
const files = fs.readdirSync(destDir);
files.forEach(f => console.log('  -', f));

console.log('==========================================');
console.log('Codegen generation complete');
console.log('==========================================');

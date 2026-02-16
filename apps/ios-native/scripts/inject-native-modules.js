#!/usr/bin/env node

/**
 * Injects custom native modules into the Xcode project after expo prebuild.
 *
 * This script:
 * 1. Copies .swift/.m files from native-modules/ into ios/Nekt/
 * 2. Patches project.pbxproj to include them in the Nekt build target
 *
 * Called by:
 * - clean-prebuild.sh (local clean builds)
 * - eas.json prebuildCommand (EAS cloud builds)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const cwd = process.cwd();
const iosNativeDir = cwd.includes('ios-native') ? cwd : path.join(cwd, 'apps/ios-native');
const nativeModulesDir = path.join(iosNativeDir, 'native-modules');
const iosNektDir = path.join(iosNativeDir, 'ios/Nekt');
const pbxprojPath = path.join(iosNativeDir, 'ios/Nekt.xcodeproj/project.pbxproj');

console.log('==========================================');
console.log('Injecting Custom Native Modules');
console.log('==========================================');

// 1. Copy native module files to ios/Nekt/
if (!fs.existsSync(nativeModulesDir)) {
  console.log('No native-modules/ directory found, skipping.');
  process.exit(0);
}

const files = fs.readdirSync(nativeModulesDir).filter(
  f => f.endsWith('.swift') || f.endsWith('.m') || f.endsWith('.h')
);

if (files.length === 0) {
  console.log('No native module files found, skipping.');
  process.exit(0);
}

fs.mkdirSync(iosNektDir, { recursive: true });

for (const file of files) {
  const src = path.join(nativeModulesDir, file);
  const dest = path.join(iosNektDir, file);
  fs.copyFileSync(src, dest);
  console.log(`  Copied ${file} -> ios/Nekt/${file}`);
}

// 2. Patch project.pbxproj
if (!fs.existsSync(pbxprojPath)) {
  console.error('Error: project.pbxproj not found at', pbxprojPath);
  console.error('Make sure expo prebuild has run first.');
  process.exit(1);
}

const lines = fs.readFileSync(pbxprojPath, 'utf8').split('\n');

/**
 * Generate a deterministic 24-char hex UUID from a seed string.
 */
function makeUUID(seed) {
  return crypto.createHash('md5').update(seed).digest('hex').slice(0, 24).toUpperCase();
}

// Build file metadata
const fileMeta = files.map(file => {
  const ext = path.extname(file);
  const isSwift = ext === '.swift';
  const isObjC = ext === '.m';
  return {
    name: file,
    fileRefId: makeUUID(`fileref-${file}`),
    buildFileId: makeUUID(`buildfile-${file}`),
    fileType: isSwift ? 'sourcecode.swift' : isObjC ? 'sourcecode.c.objc' : 'sourcecode.c.h',
    needsBuildFile: isSwift || isObjC,
  };
});

// Check which files need injection
const fullText = lines.join('\n');
const toInject = fileMeta.filter(f => !fullText.includes(`/* ${f.name} */`));

if (toInject.length === 0) {
  console.log('  All native modules already in project.pbxproj.');
  console.log('==========================================');
  process.exit(0);
}

for (const f of fileMeta) {
  if (!toInject.includes(f)) {
    console.log(`  ${f.name} already in project, skipping.`);
  }
}

// Line-by-line insertion with state tracking
const output = [];
let injectedGroup = false;
let injectedSources = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();

  // Insert PBXBuildFile entries before "End PBXBuildFile section"
  if (trimmed === '/* End PBXBuildFile section */') {
    for (const f of toInject) {
      if (f.needsBuildFile) {
        output.push(`\t\t${f.buildFileId} /* ${f.name} in Sources */ = {isa = PBXBuildFile; fileRef = ${f.fileRefId} /* ${f.name} */; };`);
        console.log(`  Added ${f.name} to PBXBuildFile`);
      }
    }
  }

  // Insert PBXFileReference entries before "End PBXFileReference section"
  if (trimmed === '/* End PBXFileReference section */') {
    for (const f of toInject) {
      output.push(`\t\t${f.fileRefId} /* ${f.name} */ = {isa = PBXFileReference; lastKnownFileType = ${f.fileType}; name = ${f.name}; path = Nekt/${f.name}; sourceTree = "<group>"; };`);
      console.log(`  Added ${f.name} to PBXFileReference`);
    }
  }

  // Insert children into the Nekt main group (13B07FAE) before its closing ");"
  // Match: we see ");" followed by "name = Nekt;" AND a few lines back we saw "13B07FAE"
  if (!injectedGroup && trimmed === ');' && i + 1 < lines.length && lines[i + 1].trim() === 'name = Nekt;') {
    // Verify this is the 13B07FAE group by looking backwards for it
    let isMainGroup = false;
    for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
      if (lines[j].includes('13B07FAE1A68108700A75B9A')) {
        isMainGroup = true;
        break;
      }
    }
    if (isMainGroup) {
      for (const f of toInject) {
        output.push(`\t\t\t\t${f.fileRefId} /* ${f.name} */,`);
        console.log(`  Added ${f.name} to Nekt group`);
      }
      injectedGroup = true;
    }
  }

  // Insert into Nekt Sources build phase (13B07F87)
  // Match: ");" inside a "files = (" block that belongs to the 13B07F87 Sources phase
  if (!injectedSources && trimmed === ');' && i >= 2) {
    // Check if we're inside the Nekt Sources phase by looking backwards
    let inFilesBlock = false;
    let isNektSources = false;
    for (let j = i - 1; j >= Math.max(0, i - 30); j--) {
      if (lines[j].trim() === 'files = (') {
        inFilesBlock = true;
      }
      if (lines[j].includes('13B07F871A680F5B00A75B9A /* Sources */')) {
        isNektSources = true;
        break;
      }
      // Stop if we hit another section
      if (lines[j].includes('/* End') || lines[j].includes('/* Begin')) break;
    }
    if (inFilesBlock && isNektSources) {
      for (const f of toInject) {
        if (f.needsBuildFile) {
          output.push(`\t\t\t\t${f.buildFileId} /* ${f.name} in Sources */,`);
          console.log(`  Added ${f.name} to Nekt Sources build phase`);
        }
      }
      injectedSources = true;
    }
  }

  output.push(line);
}

fs.writeFileSync(pbxprojPath, output.join('\n'));
console.log('  project.pbxproj updated.');

console.log('==========================================');
console.log('Native module injection complete');
console.log(`  ${files.length} files in ios/Nekt/`);
console.log('==========================================');

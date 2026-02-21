#!/usr/bin/env node

/**
 * Injects the NektWidget (Lock Screen widget) target into the Xcode project
 * after expo prebuild --clean.
 *
 * This script:
 * 1. Copies widget source from widget-extension/ into ios/NektWidget/
 * 2. Patches project.pbxproj to add the NektWidget target if absent
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
const widgetSourceDir = path.join(iosNativeDir, 'widget-extension');
const widgetDestDir = path.join(iosNativeDir, 'ios/NektWidget');
const pbxprojPath = path.join(iosNativeDir, 'ios/Nekt.xcodeproj/project.pbxproj');

console.log('==========================================');
console.log('Injecting NektWidget Target');
console.log('==========================================');

// 1. Copy widget source files
if (!fs.existsSync(widgetSourceDir)) {
  console.log('No widget-extension/ directory found, skipping.');
  process.exit(0);
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDirSync(widgetSourceDir, widgetDestDir);
console.log('  Copied widget-extension/ -> ios/NektWidget/');

// 2. Patch project.pbxproj
if (!fs.existsSync(pbxprojPath)) {
  console.error('Error: project.pbxproj not found at', pbxprojPath);
  console.error('Make sure expo prebuild has run first.');
  process.exit(1);
}

let pbx = fs.readFileSync(pbxprojPath, 'utf8');

// Check if NektWidget target already exists
if (pbx.includes('NektWidget.appex')) {
  console.log('  NektWidget target already in project.pbxproj.');
  console.log('==========================================');
  process.exit(0);
}

/**
 * Generate a deterministic 24-char hex UUID from a seed string.
 */
function makeUUID(seed) {
  return crypto.createHash('md5').update('widget-' + seed).digest('hex').slice(0, 24).toUpperCase();
}

// Deterministic UUIDs for all pbxproj entries
const IDS = {
  // File references
  swiftFileRef:       makeUUID('fileref-NektWidget.swift'),
  infoPlistFileRef:   makeUUID('fileref-Info.plist'),
  entitlementsRef:    makeUUID('fileref-NektWidget.entitlements'),
  assetsRef:          makeUUID('fileref-Assets.xcassets'),
  productRef:         makeUUID('fileref-NektWidget.appex'),
  // Build files
  swiftBuildFile:     makeUUID('buildfile-NektWidget.swift'),
  assetsBuildFile:    makeUUID('buildfile-Assets.xcassets'),
  embedBuildFile:     makeUUID('buildfile-embed-NektWidget.appex'),
  // Build phases
  sourcesPhase:       makeUUID('sources-phase'),
  resourcesPhase:     makeUUID('resources-phase'),
  frameworksPhase:    makeUUID('frameworks-phase'),
  embedPhase:         makeUUID('embed-extensions'),
  // Groups
  widgetGroup:        makeUUID('group-NektWidget'),
  // Target
  nativeTarget:       makeUUID('native-target'),
  // Container item proxy + dependency
  containerProxy:     makeUUID('container-proxy'),
  targetDependency:   makeUUID('target-dependency'),
  // Build configurations
  debugConfig:        makeUUID('config-debug'),
  releaseConfig:      makeUUID('config-release'),
  configList:         makeUUID('config-list'),
};

// ---- PBXBuildFile section ----
pbx = pbx.replace(
  '/* End PBXBuildFile section */',
  `\t\t${IDS.swiftBuildFile} /* NektWidget.swift in Sources */ = {isa = PBXBuildFile; fileRef = ${IDS.swiftFileRef} /* NektWidget.swift */; };
\t\t${IDS.assetsBuildFile} /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = ${IDS.assetsRef} /* Assets.xcassets */; };
\t\t${IDS.embedBuildFile} /* NektWidget.appex in Embed Foundation Extensions */ = {isa = PBXBuildFile; fileRef = ${IDS.productRef} /* NektWidget.appex */; settings = {ATTRIBUTES = (RemoveHeadersOnCopy, ); }; };
/* End PBXBuildFile section */`
);
console.log('  Added PBXBuildFile entries');

// ---- PBXContainerItemProxy section ----
pbx = pbx.replace(
  '/* End PBXContainerItemProxy section */',
  `\t\t${IDS.containerProxy} /* PBXContainerItemProxy */ = {
\t\t\tisa = PBXContainerItemProxy;
\t\t\tcontainerPortal = 83CBB9F71A601CBA00E9B192 /* Project object */;
\t\t\tproxyType = 1;
\t\t\tremoteGlobalIDString = ${IDS.nativeTarget};
\t\t\tremoteInfo = NektWidget;
\t\t};
/* End PBXContainerItemProxy section */`
);
console.log('  Added PBXContainerItemProxy');

// ---- PBXCopyFilesBuildPhase - add Embed Foundation Extensions to Nekt target ----
// Add a new copy files phase for embedding the widget extension
pbx = pbx.replace(
  '/* End PBXCopyFilesBuildPhase section */',
  `\t\t${IDS.embedPhase} /* Embed Foundation Extensions */ = {
\t\t\tisa = PBXCopyFilesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tdstPath = "";
\t\t\tdstSubfolderSpec = 13;
\t\t\tfiles = (
\t\t\t\t${IDS.embedBuildFile} /* NektWidget.appex in Embed Foundation Extensions */,
\t\t\t);
\t\t\tname = "Embed Foundation Extensions";
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
/* End PBXCopyFilesBuildPhase section */`
);
console.log('  Added Embed Foundation Extensions build phase');

// Add the embed phase to the Nekt target's buildPhases
pbx = pbx.replace(
  /(\t\t\t\tFCADD051B16DBAB44EAF07C3 \/\* \[CP\] Embed Pods Frameworks \*\/,\n\t\t\t\);)/,
  `\t\t\t\tFCADD051B16DBAB44EAF07C3 /* [CP] Embed Pods Frameworks */,
\t\t\t\t${IDS.embedPhase} /* Embed Foundation Extensions */,
\t\t\t);`
);

// ---- PBXFileReference section ----
pbx = pbx.replace(
  '/* End PBXFileReference section */',
  `\t\t${IDS.swiftFileRef} /* NektWidget.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = NektWidget.swift; path = NektWidget.swift; sourceTree = "<group>"; };
\t\t${IDS.infoPlistFileRef} /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; name = Info.plist; path = Info.plist; sourceTree = "<group>"; };
\t\t${IDS.entitlementsRef} /* NektWidget.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; name = NektWidget.entitlements; path = NektWidget.entitlements; sourceTree = "<group>"; };
\t\t${IDS.assetsRef} /* Assets.xcassets */ = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; name = Assets.xcassets; path = Assets.xcassets; sourceTree = "<group>"; };
\t\t${IDS.productRef} /* NektWidget.appex */ = {isa = PBXFileReference; explicitFileType = "wrapper.app-extension"; includeInIndex = 0; path = NektWidget.appex; sourceTree = BUILT_PRODUCTS_DIR; };
/* End PBXFileReference section */`
);
console.log('  Added PBXFileReference entries');

// ---- PBXFrameworksBuildPhase section ----
pbx = pbx.replace(
  '/* End PBXFrameworksBuildPhase section */',
  `\t\t${IDS.frameworksPhase} /* Frameworks */ = {
\t\t\tisa = PBXFrameworksBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
/* End PBXFrameworksBuildPhase section */`
);
console.log('  Added PBXFrameworksBuildPhase');

// ---- PBXGroup section ----
// Add NektWidget group
pbx = pbx.replace(
  '/* End PBXGroup section */',
  `\t\t${IDS.widgetGroup} /* NektWidget */ = {
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
\t\t\t\t${IDS.swiftFileRef} /* NektWidget.swift */,
\t\t\t\t${IDS.infoPlistFileRef} /* Info.plist */,
\t\t\t\t${IDS.entitlementsRef} /* NektWidget.entitlements */,
\t\t\t\t${IDS.assetsRef} /* Assets.xcassets */,
\t\t\t);
\t\t\tname = NektWidget;
\t\t\tpath = NektWidget;
\t\t\tsourceTree = "<group>";
\t\t};
/* End PBXGroup section */`
);

// Add NektWidget group to main project group (83CBB9F61A601CBA00E9B192)
pbx = pbx.replace(
  `\t\t\t\t74BDB85FBB3940D18E5EE174 /* NektClip */,`,
  `\t\t\t\t74BDB85FBB3940D18E5EE174 /* NektClip */,
\t\t\t\t${IDS.widgetGroup} /* NektWidget */,`
);

// Add NektWidget.appex to Products group
pbx = pbx.replace(
  `\t\t\t\t20D08CED9B4648B7B8D9CE32 /* NektClip.app */,`,
  `\t\t\t\t20D08CED9B4648B7B8D9CE32 /* NektClip.app */,
\t\t\t\t${IDS.productRef} /* NektWidget.appex */,`
);
console.log('  Added PBXGroup entries');

// ---- PBXNativeTarget section ----
pbx = pbx.replace(
  '/* End PBXNativeTarget section */',
  `\t\t${IDS.nativeTarget} /* NektWidget */ = {
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = ${IDS.configList} /* Build configuration list for PBXNativeTarget "NektWidget" */;
\t\t\tbuildPhases = (
\t\t\t\t${IDS.sourcesPhase} /* Sources */,
\t\t\t\t${IDS.frameworksPhase} /* Frameworks */,
\t\t\t\t${IDS.resourcesPhase} /* Resources */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tdependencies = (
\t\t\t);
\t\t\tname = NektWidget;
\t\t\tproductName = NektWidget;
\t\t\tproductReference = ${IDS.productRef} /* NektWidget.appex */;
\t\t\tproductType = "com.apple.product-type.app-extension";
\t\t};
/* End PBXNativeTarget section */`
);
console.log('  Added PBXNativeTarget');

// ---- PBXProject targets list ----
pbx = pbx.replace(
  `\t\t\t\tDE03DCB40768420780DC2B7C /* NektClip */,`,
  `\t\t\t\tDE03DCB40768420780DC2B7C /* NektClip */,
\t\t\t\t${IDS.nativeTarget} /* NektWidget */,`
);

// Add TargetAttributes for NektWidget
pbx = pbx.replace(
  `\t\t\t\t\tDE03DCB40768420780DC2B7C = {`,
  `\t\t\t\t\t${IDS.nativeTarget} = {
\t\t\t\t\t\tDevelopmentTeam = V4R5CSCQ2J;
\t\t\t\t\t\tProvisioningStyle = Automatic;
\t\t\t\t\t};
\t\t\t\t\tDE03DCB40768420780DC2B7C = {`
);
console.log('  Added to PBXProject targets and attributes');

// ---- PBXResourcesBuildPhase section ----
pbx = pbx.replace(
  '/* End PBXResourcesBuildPhase section */',
  `\t\t${IDS.resourcesPhase} /* Resources */ = {
\t\t\tisa = PBXResourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t\t${IDS.assetsBuildFile} /* Assets.xcassets in Resources */,
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
/* End PBXResourcesBuildPhase section */`
);
console.log('  Added PBXResourcesBuildPhase');

// ---- PBXSourcesBuildPhase section ----
pbx = pbx.replace(
  '/* End PBXSourcesBuildPhase section */',
  `\t\t${IDS.sourcesPhase} /* Sources */ = {
\t\t\tisa = PBXSourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t\t${IDS.swiftBuildFile} /* NektWidget.swift in Sources */,
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
/* End PBXSourcesBuildPhase section */`
);
console.log('  Added PBXSourcesBuildPhase');

// ---- PBXTargetDependency section ----
// Add dependency so Nekt depends on NektWidget
pbx = pbx.replace(
  '/* End PBXTargetDependency section */',
  `\t\t${IDS.targetDependency} /* PBXTargetDependency */ = {
\t\t\tisa = PBXTargetDependency;
\t\t\ttarget = ${IDS.nativeTarget} /* NektWidget */;
\t\t\ttargetProxy = ${IDS.containerProxy} /* PBXContainerItemProxy */;
\t\t};
/* End PBXTargetDependency section */`
);

// Add dependency ref to Nekt target
pbx = pbx.replace(
  `\t\t\t\t3E335370E20A4F6E85CCFF22 /* PBXTargetDependency */,`,
  `\t\t\t\t3E335370E20A4F6E85CCFF22 /* PBXTargetDependency */,
\t\t\t\t${IDS.targetDependency} /* PBXTargetDependency */,`
);
console.log('  Added PBXTargetDependency');

// ---- XCBuildConfiguration section ----
pbx = pbx.replace(
  '/* End XCBuildConfiguration section */',
  `\t\t${IDS.debugConfig} /* Debug */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;
\t\t\t\tASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME = WidgetBackground;
\t\t\t\tCLANG_ENABLE_MODULES = YES;
\t\t\t\tCODE_SIGN_ENTITLEMENTS = NektWidget/NektWidget.entitlements;
\t\t\t\tCODE_SIGN_IDENTITY = "Apple Development";
\t\t\t\tCODE_SIGN_STYLE = Automatic;
\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tDEVELOPMENT_TEAM = V4R5CSCQ2J;
\t\t\t\tGENERATE_INFOPLIST_FILE = NO;
\t\t\t\tINFOPLIST_FILE = NektWidget/Info.plist;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 17.0;
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/Frameworks",
\t\t\t\t\t"@executable_path/../../Frameworks",
\t\t\t\t);
\t\t\t\tMARKETING_VERSION = 1.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.nektus.app.Widget;
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSKIP_INSTALL = YES;
\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = "-Onone";
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = 1;
\t\t\t\tCC = "";
\t\t\t\tCXX = "";
\t\t\t\tLD = "";
\t\t\t\tLDPLUSPLUS = "";
\t\t\t};
\t\t\tname = Debug;
\t\t};
\t\t${IDS.releaseConfig} /* Release */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;
\t\t\t\tASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME = WidgetBackground;
\t\t\t\tCLANG_ENABLE_MODULES = YES;
\t\t\t\tCODE_SIGN_ENTITLEMENTS = NektWidget/NektWidget.entitlements;
\t\t\t\tCODE_SIGN_IDENTITY = "Apple Distribution";
\t\t\t\tCODE_SIGN_STYLE = Manual;
\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tDEVELOPMENT_TEAM = V4R5CSCQ2J;
\t\t\t\tGENERATE_INFOPLIST_FILE = NO;
\t\t\t\tINFOPLIST_FILE = NektWidget/Info.plist;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 17.0;
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/Frameworks",
\t\t\t\t\t"@executable_path/../../Frameworks",
\t\t\t\t);
\t\t\t\tMARKETING_VERSION = 1.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = com.nektus.app.Widget;
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSKIP_INSTALL = YES;
\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = 1;
\t\t\t\tCC = "";
\t\t\t\tCXX = "";
\t\t\t\tLD = "";
\t\t\t\tLDPLUSPLUS = "";
\t\t\t};
\t\t\tname = Release;
\t\t};
/* End XCBuildConfiguration section */`
);
console.log('  Added XCBuildConfiguration (Debug + Release)');

// ---- XCConfigurationList section ----
pbx = pbx.replace(
  '/* End XCConfigurationList section */',
  `\t\t${IDS.configList} /* Build configuration list for PBXNativeTarget "NektWidget" */ = {
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\t${IDS.debugConfig} /* Debug */,
\t\t\t\t${IDS.releaseConfig} /* Release */,
\t\t\t);
\t\t\tdefaultConfigurationIsVisible = 0;
\t\t\tdefaultConfigurationName = Release;
\t\t};
/* End XCConfigurationList section */`
);
console.log('  Added XCConfigurationList');

fs.writeFileSync(pbxprojPath, pbx);
console.log('  project.pbxproj updated.');

console.log('==========================================');
console.log('NektWidget target injection complete');
console.log('==========================================');

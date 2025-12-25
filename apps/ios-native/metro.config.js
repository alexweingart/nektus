const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Monorepo configuration for Bun workspaces
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

config.watchFolders = [monorepoRoot];

config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(monorepoRoot, "node_modules"),
  ],
  disableHierarchicalLookup: false,
};

module.exports = withNativeWind(config, { input: "./global.css" });

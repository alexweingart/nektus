const path = require("path");

module.exports = function (api) {
  api.cache(true);

  // Help Babel find plugins in monorepo structure
  const projectRoot = __dirname;
  const monorepoRoot = path.resolve(projectRoot, "../..");

  return {
    presets: [
      [
        require.resolve("babel-preset-expo"),
        { jsxImportSource: "nativewind" }
      ],
      require.resolve("nativewind/babel"),
    ],
  };
};

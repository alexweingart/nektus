const path = require("path");

module.exports = function (api) {
  api.cache(true);

  // Help Babel find plugins in monorepo structure
  const projectRoot = __dirname;
  const monorepoRoot = path.resolve(projectRoot, "../..");

  const plugins = [];

  // Strip console.log/warn/info in production builds (keeps console.error)
  if (process.env.NODE_ENV === "production") {
    plugins.push([
      require.resolve("babel-plugin-transform-remove-console"),
      { exclude: ["error"] },
    ]);
  }

  return {
    presets: [
      [
        require.resolve("babel-preset-expo"),
        { jsxImportSource: "nativewind" }
      ],
      require.resolve("nativewind/babel"),
    ],
    plugins,
  };
};

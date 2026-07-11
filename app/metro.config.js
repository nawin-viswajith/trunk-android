const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// zustand's package "exports" map ships a real-ESM build (esm/middleware.mjs)
// containing top-level `import.meta.env` for its optional Redux DevTools
// connector. Metro's web bundling picks that build via the "import"
// condition, but Metro (unlike Vite/webpack) doesn't support `import.meta`
// syntax at all -- it's a hard parse-time SyntaxError, not something the
// library's own try/catch can guard against. Force zustand to resolve
// through its CJS build instead, which has no import.meta reference.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "zustand" || moduleName.startsWith("zustand/")) {
    const resolve = defaultResolveRequest ?? context.resolveRequest;
    return resolve(
      { ...context, unstable_conditionNames: ["require", "react-native"] },
      moduleName,
      platform
    );
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;

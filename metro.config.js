// Learn more: https://docs.expo.dev/guides/customizing-metro/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// @supabase/supabase-js ships two builds behind its package `exports` map.
// Metro (SDK 54, package-exports on) picks the ESM build (dist/index.mjs),
// whose optional-tracing hook uses a native dynamic `import(OTEL_PKG)`. Hermes
// can't compile a native dynamic import and fails the release build with
// "Invalid expression encountered". The CJS build (dist/index.cjs) implements
// the same hook with `require(...)` instead, which Hermes handles fine — so we
// resolve just this one package to its CJS entry. Everything else keeps the
// default (package-exports) resolution.
const SUPABASE_CJS = path.resolve(
  __dirname,
  'node_modules/@supabase/supabase-js/dist/index.cjs',
);
const origResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@supabase/supabase-js') {
    return { type: 'sourceFile', filePath: SUPABASE_CJS };
  }
  return (origResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;

// biome-ignore-all lint/style/noCommonJs: exception for metro config

const path = require('node:path');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const process = require('node:process');
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

// biome-ignore lint/correctness/noGlobalDirnameFilename: necessary for metro config
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo: watch the whole workspace and resolve hoisted dependencies.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules'), path.resolve(workspaceRoot, 'node_modules')];

// ── Retint-on-save ─────────────────────────────────────────────────────────
//
// `tokens.css` is a generated, gitignored artifact: it is derived from
// `tokens.config.json` ({ hue, chroma }) by packages/ui's `rn-motion-ui-tokens`
// generator, and `global.css` imports it in place of `rn-motion-ui/tokens.css`.
// Metro re-runs the generator whenever the config changes — on first boot, so a
// fresh clone has a sheet to bundle, and on every subsequent edit, so HMR pushes
// the recolored sheet to web *and* native (uniwind recompiles the native
// stylesheet from it). The `/__tint` endpoint below lets the demo UI write the
// same config, closing the loop without a manual CLI step.
const TINT_CONFIG_PATH = path.join(projectRoot, 'tokens.config.json');
const GENERATOR_PATH = path.resolve(workspaceRoot, 'packages/ui/scripts/gen-tokens.mjs');
const MAX_CHROMA = 0.4; // sRGB tops out near 0.37; 0.4 is CSS Color 4's 100%.

function readTintConfig() {
  const defaults = { hue: 270, chroma: 0.004 };
  try {
    return { ...defaults, ...JSON.parse(fs.readFileSync(TINT_CONFIG_PATH, 'utf8')) };
  } catch {
    return defaults;
  }
}

function generateTokens() {
  const { hue, chroma } = readTintConfig();
  // Synchronous: the boot-time call must finish before bundling, and the POST
  // handler must finish before responding so the sheet on disk is the new one.
  execFileSync(
    process.execPath,
    [GENERATOR_PATH, '--hue', String(hue), '--chroma', String(chroma), '--out', 'tokens.css', '--force'],
    { cwd: projectRoot },
  );
}

// Boot: ensure the sheet exists before Metro tries to resolve `@import "./tokens.css"`.
generateTokens();

// Regenerate when the config is edited by hand (the UI path regenerates inline,
// see the POST handler below). Debounced: a single save can emit several change
// events on macOS, and regenerate is idempotent but cheap.
let regenTimer;
fs.watch(TINT_CONFIG_PATH, (eventType) => {
  if (eventType !== 'change') return;
  clearTimeout(regenTimer);
  regenTimer = setTimeout(generateTokens, 50);
});

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

// `/__tint` lets the demo UI read/write the tint config at dev time. The
// response reflects the config after the sheet has been regenerated.
config.server = config.server ?? {};
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  const url = req.url ?? '';
  if (!url.startsWith('/__tint')) return middleware(req, res, next);

  if (req.method === 'GET') return sendJson(res, 200, readTintConfig());

  if (req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        const hue = Number(parsed.hue);
        const chroma = Number(parsed.chroma);
        if (!Number.isFinite(hue)) throw new Error('hue must be a number');
        const chromaValid = Number.isFinite(chroma) && chroma >= 0 && chroma <= MAX_CHROMA;
        if (!chromaValid) throw new Error(`chroma must be between 0 and ${MAX_CHROMA}`);
        fs.writeFileSync(TINT_CONFIG_PATH, `${JSON.stringify({ hue, chroma }, null, 2)}\n`);
        generateTokens();
        sendJson(res, 200, { ok: true, hue, chroma });
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    });
    return;
  }

  return sendJson(res, 405, { ok: false, error: 'method not allowed' });
};

// Uniwind rewrites `react-native` imports to className-aware components at bundle
// time. `cssEntryFile` must stay a plain relative string (not path.resolve). The
// generated dtsFile is gitignored.
module.exports = withUniwindConfig(config, {
  cssEntryFile: './global.css',
  dtsFile: './uniwind-types.d.ts',
});

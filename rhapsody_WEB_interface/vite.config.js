import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseJsonc } from './src/core/jsonc.js';
import siteConfig from './site-override.cjs';

// Lets the code `import cfg from './x.jsonc'` (comments and trailing commas allowed).
// The root config supplies the same defaults in dev and in the built executable.
function mergeDeep(base, extra) {
  const out = { ...base };
  for (const [k, v] of Object.entries(extra || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' ? mergeDeep(base[k], v) : v;
  }
  return out;
}

function jsoncPlugin() {
  const rootConfig = fileURLToPath(new URL('../rhapsody-webapp.config.jsonc', import.meta.url));
  const override = process.env.RHAPSODY_SITE_OVERRIDE
    ? JSON.parse(process.env.RHAPSODY_SITE_OVERRIDE)
    : existsSync(rootConfig) ? siteConfig.siteOverride(parseJsonc(readFileSync(rootConfig, 'utf8'), rootConfig)) : null;
  return {
    name: 'jsonc',
    transform(code, id) {
      const file = id.split('?')[0];
      if (!file.endsWith('.jsonc')) return null;
      let value = parseJsonc(code, file);
      if (file.endsWith('site.config.jsonc') && override) value = mergeDeep(value, override);
      return { code: `export default ${JSON.stringify(value)};`, map: null };
    },
  };
}

// The build produces ONE self-contained index.html that can be opened by double-click (file://).
export default defineConfig({
  base: './',
  plugins: [jsoncPlugin(), vue(), viteSingleFile()],
  server: { port: 5173 },
  test: { include: ['test/**/*.test.js'] },
});

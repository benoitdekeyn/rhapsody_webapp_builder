import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { parseJsonc } from './src/core/jsonc.js';

// Lets the code `import cfg from './x.jsonc'` (comments and trailing commas allowed).
// RHAPSODY_SITE_OVERRIDE (JSON, set by the root build) is merged over site.config.jsonc.
function mergeDeep(base, extra) {
  const out = { ...base };
  for (const [k, v] of Object.entries(extra || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' ? mergeDeep(base[k], v) : v;
  }
  return out;
}

function jsoncPlugin() {
  return {
    name: 'jsonc',
    transform(code, id) {
      const file = id.split('?')[0];
      if (!file.endsWith('.jsonc')) return null;
      let value = parseJsonc(code, file);
      if (file.endsWith('site.config.jsonc') && process.env.RHAPSODY_SITE_OVERRIDE) value = mergeDeep(value, JSON.parse(process.env.RHAPSODY_SITE_OVERRIDE));
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

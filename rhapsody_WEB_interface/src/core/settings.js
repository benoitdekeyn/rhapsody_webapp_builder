// User settings: defaults come from site.config.jsonc (build time), overrides from localStorage (gear icon).
import { reactive } from 'vue';
import siteConfig from '../../site.config.jsonc';

export const STORAGE_KEY = 'rhapsody-web-interface.settings';

// Deep merge restricted to the keys that exist in `base` (ignores junk coming from old/edited storage).
export function mergeSettings(base, extra) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  if (!extra || typeof extra !== 'object') return out;
  for (const key of Object.keys(base)) {
    if (!(key in extra)) continue;
    const b = base[key];
    const v = extra[key];
    if (b && typeof b === 'object' && !Array.isArray(b)) out[key] = mergeSettings(b, v);
    else if (typeof v === typeof b) out[key] = v;
  }
  return out;
}

export function readStored(storage) {
  try {
    return JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

export function resolveSettings(defaults, storage) {
  return mergeSettings(defaults, storage ? readStored(storage) : null);
}

function browserStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null; // blocked storage (privacy mode)
  }
}

export const defaults = siteConfig;
export const settings = reactive(resolveSettings(defaults, browserStorage()));

export function saveSettings(next) {
  const merged = mergeSettings(defaults, next);
  Object.assign(settings, merged);
  try {
    browserStorage()?.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // storage full / blocked: the settings still apply for this session
  }
}

export function resetSettings() {
  try {
    browserStorage()?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  Object.assign(settings, mergeSettings(defaults, null));
}

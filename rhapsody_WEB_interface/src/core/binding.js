// Composables shared by all vehicle components, so that each component only contains its drawing.
import { computed } from 'vue';
import { attributeValue, attributeInfo, eventInfo, writeAttribute, fireEvent } from './store.js';

// Props every bound component accepts (spread them: `defineProps({ ...bindingProps })`).
export const bindingProps = {
  attribute: { type: String, default: '' }, // Rhapsody attribute name
  instance: { type: String, default: '' },  // Rhapsody instance (optional, auto-detected from the schema)
  event: { type: String, default: '' },     // Rhapsody event name (for buttons)
  args: { type: Object, default: () => ({}) }, // event arguments
  options: { type: Object, default: () => ({}) }, // style / bounds, override the component's defaults.json
};

// Merges the component's defaults.json with the options given by the dashboard instance.
export function mergeOptions(defaults, overrides) {
  const out = { ...defaults };
  for (const [k, v] of Object.entries(overrides || {})) {
    const base = out[k];
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base && typeof base === 'object' ? mergeOptions(base, v) : v;
  }
  return out;
}

export function useOptions(defaults, props) {
  return computed(() => mergeOptions(defaults, props.options));
}

export function useAttribute(props) {
  const value = computed(() => attributeValue(props.attribute, props.instance));
  const info = computed(() => attributeInfo(props.attribute, props.instance));
  return {
    value,
    known: computed(() => !props.attribute || info.value.known),
    writable: computed(() => info.value.writable),
    set: (v) => writeAttribute(props.attribute, v, props.instance).catch(() => {}),
  };
}

export function useEvent(props) {
  const info = computed(() => eventInfo(props.event));
  return {
    known: computed(() => !props.event || info.value.known),
    fire: () => fireEvent(props.event, props.args, props.instance).catch(() => {}),
  };
}

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const ratio = (v, min, max) => (max === min ? 0 : clamp((Number(v) - min) / (max - min), 0, 1));

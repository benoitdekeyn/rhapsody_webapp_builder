<script setup>
// Switch that writes a boolean attribute.
import { bindingProps, useOptions, useAttribute } from '../../../core/binding.js';
import defaults from './defaults.json';

const props = defineProps({ ...bindingProps });
const o = useOptions(defaults, props);
const { value, writable, set } = useAttribute(props);
</script>

<template>
  <label class="toggle" :class="{ ro: !writable }">
    <span class="track" :style="{ background: value ? o.onColor : o.offColor }" @click="writable && set(!value)">
      <span class="knob" :class="{ on: !!value }"></span>
    </span>
    <span class="label">{{ o.label }}</span>
  </label>
</template>

<style scoped>
.toggle { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
.toggle.ro { cursor: default; opacity: 0.7; }
.track { width: 38px; height: 20px; border-radius: 999px; position: relative; transition: background 0.15s; }
.knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: left 0.15s; }
.knob.on { left: 20px; }
.label { font-size: 12px; }
</style>

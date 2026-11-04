<script setup>
// Button that fires a Rhapsody event (with optional args).
import { bindingProps, useOptions, useEvent } from '../../../core/binding.js';
import defaults from './defaults.json';

const props = defineProps({ ...bindingProps });
const o = useOptions(defaults, props);
const { fire } = useEvent(props);
</script>

<template>
  <button class="pbtn" :class="{ round: o.round }" :style="{ background: o.color, color: o.textColor }" @click="fire">{{ o.label }}</button>
</template>

<style scoped>
.pbtn { border: 0; border-radius: 8px; padding: 8px 14px; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; box-shadow: 0 3px 0 #0006; transition: transform 0.05s, box-shadow 0.05s; }
.pbtn.round { border-radius: 999px; }
.pbtn:active { transform: translateY(2px); box-shadow: 0 1px 0 #0006; }
.pbtn:hover { filter: brightness(1.12); }
</style>

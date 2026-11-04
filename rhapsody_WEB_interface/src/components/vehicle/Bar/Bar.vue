<script setup>
// Horizontal level bar (fuel, battery...).
import { computed } from 'vue';
import { bindingProps, useOptions, useAttribute, ratio } from '../../../core/binding.js';
import defaults from './defaults.json';

const props = defineProps({ ...bindingProps });
const o = useOptions(defaults, props);
const { value } = useAttribute(props);

const num = computed(() => (typeof value.value === 'number' ? value.value : o.value.min));
const low = computed(() => o.value.warnBelow != null && num.value <= o.value.warnBelow);
const text = computed(() => (typeof value.value === 'number' ? value.value.toFixed(o.value.decimals) : '–'));
</script>

<template>
  <div class="bar">
    <div class="head"><span>{{ o.label }}</span><span>{{ text }} {{ o.unit }}</span></div>
    <div class="track" :style="{ width: o.width + 'px', height: o.height + 'px', background: o.colors.track }">
      <div class="fill" :style="{ width: ratio(num, o.min, o.max) * 100 + '%', background: low ? o.colors.warn : o.colors.fill }"></div>
    </div>
  </div>
</template>

<style scoped>
.bar { display: flex; flex-direction: column; gap: 3px; }
.head { display: flex; justify-content: space-between; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; opacity: 0.8; }
.track { border-radius: 999px; overflow: hidden; }
.fill { height: 100%; border-radius: 999px; }
</style>

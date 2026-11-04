<script setup>
// Vertical battery cell that fills up with the level.
import { computed } from 'vue';

const props = defineProps({
  value: { type: Number, default: 0 },
  warnBelow: { type: Number, default: null },
});
const level = computed(() => Math.min(100, Math.max(0, props.value)));
const low = computed(() => props.warnBelow !== null && props.value < props.warnBelow);
</script>

<template>
  <div class="battery" :class="{ low }">
    <div class="cell">
      <div class="fill" :style="{ height: level + '%' }"></div>
      <i v-if="warnBelow !== null" class="threshold" :style="{ bottom: Math.min(100, warnBelow) + '%' }"></i>
    </div>
    <div class="read">{{ Math.round(level) }}<small>%</small></div>
  </div>
</template>

<style scoped>
.battery { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.cell { position: relative; width: 46px; height: 84px; border: 3px solid #5d6b86; border-radius: 8px; padding: 3px; box-sizing: border-box; display: flex; align-items: flex-end; background: #070a10; margin-top: 7px; }
.cell::before { content: ''; position: absolute; top: -9px; left: 50%; transform: translateX(-50%); width: 18px; height: 6px; border-radius: 3px 3px 0 0; background: #5d6b86; }
.fill { width: 100%; border-radius: 3px; background: linear-gradient(#6fc2ff, #2f86d9); box-shadow: 0 0 10px #4aa3ff88; transition: height 0.3s; }
.low .fill { background: linear-gradient(#ff8a8a, #e03a3a); box-shadow: 0 0 10px #ff4d4d88; }
.threshold { position: absolute; left: 0; right: 0; height: 1px; background: #ffffff55; }
.read { font: 700 16px 'Segoe UI', system-ui, sans-serif; color: #fff; font-variant-numeric: tabular-nums; }
.read small { font-size: 10px; opacity: 0.6; }
</style>

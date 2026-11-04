<script setup>
// Small indicator light placed next to the instrument it belongs to.
defineProps({
  on: { type: Boolean, default: false },
  label: { type: String, default: '' },
  color: { type: String, default: '#3ecf8e' },
  blink: { type: Boolean, default: false },
});
</script>

<template>
  <span class="light" :class="{ on, blink: on && blink }" :style="{ '--c': color }" :title="label"><i></i>{{ label }}</span>
</template>

<style scoped>
.light { display: inline-flex; align-items: center; gap: 5px; font: 700 9px system-ui, sans-serif; letter-spacing: 1px; color: #43506a; white-space: nowrap; }
.light i { width: 9px; height: 9px; border-radius: 50%; background: #1a2232; box-shadow: inset 0 0 0 1px #2c3850; }
.light.on { color: var(--c); }
.light.on i { background: var(--c); box-shadow: 0 0 10px var(--c); }
.light.blink i { animation: blink 0.8s steps(2, jump-none) infinite; }
@keyframes blink { 50% { opacity: 0.15; } }
</style>

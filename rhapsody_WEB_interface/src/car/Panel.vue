<script setup>
defineProps({ title: { type: String, required: true } });
</script>

<template>
  <section class="panel">
    <header><h3>{{ title }}</h3><slot name="lights" /></header>
    <div class="body"><slot /></div>
  </section>
</template>

<style scoped>
.panel { display: flex; flex-direction: column; min-width: 0; background: var(--panel); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; }
header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px; background: #0d1320; border-bottom: 1px solid var(--border); }
h3 { margin: 0; font: 700 11px system-ui, sans-serif; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.85; }
.body { padding: 10px 12px; flex: 1; min-height: 0; overflow: auto; }
</style>

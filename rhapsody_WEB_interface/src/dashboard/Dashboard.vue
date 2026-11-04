<script setup>
import { computed } from 'vue';
import { registry } from '../components/vehicle/index.js';
import dashboard from './dashboard.config.jsonc';
import { store } from '../core/store.js';
import { validateDashboard } from '../core/resolve.js';

const problems = computed(() => validateDashboard(dashboard, store.schema));
const isMissing = (item) => problems.value.some((p) => p.name === (item.attribute || item.event));
defineExpose({ problems });
</script>

<template>
  <div class="dashboard">
    <section v-for="s in dashboard.sections" :key="s.id" class="sec" :class="s.class">
      <h3 v-if="s.title">{{ s.title }}</h3>
      <div class="items">
        <div v-for="(item, i) in s.items" :key="i" class="item" :class="{ missing: isMissing(item) }" :title="isMissing(item) ? 'Absent du schéma de l\'API' : ''">
          <component
            :is="registry[item.component]"
            v-if="registry[item.component]"
            :attribute="item.attribute"
            :event="item.event"
            :args="item.args"
            :instance="item.instance"
            :options="item.options"
          />
          <span v-else class="unknown">Composant inconnu: {{ item.component }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dashboard { display: flex; flex-direction: column; gap: 18px; align-items: center; }
.sec { background: var(--panel); border: 1px solid var(--border); border-radius: 18px; padding: 14px 22px; }
.sec h3 { margin: 0 0 10px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.5; text-align: center; }
.items { display: flex; flex-wrap: wrap; gap: 18px; justify-content: center; align-items: center; }
.cluster .items { gap: 28px; }
.pedals .items { align-items: flex-end; gap: 40px; }
.item.missing { outline: 2px dashed #ffb020; outline-offset: 4px; opacity: 0.55; border-radius: 6px; }
.unknown { color: #ff4d4d; font-size: 12px; }
</style>

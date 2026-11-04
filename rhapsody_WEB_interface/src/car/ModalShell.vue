<script>
let zTop = 100;
</script>

<script setup>
// Floating window: draggable by its title bar, several can stay open side by side.
import { ref, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  title: { type: String, required: true },
  x: { type: Number, default: 80 },
  y: { type: Number, default: 90 },
  width: { type: Number, default: 420 },
});
const emit = defineEmits(['close']);

const pos = ref({ x: props.x, y: props.y });
const z = ref(++zTop);
let drag = null;

function front() {
  z.value = ++zTop;
}
function down(e) {
  front();
  drag = { dx: e.clientX - pos.value.x, dy: e.clientY - pos.value.y };
  e.currentTarget.setPointerCapture(e.pointerId);
}
function move(e) {
  if (!drag) return;
  pos.value = {
    x: Math.min(window.innerWidth - 80, Math.max(-props.width + 120, e.clientX - drag.dx)),
    y: Math.min(window.innerHeight - 40, Math.max(0, e.clientY - drag.dy)),
  };
}
const up = () => (drag = null);
const onKey = (e) => e.key === 'Escape' && z.value === zTop && emit('close');
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="win" :style="{ left: pos.x + 'px', top: pos.y + 'px', width: width + 'px', zIndex: z }" @pointerdown="front">
    <header @pointerdown.prevent="down" @pointermove="move" @pointerup="up" @pointercancel="up">
      <span class="title">{{ title }}</span>
      <button title="Fermer" @pointerdown.stop @click="emit('close')">✕</button>
    </header>
    <div class="body"><slot /></div>
  </div>
</template>

<style scoped>
.win { position: fixed; max-width: calc(100vw - 16px); background: var(--panel); color: var(--text); border: 1px solid var(--border); border-radius: 16px; box-shadow: 0 20px 60px #000b; overflow: hidden; }
header { display: flex; align-items: center; gap: 8px; padding: 9px 12px 9px 16px; background: linear-gradient(#1d2638, #151c28); border-bottom: 1px solid var(--border); cursor: grab; user-select: none; touch-action: none; }
header:active { cursor: grabbing; }
.title { flex: 1; font: 700 12px system-ui, sans-serif; letter-spacing: 2px; text-transform: uppercase; }
header button { background: #ffffff14; color: var(--text); border: 0; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; }
header button:hover { background: #ff4d4d88; }
.body { padding: 16px; max-height: calc(100vh - 120px); overflow: auto; }
</style>

// Auto-registers every src/components/vehicle/<Name>/<Name>.vue: dropping a new folder is enough.
const modules = import.meta.glob('./*/*.vue', { eager: true });

export const registry = {};
for (const [path, mod] of Object.entries(modules)) {
  const name = path.split('/').pop().replace('.vue', '');
  registry[name] = mod.default;
}

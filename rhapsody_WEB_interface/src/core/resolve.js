// Pure helpers that map a configured attribute / event name to what the engine really exposes.

// Instance id to use for `attribute`: explicit hint, else the first schema class that has the attribute.
export function resolveInstanceId(schema, attribute, hint = '') {
  if (hint) return hint;
  const cls = schema?.classes?.find((c) => c.attributes.some((a) => a.name === attribute));
  return cls ? cls.name : '';
}

// Key of the live instance in the state: exact id, otherwise the oldest "Class#N" (the engine's alias rule).
export function findStateKey(state, id) {
  if (!id) return '';
  if (id in state) return id;
  const prefix = `${id}#`;
  return Object.keys(state).find((k) => k.startsWith(prefix)) || '';
}

export function findAttribute(schema, attribute, instanceId = '') {
  if (!schema) return null;
  for (const cls of schema.classes) {
    if (instanceId && instanceId !== cls.name && !instanceId.startsWith(`${cls.name}#`)) continue;
    const a = cls.attributes.find((x) => x.name === attribute);
    if (a) return a;
  }
  return null;
}

export function findEvent(schema, name) {
  return schema?.events?.find((e) => e.name === name) || null;
}

// Lists the attributes / events of the API map that do not exist (anymore) in the engine schema.
export function validateMap(map, schema) {
  const problems = [];
  if (!schema) return problems;
  for (const [key, def] of Object.entries(map.attributes || {})) {
    if (!findAttribute(schema, def.api)) problems.push({ key, kind: 'attribute', name: def.api });
  }
  for (const [key, name] of Object.entries(map.events || {})) {
    if (!findEvent(schema, name)) problems.push({ key, kind: 'event', name });
  }
  return problems;
}
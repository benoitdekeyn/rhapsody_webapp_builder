'use strict';

const { maskCode } = require('./parser');

const IDENTIFIER = /^[A-Za-z_]\w*$/;
const TYPES = new Set(['OMString', 'std::string', 'bool', 'int', 'float', 'double']);

function literal(override) {
  const { type, value } = override;
  if (type === 'OMString' || type === 'std::string') {
    if (typeof value !== 'string' || value.includes('\0')) throw new Error(`attribute override ${override.attribute}: expected a string without NUL`);
    const bytes = Buffer.from(value, 'utf8');
    let result = '"';
    for (const byte of bytes) {
      if (byte === 34 || byte === 92) result += '\\' + String.fromCharCode(byte);
      else if (byte >= 32 && byte <= 126) result += String.fromCharCode(byte);
      else result += '\\' + byte.toString(8).padStart(3, '0');
    }
    return result + '"';
  }
  if (type === 'bool') {
    if (typeof value !== 'boolean') throw new Error(`attribute override ${override.attribute}: expected a boolean`);
    return String(value);
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`attribute override ${override.attribute}: expected a finite number`);
  if (type === 'int' && (!Number.isInteger(value) || value < -2147483648 || value > 2147483647)) {
    throw new Error(`attribute override ${override.attribute}: expected a 32-bit integer`);
  }
  if (type === 'float' && (!Number.isFinite(Math.fround(value)) || (value !== 0 && Math.fround(value) === 0))) {
    throw new Error(`attribute override ${override.attribute}: value is outside the float range`);
  }
  return String(value);
}

function findClosing(masked, open) {
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const stack = [];
  for (let i = open; i < masked.length; i++) {
    const ch = masked[i];
    if (pairs[ch]) stack.push(pairs[ch]);
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (stack.pop() !== ch) return -1;
      if (!stack.length) return i;
    }
  }
  return -1;
}

function skipSpace(text, index) {
  while (index < text.length && /\s/.test(text[index])) index++;
  return index;
}

function constructorEdits(file, className, overrides) {
  const masked = maskCode(file.text);
  const constructor = new RegExp(`\\b${className}\\s*::\\s*${className}\\s*\\(`, 'g');
  const edits = [];
  let count = 0;
  let match;
  while ((match = constructor.exec(masked))) {
    const close = findClosing(masked, constructor.lastIndex - 1);
    if (close < 0) throw new Error(`${file.name}: unbalanced constructor parameters for ${className}`);
    let pos = skipSpace(masked, close + 1);
    if (masked[pos] === ';') continue;
    count++;
    if (masked[pos] !== ':') throw new Error(`${file.name}: constructor ${className} has no supported initializer list`);
    pos++;
    const found = new Set();
    for (;;) {
      pos = skipSpace(masked, pos);
      const init = /^([A-Za-z_]\w*(?:::\w+)*)\s*([({])/.exec(masked.slice(pos));
      if (!init) throw new Error(`${file.name}: cannot parse initializer list for ${className}`);
      const open = pos + init[0].length - 1;
      const end = findClosing(masked, open);
      if (end < 0) throw new Error(`${file.name}: unbalanced initializer ${init[1]} in ${className}`);
      const override = overrides.find((o) => o.attribute === init[1]);
      if (override) {
        if (found.has(init[1])) throw new Error(`${file.name}: duplicate initializer ${className}.${init[1]}`);
        found.add(init[1]);
        edits.push({ start: open + 1, end, value: override.cppValue });
      }
      pos = skipSpace(masked, end + 1);
      if (masked[pos] === '{') break;
      if (masked[pos] !== ',') throw new Error(`${file.name}: cannot parse initializer list for ${className}`);
      pos++;
    }
    for (const override of overrides) {
      if (!found.has(override.attribute)) throw new Error(`${file.name}: constructor ${className} has no initializer for ${override.attribute}`);
    }
    constructor.lastIndex = pos + 1;
  }
  return { edits, count };
}

// Replaces explicit constructor initializers in source copies, never the Rhapsody project.
function applyAttributeOverrides(files, model, overrides) {
  if (!Array.isArray(overrides)) throw new Error('"attributeOverrides" must be an array');
  const byClass = new Map();
  for (const entry of overrides) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
        !IDENTIFIER.test(entry.attribute || '') || (entry.class !== undefined && !IDENTIFIER.test(entry.class)) ||
        !TYPES.has(entry.type) || !Object.hasOwn(entry, 'value') ||
        Object.keys(entry).some((k) => !['class', 'attribute', 'type', 'value'].includes(k))) {
      throw new Error('attributeOverrides entries require attribute, type, value and optional class; supported types: OMString, std::string, bool, int, float, double');
    }
    const matches = model.classes.flatMap((c) => c.attributes
      .filter((a) => a.name === entry.attribute && (!entry.class || c.name === entry.class))
      .map((a) => ({ cls: c, attr: a })));
    if (matches.length !== 1) throw new Error(`attribute override ${entry.attribute}: ${matches.length ? 'ambiguous; specify class' : 'attribute not found'}`);
    const { cls, attr } = matches[0];
    if (attr.cppType !== entry.type || attr.static || attr.const || attr.dims.length) {
      throw new Error(`attribute override ${cls.name}.${entry.attribute}: expected a non-static, non-const scalar of type ${entry.type} (found ${attr.type})`);
    }
    const list = byClass.get(cls.name) || [];
    if (list.some((o) => o.attribute === entry.attribute)) throw new Error(`duplicate attribute override ${cls.name}.${entry.attribute}`);
    list.push({ ...entry, cppValue: literal(entry) });
    byClass.set(cls.name, list);
  }

  const result = new Map();
  for (const [className, entries] of byClass) {
    let constructors = 0;
    for (const file of files.filter((f) => /\.(c|cpp|cc|cxx)$/i.test(f.name))) {
      const { edits, count } = constructorEdits(file, className, entries);
      constructors += count;
      if (!edits.length) continue;
      let text = result.get(file.name) || file.text;
      // Other classes in the same file may already have changed offsets; parse that text again.
      const currentEdits = result.has(file.name) ? constructorEdits({ ...file, text }, className, entries).edits : edits;
      for (const edit of currentEdits.sort((a, b) => b.start - a.start)) {
        text = text.slice(0, edit.start) + edit.value + text.slice(edit.end);
      }
      result.set(file.name, text);
    }
    if (!constructors) throw new Error(`attribute override ${className}: no constructor definition found in included sources`);
  }
  return result;
}

module.exports = { applyAttributeOverrides };

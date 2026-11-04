// Minimal JSONC parser: strips // and /* */ comments and trailing commas (strings are preserved).
export function stripJsonc(text) {
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < n && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < n && text[i] !== '\n') i++;
    } else if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
    } else {
      out += ch;
      i++;
    }
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

export function parseJsonc(text, name = 'jsonc') {
  try {
    return JSON.parse(stripJsonc(text));
  } catch (e) {
    throw new Error(`${name}: ${e.message}`);
  }
}

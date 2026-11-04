'use strict';

// Minimal JSONC parser: strips // and /* */ comments and trailing commas, then JSON.parse.
// Positions of syntax errors are reported with the line/column of the original text.

function stripJsonc(text) {
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    const d = text[i + 1];
    if (c === '"') {
      let j = i + 1;
      while (j < n && text[j] !== '"') {
        if (text[j] === '\\') j++;
        j++;
      }
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && d === '/') {
      while (i < n && text[i] !== '\n') i++;
    } else if (c === '/' && d === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      // keep newlines so that error positions stay accurate
      out += text.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
    } else {
      out += c;
      i++;
    }
  }
  return removeTrailingCommas(out);
}

function removeTrailingCommas(text) {
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < n && text[j] !== '"') {
        if (text[j] === '\\') j++;
        j++;
      }
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (c === ',') {
      let j = i + 1;
      while (j < n && /\s/.test(text[j])) j++;
      if (text[j] === '}' || text[j] === ']') {
        out += text.slice(i + 1, j); // drop the comma, keep the whitespace
        i = j;
      } else {
        out += c;
        i++;
      }
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

function parseJsonc(text, source = 'JSONC') {
  const clean = stripJsonc(text.replace(/^\uFEFF/, ''));
  try {
    return JSON.parse(clean);
  } catch (e) {
    const m = /position (\d+)/.exec(e.message);
    let where = '';
    if (m) {
      const pos = Number(m[1]);
      const before = clean.slice(0, pos).split('\n');
      where = ` (line ${before.length}, column ${before[before.length - 1].length + 1})`;
    }
    throw new Error(`${source}: invalid JSONC${where}: ${e.message}`);
  }
}

module.exports = { parseJsonc, stripJsonc };

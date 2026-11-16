// Angles use SVG coordinates: zero points right and positive angles turn clockwise.
export function valueFromDialPoint(x, y, min, max, start, sweep) {
  if (x === 0 && y === 0) return null;
  const angle = Math.atan2(y, x) * 180 / Math.PI;
  let offset = ((angle - start) % 360 + 360) % 360;
  if (offset > sweep) offset = offset - sweep <= 360 - offset ? sweep : 0;
  return Math.round(min + (max - min) * offset / sweep);
}

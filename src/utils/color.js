/**
 * color.js — robust color utilities for your app
 * - Safer hex handling (#RGB + #RRGGBB) + normalization
 * - HSL/HEX/RGB conversions
 * - Geometry helpers for the wheel
 * - WCAG luminance/contrast
 * - Scheme + marker helpers
 * - Back-compat: export validateHexColor alias
 */

// ------------------------------- internal utils ------------------------------
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const toHex = (n) => n.toString(16).padStart(2, '0').toUpperCase();

/** Normalize any input to #RRGGBB (uppercase). Accepts #RGB and 0xRRGGBB. */
export const normalizeHex = (hex) => {
  if (typeof hex !== 'string') return '#000000';
  let h = hex.trim().replace(/^0x/i, '');
  if (!h.startsWith('#')) h = `#${h}`;
  if (/^#([A-Fa-f0-9]{3})$/.test(h)) {
    const r = h[1], g = h[2], b = h[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^#([A-Fa-f0-9]{6})$/.test(h)) return h.toUpperCase();
  return '#000000';
};

// -------------------------------- conversions --------------------------------
export const hslToHex = (h, s, l) => {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 100);
  l = clamp(l, 0, 100);

  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return toHex(Math.round(255 * c));
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

export const hexToRgb = (hex) => {
  const h = normalizeHex(hex);
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  return { r, g, b };
};

export const rgbToHex = ({ r, g, b }) =>
  `#${toHex(clamp(r, 0, 255))}${toHex(clamp(g, 0, 255))}${toHex(clamp(b, 0, 255))}`;

export const hexToHsl = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255, gn = g / 255, bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      default: h = (rn - gn) / d + 4; break;
    }
    h /= 6;
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

// --------------------------------- geometry ----------------------------------
export const normalizeAngle = (angle) => {
  let a = angle;
  while (a < 0) a += 360;
  while (a >= 360) a -= 360;
  return a;
};

export const angleToPosition = (angle, radius, centerX, centerY) => {
  const radians = (angle - 90) * (Math.PI / 180);
  return { x: centerX + radius * Math.cos(radians), y: centerY + radius * Math.sin(radians) };
};

export const positionToAngle = (x, y, centerX, centerY) => {
  let angle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
  angle += 90;
  return normalizeAngle(angle);
};

export const calculateDistance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

// --------------------------- WCAG luminance/contrast -------------------------
export const relativeLuminance = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  const srgb = [r, g, b].map(v => v / 255).map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
};

export const contrastRatio = (hex1, hex2) => {
  const L1 = relativeLuminance(hex1);
  const L2 = relativeLuminance(hex2);
  const [bright, dark] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (bright + 0.05) / (dark + 0.05);
};

export const getContrastingTextColor = (hexColor) =>
  contrastRatio(normalizeHex(hexColor), '#000000') >= 4.5 ? '#000000' : '#FFFFFF';


// ========================= OKLab / OKLCH + WCAG upgrades =========================
// Linearize sRGB channel
const _srgbToLinear = (c) => {
  c = c / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const _linearToSrgb = (c) => {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1/2.4) - 0.055;
  return Math.min(255, Math.max(0, Math.round(v * 255)));
};

export const rgbToOklab = (r, g, b) => {
  const R = _srgbToLinear(r);
  const G = _srgbToLinear(g);
  const B = _srgbToLinear(b);
  const l = 0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B;
  const m = 0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B;
  const s = 0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const b2 = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  return { L, a, b: b2 };
};

export const oklabToRgb = (L, a, b2) => {
  const l_ = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b2, 3);
  const m_ = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b2, 3);
  const s_ = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b2, 3);
  let R = +4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
  let G = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
  let B = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_;
  return { r: _linearToSrgb(R), g: _linearToSrgb(G), b: _linearToSrgb(B) };
};

export const oklabToOklch = (L, a, b) => {
  const C = Math.sqrt(a*a + b*b);
  let h = Math.atan2(b, a) * 180 / Math.PI;
  if (h < 0) h += 360;
  return { L, C, h };
};
export const oklchToOklab = (L, C, h) => {
  const hr = (h * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  return { L, a, b };
};

export const hexToOklch = (hex) => {
  const { r,g,b } = hexToRgb(hex);
  const { L,a,b:bb } = rgbToOklab(r,g,b);
  return oklabToOklch(L,a,bb);
};

export const oklchToHexClamped = (L, C, h, maxIterations = 20) => {
  let lo = 0, hi = C, best = null;
  for (let i=0;i<maxIterations;i++) {
    const mid = (lo + hi) / 2;
    const { a, b } = oklchToOklab(L, mid, h);
    const { r,g,b:bb } = oklabToRgb(L, a, b);
    const inGamut = r>=0 && r<=255 && g>=0 && g<=255 && bb>=0 && bb<=255;
    if (inGamut) { best = { r,g,b:bb }; lo = mid; } else { hi = mid; }
  }
  if (!best) {
    const { a, b } = oklchToOklab(L, 0, h);
    const { r,g,b:bb } = oklabToRgb(L, a, b);
    return rgbToHex({ r, g, b: bb });
  }
  return rgbToHex(best);
};

export const nearestAccessible = (hexBg, hexFg, target = 4.5) => {
  const fg = hexToOklch(hexFg);
  let L = fg.L;
  const step = 0.01;
  let tries = 0;
  let best = hexFg;
  let bestCR = contrastRatio(hexBg, hexFg);

  while (tries < 40 && bestCR < target) {
    L = Math.min(1, Math.max(0, L + (bestCR < target ? (L < 0.5 ? -step : step) : 0)));
    const nudged = oklchToHexClamped(L, fg.C, fg.h);
    const cr = contrastRatio(hexBg, nudged);
    if (cr > bestCR) { bestCR = cr; best = nudged; }
    else {
      L = Math.min(1, Math.max(0, L - 2*step));
      const nudged2 = oklchToHexClamped(L, fg.C, fg.h);
      const cr2 = contrastRatio(hexBg, nudged2);
      if (cr2 > bestCR) { bestCR = cr2; best = nudged2; }
    }
    tries++;
  }
  return { hex: best, ratio: bestCR };
};

const SCHEME_OFFSETS_OKLCH = {
  analogous: [0, 30, -30],
  complementary: [0, 180],
  triadic: [0, 120, 240],
  tetradic: [0, 90, 180, 270],
  'split-complementary': [0, 150, -150],
  monochromatic: [0],
};

const generateOklchScheme = (baseHex, type = 'analogous') => {
  const { L, C, h } = hexToOklch(baseHex);
  const deltas = SCHEME_OFFSETS_OKLCH[type] || SCHEME_OFFSETS_OKLCH.analogous;
  const hues = deltas.map(d => (h + d + 360) % 360);
  const colors = hues.map(hh => oklchToHexClamped(L, C, hh));
  return { baseHex: normalizeHex(baseHex), scheme: type, hues, colors };
};
// ======================= end OKLab / OKLCH + WCAG upgrades =====================
// ----------------------------- schemes/markers -------------------------------
export const getColorScheme = (baseColor, scheme, baseAngle) => {
  const baseHex = normalizeHex(baseColor);
  const { L, C, h } = hexToOklch(baseHex);
  const angle = typeof baseAngle === 'number' ? baseAngle : h;
  switch (scheme) {
    case 'complementary': {
      const hues = [angle, (angle + 180) % 360];
      return hues.map(hh => oklchToHexClamped(L, C, hh)).map(normalizeHex);
    }
    case 'analogous': {
      const hues = [angle, (angle + 30) % 360, (angle + 330) % 360];
      return hues.map(hh => oklchToHexClamped(L, C, hh)).map(normalizeHex);
    }
    case 'triadic': {
      const hues = [angle, (angle + 120) % 360, (angle + 240) % 360];
      return hues.map(hh => oklchToHexClamped(L, C, hh)).map(normalizeHex);
    }
    case 'tetradic': {
      const hues = [angle, (angle + 90) % 360, (angle + 180) % 360, (angle + 270) % 360];
      return hues.map(hh => oklchToHexClamped(L, C, hh)).map(normalizeHex);
    }
    case 'monochromatic': {
      // keep hue constant, vary L around base
      const Ls = [Math.max(0, L - 0.2), L, Math.min(1, L + 0.2)];
      return Ls.map(Lv => oklchToHexClamped(Lv, C, angle)).map(normalizeHex);
    }
    default: {
      return [baseHex];
    }
  }
};

/**
 * Calculate marker positions for multi-marker color schemes
 */
export const calculateMarkerPositions = (scheme, baseAngle, activeMarkerId = 1) => {
  const a = normalizeAngle(baseAngle);
  const mk = (id, ang, s = 100, l = 50) => ({
    id, angle: normalizeAngle(ang), color: hslToHex(normalizeAngle(ang), s, l), isActive: activeMarkerId === id
  });

  switch (scheme) {
    case 'complementary':
      return [mk(1, a), mk(2, a + 180)];
    case 'analogous':
      return [mk(1, a), mk(2, a + 30), mk(3, a - 30)];
    case 'triadic':
      return [mk(1, a), mk(2, a + 120), mk(3, a + 240)];
    case 'tetradic':
      return [mk(1, a), mk(2, a + 90), mk(3, a + 180), mk(4, a + 270)];
    case 'monochromatic':
      return [mk(1, a), mk(2, a, 100, 30), mk(3, a, 100, 70), mk(4, a, 60, 50)];
    default:
      return [mk(1, a)];
  }
};

/**
 * Update marker positions when one marker is moved
 */
export const updateMarkerPositions = (currentMarkers, activeMarkerId, newAngle, scheme) => {
  if (scheme === 'freestyle') {
    return currentMarkers.map(m =>
      m.id === activeMarkerId ? { ...m, angle: newAngle, color: hslToHex(newAngle, 100, 50) } : m
    );
  }
  const active = currentMarkers.find(m => m.id === activeMarkerId);
  if (!active) return currentMarkers;

  let base = newAngle;
  switch (scheme) {
    case 'complementary':
      if (activeMarkerId === 2) base = normalizeAngle(newAngle - 180); break;
    case 'analogous':
      if (activeMarkerId === 2) base = normalizeAngle(newAngle - 30);
      else if (activeMarkerId === 3) base = normalizeAngle(newAngle + 30);
      break;
    case 'triadic':
      if (activeMarkerId === 2) base = normalizeAngle(newAngle - 120);
      else if (activeMarkerId === 3) base = normalizeAngle(newAngle - 240);
      break;
    case 'tetradic':
      if (activeMarkerId === 2) base = normalizeAngle(newAngle - 90);
      else if (activeMarkerId === 3) base = normalizeAngle(newAngle - 180);
      else if (activeMarkerId === 4) base = normalizeAngle(newAngle - 270);
      break;
    default: break;
  }
  return calculateMarkerPositions(scheme, base, activeMarkerId);
};

/**
 * Check if a point is within the color wheel ring
 */
export const isPointInColorWheelRing = (x, y, centerX, centerY, outerRadius, innerRadius) => {
  const d = calculateDistance(x, y, centerX, centerY);
  return d >= innerRadius && d <= outerRadius;
};

export const generateColorWheelPath = (radius, strokeWidth) => {
  const outer = radius;
  const inner = radius - strokeWidth;
  return `
    M ${outer} 0
    A ${outer} ${outer} 0 1 1 ${outer - 0.01} 0
    L ${inner - 0.01} 0
    A ${inner} ${inner} 0 1 0 ${inner} 0
    Z
  `;
};

// ---------------------------- validation/blending ----------------------------
export const isValidHexColor = (hex) => /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(String(hex).trim());
export const validateHexColor = isValidHexColor; // alias for back-compat

export const blendColors = (color1, color2, ratio) => {
  const a = normalizeHex(color1);
  const b = normalizeHex(color2);
  const t = clamp(Number.isFinite(ratio) ? ratio : 0.5, 0, 1);

  const { r: r1, g: g1, b: b1 } = hexToRgb(a);
  const { r: r2, g: g2, b: b2 } = hexToRgb(b);

  const r = Math.round(r1 * (1 - t) + r2 * t);
  const g = Math.round(g1 * (1 - t) + g2 * t);
  const bb = Math.round(b1 * (1 - t) + b2 * t);

  return `#${toHex(r)}${toHex(g)}${toHex(bb)}`;
};

// Export all needed functions for FullColorWheel and ColorWheelScreen
export { generateOklchScheme, hexToOklch, oklchToHexClamped, contrastRatio, nearestAccessible };

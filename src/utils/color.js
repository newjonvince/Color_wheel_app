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

// ----------------------------- schemes/markers -------------------------------
export const getColorScheme = (baseColor, scheme, baseAngle) => {
  const baseHex = normalizeHex(baseColor);
  let angle = typeof baseAngle === 'number' ? baseAngle : hexToHsl(baseHex).h;

  const colors = [baseHex];
  switch (scheme) {
    case 'complementary':
      colors.push(hslToHex(normalizeAngle(angle + 180), 100, 50)); break;
    case 'analogous':
      colors.push(hslToHex(normalizeAngle(angle + 30), 100, 50));
      colors.push(hslToHex(normalizeAngle(angle - 30), 100, 50)); break;
    case 'triadic':
      colors.push(hslToHex(normalizeAngle(angle + 120), 100, 50));
      colors.push(hslToHex(normalizeAngle(angle + 240), 100, 50)); break;
    case 'tetradic':
      colors.push(hslToHex(normalizeAngle(angle + 90), 100, 50));
      colors.push(hslToHex(normalizeAngle(angle + 180), 100, 50));
      colors.push(hslToHex(normalizeAngle(angle + 270), 100, 50)); break;
    case 'monochromatic':
      colors.push(hslToHex(angle, 100, 30));
      colors.push(hslToHex(angle, 100, 70));
      colors.push(hslToHex(angle, 60, 50)); break;
    default: break;
  }
  return colors.map(normalizeHex);
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

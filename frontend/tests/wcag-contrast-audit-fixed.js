/**
 * WCAG Contrast Audit: CanteenLoginPage (FIXED)
 * 
 * Validación de ratios de contraste según WCAG AA (4.5:1 para texto pequeño)
 * Herramienta: Cálculos de luminancia relativa
 * 
 * CAMBIOS APLICADOS:
 * - Focus ring: teal-500 → teal-600 (2.49:1 → 3.69:1 → necesita más)
 * - Button: teal-600 → teal-700 (3.74:1 → 5.47:1) ✅
 * - Disabled: gray-400 → gray-600 (2.54:1 → 7.56:1) ✅
 */

const colors = {
  'white': '#FFFFFF',
  'gray-50': '#F9FAFB',
  'gray-100': '#F3F4F6',
  'gray-300': '#D1D5DB',
  'gray-400': '#9CA3AF',
  'gray-500': '#6B7280',
  'gray-600': '#4B5563',
  'gray-700': '#374151',
  'gray-900': '#111827',
  'teal-50': '#F0FDFA',
  'teal-500': '#14B8A6',
  'teal-600': '#0D9488',
  'teal-700': '#0F766E',
  'teal-800': '#134E4A',
  'teal-900': '#0D5D57',
};

function getLuminance(hex) {
  const rgb = parseInt(hex.slice(1), 16);
  const r = (rgb >> 16) & 255;
  const g = (rgb >> 8) & 255;
  const b = rgb & 255;

  const [rs, gs, bs] = [r, g, b].map(x => {
    x = x / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrast(hex1, hex2) {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return ((lighter + 0.05) / (darker + 0.05)).toFixed(2);
}

console.log('\n📋 WCAG AA CONTRAST AUDIT: CanteenLoginPage\n');
console.log('Estándar: 4.5:1 (mínimo para texto pequeño)\n');
console.log('Norma: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html\n');

const tests = [
  // ── INPUTS: Estado Normal ──
  {
    name: 'Input Text (gray-900 on white)',
    fg: colors['gray-900'],
    bg: colors['white'],
    component: 'Text dentro del input',
    level: 'AAA',
  },
  {
    name: 'Input Placeholder (gray-600 on white)',
    fg: colors['gray-600'],
    bg: colors['white'],
    component: 'Placeholder text',
    level: 'AA',
  },
  {
    name: 'Input Label (gray-900 on white)',
    fg: colors['gray-900'],
    bg: colors['white'],
    component: 'Label text',
    level: 'AAA',
  },
  {
    name: 'Input Border (gray-300 on white)',
    fg: colors['gray-300'],
    bg: colors['white'],
    component: 'Border color',
    level: 'N/A',
  },

  // ── INPUTS: Focus State ──
  {
    name: 'Input Focus Text (gray-900 on teal-50)',
    fg: colors['gray-900'],
    bg: colors['teal-50'],
    component: 'Text in focus',
    level: 'AAA',
  },
  {
    name: 'Focus Ring (teal-700 on white)',
    fg: colors['teal-700'],
    bg: colors['white'],
    component: 'Focus border',
    level: 'AA',
  },

  // ── BOTÓN: Estados ──
  {
    name: '✅ Button Text (white on teal-700)',
    fg: colors['white'],
    bg: colors['teal-700'],
    component: 'CTA button',
    level: 'AA',
  },
  {
    name: 'Button Hover (white on teal-800)',
    fg: colors['white'],
    bg: colors['teal-800'],
    component: 'Button hover',
    level: 'AAA',
  },
  {
    name: '✅ Button Disabled (white on gray-600)',
    fg: colors['white'],
    bg: colors['gray-600'],
    component: 'Disabled state',
    level: 'AA',
  },

  // ── ICONOS ──
  {
    name: 'Icon (gray-500 on white)',
    fg: colors['gray-500'],
    bg: colors['white'],
    component: 'Normal icon',
    level: 'AA',
  },
  {
    name: 'Icon Hover (gray-900 on white)',
    fg: colors['gray-900'],
    bg: colors['white'],
    component: 'Show/hide toggle hover',
    level: 'AAA',
  },
];

let passCount = 0;
let failCount = 0;
let naCount = 0;

console.log('─'.repeat(75));
tests.forEach(test => {
  if (test.level === 'N/A') {
    console.log(`⚪ ${test.name}`);
    console.log(`   (No aplicable a bordes decorativos)`);
    console.log('');
    naCount++;
    return;
  }

  const ratio = getContrast(test.fg, test.bg);
  const passes = parseFloat(ratio) >= 4.5;
  const icon = passes ? '✅' : '❌';

  console.log(`${icon} ${test.name}`);
  console.log(`   Ratio: ${ratio}:1 (required: 4.5:1) | Level: ${test.level}`);
  console.log(`   Component: ${test.component}`);
  console.log('');

  if (passes) passCount++;
  else failCount++;
});

console.log('═'.repeat(75));
console.log(`📊 RESULTS: ${passCount}/${passCount + failCount} PASS | ${naCount} N/A`);
console.log('═'.repeat(75));

if (failCount === 0) {
  console.log('\n✅ WCAG AA COMPLIANT!');
  console.log('   Todos los elementos de texto cumplen con 4.5:1 mínimo.\n');
  process.exit(0);
} else {
  console.log('\n⚠️  Algunos elementos NO cumplen WCAG AA.\n');
  process.exit(1);
}

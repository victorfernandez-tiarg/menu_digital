/**
 * WCAG Contrast Audit: CanteenLoginPage
 * 
 * Validación de ratios de contraste según WCAG AA (4.5:1 para texto pequeño)
 * Herramienta: Cálculos de luminancia relativa
 */

// Colores Tailwind utilizados
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
};

// Cálculo de luminancia relativa (WCAG 2.0)
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

// Cálculo de ratio de contraste (WCAG 2.0)
function getContrast(hex1, hex2) {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return ((lighter + 0.05) / (darker + 0.05)).toFixed(2);
}

// Auditoría
console.log('\n📋 WCAG AA CONTRAST AUDIT: CanteenLoginPage\n');
console.log('Estándar: 4.5:1 (mínimo para texto pequeño)\n');

const tests = [
  // Inputs en estado normal
  {
    name: 'Input Text (gray-900 on white)',
    fg: colors['gray-900'],
    bg: colors['white'],
    type: 'Normal input text',
  },
  {
    name: 'Input Placeholder (gray-600 on white)',
    fg: colors['gray-600'],
    bg: colors['white'],
    type: 'Placeholder text (improved)',
  },
  {
    name: 'Input Label (gray-900 on white)',
    fg: colors['gray-900'],
    bg: colors['white'],
    type: 'Label text',
  },

  // Inputs en estado focus
  {
    name: 'Input Focus Text (gray-900 on teal-50)',
    fg: colors['gray-900'],
    bg: colors['teal-50'],
    type: 'Focus state background',
  },
  {
    name: 'Focus Ring (teal-500 on white)',
    fg: colors['teal-500'],
    bg: colors['white'],
    type: 'Focus ring border',
  },

  // Botón
  {
    name: 'Button Text (white on teal-600)',
    fg: colors['white'],
    bg: colors['teal-600'],
    type: 'CTA button',
  },
  {
    name: 'Button Hover (white on teal-700)',
    fg: colors['white'],
    bg: colors['teal-700'],
    type: 'Button hover state',
  },
  {
    name: 'Button Disabled (white on gray-400)',
    fg: colors['white'],
    bg: colors['gray-400'],
    type: 'Disabled state',
  },

  // Iconos
  {
    name: 'Icon (gray-500 on white)',
    fg: colors['gray-500'],
    bg: colors['white'],
    type: 'Icon color',
  },
  {
    name: 'Icon Hover (gray-900 on white)',
    fg: colors['gray-900'],
    bg: colors['white'],
    type: 'Icon hover (show/hide toggle)',
  },
];

let passCount = 0;
let failCount = 0;

tests.forEach(test => {
  const ratio = getContrast(test.fg, test.bg);
  const passes = parseFloat(ratio) >= 4.5;
  const icon = passes ? '✅' : '❌';
  
  console.log(`${icon} ${test.name}`);
  console.log(`   Ratio: ${ratio}:1 (required: 4.5:1)`);
  console.log(`   Type: ${test.type}`);
  console.log('');

  if (passes) passCount++;
  else failCount++;
});

console.log('═'.repeat(60));
console.log(`📊 RESULTS: ${passCount} PASS / ${failCount} FAIL`);
console.log('═'.repeat(60));

if (failCount === 0) {
  console.log('\n✅ ¡WCAG AA COMPLIANT! Todos los elementos cumplen contraste mínimo.\n');
  process.exit(0);
} else {
  console.log('\n⚠️  Algunos elementos no cumplen WCAG AA. Revisar arriba.\n');
  process.exit(1);
}

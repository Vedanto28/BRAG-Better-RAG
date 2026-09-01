/**
 * BRAG Design System Tokens
 * Source of Truth: Stitch Project 3169147492708506007
 * Strict Inheritance — Extends BRAG Midnight Lab System
 */

export const colors = {
  // Base Surfaces
  bgWindow: '#0a0b0d',
  bgApp: '#0c0d10',
  bgCanvas: '#111317',
  bgSidebar: '#131519',
  bgCard: '#191c22',
  bgElevated: '#20242c',
  bgCode: '#0f1115',

  // Borders & Dividers
  border: '#24272f',
  borderSoft: '#1b1e24',

  // Text Neutral Scale
  textPrimary: '#f5f7fa',
  textSecondary: '#a5adbb',
  textMuted: '#6c7280',

  // Brand Accents
  violet: '#7c5cff',
  violetSoft: 'rgba(124, 92, 255, 0.14)',
  violet2: '#8a74ff',
  violet3: '#a18dff',
  blue: '#3b82f6',
  blueSoft: 'rgba(59, 130, 246, 0.14)',

  // Semantic Stages & Statuses
  mint: '#34d399',
  mintSoft: 'rgba(52, 211, 153, 0.14)',
  amber: '#fbbf24',
  amberSoft: 'rgba(251, 191, 36, 0.14)',
  coral: '#fb7185',
  coralSoft: 'rgba(251, 113, 133, 0.14)',
  emerald: '#10b981',
  emeraldSoft: 'rgba(16, 185, 129, 0.14)',
} as const;

export const typography = {
  fontFamily: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "ui-monospace, 'SF Mono', Menlo, Monaco, 'Courier New', monospace",
  },
  fontSize: {
    hero: '32px',
    h1: '24px',
    h2: '18px',
    h3: '15px',
    body: '14px',
    bodySmall: '13px',
    caption: '12px',
    eyebrow: '11px',
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
  },
  lineHeight: {
    tight: 1.2,
    heading: 1.35,
    body: 1.55,
    caption: 1.4,
  },
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '36px',
  gridGap: '14px',
  sidebarWidth: '216px',
  headerHeight: '56px',
} as const;

export const borderRadius = {
  sm: '5px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

export const motion = {
  duration: {
    fast: '120ms',
    normal: '180ms',
    smooth: '250ms',
    indicator: '280ms',
    modal: '400ms',
    pulse: '2.2s',
  },
  easing: {
    standard: 'cubic-bezier(.22, .9, .3, 1)',
    ease: 'ease',
    easeInOut: 'ease-in-out',
  },
} as const;

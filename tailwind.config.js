/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        space: '#09090b',
        panel: '#18181b',
        metal: '#27272a',
        accent: {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
          soft: 'rgba(59, 130, 246, 0.1)',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'fade-in-up': 'fadeInUp 0.25s ease-out',
        'pulse-glow': 'pulseGlow 2.4s ease-in-out infinite',
        'grid-drift': 'gridDrift 60s linear infinite',
        'grid-drift-rev': 'gridDriftRev 90s linear infinite',
        'breathe': 'breathe 8s ease-in-out infinite',
        'flicker': 'flicker 6s linear infinite',
        'caret-blink': 'caretBlink 1.1s step-end infinite',
        'bounce-dot': 'bounceDot 1.2s ease-in-out infinite',
        'toast-in': 'toastIn 0.25s ease-out',
        'scan': 'scan 1.8s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 6px 1px rgba(59,130,246,0.6)' },
          '50%': { opacity: '0.6', boxShadow: '0 0 2px 0px rgba(59,130,246,0.2)' },
        },
        gridDrift: {
          '0%': { transform: 'translate3d(0, 0, 0)' },
          '100%': { transform: 'translate3d(64px, 64px, 0)' },
        },
        gridDriftRev: {
          '0%': { transform: 'translate3d(0, 0, 0)' },
          '100%': { transform: 'translate3d(-64px, -64px, 0)' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '0.85' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '3%': { opacity: '0.6' },
          '5%': { opacity: '1' },
          '42%': { opacity: '1' },
          '44%': { opacity: '0.75' },
          '46%': { opacity: '1' },
        },
        caretBlink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        bounceDot: {
          '0%, 80%, 100%': { transform: 'translateY(0)', opacity: '0.5' },
          '40%': { transform: 'translateY(-4px)', opacity: '1' },
        },
        toastIn: {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        scan: {
          '0%': { left: '-100%' },
          '100%': { left: '200%' },
        },
      },
    },
  },
  plugins: [],
};

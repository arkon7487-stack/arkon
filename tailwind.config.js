/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontWeight: {
        500: '500',
        600: '600',
        700: '700',
        800: '800',
      },
      fontFamily: {
        sans: ['Cairo', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Cairo', 'Inter', 'system-ui', 'sans-serif'],
        arabic: ['Cairo', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          950: '#0c1729',
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          600: '#475569',
          500: '#64748b',
        },
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#1952d0',
          600: '#1543b0',
          700: '#103490',
          800: '#0b266e',
          900: '#071852',
        },
        accent: {
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
        },
        success: { 50: '#f0fdf4', 100: '#dcfce7', 400: '#4ade80', 500: '#22c55e', 600: '#16a34a' },
        warning: { 50: '#fffbeb', 100: '#fef9c3', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706' },
        danger: { 50: '#fef2f2', 100: '#fee2e2', 400: '#f87171', 500: '#ef4444', 600: '#dc2626' },
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
        glow: '0 4px 14px -4px rgba(25,82,208,0.35)',
        'glow-lg': '0 0 40px -8px rgba(25,82,208,0.3), 0 0 80px -20px rgba(25,82,208,0.1)',
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0', transform: 'translateY(4px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'slide-in': { '0%': { opacity: '0', transform: 'translateX(8px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' },
        'scan-line': { '0%': { transform: 'translateY(-100%)', opacity: '0' }, '50%': { opacity: '0.6' }, '100%': { transform: 'translateY(400%)', opacity: '0' } },
        'success-pop': { '0%': { transform: 'scale(0)', opacity: '0' }, '60%': { transform: 'scale(1.15)', opacity: '1' }, '100%': { transform: 'scale(1)', opacity: '1' } },
      },
      animation: {
        'fade-in': 'fade-in .35s ease-out both',
        'slide-in': 'slide-in .3s ease-out both',
        shimmer: 'shimmer 1.6s linear infinite',
        'scan-line': 'scan-line 2s ease-in-out infinite',
        'success-pop': 'success-pop 0.5s ease-out both',
      },
    },
  },
  plugins: [],
};

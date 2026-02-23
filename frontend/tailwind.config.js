/** Rezvo Brand Tokens — LOCKED Feb 2026 */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Core palette ── */
        forest:           { DEFAULT: '#1B4332', dark: '#0A1F14' },
        fern:             '#2D6A4F',
        sage:             '#40916C',
        mint:             '#D8F3DC',
        terracotta:       { DEFAULT: '#D4A373', dark: '#B8895A' },
        cream:            '#FAF7F2',
        ink:              '#141413',

        /* ── Semantic ── */
        text:             '#2C2C2A',
        muted:            '#7A776F',
        border:           { DEFAULT: '#E8E4DD', light: '#F0EDE7' },
        background:       '#FAF7F2',
        card:             '#FFFFFF',

        /* ── Aliases (backward compat) ── */
        primary:          '#1B4332',
        'primary-hover':  '#143326',

        /* ── Status ── */
        'status-confirmed':     '#065F46',
        'status-confirmed-bg':  '#ECFDF5',
        'status-pending':       '#92400E',
        'status-pending-bg':    '#FFFBEB',
        'status-cancelled':     '#991B1B',
        'status-cancelled-bg':  '#FEF2F2',
        'status-seated':        '#1E40AF',
        'status-seated-bg':     '#EFF6FF',
      },
      fontFamily: {
        sans:     ['Figtree', 'system-ui', 'sans-serif'],
        body:     ['Figtree', 'system-ui', 'sans-serif'],
        heading:  ['Figtree', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card:  '12px',
        input: '8px',
        pill:  '9999px',
      },
      boxShadow: {
        soft:  '0 4px 20px -2px rgba(20, 20, 19, 0.06)',
        card:  '0 4px 20px -2px rgba(20, 20, 19, 0.06)',
        'card-hover': '0 12px 40px -4px rgba(20, 20, 19, 0.12)',
      },
    },
  },
  plugins: [],
}

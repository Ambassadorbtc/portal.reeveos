export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1B4332',
        'primary-hover': '#143326',
        background: '#FEFBF4',
        card: '#FFFFFF',
        border: '#E8E0D4',
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
        text: {
          main: '#1B4332',
          muted: '#6B7280',
          light: '#9CA3AF',
        },
        forest: {
          DEFAULT: '#1B4332',
          dark: '#0A1F14',
          darker: '#061209'
        },
        sage: '#2D6A4F',
        green: '#40916C',
        mint: '#52B788',
        'light-green': '#74C69D',
        'pale-green': '#D8F3DC',
        cream: '#FAFAF7',
        warm: '#F4F0E8',
        sand: '#E8E0D0',
        latte: '#D4C5A9',
        brown: '#8B7355',
        espresso: '#5C4A32',
        gold: '#D4A017',
        amber: '#B8860B',
        coral: '#E8634A',
        'off-white': '#F4F5F0',
        border: '#E2E5DF',
        'warm-border': '#DDD5C5',
        text: '#2A2A28',
        muted: '#6B706D',
        subtle: '#9CA09E'
      },
      fontFamily: {
        sans: ['Figtree', 'system-ui', 'sans-serif'],
        display: ['Figtree', 'system-ui', 'sans-serif'],
        heading: ['Figtree', 'system-ui', 'sans-serif'],
        body: ['Figtree', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
        input: '8px',
        pill: '100px'
      },
      boxShadow: {
        card: '0 4px 20px -2px rgba(27, 67, 50, 0.08)',
        'card-hover': '0 12px 40px -4px rgba(27, 67, 50, 0.15)'
      },
      transitionDuration: {
        fast: '120ms',
        normal: '200ms'
      }
    }
  },
  plugins: []
}

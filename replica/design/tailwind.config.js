// Maps tokens.css into Tailwind. Components use bg-surface, text-muted, never raw hex.
module.exports = {
  theme: {
    extend: {
      colors: {
        'bg': 'var(--color-bg)',
        'surface': 'var(--color-surface)',
        'border': 'var(--color-border)',
        'border-input': 'var(--color-border-input)',
        'text': 'var(--color-text)',
        'text-muted': 'var(--color-text-muted)',
        'accent': 'var(--color-accent)',
        'on-accent': 'var(--color-on-accent)',
        'danger': 'var(--color-danger)',
        'success': 'var(--color-success)',
        'score-good': 'var(--color-score-good)',
        'score-ok': 'var(--color-score-ok)',
        'score-poor': 'var(--color-score-poor)',
        'score-bad': 'var(--color-score-bad)',
        'on-score': 'var(--color-on-score)',
        'warning': 'var(--color-warning)'
      },
      borderRadius: { sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)', pill: 'var(--radius-pill)' },
      boxShadow: { card: 'var(--shadow-card)', pop: 'var(--shadow-pop)' },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
};

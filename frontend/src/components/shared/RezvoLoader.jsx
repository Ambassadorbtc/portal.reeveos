/**
 * RezvoLoader — Branded loading component
 * Uses the Rezvo "R" logo with pulse animation
 * Drop-in replacement for generic spinners across the app
 */

export default function RezvoLoader({ message = 'Loading...', size = 'md', inline = false }) {
  const sizes = {
    sm: { box: 28, font: 14, r: 12, msgSize: 11 },
    md: { box: 40, font: 20, r: 16, msgSize: 13 },
    lg: { box: 56, font: 28, r: 22, msgSize: 15 },
  }
  const s = sizes[size] || sizes.md

  if (inline) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: s.box, height: s.box, borderRadius: 10,
          background: '#1B4332', display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'rezvo-pulse 1.5s ease-in-out infinite',
        }}>
          <span style={{ color: '#FAFAF7', fontWeight: 800, fontSize: s.r, fontFamily: "'Figtree', system-ui, sans-serif" }}>R</span>
        </div>
        {message && <span style={{ fontSize: s.msgSize, fontWeight: 500, color: '#6B7280', fontFamily: "'Figtree', sans-serif" }}>{message}</span>}
        <style>{rezvoStyles}</style>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', minHeight: 200, background: '#fff', fontFamily: "'Figtree', sans-serif",
    }}>
      <div style={{
        width: s.box, height: s.box, borderRadius: s.box * 0.22,
        background: '#1B4332', display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'rezvo-pulse 1.5s ease-in-out infinite',
        boxShadow: '0 4px 16px rgba(27,67,50,0.25)',
      }}>
        <span style={{ color: '#FAFAF7', fontWeight: 800, fontSize: s.r, fontFamily: "'Figtree', system-ui, sans-serif" }}>R</span>
      </div>
      {message && (
        <span style={{ marginTop: 14, fontSize: s.msgSize, fontWeight: 500, color: '#6B7280' }}>{message}</span>
      )}
      <style>{rezvoStyles}</style>
    </div>
  )
}

const rezvoStyles = `
  @keyframes rezvo-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.08); opacity: 0.85; }
  }
`

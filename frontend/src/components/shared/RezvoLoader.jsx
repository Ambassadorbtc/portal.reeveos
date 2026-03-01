/**
 * RezvoLoader — Branded loading animation
 * Four black squares that bounce in sequence
 * Used globally across all loading states
 */

export default function RezvoLoader({ message = 'Loading...', size = 'md', inline = false }) {
  const sizes = {
    sm: { sq: 6, gap: 3, msgSize: 11 },
    md: { sq: 10, gap: 4, msgSize: 13 },
    lg: { sq: 14, gap: 5, msgSize: 15 },
  }
  const s = sizes[size] || sizes.md

  const squares = (
    <div style={{ display: 'flex', gap: s.gap, alignItems: 'end' }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{
          width: s.sq, height: s.sq,
          borderRadius: s.sq * 0.2,
          background: '#111111',
          animation: `rezvo-bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
        }} />
      ))}
    </div>
  )

  if (inline) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {squares}
        {message && <span style={{ fontSize: s.msgSize, fontWeight: 500, color: '#6B7280', fontFamily: "'Figtree', sans-serif" }}>{message}</span>}
        <style>{rezvoStyles}</style>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', minHeight: 200, background: 'transparent', fontFamily: "'Figtree', sans-serif",
    }}>
      {squares}
      {message && (
        <span style={{ marginTop: 14, fontSize: s.msgSize, fontWeight: 500, color: '#6B7280' }}>{message}</span>
      )}
      <style>{rezvoStyles}</style>
    </div>
  )
}

const rezvoStyles = `
  @keyframes rezvo-bounce {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
    40% { transform: translateY(-12px); opacity: 1; }
  }
`

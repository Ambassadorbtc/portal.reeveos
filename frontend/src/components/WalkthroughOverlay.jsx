/**
 * WalkthroughOverlay v5 — Interactive steps have NO backdrop.
 * Page is fully clickable. Only the pointer + bubble + gold ring float on top.
 * Non-interactive steps keep the dark backdrop with Next button.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useWalkthrough } from '../contexts/WalkthroughContext'
import { useAuth } from '../contexts/AuthContext'
import { X, Sparkles, Rocket, ArrowRight } from 'lucide-react'

const WalkthroughOverlay = () => {
  const { active, currentStep, stepIndex, totalSteps, next, back, skip } = useWalkthrough()
  const { user } = useAuth()
  const [targetRect, setTargetRect] = useState(null)
  const [visible, setVisible] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [taskDone, setTaskDone] = useState(false)
  const firstName = (user?.name || 'there').split(' ')[0]

  const measureTarget = useCallback(() => {
    if (!currentStep?.target) { setTargetRect(null); return }
    const timer = setTimeout(() => {
      const el = document.querySelector(currentStep.target)
      if (el) {
        const r = el.getBoundingClientRect()
        setTargetRect(r)
        if (r.top < 0 || r.bottom > window.innerHeight) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          setTimeout(() => setTargetRect(el.getBoundingClientRect()), 400)
        }
      } else { setTargetRect(null) }
    }, 600)
    return () => clearTimeout(timer)
  }, [currentStep])

  useEffect(() => { const c = measureTarget(); return c }, [measureTarget, stepIndex])
  useEffect(() => {
    setTaskDone(false); setTransitioning(true)
    const t = setTimeout(() => setTransitioning(false), 350)
    return () => clearTimeout(t)
  }, [stepIndex])

  // For interactive steps: detect when user clicks inside the target,
  // OR when something changes on the page (panel opens, navigation, etc.)
  useEffect(() => {
    if (!active || !currentStep?.interactive || taskDone) return
    const handler = () => {
      // Small delay to let the UI react to the click first
      setTimeout(() => {
        setTaskDone(true)
        setTimeout(() => next(), 1200)
      }, 200)
    }

    if (!targetRect) return

    // Find the actual target element and attach click listener directly to it
    const el = document.querySelector(currentStep.target)
    if (el) {
      // Listen on the element AND all its children
      el.addEventListener('click', handler)
      return () => el.removeEventListener('click', handler)
    }
  }, [active, currentStep, targetRect, taskDone, next])

  useEffect(() => {
    if (active) setTimeout(() => setVisible(true), 50)
    else setVisible(false)
  }, [active])

  useEffect(() => {
    const h = () => measureTarget()
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [measureTarget])

  if (!active || !currentStep) return null

  const isModal = currentStep.type === 'modal'
  const isComplete = currentStep.id === 'complete'
  const isWelcome = currentStep.id === 'welcome'
  const isInteractive = currentStep.interactive && !taskDone
  const showBackdrop = !isInteractive // NO backdrop for interactive steps
  const bodyText = (currentStep.body || '').replace(/\{firstName\}/g, firstName)
  const taskText = (currentStep.task || '').replace(/\{firstName\}/g, firstName)

  const getBubbleStyle = () => {
    if (!targetRect || isModal) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    const bw = 460
    const pos = currentStep.position || 'bottom'
    let top, left
    if (pos === 'bottom') { top = targetRect.bottom + 24; left = targetRect.left + targetRect.width / 2 - bw / 2 }
    else if (pos === 'top') { top = targetRect.top - 340; left = targetRect.left + targetRect.width / 2 - bw / 2 }
    else if (pos === 'right') { top = targetRect.top; left = targetRect.right + 24 }
    else { top = targetRect.top; left = targetRect.left - bw - 24 }
    left = Math.max(16, Math.min(left, window.innerWidth - bw - 16))
    top = Math.max(16, Math.min(top, window.innerHeight - 380))
    return { top, left, transform: 'none' }
  }

  const bubbleStyle = getBubbleStyle()

  return (
    <>
      {/* ═══ BACKDROP (only for non-interactive steps + modals) ═══ */}
      {showBackdrop && visible && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }}>
          {targetRect && !isModal ? (
            <>
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: Math.max(0, targetRect.top - 12), background: 'rgba(0,0,0,0.6)' }} />
              <div style={{ position: 'fixed', top: targetRect.bottom + 12, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)' }} />
              <div style={{ position: 'fixed', top: targetRect.top - 12, left: 0, width: Math.max(0, targetRect.left - 12), height: targetRect.height + 24, background: 'rgba(0,0,0,0.6)' }} />
              <div style={{ position: 'fixed', top: targetRect.top - 12, left: targetRect.right + 12, right: 0, height: targetRect.height + 24, background: 'rgba(0,0,0,0.6)' }} />
            </>
          ) : (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
          )}
        </div>
      )}

      {/* ═══ GOLD RING around target (always visible) ═══ */}
      {targetRect && !isModal && visible && (
        <div style={{
          position: 'fixed', pointerEvents: 'none', zIndex: 9999,
          top: targetRect.top - 14, left: targetRect.left - 14,
          width: targetRect.width + 28, height: targetRect.height + 28,
          border: '3px solid #C9A84C', borderRadius: 16,
          boxShadow: '0 0 0 4px rgba(201,168,76,0.15), 0 0 40px rgba(201,168,76,0.25)',
          animation: 'wt-pulse 2s ease-in-out infinite',
          transition: 'all 500ms',
        }} />
      )}

      {/* ═══ HAND POINTER (always visible, always clickable-through) ═══ */}
      {targetRect && !isModal && visible && !taskDone && (
        <div style={{
          position: 'fixed', pointerEvents: 'none', zIndex: 10001,
          left: targetRect.left + targetRect.width / 2 + 20,
          top: targetRect.top + targetRect.height / 2 - 24,
          animation: 'wt-pointer 1.2s ease-in-out infinite',
          transition: 'left 500ms, top 500ms',
        }}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <g filter="url(#wtglow)">
              <path d="M16 6L16 40L24 32L32 48L38 45L30 29L40 29Z" fill="#C9A84C" stroke="#111" strokeWidth="2" strokeLinejoin="round"/>
            </g>
            <defs><filter id="wtglow" x="4" y="0" width="56" height="60" filterUnits="userSpaceOnUse"><feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#C9A84C" floodOpacity="0.6"/></filter></defs>
          </svg>
        </div>
      )}

      {/* ═══ TASK DONE CHECKMARK ═══ */}
      {taskDone && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10003, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: '#C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 40px rgba(0,0,0,0.3)', animation: 'wt-pop 0.5s ease-out forwards' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
        </div>
      )}

      {/* ═══ SKIP TOUR BUTTON ═══ */}
      {!isComplete && visible && (
        <button onClick={skip} style={{
          position: 'fixed', top: 16, right: 16, zIndex: 10002,
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px',
          borderRadius: 999, background: 'rgba(17,17,17,0.85)', backdropFilter: 'blur(8px)',
          color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
          fontFamily: 'Figtree, sans-serif', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}>
          <X size={14} /> Skip Tour
        </button>
      )}

      {/* ═══ SPEECH BUBBLE ═══ */}
      {visible && (
        <div style={{
          position: 'fixed', zIndex: 10001,
          top: typeof bubbleStyle.top === 'number' ? bubbleStyle.top : bubbleStyle.top,
          left: typeof bubbleStyle.left === 'number' ? bubbleStyle.left : bubbleStyle.left,
          transform: bubbleStyle.transform,
          opacity: transitioning ? 0 : 1,
          transition: 'opacity 300ms, transform 300ms',
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, width: isModal ? 500 : 460, maxWidth: '92vw',
            padding: isModal ? 32 : 24, fontFamily: 'Figtree, sans-serif',
            boxShadow: '0 16px 64px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)',
          }}>
            {/* Modal icon */}
            {isModal && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isComplete ? '#F0FDF4' : '#FBF5E6' }}>
                  {isComplete ? <Rocket size={32} color="#16A34A" /> : <Sparkles size={32} color="#C9A84C" />}
                </div>
              </div>
            )}

            {/* Step badge */}
            {!isModal && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'rgba(201,168,76,0.12)', padding: '5px 12px', borderRadius: 999 }}>
                  Step {stepIndex} / {totalSteps - 1}
                </span>
                {isInteractive && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.08em', background: '#ECFDF5', padding: '5px 12px', borderRadius: 999, animation: 'wt-pulse 2s ease-in-out infinite' }}>
                    Click to try
                  </span>
                )}
              </div>
            )}

            {/* Title */}
            <h3 style={{ fontWeight: 800, color: '#111', fontSize: isModal ? 26 : 20, marginBottom: 10, textAlign: isModal ? 'center' : 'left', lineHeight: 1.3 }}>
              {(currentStep.title || '').replace(/\{firstName\}/g, firstName)}
            </h3>

            {/* Body */}
            <p style={{ color: '#555', fontSize: 14, lineHeight: 1.75, textAlign: isModal ? 'center' : 'left', marginBottom: 14 }}>
              {bodyText}
            </p>

            {/* Task instruction */}
            {isInteractive && taskText && !taskDone && (
              <div style={{ background: '#FBF5E6', border: '2px solid rgba(201,168,76,0.25)', borderRadius: 14, padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
                <p style={{ color: '#111', fontSize: 14, fontWeight: 600, lineHeight: 1.5, margin: 0 }}>{taskText}</p>
              </div>
            )}

            {/* Task done */}
            {taskDone && (
              <div style={{ background: '#F0FDF4', border: '2px solid #BBF7D0', borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                <p style={{ color: '#16A34A', fontSize: 14, fontWeight: 700, margin: 0 }}>Nice one! Moving on...</p>
              </div>
            )}

            {/* Progress bar */}
            <div style={{ width: '100%', height: 6, background: '#E8E0D4', borderRadius: 3, marginBottom: 18, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#C9A84C', borderRadius: 3, transition: 'width 500ms', width: `${(stepIndex / (totalSteps - 1)) * 100}%` }} />
            </div>

            {/* Nav */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              {isWelcome ? (
                <>
                  <button onClick={skip} style={{ fontSize: 13, color: '#999', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 14px', fontFamily: 'Figtree, sans-serif', fontWeight: 500 }}>Skip Tour</button>
                  <button onClick={next} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 24px', borderRadius: 14, fontSize: 15, fontWeight: 700, background: '#C9A84C', color: '#111', border: 'none', cursor: 'pointer', fontFamily: 'Figtree, sans-serif' }}>
                    Let's Go <ArrowRight size={16} />
                  </button>
                </>
              ) : isComplete ? (
                <button onClick={next} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px 24px', borderRadius: 14, fontSize: 15, fontWeight: 700, background: '#111', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'Figtree, sans-serif' }}>
                  Go to Dashboard <ArrowRight size={16} />
                </button>
              ) : isInteractive ? (
                <p style={{ fontSize: 13, color: '#888', textAlign: 'center', width: '100%', margin: 0, lineHeight: 1.6 }}>
                  Click the highlighted area to continue, or{' '}
                  <button onClick={next} style={{ color: '#C9A84C', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, fontFamily: 'Figtree, sans-serif' }}>skip this step</button>
                </p>
              ) : (
                <>
                  {stepIndex > 1 && <button onClick={back} style={{ fontSize: 13, color: '#999', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 14px', fontFamily: 'Figtree, sans-serif', fontWeight: 500 }}>Back</button>}
                  <button onClick={next} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 24px', borderRadius: 14, fontSize: 15, fontWeight: 700, background: '#111', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'Figtree, sans-serif' }}>
                    {stepIndex >= totalSteps - 2 ? 'Finish' : 'Next'} <ArrowRight size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confetti */}
      {isComplete && visible && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 10004 }}>
          {Array.from({ length: 60 }).map((_, i) => (
            <div key={i} style={{
              position: 'absolute', width: 8, height: 8, borderRadius: '50%',
              left: `${Math.random() * 100}%`, top: -10,
              backgroundColor: ['#C9A84C', '#111', '#FFD700', '#FFF', '#E8E0D4'][i % 5],
              animation: `wt-confetti ${2 + Math.random() * 2}s linear ${Math.random() * 2}s forwards`,
            }} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes wt-pointer { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-6px,12px)} }
        @keyframes wt-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes wt-pop { 0%{transform:scale(0);opacity:0} 60%{transform:scale(1.2);opacity:1} 100%{transform:scale(1);opacity:1} }
        @keyframes wt-confetti { 0%{transform:translateY(-10px) rotate(0deg);opacity:1} 100%{transform:translateY(100vh) rotate(720deg);opacity:0} }
      `}</style>
    </>
  )
}

export default WalkthroughOverlay

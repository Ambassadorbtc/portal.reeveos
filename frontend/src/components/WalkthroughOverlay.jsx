/**
 * WalkthroughOverlay v2 — Interactive guided tour
 * - Animated bouncing arrow pointing at target element
 * - Click-to-advance: user must click the highlighted element to proceed
 * - Speech bubble with task instruction
 * - Gold highlight ring with pulse animation
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
  const bubbleRef = useRef(null)
  const firstName = (user?.name || 'there').split(' ')[0]

  const measureTarget = useCallback(() => {
    if (!currentStep?.target) { setTargetRect(null); return }
    const timer = setTimeout(() => {
      const el = document.querySelector(currentStep.target)
      if (el) {
        const rect = el.getBoundingClientRect()
        setTargetRect(rect)
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          setTimeout(() => setTargetRect(el.getBoundingClientRect()), 400)
        }
      } else { setTargetRect(null) }
    }, 600)
    return () => clearTimeout(timer)
  }, [currentStep])

  useEffect(() => { const c = measureTarget(); return c }, [measureTarget, stepIndex])
  useEffect(() => { setTaskDone(false); setTransitioning(true); const t = setTimeout(() => setTransitioning(false), 350); return () => clearTimeout(t) }, [stepIndex])

  // Interactive: listen for clicks on target
  useEffect(() => {
    if (!active || !currentStep?.interactive || !currentStep?.target) return
    const handler = (e) => {
      const el = document.querySelector(currentStep.target)
      if (el && (el.contains(e.target) || el === e.target)) {
        setTaskDone(true)
        setTimeout(() => next(), 900)
      }
    }
    document.addEventListener('click', handler, true)
    return () => document.removeEventListener('click', handler, true)
  }, [active, currentStep, next])

  useEffect(() => { if (active) setTimeout(() => setVisible(true), 50); else setVisible(false) }, [active])
  useEffect(() => { const h = () => measureTarget(); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [measureTarget])

  if (!active || !currentStep) return null

  const isModal = currentStep.type === 'modal'
  const isComplete = currentStep.id === 'complete'
  const isWelcome = currentStep.id === 'welcome'
  const isInteractive = currentStep.interactive && !taskDone
  const bodyText = (currentStep.body || '').replace('{firstName}', firstName)
  const taskText = (currentStep.task || '').replace('{firstName}', firstName)

  // Arrow position
  const getArrowStyle = () => {
    if (!targetRect || isModal) return null
    const pos = currentStep.arrowFrom || currentStep.position || 'top'
    const cx = targetRect.left + targetRect.width / 2
    const cy = targetRect.top + targetRect.height / 2
    if (pos === 'bottom') return { left: cx - 16, top: targetRect.bottom + 8, rot: 0 }
    if (pos === 'top') return { left: cx - 16, top: targetRect.top - 52, rot: 180 }
    if (pos === 'right') return { left: targetRect.right + 8, top: cy - 20, rot: -90 }
    return { left: targetRect.left - 52, top: cy - 20, rot: 90 }
  }
  const arrowStyle = getArrowStyle()

  // Bubble position
  const getBubblePos = () => {
    if (!targetRect || isModal) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    const bw = 360; const pos = currentStep.position || 'bottom'
    let top, left
    if (pos === 'bottom') { top = targetRect.bottom + 64; left = targetRect.left + targetRect.width / 2 - bw / 2 }
    else if (pos === 'top') { top = targetRect.top - 260; left = targetRect.left + targetRect.width / 2 - bw / 2 }
    else if (pos === 'right') { top = targetRect.top; left = targetRect.right + 64 }
    else { top = targetRect.top; left = targetRect.left - bw - 64 }
    left = Math.max(16, Math.min(left, window.innerWidth - bw - 16))
    top = Math.max(16, Math.min(top, window.innerHeight - 300))
    return { top: `${top}px`, left: `${left}px`, transform: 'none' }
  }

  return (
    <div className={`fixed inset-0 z-[9999] transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-black/50" onClick={e => e.stopPropagation()} />

      {/* Highlight cutout */}
      {targetRect && !isModal && (
        <div className="absolute rounded-xl transition-all duration-500" style={{
          top: targetRect.top - 8, left: targetRect.left - 8,
          width: targetRect.width + 16, height: targetRect.height + 16,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.55), 0 0 0 4px #C9A84C, 0 0 40px rgba(201,168,76,0.3)',
          pointerEvents: isInteractive ? 'auto' : 'none', cursor: isInteractive ? 'pointer' : 'default',
          zIndex: 10000,
        }}>
          <div className="absolute inset-[-4px] rounded-xl border-2 border-[#C9A84C]" style={{ animation: 'pulse-ring 2s ease-in-out infinite' }} />
        </div>
      )}

      {/* Animated bouncing arrow */}
      {arrowStyle && !isModal && (
        <div className="absolute z-[10001]" style={{ left: arrowStyle.left, top: arrowStyle.top, animation: 'bounce-arrow 1s ease-in-out infinite' }}>
          <svg width="32" height="44" viewBox="0 0 32 44" fill="none" style={{ transform: `rotate(${arrowStyle.rot}deg)` }}>
            <path d="M16 0L16 30" stroke="#C9A84C" strokeWidth="3" strokeLinecap="round" />
            <path d="M6 22L16 34L26 22" stroke="#C9A84C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="16" cy="38" r="4" fill="#C9A84C" opacity="0.6">
              <animate attributeName="r" values="3;5;3" dur="1s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.6;1;0.6" dur="1s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>
      )}

      {/* Skip */}
      {!isComplete && (
        <button onClick={skip} className="absolute top-4 right-4 z-[10002] flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white/70 text-sm font-medium hover:bg-white/20 hover:text-white transition-all">
          <X size={14} /> Skip Tour
        </button>
      )}

      {/* Task done checkmark flash */}
      {taskDone && (
        <div className="absolute inset-0 z-[10003] pointer-events-none flex items-center justify-center">
          <div style={{ animation: 'task-done-pop 0.5s ease-out forwards' }} className="bg-[#C9A84C] text-white rounded-full w-20 h-20 flex items-center justify-center shadow-2xl">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
        </div>
      )}

      {/* Speech bubble */}
      <div ref={bubbleRef} className={`absolute z-[10001] transition-all duration-300 ${transitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`} style={getBubblePos()}>
        <div className={`bg-white rounded-2xl shadow-2xl border border-[#E8E0D4] ${isModal ? 'w-[440px] max-w-[90vw] p-8' : 'w-[360px] max-w-[85vw] p-5'}`}>

          {isModal && (
            <div className="flex justify-center mb-5">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isComplete ? 'bg-green-50' : 'bg-[#FBF5E6]'}`}>
                {isComplete ? <Rocket className="w-7 h-7 text-green-600" /> : <Sparkles className="w-7 h-7 text-[#C9A84C]" />}
              </div>
            </div>
          )}

          {!isModal && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest bg-[#C9A84C]/10 px-2.5 py-1 rounded-full">
                Step {stepIndex} / {totalSteps - 1}
              </span>
              {isInteractive && (
                <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider bg-green-50 px-2.5 py-1 rounded-full" style={{ animation: 'pulse-ring 2s ease-in-out infinite' }}>
                  Try it
                </span>
              )}
            </div>
          )}

          <h3 className={`font-bold text-[#111] mb-1.5 ${isModal ? 'text-2xl text-center' : 'text-base'}`} style={{ fontFamily: 'Figtree, sans-serif' }}>
            {currentStep.title.replace('{firstName}', firstName)}
          </h3>

          <p className={`text-[#666] text-sm leading-relaxed ${isModal ? 'text-center mb-2' : 'mb-2'}`} style={{ fontFamily: 'Figtree, sans-serif' }}>
            {bodyText}
          </p>

          {isInteractive && taskText && (
            <div className="bg-[#FBF5E6] border border-[#C9A84C]/20 rounded-lg px-3 py-2.5 mb-3 flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-[#C9A84C] flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </div>
              <p className="text-[#111] text-xs font-semibold leading-relaxed" style={{ fontFamily: 'Figtree, sans-serif' }}>{taskText}</p>
            </div>
          )}

          {taskDone && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              <p className="text-green-700 text-xs font-bold">Nice one! Moving on...</p>
            </div>
          )}

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-[#E8E0D4] rounded-full mb-4 overflow-hidden">
            <div className="h-full bg-[#C9A84C] rounded-full transition-all duration-500" style={{ width: `${(stepIndex / (totalSteps - 1)) * 100}%` }} />
          </div>

          <div className="flex items-center justify-between gap-2">
            {isWelcome ? (
              <>
                <button onClick={skip} className="text-xs text-[#999] hover:text-[#111] font-medium px-3 py-2">Skip Tour</button>
                <button onClick={next} className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold" style={{ background: '#C9A84C', color: '#111' }}>
                  Let's Go <ArrowRight size={14} />
                </button>
              </>
            ) : isComplete ? (
              <button onClick={next} className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold" style={{ background: '#111', color: '#fff' }}>
                Go to Dashboard <ArrowRight size={14} />
              </button>
            ) : isInteractive ? (
              <p className="text-[10px] text-[#999] text-center w-full">
                Click the highlighted area to continue, or <button onClick={next} className="text-[#C9A84C] font-bold hover:underline">skip this step</button>
              </p>
            ) : (
              <>
                {stepIndex > 1 && <button onClick={back} className="text-xs text-[#999] hover:text-[#111] font-medium px-3 py-2">Back</button>}
                <button onClick={next} className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold" style={{ background: '#111', color: '#fff' }}>
                  {stepIndex >= totalSteps - 2 ? 'Finish' : 'Next'} <ArrowRight size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Confetti */}
      {isComplete && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-[10004]">
          {Array.from({ length: 50 }).map((_, i) => (
            <div key={i} className="absolute w-2 h-2 rounded-full" style={{
              left: `${Math.random() * 100}%`, top: '-10px',
              backgroundColor: ['#C9A84C', '#111', '#FFD700', '#FFF', '#E8E0D4'][i % 5],
              animation: `confetti-fall ${2 + Math.random() * 2}s linear ${Math.random() * 2}s forwards`,
            }} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes bounce-arrow { 0%,100%{transform:translateY(0)} 50%{transform:translateY(14px)} }
        @keyframes pulse-ring { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.03)} }
        @keyframes task-done-pop { 0%{transform:scale(0);opacity:0} 50%{transform:scale(1.2);opacity:1} 100%{transform:scale(1);opacity:1} }
        @keyframes confetti-fall { 0%{transform:translateY(-10px) rotate(0deg);opacity:1} 100%{transform:translateY(100vh) rotate(720deg);opacity:0} }
      `}</style>
    </div>
  )
}

export default WalkthroughOverlay

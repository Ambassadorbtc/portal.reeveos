/**
 * RoomSetupModal — First-time floor plan setup
 * Asks restaurant owner about their dining room dimensions.
 * Presets based on UK restaurant size research (dining area only).
 */
import { useState } from 'react'
import {
  Coffee, UtensilsCrossed, ChefHat, Building2,
  Beer, Zap, Gem, Ruler, ArrowRight, X
} from 'lucide-react'

const PRESETS = [
  {
    id: 'small_cafe',
    label: 'Small Café',
    desc: '10–20 covers',
    width_m: 5,
    height_m: 8,
    Icon: Coffee,
    color: '#D97706',
  },
  {
    id: 'bistro',
    label: 'Bistro',
    desc: '20–30 covers',
    width_m: 6,
    height_m: 10,
    Icon: UtensilsCrossed,
    color: '#059669',
  },
  {
    id: 'mid_restaurant',
    label: 'Mid-size Restaurant',
    desc: '40–60 covers',
    width_m: 10,
    height_m: 15,
    Icon: ChefHat,
    color: '#1B4332',
  },
  {
    id: 'large_restaurant',
    label: 'Large Restaurant',
    desc: '80–120 covers',
    width_m: 12,
    height_m: 18,
    Icon: Building2,
    color: '#7C3AED',
  },
  {
    id: 'pub_dining',
    label: 'Pub / Gastropub',
    desc: '40–60 covers',
    width_m: 8,
    height_m: 12,
    Icon: Beer,
    color: '#B45309',
  },
  {
    id: 'fast_food',
    label: 'Fast Food',
    desc: '15–30 covers',
    width_m: 5,
    height_m: 10,
    Icon: Zap,
    color: '#DC2626',
  },
  {
    id: 'fine_dining',
    label: 'Fine Dining',
    desc: '25–40 covers',
    width_m: 10,
    height_m: 14,
    Icon: Gem,
    color: '#6D28D9',
  },
]

export default function RoomSetupModal({ onComplete, onSkip }) {
  const [mode, setMode] = useState('presets') // 'presets' | 'custom'
  const [selected, setSelected] = useState(null)
  const [customW, setCustomW] = useState('')
  const [customH, setCustomH] = useState('')
  const [saving, setSaving] = useState(false)

  const handlePresetSelect = (preset) => {
    setSelected(preset.id)
    // Auto-submit after a brief moment for visual feedback
    setSaving(true)
    setTimeout(() => {
      onComplete({
        width_m: preset.width_m,
        height_m: preset.height_m,
        preset: preset.id,
      })
    }, 300)
  }

  const handleCustomSubmit = () => {
    const w = parseFloat(customW)
    const h = parseFloat(customH)
    if (!w || !h || w < 2 || h < 2 || w > 50 || h > 50) return
    setSaving(true)
    onComplete({ width_m: w, height_m: h, preset: 'custom' })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: 'Figtree, system-ui, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, maxWidth: 680, width: '100%',
        maxHeight: '90vh', overflow: 'auto',
        boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{
          padding: '28px 32px 0', display: 'flex',
          justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1B4332', margin: 0 }}>
              Set Up Your Dining Room
            </h2>
            <p style={{ fontSize: 14, color: '#6B7280', marginTop: 6, lineHeight: 1.5 }}>
              Tell us your room size so the AI can arrange tables intelligently.
              <br />This is the <strong>dining area only</strong> — not kitchen or back-of-house.
            </p>
          </div>
          {onSkip && (
            <button onClick={onSkip} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9CA3AF', padding: 4,
            }}>
              <X size={20} />
            </button>
          )}
        </div>

        {/* Toggle */}
        <div style={{
          display: 'flex', gap: 8, padding: '20px 32px 0',
        }}>
          <button
            onClick={() => setMode('presets')}
            style={{
              padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              border: 'none', cursor: 'pointer',
              background: mode === 'presets' ? '#1B4332' : '#F3F4F6',
              color: mode === 'presets' ? '#fff' : '#6B7280',
              transition: 'all 0.15s',
            }}
          >
            Quick Presets
          </button>
          <button
            onClick={() => setMode('custom')}
            style={{
              padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
              border: 'none', cursor: 'pointer',
              background: mode === 'custom' ? '#1B4332' : '#F3F4F6',
              color: mode === 'custom' ? '#fff' : '#6B7280',
              transition: 'all 0.15s',
            }}
          >
            <Ruler size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
            Custom Size
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 32px 28px' }}>
          {mode === 'presets' ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12,
            }}>
              {PRESETS.map(preset => {
                const isSelected = selected === preset.id
                return (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset)}
                    disabled={saving}
                    style={{
                      background: isSelected ? `${preset.color}10` : '#FAFAFA',
                      border: `2px solid ${isSelected ? preset.color : '#E5E7EB'}`,
                      borderRadius: 14, padding: '18px 16px',
                      cursor: saving ? 'wait' : 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                      opacity: saving && !isSelected ? 0.5 : 1,
                    }}
                  >
                    <preset.Icon size={22} color={preset.color} strokeWidth={2} />
                    <div style={{
                      fontSize: 14, fontWeight: 700, color: '#1F2937',
                      marginTop: 10, lineHeight: 1.2,
                    }}>
                      {preset.label}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                      {preset.desc}
                    </div>
                    <div style={{
                      fontSize: 11, color: preset.color, fontWeight: 600,
                      marginTop: 8, letterSpacing: '0.02em',
                    }}>
                      {preset.width_m}m × {preset.height_m}m
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div style={{ maxWidth: 360 }}>
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16, lineHeight: 1.5 }}>
                Enter your dining room dimensions in metres. You can measure wall-to-wall
                or estimate — you can always change this later.
              </p>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                    Width (m)
                  </label>
                  <input
                    type="number"
                    min="2" max="50" step="0.5"
                    placeholder="e.g. 8"
                    value={customW}
                    onChange={e => setCustomW(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      border: '2px solid #E5E7EB', fontSize: 15, fontWeight: 600,
                      fontFamily: 'Figtree, system-ui', outline: 'none',
                    }}
                    onFocus={e => e.target.style.borderColor = '#1B4332'}
                    onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                  />
                </div>
                <div style={{
                  fontSize: 18, fontWeight: 700, color: '#D1D5DB',
                  paddingBottom: 10,
                }}>×</div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                    Depth (m)
                  </label>
                  <input
                    type="number"
                    min="2" max="50" step="0.5"
                    placeholder="e.g. 12"
                    value={customH}
                    onChange={e => setCustomH(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      border: '2px solid #E5E7EB', fontSize: 15, fontWeight: 600,
                      fontFamily: 'Figtree, system-ui', outline: 'none',
                    }}
                    onFocus={e => e.target.style.borderColor = '#1B4332'}
                    onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                  />
                </div>
              </div>
              {customW && customH && parseFloat(customW) >= 2 && parseFloat(customH) >= 2 && (
                <div style={{
                  marginTop: 12, padding: '10px 14px', borderRadius: 10,
                  background: '#F0FDF4', fontSize: 13, color: '#166534',
                }}>
                  {parseFloat(customW)}m × {parseFloat(customH)}m = {(parseFloat(customW) * parseFloat(customH)).toFixed(0)} m² dining area
                </div>
              )}
              <button
                onClick={handleCustomSubmit}
                disabled={saving || !customW || !customH || parseFloat(customW) < 2 || parseFloat(customH) < 2}
                style={{
                  marginTop: 16, width: '100%', padding: '12px 20px',
                  borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: '#1B4332', color: '#fff',
                  fontSize: 14, fontWeight: 700,
                  opacity: (!customW || !customH || parseFloat(customW) < 2 || parseFloat(customH) < 2) ? 0.4 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'opacity 0.15s',
                }}
              >
                {saving ? 'Setting up...' : 'Set Room Size'}
                {!saving && <ArrowRight size={15} />}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

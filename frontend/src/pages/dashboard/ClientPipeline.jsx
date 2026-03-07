/**
 * ClientPipeline.jsx — Sales Pipeline CRM for business owners
 * Kanban board showing clients moving through stages:
 * New Lead → Consultation → First Appointment → Package Sold → Active → At Risk → Win Back
 */
import { useState, useEffect, useCallback } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'
import AppLoader from '../../components/shared/AppLoader'
import { Search, Plus, GripVertical, Phone, Mail, ChevronDown, X, PoundSterling } from 'lucide-react'

const STAGE_COLORS = {
  new_lead: '#6B7280', consultation_booked: '#3B82F6', first_appointment: '#F59E0B',
  package_sold: '#8B5CF6', active_client: '#10B981', at_risk: '#EF4444', win_back: '#EC4899',
  unassigned: '#9CA3AF',
}

const getInit = (n) => (n || '??').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
const AVATAR_BG = ['#FEF3C7','#DBEAFE','#FCE7F3','#D1FAE5','#EDE9FE','#FEE2E2','#E0E7FF']
const getAvatarBg = (n) => AVATAR_BG[Math.abs([...(n||'')].reduce((h,c) => c.charCodeAt(0)+((h<<5)-h), 0)) % AVATAR_BG.length]

export default function ClientPipeline() {
  const { business } = useBusiness()
  const bid = business?.id ?? business?._id
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dragItem, setDragItem] = useState(null)
  const [editClient, setEditClient] = useState(null)

  const load = useCallback(async () => {
    if (!bid) return
    try {
      const r = await api.get(`/clients/business/${bid}/pipeline`)
      setData(r)
    } catch (e) { console.error('Pipeline load error:', e) }
    setLoading(false)
  }, [bid])

  useEffect(() => { load() }, [load])

  const moveClient = async (clientId, newStage) => {
    try {
      await api.patch(`/clients/business/${bid}/pipeline/${clientId}/move`, { stage: newStage })
      setData(prev => {
        if (!prev) return prev
        const updated = { ...prev, pipeline: {} }
        let movedClient = null
        for (const [stage, clients] of Object.entries(prev.pipeline)) {
          const found = clients.find(c => c.id === clientId)
          if (found) {
            movedClient = { ...found, stage: newStage }
            updated.pipeline[stage] = clients.filter(c => c.id !== clientId)
          } else {
            updated.pipeline[stage] = [...clients]
          }
        }
        if (movedClient) {
          if (!updated.pipeline[newStage]) updated.pipeline[newStage] = []
          updated.pipeline[newStage].push(movedClient)
        }
        return updated
      })
    } catch (e) { console.error('Move error:', e) }
  }

  if (loading) return <AppLoader message="Loading pipeline..." />
  const DEFAULT_STAGES = [
    { id: 'new_lead', label: 'New Lead', color: '#6B7280' },
    { id: 'consultation_booked', label: 'Consultation Booked', color: '#3B82F6' },
    { id: 'first_appointment', label: 'First Appointment', color: '#F59E0B' },
    { id: 'package_sold', label: 'Package Sold', color: '#8B5CF6' },
    { id: 'active_client', label: 'Active Client', color: '#10B981' },
    { id: 'at_risk', label: 'At Risk', color: '#EF4444' },
    { id: 'win_back', label: 'Win Back', color: '#EC4899' },
  ]
  const displayData = data || { stages: DEFAULT_STAGES, pipeline: {}, total_clients: 0, total_value: 0 }

  const stages = [...(displayData.stages || []), { id: 'unassigned', label: 'Unassigned', color: '#9CA3AF' }]

  return (
    <div style={{ fontFamily: "'Figtree', sans-serif", height: 'calc(100vh - 4rem)', display: 'flex', flexDirection: 'column', margin: '-1.5rem -1.5rem 0', background: '#FAFAF8' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #EBEBEB', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: 0 }}>Sales Pipeline</h1>
          <p style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{displayData.total_clients} clients · £{(displayData.total_value || 0).toLocaleString()} pipeline value</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#999' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..." style={{ paddingLeft: 32, paddingRight: 12, padding: '8px 12px 8px 32px', border: '1px solid #E0E0E0', borderRadius: 10, fontSize: 13, width: 200, outline: 'none', fontFamily: "'Figtree', sans-serif" }} />
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '20px 16px', display: 'flex', gap: 14 }}>
        {stages.map(stage => {
          const clients = (displayData.pipeline[stage.id] || []).filter(c =>
            !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.email || '').toLowerCase().includes(search.toLowerCase())
          )
          const stageValue = clients.reduce((s, c) => s + (c.value || 0), 0)
          const color = stage.color || STAGE_COLORS[stage.id] || '#6B7280'

          return (
            <div key={stage.id}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = '#F0F0F0' }}
              onDragLeave={e => { e.currentTarget.style.background = '#F5F5F3' }}
              onDrop={e => {
                e.preventDefault()
                e.currentTarget.style.background = '#F5F5F3'
                if (dragItem && dragItem.stage !== stage.id) {
                  moveClient(dragItem.id, stage.id)
                }
                setDragItem(null)
              }}
              style={{ minWidth: 280, maxWidth: 300, flex: '0 0 280px', background: '#F5F5F3', borderRadius: 16, display: 'flex', flexDirection: 'column', height: '100%', transition: 'background 0.15s' }}>

              {/* Stage Header */}
              <div style={{ padding: '14px 14px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{stage.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, background: '#E5E5E5', color: '#666', padding: '1px 7px', borderRadius: 10 }}>{clients.length}</span>
                </div>
                {stageValue > 0 && <span style={{ fontSize: 11, fontWeight: 700, color }}> £{stageValue.toLocaleString()}</span>}
              </div>

              {/* Cards */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {clients.map(c => (
                  <div key={c.id}
                    draggable
                    onDragStart={() => setDragItem(c)}
                    onDragEnd={() => setDragItem(null)}
                    onClick={() => setEditClient(c)}
                    style={{
                      background: '#fff', borderRadius: 12, padding: '12px 14px', cursor: 'grab',
                      border: '1px solid #EBEBEB', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      opacity: dragItem?.id === c.id ? 0.5 : 1, transition: 'opacity 0.15s, box-shadow 0.15s',
                    }}
                    onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                    onMouseOut={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: getAvatarBg(c.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#333', flexShrink: 0 }}>{getInit(c.name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                        {c.email && <div style={{ fontSize: 11, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                      {(c.tags || []).slice(0, 3).map(t => (
                        <span key={t} style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: '#F3F4F6', color: '#555' }}>{t}</span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#999' }}>
                        {c.total_visits > 0 && <span>{c.total_visits} visits</span>}
                        {c.total_spend > 0 && <span>£{c.total_spend}</span>}
                      </div>
                      {c.value > 0 && <span style={{ fontSize: 12, fontWeight: 800, color }}> £{c.value}</span>}
                    </div>
                    {c.package && <div style={{ marginTop: 6, fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: '#EDE9FE', color: '#7C3AED', display: 'inline-block' }}>{typeof c.package === 'object' ? c.package.name : c.package}</div>}
                  </div>
                ))}
                {clients.length === 0 && <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: '#999' }}>No clients in this stage</div>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Client Detail Slide Panel */}
      {editClient && (
        <>
          <div onClick={() => setEditClient(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, maxWidth: '90vw', background: '#fff', zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #EBEBEB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: getAvatarBg(editClient.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>{getInit(editClient.name)}</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{editClient.name}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{editClient.email || editClient.phone || 'No contact'}</div>
                </div>
              </div>
              <button onClick={() => setEditClient(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}><X size={18} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Stage selector */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Pipeline Stage</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {(displayData?.stages || []).map(s => (
                    <button key={s.id} onClick={() => { moveClient(editClient.id, s.id); setEditClient(prev => ({ ...prev, stage: s.id })) }}
                      style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: editClient.stage === s.id ? `2px solid ${s.color}` : '1px solid #E5E5E5', background: editClient.stage === s.id ? `${s.color}15` : '#fff', color: editClient.stage === s.id ? s.color : '#666', fontFamily: "'Figtree', sans-serif" }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Total Visits', value: editClient.total_visits || 0 },
                  { label: 'Total Spend', value: `£${editClient.total_spend || 0}` },
                  { label: 'Pipeline Value', value: `£${editClient.value || 0}` },
                  { label: 'Last Visit', value: editClient.last_visit ? new Date(editClient.last_visit).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Never' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#FAFAF8', borderRadius: 10, padding: '10px 12px', border: '1px solid #EBEBEB' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#111', marginTop: 2 }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Tags */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tags</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {(editClient.tags || []).map(t => (
                    <span key={t} style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 8, background: '#F3F4F6', color: '#555' }}>{t}</span>
                  ))}
                  {(!editClient.tags || editClient.tags.length === 0) && <span style={{ fontSize: 12, color: '#999' }}>No tags</span>}
                </div>
              </div>

              {/* Contact */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Contact</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                  {editClient.phone && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#333' }}><Phone size={14} color="#999" /> {editClient.phone}</div>}
                  {editClient.email && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#333' }}><Mail size={14} color="#999" /> {editClient.email}</div>}
                </div>
              </div>

              {/* Notes */}
              {editClient.notes && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>Notes</label>
                  <p style={{ fontSize: 13, color: '#555', marginTop: 4, lineHeight: '20px' }}>{editClient.notes}</p>
                </div>
              )}

              {/* Package */}
              {editClient.package && (
                <div style={{ background: '#EDE9FE', borderRadius: 10, padding: '12px 14px', border: '1px solid #DDD6FE' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase' }}>Active Package</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#5B21B6', marginTop: 4 }}>{typeof editClient.package === 'object' ? editClient.package.name : editClient.package}</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

import AppLoader from "../../components/shared/AppLoader"
import { useState, useEffect, useCallback } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'

const MothershipPayments = () => {
  const { business } = useBusiness()
  const [settlements, setSettlements] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [toast, setToast] = useState(null)
  const bid = business?.id ?? business?._id

  const fetchSettlements = useCallback(async () => {
    if (!bid) { setLoading(false); return }
    try {
      const res = await api.get(`/mothership/business/${bid}/settlements`)
      setSettlements(res.settlements || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [bid])

  useEffect(() => { fetchSettlements() }, [fetchSettlements])

  const generateReport = async () => {
    setGenerating(true)
    try {
      const today = new Date()
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      const res = await api.post(`/mothership/business/${bid}/settlements/generate`, {
        period_start: weekAgo.toISOString().split('T')[0],
        period_end: today.toISOString().split('T')[0],
      })
      setSettlements(prev => [...(res.settlements || []), ...prev])
      setToast(`${res.count} settlement reports generated`)
      setTimeout(() => setToast(null), 4000)
    } catch (e) { setToast(e.message || 'Failed to generate'); setTimeout(() => setToast(null), 4000) }
    finally { setGenerating(false) }
  }

  const markPaid = async (id, name) => {
    try {
      await api.patch(`/mothership/business/${bid}/settlements/${id}/mark-paid`)
      setSettlements(prev => prev.map(s => s.id === id ? { ...s, status: 'paid', paid_at: new Date().toISOString() } : s))
      setToast(`${name} marked as paid`)
      setTimeout(() => setToast(null), 4000)
    } catch (e) { setToast(e.message || 'Failed'); setTimeout(() => setToast(null), 4000) }
  }

  if (loading) return <AppLoader message="Loading payments..." />

  const pending = settlements.filter(s => s.status === 'pending')
  const paid = settlements.filter(s => s.status === 'paid')
  const totalOwed = pending.reduce((sum, s) => sum + (s.operator_cut || 0), 0)

  return (
    <div className="-m-6 lg:-m-8 flex flex-col h-[calc(100vh-4rem)]" style={{ fontFamily: "'Figtree',sans-serif" }}>
      <div className="px-6 md:px-8 pt-6 pb-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-heading font-extrabold text-primary">Payments & Settlements</h1>
            <p className="text-sm text-gray-500 mt-0.5">{pending.length} pending · {paid.length} paid</p>
          </div>
          <button onClick={generateReport} disabled={generating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary-hover shadow-md disabled:opacity-50">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {generating ? 'Generating...' : 'Generate This Week'}
          </button>
        </div>

        {/* Summary card */}
        {totalOwed > 0 && (
          <div className="bg-[#FFFDF6] border border-[#C9A84C]/20 rounded-xl p-4 flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-bold text-primary">Outstanding to operators</div>
              <div className="text-xs text-gray-400 mt-0.5">{pending.length} settlements awaiting payment</div>
            </div>
            <div className="text-2xl font-extrabold text-[#C9A84C]">£{totalOwed.toFixed(2)}</div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 md:px-8 pb-8">
        {settlements.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </div>
            <h3 className="font-bold text-lg text-primary mb-2">No settlements yet</h3>
            <p className="text-sm text-gray-500 mb-6">Generate your first settlement report to see revenue splits.</p>
            <button onClick={generateReport} disabled={generating} className="text-sm font-bold text-white bg-primary px-6 py-2.5 rounded-lg hover:bg-primary-hover shadow-md disabled:opacity-50">
              {generating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {settlements.map(s => (
              <div key={s.id} className={`bg-white border rounded-xl p-4 transition-all ${s.status === 'paid' ? 'border-gray-100 opacity-70' : 'border-gray-200 hover:shadow-md'}`}>
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-[#C9A84C]/10 flex items-center justify-center text-[#C9A84C] font-bold text-sm shrink-0">
                    {(s.operator_name || '??').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-primary">{s.operator_name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.status === 'paid' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
                      }`}>{s.status}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {s.period_start} → {s.period_end} · {s.booking_count} bookings
                    </div>
                  </div>
                  {/* Amounts */}
                  <div className="text-right shrink-0 mr-2">
                    <div className="text-sm font-extrabold text-primary">£{(s.operator_cut || 0).toFixed(2)}</div>
                    <div className="text-[10px] text-gray-400">of £{(s.total_revenue || 0).toFixed(2)} total</div>
                    <div className="text-[10px] text-[#C9A84C] font-bold">Your cut: £{(s.salon_cut || 0).toFixed(2)} ({s.commission_rate || 30}%)</div>
                  </div>
                  {/* Action */}
                  {s.status === 'pending' && (
                    <button onClick={() => markPaid(s.id, s.operator_name)}
                      className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-hover shrink-0">
                      Mark Paid
                    </button>
                  )}
                  {s.status === 'paid' && (
                    <div className="text-xs text-green-600 font-bold shrink-0 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Paid
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-primary text-white rounded-xl shadow-xl text-sm font-semibold">{toast}</div>
      )}
    </div>
  )
}

export default MothershipPayments

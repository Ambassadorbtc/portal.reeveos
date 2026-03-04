/**
 * Reviews — wired to real backend
 * GET /reviews/business/{bid} — list reviews
 * POST /reviews/{id}/reply — owner reply
 * GET /reputation/business/{bid}/review-stats — stats
 */
import { useState, useEffect, useCallback } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import api from '../../utils/api'
import { Star, MessageSquare, ThumbsUp, Send, Loader2, RefreshCw } from 'lucide-react'

const Reviews = () => {
  const { business, loading: bizLoading } = useBusiness()
  const bid = business?.id ?? business?._id
  const [reviews, setReviews] = useState([])
  const [stats, setStats] = useState({ total_reviews: 0, average_rating: 0, rating_distribution: {} })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [replySending, setReplySending] = useState(false)

  const fetchReviews = useCallback(async () => {
    if (!bid) return
    setLoading(true)
    try {
      const [reviewData, statsData] = await Promise.all([
        api.get(`/reviews/business/${bid}?limit=100`).catch(() => ({ results: [] })),
        api.get(`/reputation/business/${bid}/review-stats`).catch(() => ({ total_reviews: 0, average_rating: 0, rating_distribution: {} })),
      ])
      const list = (reviewData.results || []).map(r => ({
        id: r._id || r.id,
        name: r.user_name || 'Anonymous',
        rating: r.rating || 0,
        date: r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
        text: r.body || '',
        service: r.categories?.join(', ') || '',
        replied: !!r.owner_reply,
        reply: r.owner_reply || '',
        replyDate: r.owner_reply_at ? new Date(r.owner_reply_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '',
        source: r.source || 'ReeveOS',
        helpful: r.helpful_count || 0,
      }))
      setReviews(list)
      setStats(statsData)
    } catch (err) {
      console.error('Failed to load reviews:', err)
    }
    setLoading(false)
  }, [bid])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  const handleReply = async (reviewId) => {
    if (!replyText.trim()) return
    setReplySending(true)
    try {
      await api.post(`/reviews/${reviewId}/reply`, { reply: replyText })
      setReplyText('')
      setReplyingTo(null)
      await fetchReviews()
    } catch (err) {
      console.error('Reply failed:', err)
    }
    setReplySending(false)
  }

  const avgRating = stats.average_rating || (reviews.length > 0 ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length) : 0)
  const replyRate = reviews.length > 0 ? Math.round((reviews.filter(r => r.replied).length / reviews.length) * 100) : 0
  const fiveStarPct = reviews.length > 0 ? Math.round((reviews.filter(r => r.rating === 5).length / reviews.length) * 100) : 0
  const filtered = filter === 'all' ? reviews : filter === 'unreplied' ? reviews.filter(r => !r.replied) : reviews.filter(r => r.rating === parseInt(filter))

  if (bizLoading || !business) {
    return (
      <div className="flex items-center justify-center h-64" style={{ fontFamily: "'Figtree', sans-serif" }}>
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6" style={{ fontFamily: "'Figtree', sans-serif" }}>
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm text-center">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Average Rating</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-3xl font-extrabold text-gray-900">{avgRating.toFixed(1)}</span>
            <div className="flex text-amber-400 text-sm gap-0.5">
              {[1,2,3,4,5].map(s => <Star key={s} className={`w-4 h-4 ${s <= Math.round(avgRating) ? 'fill-amber-400' : 'fill-gray-200 text-gray-200'}`} />)}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm text-center">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Reviews</p>
          <p className="text-3xl font-extrabold text-gray-900 mt-2">{stats.total_reviews || reviews.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm text-center">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Reply Rate</p>
          <p className="text-3xl font-extrabold text-emerald-600 mt-2">{replyRate}%</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm text-center">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">5-Star %</p>
          <p className="text-3xl font-extrabold text-gray-900 mt-2">{fiveStarPct}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'unreplied', label: 'Needs Reply' },
            { key: '5', label: '5 Stars' },
            { key: '4', label: '4 Stars' },
            { key: '3', label: '3 Stars' },
            { key: '2', label: '2 Stars' },
            { key: '1', label: '1 Star' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all ${
                filter === f.key ? 'bg-[#111111] text-white shadow-lg shadow-[#111111]/20' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}>{f.label}</button>
          ))}
        </div>
        <button onClick={fetchReviews} className="p-2 rounded-full hover:bg-gray-100 transition-all">
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-20">
          <Star className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400 font-semibold text-sm">
            {filter === 'all' ? 'No reviews yet' : filter === 'unreplied' ? 'All reviews have been replied to' : `No ${filter}-star reviews`}
          </p>
          <p className="text-gray-300 text-xs mt-1">Reviews will appear here when customers leave feedback</p>
        </div>
      )}

      {/* Review Cards */}
      {!loading && filtered.map(r => (
        <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
                {(r.name || '?')[0].toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">{r.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(s => <Star key={s} className={`w-3.5 h-3.5 ${s <= r.rating ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}`} />)}
                  </div>
                  <span className="text-xs text-gray-400">{r.date}</span>
                  {r.source && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{r.source}</span>}
                </div>
              </div>
            </div>
            {!r.replied && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">Needs Reply</span>
            )}
          </div>

          {r.text && <p className="text-sm text-gray-600 mt-3 leading-relaxed">{r.text}</p>}
          {r.service && <p className="text-xs text-gray-400 mt-2">Service: {r.service}</p>}

          {/* Owner reply */}
          {r.replied && (
            <div className="mt-3 ml-6 p-3 bg-gray-50 rounded-lg border-l-2 border-gray-200">
              <p className="text-xs font-bold text-gray-500 mb-1">Your Reply · {r.replyDate}</p>
              <p className="text-sm text-gray-600">{r.reply}</p>
            </div>
          )}

          {/* Reply form */}
          {replyingTo === r.id && !r.replied && (
            <div className="mt-3 flex gap-2">
              <input
                value={replyText} onChange={e => setReplyText(e.target.value)}
                placeholder="Write your reply..."
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#111]/10 focus:border-[#111]"
                style={{ fontFamily: "'Figtree', sans-serif" }}
                onKeyDown={e => e.key === 'Enter' && handleReply(r.id)}
              />
              <button onClick={() => handleReply(r.id)} disabled={replySending}
                className="px-4 py-2 text-xs font-bold text-white bg-[#111111] rounded-full hover:bg-[#1a1a1a] transition-all disabled:opacity-50 flex items-center gap-1.5">
                {replySending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Reply
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-50">
            {!r.replied && (
              <button onClick={() => { setReplyingTo(replyingTo === r.id ? null : r.id); setReplyText('') }}
                className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-gray-700 transition-all">
                <MessageSquare className="w-3.5 h-3.5" /> Reply
              </button>
            )}
            <span className="flex items-center gap-1 text-xs text-gray-300">
              <ThumbsUp className="w-3 h-3" /> {r.helpful}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default Reviews

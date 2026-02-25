import RezvoLoader from "../../components/shared/RezvoLoader"
/**
 * Run 3: Dashboard — styled to match 5-Brand Design - Home Dashboard.html
 * KPI cards with icons, activity feed with avatars, cream/rounded/shadow layout
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBusiness } from '../../contexts/BusinessContext'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../utils/api'

const Dashboard = () => {
  const { business, isDemo } = useBusiness()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [todayBookings, setTodayBookings] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = async () => {
    const bid = business?.id ?? business?._id
    if (!bid || isDemo) {
      setLoading(false)
      return
    }
    try {
      const [s, t, a] = await Promise.all([
        api.get(`/dashboard/business/${bid}/summary`),
        api.get(`/dashboard/business/${bid}/today`),
        api.get(`/dashboard/business/${bid}/activity?limit=20`),
      ])
      setSummary(s)
      setTodayBookings(t?.bookings || [])
      setActivity(a?.events || [])
    } catch (err) {
      console.error('Failed to fetch dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 30000)
    return () => clearInterval(interval)
  }, [business?.id ?? business?._id])

  const formatPounds = (pence) => {
    if (pence == null) return '£0.00'
    return `£${((pence || 0) / 100).toFixed(2)}`
  }

  const formatTime = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    const diff = (Date.now() - d) / 60000
    if (diff < 1) return 'Just now'
    if (diff < 60) return `${Math.floor(diff)} min ago`
    if (diff < 1440) return `${Math.floor(diff / 60)} hr ago`
    return `${Math.floor(diff / 1440)} days ago`
  }

  const eventStyle = (type) => {
    if (type?.includes('created')) return { bg: 'bg-blue-100', icon: 'fa-calendar-plus', color: 'text-blue-600' }
    if (type?.includes('cancelled')) return { bg: 'bg-red-100', icon: 'fa-xmark', color: 'text-red-600' }
    if (type?.includes('completed')) return { bg: 'bg-green-100', icon: 'fa-check', color: 'text-green-600' }
    if (type?.includes('payment')) return { bg: 'bg-amber-100', icon: 'fa-credit-card', color: 'text-amber-600' }
    return { bg: 'bg-gray-100', icon: 'fa-circle', color: 'text-gray-600' }
  }

  if (loading && !summary) {
    return (
      <div className="text-center py-12">
        <RezvoLoader message="Loading dashboard..." />
      </div>
    )
  }

  const today = summary?.today || {}
  const period = summary?.period || {}

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-primary">Dashboard</h1>
        <p className="text-sm text-muted mt-1">Welcome back, {user?.name}</p>
      </div>

      {/* KPI cards — styled like design: icons, colour accents, footer */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#F0FDF4] flex items-center justify-center text-primary">
              <i className="fa-regular fa-calendar-check text-lg" />
            </div>
            {period.bookingsChange != null && period.bookingsChange !== 0 && (
              <span className={`flex items-center text-xs font-bold px-2 py-1 rounded-full ${period.bookingsChange > 0 ? 'text-success bg-success/10' : 'text-error bg-error/10'}`}>
                <i className={`fa-solid fa-arrow-${period.bookingsChange > 0 ? 'up' : 'down'} text-[10px] mr-1`} />
                {Math.abs(period.bookingsChange)}%
              </span>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted">Today&apos;s Bookings</p>
            <h3 className="text-3xl font-heading font-bold text-primary">{today.bookings ?? 0}</h3>
          </div>
          <div className="mt-4 pt-3 border-t border-border text-xs text-muted">
            <span className="font-bold text-primary">{today.upcomingBookings ?? 0}</span> pending confirmation
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#FEF3C7] flex items-center justify-center text-warning">
              <i className="fa-solid fa-sterling-sign text-lg" />
            </div>
            {period.revenueChange != null && period.revenueChange !== 0 && (
              <span className={`flex items-center text-xs font-bold px-2 py-1 rounded-full ${period.revenueChange > 0 ? 'text-success bg-success/10' : 'text-error bg-error/10'}`}>
                <i className={`fa-solid fa-arrow-${period.revenueChange > 0 ? 'up' : 'down'} text-[10px] mr-1`} />
                {Math.abs(period.revenueChange)}%
              </span>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted">Revenue (Today)</p>
            <h3 className="text-3xl font-heading font-bold text-primary">{formatPounds(today.revenue)}</h3>
          </div>
          <div className="mt-4 pt-3 border-t border-border text-xs text-muted">
            Revenue this week
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#E0F2FE] flex items-center justify-center text-info">
              <i className="fa-solid fa-chart-simple text-lg" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted">Completed</p>
            <h3 className="text-3xl font-heading font-bold text-primary">{today.completedBookings ?? 0}</h3>
          </div>
          <div className="mt-4 pt-3 border-t border-border text-xs text-muted">
            Done today
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#F3E8FF] flex items-center justify-center text-purple-600">
              <i className="fa-solid fa-user-plus text-lg" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted">New Clients</p>
            <h3 className="text-3xl font-heading font-bold text-primary">{today.newClients ?? 0}</h3>
          </div>
          <div className="mt-4 pt-3 border-t border-border text-xs text-muted">
            Today
          </div>
        </div>
      </section>

      {/* Main grid: 2/3 schedule, 1/3 activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
        <div className="xl:col-span-2 space-y-6 lg:space-y-8">
          {/* Today's Schedule */}
          <section className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-lg font-heading font-bold text-primary">Today&apos;s Schedule</h2>
              <button onClick={() => navigate('/dashboard/bookings')} className="text-sm text-primary font-bold hover:underline">
                View Calendar
              </button>
            </div>
            <div className="p-5">
              {todayBookings.length === 0 ? (
                <p className="text-muted py-8 text-center">No bookings today</p>
              ) : (
                <div className="space-y-3">
                  {todayBookings.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => navigate(`/dashboard/bookings?booking=${b.id}`)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${b.isNext ? 'border-primary bg-primary/5' : 'border-border hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-primary">{b.time}</span>
                          <span className="text-muted ml-2">— {b.customerName}</span>
                          <p className="text-sm text-muted mt-0.5">{b.service} {b.staff && `· ${b.staff}`}</p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${b.status === 'confirmed' ? 'bg-success/10 text-success' : b.status === 'checked_in' ? 'bg-info/10 text-info' : 'bg-muted/30 text-muted'}`}>
                          {b.status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right column: Activity + Quick Actions */}
        <div className="space-y-6 lg:space-y-8">
          {/* Activity feed — styled with avatar circles, hover */}
          <section className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border bg-gray-50/50">
              <h2 className="text-sm font-heading font-bold text-primary">Recent Activity</h2>
            </div>
            <div className="max-h-[400px] overflow-y-auto p-0">
              {activity.length === 0 ? (
                <p className="p-4 text-muted text-sm">No recent activity</p>
              ) : (
                activity.map((e) => {
                  const style = eventStyle(e.type)
                  return (
                    <div key={e.id} className="flex gap-3 p-4 border-b border-border hover:bg-gray-50 transition-colors last:border-b-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${style.bg}`}>
                        <i className={`fa-solid ${style.icon} ${style.color} text-xs`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-primary font-medium">{e.message}</p>
                        <p className="text-[10px] text-muted mt-1">{formatTime(e.timestamp)}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </section>

          {/* Quick Actions */}
          <section className="bg-[#F0FDF4] rounded-xl border border-success/20 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-success/10 flex justify-between items-center">
              <h2 className="text-sm font-heading font-bold text-primary flex items-center gap-2">
                <i className="fa-solid fa-bolt text-warning" />
                Quick Actions
              </h2>
            </div>
            <div className="p-4 space-y-3">
              <button onClick={() => navigate('/dashboard/bookings')} className="w-full bg-white p-3 rounded-lg border border-border shadow-sm flex gap-3 items-start group hover:border-primary transition-colors text-left">
                <div className="mt-0.5 text-primary">
                  <i className="fa-regular fa-calendar-check" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-primary group-hover:underline">View Today&apos;s Bookings</p>
                  <p className="text-[10px] text-muted mt-0.5">See all bookings for today</p>
                </div>
                <i className="fa-solid fa-chevron-right text-xs text-muted ml-auto mt-1.5 shrink-0" />
              </button>
              <button onClick={() => navigate('/dashboard/services')} className="w-full bg-white p-3 rounded-lg border border-border shadow-sm flex gap-3 items-start group hover:border-primary transition-colors text-left">
                <div className="mt-0.5 text-primary">
                  <i className="fa-solid fa-scissors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-primary group-hover:underline">Add New Service</p>
                  <p className="text-[10px] text-muted mt-0.5">Manage your service menu</p>
                </div>
                <i className="fa-solid fa-chevron-right text-xs text-muted ml-auto mt-1.5 shrink-0" />
              </button>
              <button onClick={() => navigate('/dashboard/staff')} className="w-full bg-white p-3 rounded-lg border border-border shadow-sm flex gap-3 items-start group hover:border-primary transition-colors text-left">
                <div className="mt-0.5 text-primary">
                  <i className="fa-solid fa-users" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-primary group-hover:underline">Manage Staff</p>
                  <p className="text-[10px] text-muted mt-0.5">Team and availability</p>
                </div>
                <i className="fa-solid fa-chevron-right text-xs text-muted ml-auto mt-1.5 shrink-0" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

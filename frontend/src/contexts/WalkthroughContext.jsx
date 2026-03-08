/**
 * WalkthroughContext — manages the guided tour state across the dashboard.
 * Persists to localStorage + user API. Auto-triggers on first login.
 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useBusiness } from './BusinessContext'
import { useAuth } from './AuthContext'
import api from '../utils/api'

const WalkthroughContext = createContext(null)

const STORAGE_KEY = 'reeveos_walkthrough'

function getSteps(businessType) {
  const isFood = ['restaurant', 'cafe', 'bar', 'pub', 'takeaway'].includes(businessType)
  const isBeauty = ['beauty', 'aesthetics', 'salon', 'nails', 'spa', 'massage', 'physiotherapy'].includes(businessType)
  const svc = isFood ? 'menu item' : 'treatment'
  const svcs = isFood ? 'menu' : 'services'
  const staff = isBeauty ? 'therapist' : isFood ? 'server' : 'team member'

  const steps = [
    {
      id: 'welcome',
      path: null,
      target: null,
      title: 'Welcome to ReeveOS!',
      body: `I'm your setup guide. I'll walk you through every part of your portal in about 3 minutes. You'll get to try each feature as we go. Ready?`,
      type: 'modal',
    },
    {
      id: 'sidebar',
      path: '/dashboard',
      target: '[data-tour="sidebar"]',
      title: 'Your Command Centre',
      body: `Everything in your business lives here — bookings, clients, shop, messages, settings. The sections adapt to your business type.`,
      task: 'Click the sidebar to explore — notice how sections are grouped by function.',
      interactive: true,
      position: 'right',
    },
    {
      id: 'dashboard',
      path: '/dashboard',
      target: '[data-tour="dashboard-stats"]',
      title: 'Dashboard Overview',
      body: `Your home page. Today's bookings, revenue, new clients, and alerts — all live data at a glance.`,
      task: 'Click on any stat card to see more detail.',
      interactive: true,
      position: 'bottom',
    },
    {
      id: 'calendar',
      path: '/dashboard/calendar',
      target: '[data-tour="calendar"]',
      title: isFood ? 'Reservations' : 'Calendar',
      body: `Every booking across all your ${staff}s. We've loaded sample data so you can see how it looks in action.`,
      task: 'Click on any appointment to open the booking detail panel.',
      interactive: true,
      position: 'bottom',
    },
    {
      id: 'booking-link',
      path: '/dashboard/online-booking',
      target: '[data-tour="booking-link"]',
      title: 'Your Booking Link',
      body: `This is how clients book themselves in 24/7. Share it on your website, Instagram, or WhatsApp.`,
      task: 'Click "Copy Link" to grab your booking URL — try pasting it in a new tab!',
      interactive: true,
      position: 'bottom',
    },
    {
      id: 'services',
      path: '/dashboard/services',
      target: '[data-tour="services"]',
      title: isFood ? 'Your Menu' : 'Your Services',
      body: `Each ${svc} has a name, duration, price, and category. You added some during setup — you can always add more.`,
      task: `Click on any ${svc} to edit it, or try the "Add" button to create a new one.`,
      interactive: true,
      position: 'bottom',
    },
    {
      id: 'crm',
      path: '/dashboard/crm?view=clients',
      target: '[data-tour="crm"]',
      title: 'Client Management',
      body: `Track every client — who's booked, who's overdue, lifetime spend, and favourite ${svcs}. Turn one-timers into regulars.`,
      task: 'Click on any client row to see their full profile and history.',
      interactive: true,
      position: 'bottom',
    },
    {
      id: 'shop',
      path: '/dashboard/shop?tab=products',
      target: '[data-tour="shop"]',
      title: 'Shop',
      body: `Sell products, gift vouchers, and ${svc} packages online. Clients buy directly from their portal.`,
      position: 'bottom',
    },
    {
      id: 'consultation-forms',
      path: '/dashboard/consultation-forms',
      target: '[data-tour="consultation-forms"]',
      title: 'Consultation Forms',
      body: isBeauty
        ? `Client health questionnaires appear here. The system auto-checks for contraindications — flags or blocks unsafe bookings automatically.`
        : `Client intake forms land here. Review, approve, and trigger follow-up emails or texts.`,
      task: isBeauty ? 'Click on any submitted form to see the contraindication status.' : 'Click to view a submitted form.',
      interactive: true,
      position: 'bottom',
    },
    {
      id: 'messages',
      path: '/dashboard/client-messages',
      target: '[data-tour="messages"]',
      title: 'Messages',
      body: `Two-way chat with your clients. Reminders, aftercare, follow-ups — one inbox for everything.`,
      task: 'Click on a conversation to see the message thread.',
      interactive: true,
      position: 'bottom',
    },
    {
      id: 'staff',
      path: '/dashboard/staff',
      target: '[data-tour="staff"]',
      title: 'Your Team',
      body: `Each ${staff} has their own schedule, ${svcs} they perform, and availability. Clients pick their preferred ${staff} when booking.`,
      task: 'Click on a team member to see their profile and schedule.',
      interactive: true,
      position: 'bottom',
    },
    {
      id: 'settings',
      path: '/dashboard/settings',
      target: '[data-tour="settings"]',
      title: 'Settings',
      body: `Business hours, cancellation policy, booking rules, notifications, and the Guided Tour toggle all live here.`,
      task: 'Click on the "Preferences" tab to find the tour toggle.',
      interactive: true,
      position: 'bottom',
    },
  ]

  // Add medical safety step for beauty/aesthetics
  if (isBeauty) {
    steps.splice(9, 0, {
      id: 'medical-safety',
      path: '/dashboard/consultation-forms',
      target: '[data-tour="consultation-forms"]',
      title: 'Medical Safety System',
      body: `ReeveOS checks every client's health form against a contraindication matrix — 20 conditions across 5 treatment types. BLOCK = unsafe, FLAG = review needed. Every override is logged for insurance.`,
      task: 'Look for any flagged forms — click one to see the contraindication details and override options.',
      interactive: true,
      position: 'top',
    })
  }

  // Final step
  steps.push({
    id: 'complete',
    path: null,
    target: null,
    title: "You're Ready, {firstName}!",
    body: `You've explored every section of your portal. Your business is live and ready for clients. Restart this tour anytime from the compass icon in the top bar.`,
    type: 'modal',
  })

  return steps
}

export function WalkthroughProvider({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { businessType } = useBusiness()
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [steps, setSteps] = useState([])

  // Build steps when business type is known
  useEffect(() => {
    setSteps(getSteps(businessType || 'other'))
  }, [businessType])

  // Auto-start on first login
  useEffect(() => {
    if (!user) return
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const d = JSON.parse(stored)
        if (d.completed) return // Already done
        if (d.active) { setActive(true); setStepIndex(d.step || 0) }
      } catch { /* ignore */ }
    } else {
      // First ever login — auto start after a short delay
      const timer = setTimeout(() => {
        setActive(true)
        setStepIndex(0)
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ active: true, step: 0, completed: false }))
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [user])

  // Persist step changes
  useEffect(() => {
    if (active) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ active, step: stepIndex, completed: false }))
    }
  }, [active, stepIndex])

  // Navigate when step changes
  useEffect(() => {
    if (!active || steps.length === 0) return
    const step = steps[stepIndex]
    if (step?.path && location.pathname + location.search !== step.path) {
      navigate(step.path)
    }
  }, [active, stepIndex, steps, navigate, location.pathname, location.search])

  const next = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      // Complete
      setActive(false)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ active: false, step: 0, completed: true }))
      try { api.patch('/users/me', { walkthrough_completed: true }).catch(() => {}) } catch {}
      return
    }
    setStepIndex(i => i + 1)
  }, [stepIndex, steps.length])

  const back = useCallback(() => {
    setStepIndex(i => Math.max(0, i - 1))
  }, [])

  const skip = useCallback(() => {
    setActive(false)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ active: false, step: 0, completed: true }))
    try { api.patch('/users/me', { walkthrough_completed: true }).catch(() => {}) } catch {}
  }, [])

  const restart = useCallback(() => {
    setStepIndex(0)
    setActive(true)
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ active: true, step: 0, completed: false }))
  }, [])

  const currentStep = steps[stepIndex] || null

  return (
    <WalkthroughContext.Provider value={{ active, currentStep, stepIndex, totalSteps: steps.length, next, back, skip, restart }}>
      {children}
    </WalkthroughContext.Provider>
  )
}

export function useWalkthrough() {
  const ctx = useContext(WalkthroughContext)
  if (!ctx) return { active: false, currentStep: null, stepIndex: 0, totalSteps: 0, next: () => {}, back: () => {}, skip: () => {}, restart: () => {} }
  return ctx
}

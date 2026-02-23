/**
 * Rezvo Sidebar — Clean minimal style
 * 
 * Expanded: full-width with text labels, search bar, grouped sections
 * Collapsed: icon-only rail with popover sub-menus on hover
 * 
 * Brand: Rezvo locked tokens (Forest, Cream, Terracotta, Figtree)
 * Style ref: Clean white sidebar with subtle borders
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useBusiness } from '../../contexts/BusinessContext'
import { useAuth } from '../../contexts/AuthContext'
import { isFeatureUnlocked, TIERS } from '../../config/tiers'
import UpgradeModal from './UpgradeModal'
import {
  LayoutDashboard,
  Calendar,
  UtensilsCrossed,
  Scissors,
  Users,
  BarChart3,
  Settings,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Lock,
  X,
  CreditCard,
  Globe,
  Star,
  ClipboardList,
  HelpCircle,
  Megaphone,
  MapPin,
} from 'lucide-react'

const EXPANDED_W = 260
const COLLAPSED_W = 68

/* ── Navigation structure ── */
const getSections = (businessType) => {
  const isR = businessType === 'restaurant'
  return [
    {
      label: 'MAIN',
      items: [
        {
          id: 'dashboard',
          Icon: LayoutDashboard,
          label: 'Dashboard',
          children: [
            { id: 'home', label: 'Overview', path: '/dashboard', minTier: 'free' },
          ],
        },
        {
          id: 'calendar',
          Icon: Calendar,
          label: 'Calendar',
          children: [
            { id: 'calendar', label: 'Calendar', path: '/dashboard/calendar', minTier: 'free' },
            { id: 'bookings', label: 'Bookings', path: '/dashboard/bookings', minTier: 'free' },
            { id: 'booking-link', label: 'Booking Link', path: '/dashboard/booking-link', minTier: 'free' },
          ],
        },
        {
          id: 'services',
          Icon: isR ? UtensilsCrossed : Scissors,
          label: isR ? 'Menu' : 'Services',
          children: [
            { id: 'services', label: isR ? 'Menu Items' : 'Services', path: '/dashboard/services', minTier: 'free' },
            { id: 'online-booking', label: 'Online Booking', path: '/dashboard/online-booking', minTier: 'starter' },
            ...(isR ? [{ id: 'orders', label: 'Orders', path: '/dashboard/orders', minTier: 'growth' }] : []),
          ],
        },
      ],
    },
    {
      label: 'MANAGE',
      items: [
        {
          id: 'people',
          Icon: Users,
          label: 'People',
          children: [
            { id: 'clients', label: 'Clients', path: '/dashboard/clients', minTier: 'growth' },
            { id: 'staff', label: 'Staff', path: '/dashboard/staff', minTier: 'starter' },
            { id: 'reviews', label: 'Reviews', path: '/dashboard/reviews', minTier: 'growth' },
          ],
        },
        {
          id: 'business',
          Icon: BarChart3,
          label: 'Business',
          children: [
            { id: 'payments', label: 'Payments', path: '/dashboard/payments', minTier: 'growth' },
            { id: 'analytics', label: 'Analytics', path: '/dashboard/analytics', minTier: 'growth' },
            ...(isR ? [{ id: 'floor-plan', label: 'Floor Plan', path: '/dashboard/floor-plan', minTier: 'scale' }] : []),
          ],
        },
        {
          id: 'settings',
          Icon: Settings,
          label: 'Settings',
          children: [
            { id: 'settings', label: 'Settings', path: '/dashboard/settings', minTier: 'free' },
          ],
        },
      ],
    },
  ]
}

/* ── Main component ── */
const Sidebar = ({ open, onNavigate }) => {
  const { business, businessType, tier } = useBusiness()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [expanded, setExpanded] = useState(true)
  const [openMenus, setOpenMenus] = useState({ dashboard: true })
  const [hoveredItem, setHoveredItem] = useState(null)
  const [upgradeModal, setUpgradeModal] = useState(null)
  const [searchFocused, setSearchFocused] = useState(false)
  const hoverTimeoutRef = useRef(null)
  const popoverRef = useRef(null)

  const sections = getSections(businessType)

  /* Auto-open the section containing the active route */
  useEffect(() => {
    for (const section of sections) {
      for (const item of section.items) {
        if (item.children?.some((c) => c.path === location.pathname)) {
          setOpenMenus((prev) => ({ ...prev, [item.id]: true }))
          return
        }
      }
    }
  }, [location.pathname, businessType])

  /* Keyboard shortcut: ⌘K for search */
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchFocused(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const toggleMenu = (id) => {
    if (!expanded) {
      setExpanded(true)
      setOpenMenus((prev) => ({ ...prev, [id]: true }))
      return
    }
    setOpenMenus((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleChildClick = (child) => {
    if (!isFeatureUnlocked(tier, child.minTier)) {
      setUpgradeModal(TIERS[child.minTier]?.label || child.minTier)
      return
    }
    navigate(child.path)
    onNavigate?.()
  }

  const handleLogout = () => {
    logout?.()
    navigate('/login')
    onNavigate?.()
  }

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  const handleHoverEnter = (itemId) => {
    if (expanded) return
    clearTimeout(hoverTimeoutRef.current)
    setHoveredItem(itemId)
  }

  const handleHoverLeave = () => {
    if (expanded) return
    hoverTimeoutRef.current = setTimeout(() => setHoveredItem(null), 150)
  }

  /* ── Render a nav group item ── */
  const renderNavItem = (item) => {
    const { id, Icon, label, children } = item
    const isOpen = openMenus[id]
    const hasActiveChild = children?.some((c) => c.path === location.pathname)
    const isHovered = hoveredItem === id

    return (
      <div
        key={id}
        className="relative"
        onMouseEnter={() => handleHoverEnter(id)}
        onMouseLeave={handleHoverLeave}
      >
        {/* Parent button */}
        <button
          onClick={() => children?.length > 1 ? toggleMenu(id) : handleChildClick(children[0])}
          className={`
            w-full flex items-center gap-3 transition-all duration-200
            ${expanded ? 'px-3 py-2.5 rounded-[10px]' : 'justify-center w-11 h-11 mx-auto rounded-xl'}
            ${hasActiveChild
              ? expanded
                ? 'bg-[#1B4332]/[0.06] text-[#1B4332]'
                : 'bg-[#1B4332]/[0.08] text-[#1B4332]'
              : 'text-[#7A776F] hover:text-[#2C2C2A] hover:bg-[#E8E4DD]/40'
            }
          `}
        >
          <Icon
            size={expanded ? 18 : 20}
            strokeWidth={hasActiveChild ? 2 : 1.5}
            className="shrink-0"
          />
          {expanded && (
            <>
              <span className={`flex-1 text-left text-[13.5px] ${hasActiveChild ? 'font-semibold' : 'font-medium'}`}>
                {label}
              </span>
              {children?.length > 1 && (
                <ChevronDown
                  size={14}
                  className={`shrink-0 text-[#7A776F] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
              )}
            </>
          )}
        </button>

        {/* Expanded: inline children */}
        {expanded && isOpen && children?.length > 1 && (
          <div className="ml-[30px] mt-0.5 mb-1 border-l border-[#E8E4DD] pl-3 space-y-0.5">
            {children.map((child) => {
              const isActive = location.pathname === child.path
              const unlocked = isFeatureUnlocked(tier, child.minTier)
              return (
                <button
                  key={child.id}
                  onClick={() => handleChildClick(child)}
                  className={`
                    w-full text-left px-2.5 py-[7px] rounded-lg text-[13px] transition-all duration-150
                    flex items-center justify-between
                    ${isActive
                      ? 'text-[#1B4332] font-semibold bg-[#1B4332]/[0.05]'
                      : unlocked
                        ? 'text-[#7A776F] hover:text-[#2C2C2A] hover:bg-[#E8E4DD]/30 font-medium'
                        : 'text-[#E8E4DD] font-medium cursor-not-allowed'
                    }
                  `}
                >
                  <span>{child.label}</span>
                  {!unlocked && <Lock size={11} className="text-[#E8E4DD]" />}
                </button>
              )
            })}
          </div>
        )}

        {/* Collapsed: popover on hover */}
        {!expanded && isHovered && children && (
          <div
            ref={popoverRef}
            className="absolute left-full top-0 ml-2 z-50 animate-fadeIn"
            onMouseEnter={() => { clearTimeout(hoverTimeoutRef.current); setHoveredItem(id) }}
            onMouseLeave={handleHoverLeave}
          >
            <div className="bg-white rounded-xl shadow-[0_8px_30px_-4px_rgba(20,20,19,0.12)] border border-[#E8E4DD] py-1.5 min-w-[160px]">
              {children.length === 1 ? (
                <button
                  onClick={() => handleChildClick(children[0])}
                  className="w-full text-left px-3.5 py-2 text-[13px] font-medium text-[#2C2C2A] hover:bg-[#FAF7F2] transition-colors"
                >
                  {label}
                </button>
              ) : (
                children.map((child) => {
                  const isActive = location.pathname === child.path
                  const unlocked = isFeatureUnlocked(tier, child.minTier)
                  return (
                    <button
                      key={child.id}
                      onClick={() => handleChildClick(child)}
                      className={`
                        w-full text-left px-3.5 py-2 text-[13px] transition-colors flex items-center justify-between
                        ${isActive
                          ? 'text-[#1B4332] font-semibold bg-[#FAF7F2]'
                          : unlocked
                            ? 'text-[#7A776F] hover:text-[#2C2C2A] hover:bg-[#FAF7F2] font-medium'
                            : 'text-[#E8E4DD] cursor-not-allowed font-medium'
                        }
                      `}
                    >
                      <span>{child.label}</span>
                      {!unlocked && <Lock size={11} className="text-[#E8E4DD]" />}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ════════════════════════════════════════════
   *  DESKTOP SIDEBAR
   * ════════════════════════════════════════════ */
  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-[#E8E4DD]">

      {/* ── Header: Logo + toggle ── */}
      <div className="shrink-0 flex items-center justify-between h-16 px-4 border-b border-[#F0EDE7]">
        {expanded ? (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#1B4332] rounded-lg flex items-center justify-center">
              <span className="text-[#FAF7F2] font-bold text-sm">R</span>
            </div>
            <span className="font-bold text-[17px] text-[#1B4332] tracking-tight">rezvo</span>
          </div>
        ) : (
          <div className="w-8 h-8 bg-[#1B4332] rounded-lg flex items-center justify-center mx-auto">
            <span className="text-[#FAF7F2] font-bold text-sm">R</span>
          </div>
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-7 h-7 rounded-lg flex items-center justify-center text-[#7A776F] hover:text-[#2C2C2A] hover:bg-[#F0EDE7] transition-all duration-200 ${!expanded ? 'hidden lg:hidden' : ''}`}
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* ── Search ── */}
      {expanded ? (
        <div className="shrink-0 px-3 pt-3 pb-1">
          <div className={`flex items-center gap-2 px-3 h-9 rounded-lg border transition-all duration-200 ${searchFocused ? 'border-[#40916C] ring-2 ring-[#40916C]/10' : 'border-[#E8E4DD] hover:border-[#D4A373]/40'}`}>
            <Search size={14} className="text-[#7A776F] shrink-0" />
            <input
              type="text"
              placeholder="Search"
              className="flex-1 bg-transparent text-[13px] text-[#2C2C2A] placeholder:text-[#7A776F] outline-none"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-[#7A776F] bg-[#F0EDE7] px-1.5 py-0.5 rounded font-mono">
              ⌘K
            </kbd>
          </div>
        </div>
      ) : (
        <div className="shrink-0 flex justify-center py-3">
          <button className="w-9 h-9 rounded-lg flex items-center justify-center text-[#7A776F] hover:text-[#2C2C2A] hover:bg-[#F0EDE7] transition-all">
            <Search size={18} />
          </button>
        </div>
      )}

      {/* ── Nav sections ── */}
      <div className="flex-1 overflow-y-auto px-2.5 pt-2 pb-4 space-y-5">
        {sections.map((section) => (
          <div key={section.label}>
            {expanded && (
              <div className="px-3 mb-2 text-[10px] font-semibold tracking-[0.1em] text-[#7A776F] uppercase select-none">
                {section.label}
              </div>
            )}
            <div className={expanded ? 'space-y-0.5' : 'flex flex-col items-center gap-1'}>
              {section.items.map(renderNavItem)}
            </div>
          </div>
        ))}
      </div>

      {/* ── User profile ── */}
      <div className="shrink-0 border-t border-[#F0EDE7] p-3">
        {expanded ? (
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[#F0EDE7]/60 transition-all cursor-pointer group">
            <div className="w-9 h-9 rounded-full bg-[#D4A373]/15 flex items-center justify-center shrink-0">
              <span className="text-[#1B4332] font-semibold text-xs">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[#2C2C2A] truncate">{user?.name || 'Demo User'}</div>
              <div className="text-[11px] text-[#7A776F] truncate">
                {business?.name || 'Your Business'}
              </div>
            </div>
            <ChevronDown size={14} className="text-[#7A776F] shrink-0 group-hover:text-[#2C2C2A] transition-colors" />
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={handleLogout}
              className="w-9 h-9 rounded-full bg-[#D4A373]/15 flex items-center justify-center hover:bg-[#D4A373]/25 transition-all"
              title="Log out"
            >
              <span className="text-[#1B4332] font-semibold text-xs">{initials}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* ══════ DESKTOP ══════ */}
      <div
        className="hidden lg:block shrink-0 h-screen relative"
        style={{
          width: expanded ? EXPANDED_W : COLLAPSED_W,
          transition: 'width 280ms cubic-bezier(0.25, 0.1, 0.25, 1)',
        }}
      >
        {sidebarContent}

        {/* Expand handle (visible when collapsed) */}
        {!expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-30 w-6 h-10 bg-white border border-[#E8E4DD] rounded-r-lg flex items-center justify-center text-[#7A776F] hover:text-[#1B4332] hover:bg-[#FAF7F2] shadow-sm transition-all duration-200"
          >
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* ══════ MOBILE OVERLAY ══════ */}
      {open && (
        <div className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onNavigate} />
      )}
      <div
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[280px] transition-transform duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col bg-white border-r border-[#E8E4DD]">
          {/* Mobile header */}
          <div className="shrink-0 flex items-center justify-between h-16 px-4 border-b border-[#F0EDE7]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-[#1B4332] rounded-lg flex items-center justify-center">
                <span className="text-[#FAF7F2] font-bold text-sm">R</span>
              </div>
              <span className="font-bold text-[17px] text-[#1B4332] tracking-tight">rezvo</span>
            </div>
            <button onClick={onNavigate} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#7A776F] hover:text-[#2C2C2A] hover:bg-[#F0EDE7] transition-all">
              <X size={18} />
            </button>
          </div>

          {/* Mobile search */}
          <div className="shrink-0 px-3 pt-3 pb-1">
            <div className="flex items-center gap-2 px-3 h-9 rounded-lg border border-[#E8E4DD]">
              <Search size={14} className="text-[#7A776F] shrink-0" />
              <input
                type="text"
                placeholder="Search"
                className="flex-1 bg-transparent text-[13px] text-[#2C2C2A] placeholder:text-[#7A776F] outline-none"
              />
            </div>
          </div>

          {/* Mobile nav — always expanded */}
          <div className="flex-1 overflow-y-auto px-2.5 pt-2 pb-4 space-y-5">
            {sections.map((section) => (
              <div key={section.label}>
                <div className="px-3 mb-2 text-[10px] font-semibold tracking-[0.1em] text-[#7A776F] uppercase select-none">
                  {section.label}
                </div>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const { id, Icon, label, children } = item
                    const isOpen = openMenus[id]
                    const hasActiveChild = children?.some((c) => c.path === location.pathname)
                    return (
                      <div key={id}>
                        <button
                          onClick={() => children?.length > 1 ? toggleMenu(id) : handleChildClick(children[0])}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-all duration-200
                            ${hasActiveChild ? 'bg-[#1B4332]/[0.06] text-[#1B4332]' : 'text-[#7A776F] hover:text-[#2C2C2A] hover:bg-[#E8E4DD]/40'}`}
                        >
                          <Icon size={18} strokeWidth={hasActiveChild ? 2 : 1.5} className="shrink-0" />
                          <span className={`flex-1 text-left text-[13.5px] ${hasActiveChild ? 'font-semibold' : 'font-medium'}`}>{label}</span>
                          {children?.length > 1 && (
                            <ChevronDown size={14} className={`text-[#7A776F] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                          )}
                        </button>
                        {isOpen && children?.length > 1 && (
                          <div className="ml-[30px] mt-0.5 mb-1 border-l border-[#E8E4DD] pl-3 space-y-0.5">
                            {children.map((child) => {
                              const isActive = location.pathname === child.path
                              const unlocked = isFeatureUnlocked(tier, child.minTier)
                              return (
                                <button
                                  key={child.id}
                                  onClick={() => { handleChildClick(child); onNavigate?.() }}
                                  className={`w-full text-left px-2.5 py-[7px] rounded-lg text-[13px] transition-all flex items-center justify-between
                                    ${isActive ? 'text-[#1B4332] font-semibold bg-[#1B4332]/[0.05]' : unlocked ? 'text-[#7A776F] hover:text-[#2C2C2A] font-medium' : 'text-[#E8E4DD] cursor-not-allowed font-medium'}`}
                                >
                                  <span>{child.label}</span>
                                  {!unlocked && <Lock size={11} className="text-[#E8E4DD]" />}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Mobile user */}
          <div className="shrink-0 border-t border-[#F0EDE7] p-3">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-9 h-9 rounded-full bg-[#D4A373]/15 flex items-center justify-center shrink-0">
                <span className="text-[#1B4332] font-semibold text-xs">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[#2C2C2A] truncate">{user?.name || 'Demo User'}</div>
                <div className="text-[11px] text-[#7A776F]">{business?.name || 'Your Business'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Animations ── */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-4px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fadeIn { animation: fadeIn 150ms ease-out forwards; }
      `}</style>

      {upgradeModal && <UpgradeModal tierName={upgradeModal} onClose={() => setUpgradeModal(null)} onViewPlans={() => setUpgradeModal(null)} />}
    </>
  )
}

export default Sidebar

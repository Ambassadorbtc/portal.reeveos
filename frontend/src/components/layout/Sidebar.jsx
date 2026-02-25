/**
 * Green Rail + White Panel sidebar with dripping edge animation
 * Adapted from approved sidebar-v7 prototype
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useBusiness } from '../../contexts/BusinessContext'
import { isFeatureUnlocked } from '../../config/tiers'
import { getNavItems as getNavItemsFn } from '../../config/navigation'
import {
  LayoutDashboard, Calendar, ClipboardList, Link2, UtensilsCrossed, Scissors,
  Users, Globe, ShoppingBag, BookUser, Star, BarChart3, CreditCard,
  LayoutGrid, Megaphone, Settings, HelpCircle,
  ChevronLeft, ChevronRight, ChevronDown, Lock,
  Send, Bot, Linkedin, Bell
} from 'lucide-react'

/* ── Color tokens ── */
const T = {
  forest: '#1B4332', fern: '#2D6A4F', sage: '#40916C', mint: '#D8F3DC',
  cream: '#FAF7F2', ink: '#141413', text: '#2C2C2A',
  muted: '#7A776F', border: '#E8E4DD', borderLight: '#F0EDE7', white: '#FFFFFF',
}

const RAIL_W = 64
const PANEL_W = 220

/* ── Icon map ── */
const ICON_MAP = {
  'fa-house': LayoutDashboard,
  'fa-calendar-days': Calendar,
  'fa-clipboard-list': ClipboardList,
  'fa-link': Link2,
  'fa-utensils': UtensilsCrossed,
  'fa-scissors': Scissors,
  'fa-users': Users,
  'fa-globe': Globe,
  'fa-bag-shopping': ShoppingBag,
  'fa-address-book': BookUser,
  'fa-star': Star,
  'fa-chart-line': BarChart3,
  'fa-credit-card': CreditCard,
  'fa-table-cells-large': LayoutGrid,
  'fa-bullhorn': Megaphone,
  'fa-gear': Settings,
  'fa-circle-question': HelpCircle,
  'fa-paper-plane': Send,
  'fa-robot': Bot,
  'fa-linkedin': Linkedin,
  'fa-bell': Bell,
}

/* ── Build grouped sections from nav config ── */
function buildSections(navItems, tier, businessType) {
  const iconFor = (item) => ICON_MAP[item.icon] || LayoutDashboard
  const locked = () => false // All features unlocked

  // Group: MAIN
  const mainChildren = [
    ...(navItems.main || []).map(i => ({
      id: i.id, label: i.label, path: i.path, Icon: iconFor(i), locked: locked(i), badge: i.badge,
    })),
  ]

  // Group: MANAGE
  const manageChildren = [
    ...(navItems.management || []).map(i => ({
      id: i.id, label: i.label, path: i.path, Icon: iconFor(i), locked: locked(i),
    })),
    ...(navItems.business || []).map(i => ({
      id: i.id, label: i.label, path: i.path, Icon: iconFor(i), locked: locked(i),
    })),
    ...(navItems.advanced || []).map(i => ({
      id: i.id, label: i.label, path: i.path, Icon: iconFor(i), locked: locked(i),
    })),
  ]

  // Group: SYSTEM
  const systemChildren = [
    ...(navItems.system || []).map(i => ({
      id: i.id, label: i.label, path: i.path, Icon: iconFor(i), locked: locked(i),
    })),
  ]

  // Build rail items (grouped with children for sub-menu)
  const sections = [
    { label: 'MAIN', items: [
      { id: 'dashboard', Icon: LayoutDashboard, label: 'Dashboard', children: [
        mainChildren.find(c => c.id === 'home'),
      ].filter(Boolean) },
      { id: 'calendar', Icon: Calendar, label: businessType === 'restaurant' ? 'Reservations' : 'Calendar', children: [
        mainChildren.find(c => c.id === 'calendar'),
        mainChildren.find(c => c.id === 'notifications'),
        mainChildren.find(c => c.id === 'bookings'),
      ].filter(Boolean) },
      { id: 'booking-link', Icon: Link2, label: 'Booking Link', children: [
        mainChildren.find(c => c.id === 'booking-link'),
      ].filter(Boolean) },
      { id: 'services', Icon: mainChildren.find(c => c.id === 'services')?.Icon || UtensilsCrossed, label: mainChildren.find(c => c.id === 'services')?.label || 'Services', children: [
        mainChildren.find(c => c.id === 'services'),
        ...(navItems.management || []).filter(i => i.id === 'online-booking').map(i => ({
          id: i.id, label: i.label, path: i.path, Icon: iconFor(i), locked: locked(i),
        })),
        ...(navItems.business || []).filter(i => i.id === 'orders').map(i => ({
          id: i.id, label: i.label, path: i.path, Icon: iconFor(i), locked: locked(i),
        })),
      ].filter(Boolean) },
    ]},
    { label: 'MANAGE', items: [
      { id: 'people', Icon: Users, label: 'People', children: [
        ...(navItems.management || []).filter(i => i.id === 'staff').map(i => ({
          id: i.id, label: i.label, path: i.path, Icon: iconFor(i), locked: locked(i),
        })),
        ...(navItems.business || []).filter(i => ['clients', 'reviews'].includes(i.id)).map(i => ({
          id: i.id, label: i.label, path: i.path, Icon: iconFor(i), locked: locked(i),
        })),
      ].filter(Boolean) },
      { id: 'business', Icon: BarChart3, label: 'Business', children: [
        ...(navItems.business || []).filter(i => ['analytics', 'payments'].includes(i.id)).map(i => ({
          id: i.id, label: i.label, path: i.path, Icon: iconFor(i), locked: locked(i),
        })),
        ...(navItems.advanced || []).map(i => ({
          id: i.id, label: i.label, path: i.path, Icon: iconFor(i), locked: locked(i),
        })),
      ].filter(Boolean) },
      { id: 'settings', Icon: Settings, label: 'Settings', children:
        systemChildren
      },
    ]},
  ]

  return sections
}

/* ── Sub-components ── */
function TreeBranch({ index, total }) {
  const isLast = index === total - 1
  return (
    <svg width="20" height="36" viewBox="0 0 20 36" style={{ flexShrink: 0, marginLeft: 2 }}>
      <path d="M 10 0 L 10 18 Q 10 24 16 24 L 20 24" fill="none" stroke="rgba(27,67,50,0.15)" strokeWidth="1.5" />
      {!isLast && <line x1="10" y1="18" x2="10" y2="36" stroke="rgba(27,67,50,0.15)" strokeWidth="1.5" />}
    </svg>
  )
}

function CascadeItem({ delay, show, children }) {
  return (
    <div style={{
      opacity: show ? 1 : 0,
      transform: show ? 'translateY(0)' : 'translateY(-16px)',
      transition: `opacity 350ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 450ms cubic-bezier(0.34,1.56,0.64,1) ${delay}ms`,
    }}>{children}</div>
  )
}

function WaterfallChild({ child, index, total, isActive, onClick, baseDelay, panelShow }) {
  const d = baseDelay + index * 60
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      opacity: panelShow ? 1 : 0,
      transform: panelShow ? 'translateY(0)' : 'translateY(-12px)',
      transition: `opacity 300ms cubic-bezier(0.16,1,0.3,1) ${d}ms, transform 400ms cubic-bezier(0.34,1.56,0.64,1) ${d}ms`,
    }}>
      <TreeBranch index={index} total={total} />
      <button onClick={onClick} style={{
        flex: 1, textAlign: 'left', padding: '7px 10px', borderRadius: 8, border: 'none',
        cursor: child.locked ? 'not-allowed' : 'pointer',
        fontSize: 13, fontFamily: 'Figtree,system-ui,sans-serif',
        fontWeight: isActive ? 600 : 500,
        color: isActive ? T.forest : child.locked ? '#C5C2BC' : T.muted,
        background: isActive ? 'rgba(27,67,50,0.06)' : 'transparent',
        transition: 'background 150ms, color 150ms',
      }}
        onMouseOver={e => { if (!child.locked && !isActive) { e.currentTarget.style.background = 'rgba(27,67,50,0.04)'; e.currentTarget.style.color = T.text; }}}
        onMouseOut={e => { if (!child.locked && !isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = child.locked ? '#C5C2BC' : T.muted; }}}
      >{child.label}{child.badge && <span style={{ marginLeft: 6, background: '#D4A373', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10, lineHeight: '14px', display: 'inline-block', minWidth: 18, textAlign: 'center' }}>{child.badge}</span>}</button>
      {child.locked && <Lock size={11} style={{ color: '#D5D2CC', marginRight: 8 }} />}
    </div>
  )
}

function WaterfallMenu({ children: kids, isOpen, activePath, onNavigate, panelShow, baseDelay }) {
  const [render, setRender] = useState(false)
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (isOpen) { setRender(true); requestAnimationFrame(() => requestAnimationFrame(() => setShow(true))) }
    else { setShow(false); const t = setTimeout(() => setRender(false), 400); return () => clearTimeout(t) }
  }, [isOpen])
  if (!render || !kids || kids.length <= 1) return null
  return (
    <div style={{
      overflow: 'hidden', maxHeight: show ? kids.length * 40 + 16 : 0,
      transition: 'max-height 450ms cubic-bezier(0.16,1,0.3,1)', marginLeft: 14,
    }}>
      <div style={{ paddingTop: 2, paddingBottom: 4 }}>
        {kids.map((child, i) => (
          <WaterfallChild key={child.id} child={child} index={i} total={kids.length}
            isActive={activePath === child.path} panelShow={show && panelShow}
            onClick={() => !child.locked && onNavigate(child.path)} baseDelay={baseDelay + 60}
          />
        ))}
      </div>
    </div>
  )
}

function CollapsedPopover({ item, activePath, onNavigate }) {
  return (
    <div style={{
      position: 'absolute', left: 'calc(100% + 8px)', top: -4, zIndex: 999,
      animation: 'sidebarPopIn 250ms cubic-bezier(0.16,1,0.3,1) forwards',
    }}>
      <div style={{
        background: T.white, borderRadius: 14, padding: '8px 6px', minWidth: 170,
        boxShadow: '0 12px 40px -6px rgba(20,20,19,0.15), 0 4px 12px -2px rgba(20,20,19,0.08)',
        border: `1px solid ${T.borderLight}`,
      }}>
        <div style={{ padding: '4px 10px 8px', fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: '0.04em' }}>{item.label}</div>
        {item.children?.map((child, i) => {
          const isActive = activePath === child.path
          return (
            <button key={child.id} onClick={() => !child.locked && onNavigate(child.path)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: 'none',
              cursor: child.locked ? 'not-allowed' : 'pointer',
              fontSize: 13, fontFamily: 'Figtree,system-ui,sans-serif',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? T.forest : child.locked ? '#C5C2BC' : T.muted,
              background: isActive ? 'rgba(27,67,50,0.06)' : 'transparent',
              transition: 'all 150ms',
              opacity: 0, animation: `sidebarFadeSlideIn 280ms cubic-bezier(0.16,1,0.3,1) ${60 + i * 55}ms forwards`,
            }}
              onMouseOver={e => { if (!child.locked && !isActive) { e.currentTarget.style.background = T.cream; e.currentTarget.style.color = T.text; }}}
              onMouseOut={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isActive ? T.forest : child.locked ? '#C5C2BC' : T.muted; }}}
            >
              <span>{child.label}</span>
              {child.locked && <Lock size={11} style={{ color: '#D5D2CC' }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── Dripping edge animation ── */
function DrippingEdge({ active, panelHeight }) {
  const svgRef = useRef(null)
  const animRef = useRef(null)
  const [dropY, setDropY] = useState(-100)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (active) {
      setVisible(true)
      setDropY(-80)
      const h = panelHeight || 800
      const duration = 700
      const start = performance.now()
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1)
        const eased = 1 - Math.pow(1 - t, 2.5)
        setDropY(-80 + (h + 160) * eased)
        if (t < 1) { animRef.current = requestAnimationFrame(tick) }
        else { setTimeout(() => setVisible(false), 100) }
      }
      animRef.current = requestAnimationFrame(tick)
    } else { setVisible(false) }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [active, panelHeight])

  if (!visible) return null
  const h = panelHeight || 800
  const bulgeW = 22
  const bulgeH = 120
  const y = dropY
  const path = `M 0 0 L 0 ${Math.max(0, y - bulgeH / 2)} C 0 ${y - bulgeH * 0.3}, ${bulgeW * 0.6} ${y - bulgeH * 0.15}, ${bulgeW} ${y} C ${bulgeW * 0.6} ${y + bulgeH * 0.15}, 0 ${y + bulgeH * 0.3}, 0 ${Math.min(h, y + bulgeH / 2)} L 0 ${h} L -1 ${h} L -1 0 Z`

  return (
    <svg ref={svgRef} width={bulgeW + 2} height={h} viewBox={`-1 0 ${bulgeW + 3} ${h}`}
      style={{ position: 'absolute', right: -(bulgeW), top: 0, height: '100%', pointerEvents: 'none', zIndex: 5 }}>
      <path d={path} fill={T.white} />
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════
   MAIN SIDEBAR COMPONENT
   ══════════════════════════════════════════════════════════ */
const Sidebar = ({ open, onNavigate: closeMobile }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { business, businessType, tier } = useBusiness()
  const navItems = getNavItemsFn(businessType)
  const sections = buildSections(navItems, tier, businessType)
  const allItems = sections.flatMap(s => s.items)

  const [panelOpen, setPanelOpen] = useState(true)
  const [panelShow, setPanelShow] = useState(true)
  const [activeSection, setActiveSection] = useState('dashboard')
  const [openMenus, setOpenMenus] = useState({ dashboard: true })
  const [hoveredRail, setHoveredRail] = useState(null)
  const [dripActive, setDripActive] = useState(false)
  const [dripKey, setDripKey] = useState(0)
  const hoverTimeout = useRef(null)
  const panelRef = useRef(null)
  const [panelH, setPanelH] = useState(800)
  const cascadeCounter = useRef(0)

  const activePath = location.pathname

  useEffect(() => {
    if (panelRef.current) setPanelH(panelRef.current.offsetHeight)
  })

  // Sync active section from URL
  useEffect(() => {
    for (const item of allItems) {
      if (item.children?.some(c => c.path === activePath)) {
        setActiveSection(item.id)
        setOpenMenus(p => ({ ...p, [item.id]: true }))
        return
      }
    }
  }, [activePath])

  const triggerOpen = () => {
    setPanelShow(false)
    setDripActive(false)
    requestAnimationFrame(() => {
      setDripKey(k => k + 1)
      setDripActive(true)
      setPanelShow(true)
    })
  }

  const handleNav = (path) => {
    navigate(path)
    closeMobile?.()
  }

  const handleRailClick = (item) => {
    if (activeSection === item.id && panelOpen) {
      setPanelOpen(false)
      setPanelShow(false)
      setDripActive(false)
    } else {
      setActiveSection(item.id)
      setOpenMenus({ [item.id]: true })
      if (!panelOpen) setPanelOpen(true)
      triggerOpen()
      const first = item.children?.find(c => !c.locked)
      if (first) handleNav(first.path)
    }
  }

  const toggleMenu = (id) => setOpenMenus(p => ({ ...p, [id]: !p[id] }))

  const handleRailHover = (id) => { clearTimeout(hoverTimeout.current); setHoveredRail(id) }
  const handleRailLeave = () => { hoverTimeout.current = setTimeout(() => setHoveredRail(null), 200) }

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'
  const businessName = business?.name || 'My Business'

  const nd = () => (cascadeCounter.current++) * 45

  // Reset cascade counter each render
  cascadeCounter.current = 0

  return (
    <>
      <style>{`
        @keyframes sidebarPopIn{from{opacity:0;transform:scale(0.95) translateX(-8px)}to{opacity:1;transform:scale(1) translateX(0)}}
        @keyframes sidebarFadeSlideIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 lg:hidden"
          onClick={closeMobile}
        />
      )}

      <div
        className={`fixed lg:relative inset-y-0 left-0 z-40 flex transition-transform duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ fontFamily: 'Figtree,system-ui,sans-serif' }}
      >
        {/* ═══ GREEN RAIL ═══ */}
        <div style={{ width: RAIL_W, background: T.forest, display: 'flex', flexDirection: 'column', zIndex: 20, flexShrink: 0 }}>
          {/* Logo */}
          <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#D4A373', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
              <span style={{ color: '#1B4332', fontWeight: 700, fontSize: 15, fontFamily: 'Figtree,sans-serif' }}>R.</span>
            </div>
          </div>

          {/* Rail icons */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16, gap: 4, overflowY: 'auto' }}>
            {allItems.map(item => {
              const SIcon = item.Icon || LayoutDashboard
              const isActive = item.children?.some(c => c.path === activePath)
              const isHovered = hoveredRail === item.id
              return (
                <div key={item.id} style={{ position: 'relative' }}
                  onMouseEnter={() => handleRailHover(item.id)}
                  onMouseLeave={handleRailLeave}
                >
                  <button onClick={() => handleRailClick(item)} style={{
                    width: 44, height: 44, borderRadius: 12, border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isActive ? 'rgba(255,255,255,0.14)' : isHovered ? 'rgba(255,255,255,0.08)' : 'transparent',
                    transition: 'all 200ms', position: 'relative',
                  }}>
                    {isActive && <div style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: '0 4px 4px 0', background: T.cream }} />}
                    <SIcon size={20} strokeWidth={isActive ? 2.2 : 1.5} color={isActive ? T.cream : 'rgba(250,247,242,0.4)'} style={{ transition: 'all 200ms' }} />
                  </button>
                  {!panelOpen && isHovered && item.children?.length > 0 && (
                    <div onMouseEnter={() => handleRailHover(item.id)} onMouseLeave={handleRailLeave}>
                      <CollapsedPopover item={item} activePath={activePath} onNavigate={handleNav} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* User avatar */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 0', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', cursor: 'pointer',
              background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 200ms',
            }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            >
              <span style={{ color: T.cream, fontWeight: 600, fontSize: 12 }}>{initials}</span>
            </div>
          </div>
        </div>

        {/* ═══ WHITE PANEL ═══ */}
        <div style={{
          width: panelOpen ? PANEL_W : 0, minWidth: panelOpen ? PANEL_W : 0,
          transition: 'width 500ms cubic-bezier(0.16,1,0.3,1), min-width 500ms cubic-bezier(0.16,1,0.3,1)',
          overflow: 'visible', flexShrink: 0, position: 'relative', zIndex: 10,
        }}>
          <div ref={panelRef} style={{
            width: PANEL_W, height: panelOpen ? '100%' : '0%',
            background: T.white, display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            transition: 'height 550ms cubic-bezier(0.16,1,0.3,1)',
            position: 'relative',
          }}>
            <DrippingEdge key={dripKey} active={dripActive} panelHeight={panelH} />

            {/* Panel header */}
            <CascadeItem delay={nd()} show={panelShow}>
              <div style={{
                height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 16px', borderBottom: `1px solid ${T.borderLight}`, flexShrink: 0,
              }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: T.forest, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                  {allItems.find(i => i.id === activeSection)?.label || 'Menu'}
                </span>
                <button onClick={() => { setPanelOpen(false); setPanelShow(false); setDripActive(false) }} style={{
                  width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: T.muted, background: 'transparent', transition: 'all 150ms',
                }}
                  onMouseOver={e => { e.currentTarget.style.background = T.borderLight; e.currentTarget.style.color = T.text }}
                  onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.muted }}
                >
                  <ChevronLeft size={16} />
                </button>
              </div>
            </CascadeItem>

            {/* Nav items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px 16px' }}>
              {sections.map(section => {
                const sd = nd()
                return (
                  <div key={section.label} style={{ marginBottom: 20 }}>
                    <CascadeItem delay={sd} show={panelShow}>
                      <div style={{ padding: '0 8px', marginBottom: 8, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: T.muted, textTransform: 'uppercase', userSelect: 'none' }}>{section.label}</div>
                    </CascadeItem>
                    {section.items.map(item => {
                      const { id, Icon, label, children } = item
                      const isOpen = openMenus[id]
                      const hasActive = children?.some(c => c.path === activePath)
                      const id2 = nd()
                      return (
                        <div key={id} style={{ marginBottom: 2 }}>
                          <CascadeItem delay={id2} show={panelShow}>
                            <button onClick={() => children?.length > 1 ? toggleMenu(id) : children?.[0] && handleNav(children[0].path)} style={{
                              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                              padding: '9px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                              fontSize: 13.5, fontFamily: 'Figtree,system-ui,sans-serif',
                              fontWeight: hasActive ? 600 : 500, color: hasActive ? T.forest : T.muted,
                              background: hasActive ? 'rgba(27,67,50,0.06)' : 'transparent',
                              transition: 'all 180ms', whiteSpace: 'nowrap',
                            }}
                              onMouseOver={e => { if (!hasActive) { e.currentTarget.style.background = 'rgba(232,228,221,0.5)'; e.currentTarget.style.color = T.text }}}
                              onMouseOut={e => { if (!hasActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.muted }}}
                            >
                              <Icon size={17} strokeWidth={hasActive ? 2 : 1.5} style={{ flexShrink: 0 }} />
                              <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
                              {children?.length > 1 && <ChevronDown size={14} style={{ color: T.muted, flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 350ms cubic-bezier(0.34,1.56,0.64,1)' }} />}
                            </button>
                          </CascadeItem>
                          <WaterfallMenu children={children} isOpen={isOpen} activePath={activePath}
                            onNavigate={handleNav} panelShow={panelShow} baseDelay={id2 + 40} />
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* User footer */}
            <CascadeItem delay={nd()} show={panelShow}>
              <div style={{ flexShrink: 0, borderTop: `1px solid ${T.borderLight}`, padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px', borderRadius: 10, cursor: 'pointer', transition: 'all 200ms' }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(240,237,231,0.6)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(212,163,115,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: T.forest, fontWeight: 600, fontSize: 11 }}>{initials}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text, lineHeight: 1.3 }}>{user?.name || 'User'}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>{businessName}</div>
                  </div>
                  <ChevronDown size={13} style={{ color: T.muted, flexShrink: 0 }} />
                </div>
              </div>
            </CascadeItem>
          </div>
        </div>

        {/* Expand handle when panel collapsed */}
        {!panelOpen && (
          <button onClick={() => { setPanelOpen(true); triggerOpen() }} className="hidden lg:flex" style={{
            position: 'absolute', left: RAIL_W - 1, top: '50%', transform: 'translateY(-50%)', zIndex: 30,
            width: 20, height: 44, background: T.white, border: `1px solid ${T.border}`, borderLeft: 'none',
            borderRadius: '0 8px 8px 0', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: T.muted, boxShadow: '2px 0 12px rgba(0,0,0,0.04)', transition: 'all 200ms',
          }}
            onMouseOver={e => { e.currentTarget.style.color = T.forest; e.currentTarget.style.background = T.cream }}
            onMouseOut={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.background = T.white }}
          >
            <ChevronRight size={14} />
          </button>
        )}
      </div>
    </>
  )
}

export default Sidebar

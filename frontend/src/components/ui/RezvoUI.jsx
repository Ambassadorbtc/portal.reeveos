/**
 * Rezvo UI — Branded component library
 * Import these everywhere. No more default browser styles.
 * 
 * Usage:
 *   import { PillTabs, SearchBar, ActionButton, Select, Badge } from '../../components/ui/RezvoUI'
 */
import { Search, ChevronDown, Check } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

/* ═══════════════════════════════════════════
   PILL TABS — The standard tab component
   ═══════════════════════════════════════════ */
export const PillTabs = ({ tabs, active, onChange, size = 'md' }) => {
  const sizes = {
    sm: 'px-3 py-1 text-[11px]',
    md: 'px-4 py-1.5 text-xs',
    lg: 'px-5 py-2 text-sm',
  }
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {tabs.map(t => {
        const key = typeof t === 'string' ? t : t.id
        const label = typeof t === 'string' ? t : t.label
        const Icon = typeof t === 'object' ? t.icon : null
        const isActive = active === key
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`
              flex items-center gap-1.5 rounded-full font-bold transition-all whitespace-nowrap
              ${sizes[size]}
              ${isActive
                ? 'bg-[#111111] text-white shadow-lg shadow-[#111111]/20'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }
            `}
            style={{ fontFamily: "'Figtree', sans-serif" }}
          >
            {Icon && <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
            {label}
          </button>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════
   SEARCH BAR — Branded pill search input
   ═══════════════════════════════════════════ */
export const SearchBar = ({ value, onChange, placeholder = 'Search...', className = '' }) => (
  <div className={`relative ${className}`}>
    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#111111]/15 focus:border-[#111111]/30 shadow-sm transition-all"
      style={{ fontFamily: "'Figtree', sans-serif" }}
    />
  </div>
)

/* ═══════════════════════════════════════════
   ACTION BUTTON — Primary CTA, always branded
   ═══════════════════════════════════════════ */
export const ActionButton = ({
  children, onClick, variant = 'primary', size = 'md', icon: Icon, disabled = false, className = '', ...props
}) => {
  const variants = {
    primary: 'bg-[#111111] text-white hover:bg-[#1a1a1a] shadow-lg shadow-[#111111]/20 active:shadow-md',
    secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm',
    danger: 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20',
    ghost: 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
    success: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20',
  }
  const sizes = {
    xs: 'px-2.5 py-1 text-[11px] gap-1',
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-sm gap-2',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center rounded-full font-bold transition-all
        ${variants[variant]} ${sizes[size]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      style={{ fontFamily: "'Figtree', sans-serif" }}
      {...props}
    >
      {Icon && <Icon className={size === 'xs' ? 'w-3 h-3' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />}
      {children}
    </button>
  )
}

/* ═══════════════════════════════════════════
   SELECT — Custom dropdown, no browser default
   ═══════════════════════════════════════════ */
export const Select = ({ value, onChange, options, placeholder = 'Select...', className = '' }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const selected = options.find(o => (typeof o === 'object' ? o.value : o) === value)
  const label = selected ? (typeof selected === 'object' ? selected.label : selected) : placeholder

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`
          w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all text-left
          ${open ? 'border-[#111111]/30 ring-2 ring-[#111111]/10' : 'border-gray-200 hover:border-gray-300'}
          ${value ? 'text-gray-900' : 'text-gray-400'}
          bg-white shadow-sm
        `}
        style={{ fontFamily: "'Figtree', sans-serif" }}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto"
          style={{ fontFamily: "'Figtree', sans-serif" }}>
          {options.map((opt, i) => {
            const optVal = typeof opt === 'object' ? opt.value : opt
            const optLabel = typeof opt === 'object' ? opt.label : opt
            const isSelected = optVal === value
            return (
              <button
                key={i}
                onClick={() => { onChange(optVal); setOpen(false) }}
                className={`
                  w-full text-left px-3.5 py-2.5 text-sm font-medium flex items-center justify-between transition-colors
                  ${isSelected ? 'bg-[#111111]/5 text-[#111111] font-bold' : 'text-gray-700 hover:bg-gray-50'}
                `}
              >
                <span>{optLabel}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-[#111111]" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════
   BADGE — Status pill
   ═══════════════════════════════════════════ */
export const Badge = ({ children, variant = 'default', dot = false }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-600',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-600',
    info: 'bg-blue-50 text-blue-700',
    primary: 'bg-[#111111]/10 text-[#111111]',
    live: 'bg-emerald-50 text-emerald-700',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${variants[variant]}`}
      style={{ fontFamily: "'Figtree', sans-serif" }}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${
        variant === 'success' || variant === 'live' ? 'bg-emerald-500' :
        variant === 'warning' ? 'bg-amber-500' :
        variant === 'danger' ? 'bg-red-500' :
        variant === 'info' ? 'bg-blue-500' :
        variant === 'primary' ? 'bg-[#111111]' : 'bg-gray-400'
      }`} />}
      {children}
    </span>
  )
}

/* ═══════════════════════════════════════════
   CARD — Standard container
   ═══════════════════════════════════════════ */
export const Card = ({ children, className = '', hover = false, ...props }) => (
  <div
    className={`bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] ${
      hover ? 'hover:shadow-[0_10px_30px_-5px_rgba(17,17,17,0.08)] transition-all' : ''
    } ${className}`}
    style={{ fontFamily: "'Figtree', sans-serif" }}
    {...props}
  >
    {children}
  </div>
)

/* ═══════════════════════════════════════════
   PAGE HEADER — Consistent page top section
   ═══════════════════════════════════════════ */
export const PageHeader = ({ title, subtitle, children }) => (
  <div className="flex items-center justify-between flex-wrap gap-3 -mt-1 mb-6">
    <div>
      {title && <h1 className="text-xl font-extrabold text-gray-900" style={{ fontFamily: "'Figtree', sans-serif" }}>{title}</h1>}
      {subtitle && <p className="text-xs text-gray-400 font-medium mt-0.5">{subtitle}</p>}
    </div>
    {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
  </div>
)

/* ═══════════════════════════════════════════
   ICON BUTTON — Small icon-only button
   ═══════════════════════════════════════════ */
export const IconButton = ({ icon: Icon, onClick, variant = 'ghost', size = 'md', className = '', title, ...props }) => {
  const sizes = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  }
  const variants = {
    ghost: 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
    primary: 'text-[#111111] hover:bg-[#111111]/10',
    danger: 'text-gray-400 hover:text-red-500 hover:bg-red-50',
  }
  return (
    <button
      onClick={onClick}
      title={title}
      className={`${sizes[size]} rounded-lg flex items-center justify-center transition-all ${variants[variant]} ${className}`}
      {...props}
    >
      <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
    </button>
  )
}

/* ═══════════════════════════════════════════
   EMPTY STATE — Consistent empty states
   ═══════════════════════════════════════════ */
export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    {Icon && (
      <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-gray-300" />
      </div>
    )}
    <h3 className="text-sm font-bold text-gray-900 mb-1" style={{ fontFamily: "'Figtree', sans-serif" }}>{title}</h3>
    {description && <p className="text-xs text-gray-400 max-w-xs mb-4">{description}</p>}
    {action}
  </div>
)

/* ═══════════════════════════════════════════
   TABLE — Branded data table wrapper
   ═══════════════════════════════════════════ */
export const DataTable = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.03)] overflow-hidden ${className}`}>
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ fontFamily: "'Figtree', sans-serif" }}>
        {children}
      </table>
    </div>
  </div>
)

export const Th = ({ children, className = '' }) => (
  <th className={`px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-left ${className}`}>{children}</th>
)

export const Td = ({ children, className = '' }) => (
  <td className={`px-5 py-3.5 ${className}`}>{children}</td>
)

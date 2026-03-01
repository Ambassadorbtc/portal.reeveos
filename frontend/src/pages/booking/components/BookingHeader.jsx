/**
 * Booking page header — compact business identity
 * Mobile-first, minimal height
 */

import { MapPin, Store } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/** Resolve image paths — API returns /static/uploads/... which needs API base prefix */
const resolveImg = (url) => {
  if (!url) return null
  if (url.startsWith('http')) return url
  if (url.startsWith('/static/')) return `${API_BASE}${url}`
  return url
}

const BookingHeader = ({ business }) => {
  if (!business) return null
  const accent = business.accentColour || '#111111'
  const logoSrc = resolveImg(business.logo)

  return (
    <div className="mb-3">
      {/* Logo + name row */}
      <div className="flex items-center gap-2.5">
        {logoSrc ? (
          <img
            src={logoSrc}
            alt={business.name}
            className="w-10 h-10 rounded-lg border border-gray-200 object-cover bg-white shrink-0"
          />
        ) : (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: accent }}
          >
            <Store className="w-4.5 h-4.5 text-white" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-sm font-semibold leading-tight text-[#111111] truncate">
              {business.name}
            </h1>
            {business.isOpen && (
              <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-medium">
                <span className="w-1 h-1 bg-emerald-500 rounded-full" />
                Open
              </span>
            )}
          </div>
          {business.address && (
            <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5 truncate">
              <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
              {business.address}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default BookingHeader

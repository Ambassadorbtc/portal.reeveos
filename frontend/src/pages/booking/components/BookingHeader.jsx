/**
 * Booking page header — business identity, address, open badge
 * Mobile-first, Lucide icons, Figtree font
 */

import { MapPin, Store } from 'lucide-react'

const BookingHeader = ({ business }) => {
  if (!business) return null
  const accent = business.accentColour || '#1B4332'

  return (
    <div className="mb-3 sm:mb-5">
      {/* Cover photo */}
      {business.coverPhoto && (
        <div
          className="h-28 sm:h-44 rounded-xl sm:rounded-2xl bg-border/40 bg-cover bg-center"
          style={{ backgroundImage: `url(${business.coverPhoto})` }}
        />
      )}

      {/* Logo + name row */}
      <div className={`flex items-start gap-2.5 sm:gap-3 ${business.coverPhoto ? '-mt-7 sm:-mt-8 relative' : ''}`}>
        {business.logo ? (
          <img
            src={business.logo}
            alt={business.name}
            className="w-11 h-11 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl border-2 border-white shadow-md object-cover bg-white shrink-0"
          />
        ) : (
          <div
            className="w-11 h-11 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl border-2 border-white shadow-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: accent }}
          >
            <Store className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
        )}

        <div className="flex-1 min-w-0 pt-0.5 sm:pt-1">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-base sm:text-lg font-semibold leading-tight text-[#1B4332]">
              {business.name}
            </h1>
            {business.isOpen && (
              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                Open
              </span>
            )}
          </div>

          {business.rating != null && (
            <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
              <span className="text-amber-400">★</span>
              <span>{business.rating.toFixed(1)}</span>
              {business.reviewCount > 0 && (
                <span className="text-gray-400">({business.reviewCount})</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {business.description && (
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">{business.description}</p>
      )}

      {/* Address */}
      {business.address && (
        <p className="text-sm text-gray-500 mt-1.5 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[#1B4332] shrink-0" />
          {business.address}
        </p>
      )}
    </div>
  )
}

export default BookingHeader

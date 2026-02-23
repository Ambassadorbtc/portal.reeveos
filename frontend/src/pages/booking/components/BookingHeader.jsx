/**
 * Run 2: Business hero — cover, logo, name, rating, address, open badge
 * Run 6: Supports description and accentColour from booking page editor
 */

const BookingHeader = ({ business }) => {
  if (!business) return null
  const accent = business.accentColour || '#1B4332'

  return (
    <div className="mb-6">
      {business.coverPhoto && (
        <div
          className="h-32 rounded-t-2xl bg-border bg-cover bg-center"
          style={{ backgroundImage: `url(${business.coverPhoto})` }}
        />
      )}
      <div className="flex items-center gap-4 p-4 -mt-12 relative">
        {business.logo ? (
          <img
            src={business.logo}
            alt={business.name}
            className="w-16 h-16 rounded-xl border-2 border-white shadow-lg object-cover bg-white"
          />
        ) : (
          <div className="w-16 h-16 rounded-xl border-2 border-white shadow-lg flex items-center justify-center" style={{ backgroundColor: accent }}>
            <i className="fa-solid fa-store text-white text-2xl" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-xl font-bold truncate" style={{ color: accent }}>{business.name}</h1>
          {business.rating != null && (
            <div className="flex items-center gap-1 text-sm text-muted">
              <i className="fa-solid fa-star text-amber-400" />
              <span>{business.rating.toFixed(1)}</span>
              {business.reviewCount > 0 && (
                <span>({business.reviewCount} reviews)</span>
              )}
            </div>
          )}
        </div>
        {business.isOpen && (
          <span className="badge-success text-xs shrink-0">Open</span>
        )}
      </div>
      {business.description && (
        <p className="px-4 pb-2 text-sm text-muted">{business.description}</p>
      )}
      {business.address && (
        <p className="px-4 pb-4 text-sm text-muted flex items-center gap-2">
          <i className="fa-solid fa-location-dot text-primary" />
          {business.address}
        </p>
      )}
    </div>
  )
}

export default BookingHeader

/**
 * Contained sticky footer for booking CTA
 * Stays at bottom of scroll context, max-width matches container
 */

const StickyFooter = ({ children }) => (
  <div className="sticky bottom-0 z-10 pt-2 pb-4 sm:pt-3 sm:pb-5 bg-gradient-to-t from-[#FEFBF4] via-[#FEFBF4] to-[#FEFBF4]/0">
    {children}
  </div>
)

export default StickyFooter

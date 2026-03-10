/**
 * BusinessContext — provides real business data from TierContext.
 * No demo fallbacks. If business hasn't loaded, pages get null and must handle it.
 */

import { createContext, useContext, useState, useMemo } from 'react'
import { useTier } from './TierContext'
import { TIER_ORDER } from '../config/tiers'

const BusinessContext = createContext(null)

export const useBusiness = () => {
  const ctx = useContext(BusinessContext)
  if (!ctx) throw new Error('useBusiness must be used within BusinessProvider')
  return ctx
}

// Map backend tier names to frontend tiers
const mapTier = (backendTier) => {
  const m = {
    solo: 'free',
    team: 'starter',
    venue: 'growth',
    free: 'free',
    starter: 'starter',
    growth: 'growth',
    scale: 'scale',
    enterprise: 'enterprise',
  }
  return m[backendTier] || 'free'
}

export const BusinessProvider = ({ children }) => {
  const tierCtx = useTier()
  const [devTypeOverride, setDevTypeOverride] = useState(null)
  const [devTierOverride, setDevTierOverride] = useState(null)

  const value = useMemo(() => {
    const business = tierCtx?.business || null
    const isRestaurant = business?.type === 'restaurant' || business?.category === 'restaurant' || business?.subcategory === 'turkish'
    const businessType = devTypeOverride ?? (isRestaurant ? 'restaurant' : 'services')
    const tier = devTierOverride ?? mapTier(business?.tier || business?.rezvo_tier) ?? 'enterprise'

    const setBusinessType = (type) => setDevTypeOverride(type)
    const cycleTier = () => {
      const idx = TIER_ORDER.indexOf(devTierOverride ?? tier)
      const next = TIER_ORDER[(idx + 1) % TIER_ORDER.length]
      setDevTierOverride(next)
    }

    return {
      business,       // null if not loaded — pages must handle this
      businessType,
      tier,
      setBusinessType,
      cycleTier,
      refetchBusiness: tierCtx?.refetchBusiness,
      loading: tierCtx?.loading ?? false,
    }
  }, [tierCtx?.business, tierCtx?.loading, devTypeOverride, devTierOverride])

  return (
    <BusinessContext.Provider value={value}>
      {children}
    </BusinessContext.Provider>
  )
}

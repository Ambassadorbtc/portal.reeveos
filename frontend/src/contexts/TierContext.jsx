import { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import api from '../utils/api'

const TierContext = createContext(null)

export const useTier = () => {
  const context = useContext(TierContext)
  if (!context) {
    throw new Error('useTier must be used within TierProvider')
  }
  return context
}

export const TierProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth()
  const [business, setBusiness] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isAuthenticated && ['business_owner', 'platform_admin', 'super_admin'].includes(user?.role) && user?.business_ids?.length > 0) {
      fetchBusiness()
    } else {
      setLoading(false)
    }
  }, [isAuthenticated, user])

  const fetchBusiness = async () => {
    try {
      const businessId = user.business_ids[0]
      const data = await api.get(`/businesses/${businessId}`)
      setBusiness(data)
    } catch (error) {
      console.error('Failed to fetch business:', error)
    } finally {
      setLoading(false)
    }
  }

  const hasFeature = (feature) => {
    if (!business) return false

    const tier = business.tier
    
    const featureMap = {
      calendar: ['solo', 'team', 'venue'],
      crm: ['solo', 'team', 'venue'],
      profile: ['solo', 'team', 'venue'],
      staff: ['team', 'venue'],
      floor_plan: ['venue'],
      tables: ['venue'],
      analytics: ['solo', 'team', 'venue'],
      reviews: ['solo', 'team', 'venue']
    }

    return featureMap[feature]?.includes(tier) || false
  }

  const isPro = () => {
    return business?.rezvo_tier === 'pro' || business?.rezvo_tier === 'premium'
  }

  const isPremium = () => {
    return business?.rezvo_tier === 'premium'
  }

  const value = {
    business,
    loading,
    hasFeature,
    isPro,
    isPremium,
    tier: business?.tier,
    platformTier: business?.rezvo_tier
  }

  return <TierContext.Provider value={value}>{children}</TierContext.Provider>
}

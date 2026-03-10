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

  const HOSPITALITY_CATEGORIES = ['restaurant', 'bar', 'pub', 'bistro', 'fine_dining', 'brasserie']

  useEffect(() => {
    if (isAuthenticated && ['business_owner', 'platform_admin', 'super_admin'].includes(user?.role) && user?.business_ids?.length > 0) {
      fetchBusinessByType()
    } else {
      setLoading(false)
    }
  }, [isAuthenticated, user])

  const fetchBusinessByType = async () => {
    try {
      const loginType = sessionStorage.getItem('login_business_type') // 'hospitality' | 'services' | null

      if (user.business_ids.length === 1 || !loginType) {
        // Single business or no type selected — just load first
        const businessId = user.business_ids[0]
        const data = await api.get(`/businesses/${businessId}`)
        setBusiness(data)
        sessionStorage.removeItem('login_business_type')
      } else {
        // Multiple businesses — filter by type
        let matched = null
        for (const bid of user.business_ids) {
          try {
            const data = await api.get(`/businesses/${bid}`)
            const cat = (data.category || data.type || '').toLowerCase()
            const isHospitality = HOSPITALITY_CATEGORIES.includes(cat)

            if (loginType === 'hospitality' && isHospitality) {
              matched = data
              break
            } else if (loginType === 'services' && !isHospitality) {
              matched = data
              break
            }
          } catch (e) {
            console.error(`Failed to fetch business ${bid}:`, e)
          }
        }

        // If no match found for selected type, fall back to first business
        if (!matched) {
          const data = await api.get(`/businesses/${user.business_ids[0]}`)
          matched = data
        }

        setBusiness(matched)
        sessionStorage.removeItem('login_business_type')
      }
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
    refetchBusiness: fetchBusinessByType,
    tier: business?.tier,
    platformTier: business?.rezvo_tier
  }

  return <TierContext.Provider value={value}>{children}</TierContext.Provider>
}

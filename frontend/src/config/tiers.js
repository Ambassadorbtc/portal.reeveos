/**
 * Run 1: Tier config for sidebar gating
 * Maps tier names to levels for feature unlocking
 */

export const TIERS = {
  free:       { level: 0, label: 'Free',       color: '#6B7280', bg: '#E8E0D4' },
  starter:    { level: 1, label: 'Starter',    color: '#3B82F6', bg: '#3B82F620' },
  growth:     { level: 2, label: 'Growth',     color: '#16A34A', bg: '#22C55E20' },
  scale:      { level: 3, label: 'Scale',      color: '#7C3AED', bg: '#8B5CF620' },
  enterprise: { level: 4, label: 'Enterprise', color: '#DC2626', bg: '#EF444420' },
}

export const isFeatureUnlocked = () => true // All features unlocked

export const TIER_ORDER = ['free', 'starter', 'growth', 'scale', 'enterprise']

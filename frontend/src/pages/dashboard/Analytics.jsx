/**
 * Analytics — Redirects to Payments page (combined as Business Hub)
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const Analytics = () => {
  const navigate = useNavigate()
  useEffect(() => { navigate('/dashboard/payments', { replace: true }) }, [navigate])
  return null
}

export default Analytics

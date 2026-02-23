/**
 * Marketing — Email campaigns, SMS, automated messages
 */

import { useState } from 'react'
import { useBusiness } from '../../contexts/BusinessContext'
import { useTier } from '../../contexts/TierContext'

const Marketing = () => {
  const { business } = useBusiness()
  const { tier } = useTier()
  const [activeTab, setActiveTab] = useState('campaigns')

  const campaigns = [
    { id: 1, name: 'Welcome Series', type: 'Automated', status: 'Active', sent: 234, opened: '68%', clicked: '24%' },
    { id: 2, name: 'Win-Back Inactive', type: 'Automated', status: 'Active', sent: 45, opened: '52%', clicked: '18%' },
    { id: 3, name: 'October Newsletter', type: 'One-off', status: 'Sent', sent: 890, opened: '41%', clicked: '12%' },
    { id: 4, name: 'Holiday Special Offer', type: 'Scheduled', status: 'Draft', sent: 0, opened: '-', clicked: '-' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-primary">Marketing</h1>
          <p className="text-sm text-gray-500 mt-1">Email campaigns, automated messages, and promotions.</p>
        </div>
        <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold shadow-sm hover:bg-primary-hover flex items-center gap-2">
          <i className="fa-solid fa-plus" /> New Campaign
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8">
          {[{ id: 'campaigns', label: 'Campaigns', icon: 'fa-paper-plane' }, { id: 'automations', label: 'Automations', icon: 'fa-robot' }, { id: 'templates', label: 'Templates', icon: 'fa-file-lines' }].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition-colors ${activeTab === t.id ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-primary hover:border-gray-300'}`}>
              <i className={`fa-solid ${t.icon}`} /> {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: 'Emails Sent', value: '1,169', icon: 'fa-envelope', color: 'bg-primary/5 text-primary' },
          { label: 'Open Rate', value: '52%', icon: 'fa-envelope-open', color: 'bg-blue-50 text-blue-500' },
          { label: 'Click Rate', value: '18%', icon: 'fa-mouse-pointer', color: 'bg-green-50 text-green-600' },
          { label: 'Subscribers', value: '890', icon: 'fa-users', color: 'bg-purple-50 text-purple-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-border p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{s.label}</p>
              <div className={`p-1.5 rounded-lg ${s.color}`}><i className={`fa-solid ${s.icon} text-sm`} /></div>
            </div>
            <p className="text-2xl font-heading font-bold text-primary">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Campaigns Table */}
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                {['Campaign', 'Type', 'Status', 'Sent', 'Opened', 'Clicked', ''].map(h => (
                  <th key={h} className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaigns.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors cursor-pointer">
                  <td className="px-6 py-4 text-sm font-bold text-primary">{c.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{c.type}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${c.status === 'Active' ? 'bg-green-50 text-green-700 border border-green-200' : c.status === 'Sent' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>{c.status}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{c.sent.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{c.opened}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{c.clicked}</td>
                  <td className="px-6 py-4 text-right"><button className="text-gray-400 hover:text-primary"><i className="fa-solid fa-ellipsis" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Marketing

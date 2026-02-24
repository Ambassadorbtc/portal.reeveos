import { useState } from "react"

const TABS = [
  { id: "overview", label: "Overview", icon: "◻" },
  { id: "products", label: "Products", icon: "🛍" },
  { id: "courses", label: "Courses", icon: "🎓" },
  { id: "discounts", label: "Discounts", icon: "🏷" },
  { id: "loyalty", label: "Loyalty", icon: "⭐" },
  { id: "vouchers", label: "Gift Vouchers", icon: "🎁" },
  { id: "orders", label: "Orders", icon: "📦" },
  { id: "storefront", label: "Storefront", icon: "🌐" },
]

/* ─── Mock Data ─── */
const MOCK_PRODUCTS = [
  { id: 1, name: "Dermalogica Daily Microfoliant", price: 49.50, stock: 24, category: "Skincare", image: "🧴", status: "active" },
  { id: 2, name: "PreCleanse Balm", price: 38.00, stock: 12, category: "Skincare", image: "🫧", status: "active" },
  { id: 3, name: "Active Moist Moisturizer", price: 52.00, stock: 0, category: "Skincare", image: "💧", status: "out_of_stock" },
  { id: 4, name: "Skin Smoothing Cream", price: 55.00, stock: 8, category: "Skincare", image: "✨", status: "active" },
  { id: 5, name: "Gift Set – Hydration Bundle", price: 89.99, stock: 15, category: "Gift Sets", image: "🎀", status: "active" },
]

const MOCK_COURSES = [
  { id: 1, name: "Skincare Fundamentals", lessons: 8, students: 0, price: 79, status: "draft" },
  { id: 2, name: "Advanced Facial Techniques", lessons: 12, students: 0, price: 149, status: "draft" },
]

const MOCK_DISCOUNTS = [
  { id: 1, code: "WELCOME15", type: "percentage", value: 15, uses: 0, maxUses: 100, status: "active", applies: "All products" },
  { id: 2, code: "SUMMER10", type: "fixed", value: 10, uses: 0, maxUses: 50, status: "scheduled", applies: "Skincare" },
]

const MOCK_ORDERS = [
  { id: "#RZ-001", customer: "Sarah M.", items: 2, total: 87.50, status: "processing", date: "Today" },
  { id: "#RZ-002", customer: "James L.", items: 1, total: 49.50, status: "shipped", date: "Yesterday" },
  { id: "#RZ-003", customer: "Emma K.", items: 3, total: 142.00, status: "delivered", date: "22 Feb" },
]

/* ─── Shared Components ─── */
const Badge = ({ children, color = "emerald" }) => {
  const colors = {
    emerald: "bg-emerald-500/15 text-emerald-400",
    amber: "bg-amber-500/15 text-amber-400",
    red: "bg-red-500/15 text-red-400",
    blue: "bg-blue-500/15 text-blue-400",
    purple: "bg-purple-500/15 text-purple-400",
    gray: "bg-gray-700/50 text-gray-400",
  }
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${colors[color]}`}>{children}</span>
}

const StatCard = ({ label, value, sub, icon, color = "emerald" }) => (
  <div className="bg-gray-900/80 border border-gray-800/60 rounded-2xl p-5 hover:border-gray-700/60 transition-all">
    <div className="flex items-start justify-between mb-3">
      <span className="text-xl">{icon}</span>
      {sub && <span className="text-[10px] text-emerald-400 font-medium">{sub}</span>}
    </div>
    <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
    <p className="text-[11px] text-gray-500 mt-1">{label}</p>
  </div>
)

const EmptyState = ({ icon, title, desc, action, onAction }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <span className="text-4xl mb-4">{icon}</span>
    <h3 className="text-base font-bold text-white mb-1">{title}</h3>
    <p className="text-xs text-gray-500 max-w-xs mb-6">{desc}</p>
    {action && (
      <button onClick={onAction} className="px-5 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors">
        {action}
      </button>
    )}
  </div>
)

/* ─── Tab Panels ─── */
function OverviewPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">Shop Overview</h2>
        <p className="text-xs text-gray-500">Everything about your online shop at a glance</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon="💷" label="Revenue This Month" value="£0.00" sub="Shop not live yet" />
        <StatCard icon="📦" label="Orders" value="0" />
        <StatCard icon="🛍" label="Products" value={MOCK_PRODUCTS.length} sub={`${MOCK_PRODUCTS.filter(p=>p.stock>0).length} in stock`} />
        <StatCard icon="👥" label="Loyalty Members" value="0" />
      </div>

      {/* Quick Setup Checklist */}
      <div className="bg-gray-900/80 border border-gray-800/60 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-4
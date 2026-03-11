import React, { useState } from 'react';
import { X, AlertCircle, Circle, CheckCircle2 } from 'lucide-react';
import api from '../utils/api';

const SERVICE_TYPES = [
  { value: 'microneedling', label: 'Microneedling' },
  { value: 'chemical_peel', label: 'Chemical Peel' },
  { value: 'lymphatic', label: 'Lymphatic' },
  { value: 'rf_needling', label: 'RF Needling' },
  { value: 'dermaplaning', label: 'Dermaplaning' },
  { value: 'other', label: 'Other' },
];

const TREATMENT_AREAS = [
  'forehead', 'cheeks', 'chin', 'jawline', 'neck', 'decolletage', 'full_face', 'hands', 'other',
];

const AREA_LABELS = {
  forehead: 'Forehead',
  cheeks: 'Cheeks',
  chin: 'Chin',
  jawline: 'Jawline',
  neck: 'Neck',
  decolletage: 'Decolletage',
  full_face: 'Full Face',
  hands: 'Hands',
  other: 'Other',
};

const NEEDLE_DEPTHS = [];
for (let d = 0.25; d <= 3.0; d += 0.25) {
  NEEDLE_DEPTHS.push(parseFloat(d.toFixed(2)));
}

const REACTION_COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];

export default function CheckoutForm({ isOpen, onClose, booking, businessId, onSuccess }) {
  const [serviceType, setServiceType] = useState('');
  const [areasTreated, setAreasTreated] = useState([]);
  const [needleDepth, setNeedleDepth] = useState(1.0);
  const [serumUsed, setSerumUsed] = useState('');
  const [comfortLevel, setComfortLevel] = useState(0);
  const [skinReaction, setSkinReaction] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);

  if (!isOpen) return null;

  const showNeedleDepth = serviceType === 'microneedling' || serviceType === 'rf_needling';
  const canSubmit = serviceType && areasTreated.length > 0 && comfortLevel > 0 && skinReaction > 0 && !loading;

  const toggleArea = (area) => {
    setAreasTreated((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError('');
    setLoading(true);

    try {
      const bookingId = booking._id || booking.id;
      const fields = {
        areas_treated: areasTreated,
        serum_used: serumUsed,
        comfort_level: comfortLevel,
        skin_reaction: skinReaction,
      };
      if (showNeedleDepth) {
        fields.needle_depth = needleDepth;
      }

      await api.post(`/clinical/business/${businessId}/booking/${bookingId}/complete`, {
        treatment_record: {
          service_type: serviceType,
          fields,
          notes,
        },
      });

      onSuccess?.();
      handleClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to complete checkout');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setServiceType('');
    setAreasTreated([]);
    setNeedleDepth(1.0);
    setSerumUsed('');
    setComfortLevel(0);
    setSkinReaction(0);
    setNotes('');
    setError('');
    setServiceDropdownOpen(false);
    onClose();
  };

  const selectedServiceLabel = SERVICE_TYPES.find((s) => s.value === serviceType)?.label;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleClose}
      style={{ fontFamily: 'Figtree, sans-serif' }}
    >
      <div
        className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-semibold" style={{ color: '#111111' }}>
            Treatment Record
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={20} color="#111111" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {/* Service type selector (custom dropdown) */}
          <div className="space-y-1 relative">
            <label className="block text-sm font-medium" style={{ color: '#111111' }}>
              Service Type
            </label>
            <button
              type="button"
              onClick={() => setServiceDropdownOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 focus:border-[#C9A84C]"
              style={{ color: selectedServiceLabel ? '#111111' : '#9ca3af' }}
            >
              <span>{selectedServiceLabel || 'Select a service type'}</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {serviceDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                {SERVICE_TYPES.map((st) => (
                  <button
                    key={st.value}
                    type="button"
                    onClick={() => {
                      setServiceType(st.value);
                      setServiceDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                      serviceType === st.value ? 'bg-[#C9A84C]/10 font-medium' : ''
                    }`}
                    style={{ color: '#111111' }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Treatment areas (multi-select chips) */}
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: '#111111' }}>
              Treatment Areas
            </label>
            <div className="flex flex-wrap gap-2">
              {TREATMENT_AREAS.map((area) => {
                const selected = areasTreated.includes(area);
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => toggleArea(area)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                      selected
                        ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#111111]'
                        : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {AREA_LABELS[area]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Needle depth (conditional) */}
          {showNeedleDepth && (
            <div className="space-y-1">
              <label className="block text-sm font-medium" style={{ color: '#111111' }}>
                Needle Depth (mm)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0.25}
                  max={3.0}
                  step={0.25}
                  value={needleDepth}
                  onChange={(e) => setNeedleDepth(parseFloat(e.target.value))}
                  className="flex-1 accent-[#C9A84C]"
                />
                <span
                  className="text-sm font-medium w-12 text-center py-1 rounded-lg bg-gray-100"
                  style={{ color: '#111111' }}
                >
                  {needleDepth.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>0.25mm</span>
                <span>3.00mm</span>
              </div>
            </div>
          )}

          {/* Serum/product used */}
          <div className="space-y-1">
            <label className="block text-sm font-medium" style={{ color: '#111111' }}>
              Serum / Product Used
            </label>
            <input
              type="text"
              value={serumUsed}
              onChange={(e) => setSerumUsed(e.target.value)}
              placeholder="e.g. Hyaluronic acid serum"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 focus:border-[#C9A84C]"
              style={{ color: '#111111' }}
            />
          </div>

          {/* Comfort level (1-5 clickable circles) */}
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: '#111111' }}>
              Comfort Level
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setComfortLevel(level)}
                  className="transition-transform hover:scale-110"
                >
                  {level <= comfortLevel ? (
                    <CheckCircle2 size={28} color="#C9A84C" fill="#C9A84C" strokeWidth={1.5} />
                  ) : (
                    <Circle size={28} color="#d1d5db" strokeWidth={1.5} />
                  )}
                </button>
              ))}
              {comfortLevel > 0 && (
                <span className="ml-2 text-xs text-gray-400">{comfortLevel}/5</span>
              )}
            </div>
          </div>

          {/* Skin reaction (1-5 green-to-red gradient) */}
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: '#111111' }}>
              Skin Reaction
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setSkinReaction(level)}
                  className="transition-transform hover:scale-110"
                >
                  <div
                    className="w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center"
                    style={{
                      borderColor: level <= skinReaction ? REACTION_COLORS[level - 1] : '#d1d5db',
                      backgroundColor: level <= skinReaction ? REACTION_COLORS[level - 1] : 'transparent',
                    }}
                  >
                    {level <= skinReaction && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                </button>
              ))}
              {skinReaction > 0 && (
                <span className="ml-2 text-xs text-gray-400">{skinReaction}/5</span>
              )}
            </div>
          </div>

          {/* Clinical notes */}
          <div className="space-y-1">
            <label className="block text-sm font-medium" style={{ color: '#111111' }}>
              Clinical Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => {
                if (e.target.value.length <= 1000) setNotes(e.target.value);
              }}
              placeholder="Any additional observations or notes..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 focus:border-[#C9A84C]"
              style={{ color: '#111111' }}
            />
            <p className="text-xs text-gray-400 text-right">{notes.length}/1000</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2 border-t border-gray-100 shrink-0">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            style={{ color: '#111111' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#111111' }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              'Complete Treatment'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../utils/api';

export default function CheckInModal({ isOpen, onClose, booking, businessId, onSuccess }) {
  const [medicalChanges, setMedicalChanges] = useState(null);
  const [medicalNotes, setMedicalNotes] = useState('');
  const [verbalConfirmation, setVerbalConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  if (!isOpen) return null;

  const canSubmit = verbalConfirmation && medicalChanges !== null && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError('');
    setLoading(true);

    try {
      const bookingId = booking._id || booking.id;
      await api.post(`/clinical/business/${businessId}/booking/${bookingId}/check-in`, {
        medical_changes: medicalChanges,
        medical_notes: medicalChanges ? medicalNotes : '',
        verbal_confirmation: verbalConfirmation,
        checked_in_by: 'Staff',
      });

      setShowSuccess(true);
      onSuccess?.();
      setTimeout(() => {
        setShowSuccess(false);
        handleClose();
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to check in');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMedicalChanges(null);
    setMedicalNotes('');
    setVerbalConfirmation(false);
    setError('');
    setShowSuccess(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleClose}
      style={{ fontFamily: 'Figtree, sans-serif' }}
    >
      <div
        className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold" style={{ color: '#111111' }}>
            Clinical Check-In
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={20} color="#111111" />
          </button>
        </div>

        {/* Success overlay */}
        {showSuccess && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 rounded-2xl">
            <div className="flex flex-col items-center gap-2">
              <CheckCircle size={48} className="text-green-500" />
              <span className="text-sm font-medium text-green-600">Checked in successfully</span>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Medical changes question */}
          <div className="space-y-2">
            <label className="block text-sm font-medium" style={{ color: '#111111' }}>
              Has the client reported any new health conditions or changes since their last visit?
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMedicalChanges(true)}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition-colors ${
                  medicalChanges === true
                    ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#111111]'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => {
                  setMedicalChanges(false);
                  setMedicalNotes('');
                }}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition-colors ${
                  medicalChanges === false
                    ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#111111]'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                No
              </button>
            </div>
          </div>

          {/* Medical notes (conditional) */}
          {medicalChanges === true && (
            <div className="space-y-1">
              <label className="block text-sm font-medium" style={{ color: '#111111' }}>
                Medical Notes
              </label>
              <textarea
                value={medicalNotes}
                onChange={(e) => {
                  if (e.target.value.length <= 500) setMedicalNotes(e.target.value);
                }}
                placeholder="Describe the health changes or conditions..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40 focus:border-[#C9A84C]"
                style={{ color: '#111111' }}
              />
              <p className="text-xs text-gray-400 text-right">{medicalNotes.length}/500</p>
            </div>
          )}

          {/* Verbal confirmation */}
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={verbalConfirmation}
              onChange={(e) => setVerbalConfirmation(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[#C9A84C]"
            />
            <span className="text-sm" style={{ color: '#111111' }}>
              I confirm the client has verbally agreed to proceed with treatment
            </span>
          </label>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2">
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
                Checking in...
              </span>
            ) : (
              'Check In'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

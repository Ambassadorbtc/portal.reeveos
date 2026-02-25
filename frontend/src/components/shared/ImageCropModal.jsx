/**
 * ImageCropModal — crop/position adjustment before upload
 * Uses react-easy-crop for pan + zoom
 */
import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react'

// Create a cropped image from the canvas
async function getCroppedImg(imageSrc, pixelCrop) {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  await new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = reject
    image.src = imageSrc
  })

  const canvas = document.createElement('canvas')
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  const ctx = canvas.getContext('2d')

  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height
  )

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob)
    }, 'image/jpeg', 0.92)
  })
}

const ImageCropModal = ({
  isOpen,
  onClose,
  onSave,
  imageSrc,
  aspect = 1,        // 1 for square logo, 16/9 for cover
  cropShape = 'round', // 'round' for logo, 'rect' for cover
  title = 'Adjust Image',
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [saving, setSaving] = useState(false)

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleSave = async () => {
    if (!croppedAreaPixels) return
    setSaving(true)
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels)
      await onSave(croppedBlob)
    } catch (err) {
      console.error('Crop failed:', err)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen || !imageSrc) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{ fontFamily: "'Figtree', sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-lg text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Crop Area */}
        <div className="relative w-full" style={{ height: 420, background: '#1a1a1a' }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            cropShape={cropShape}
            showGrid={cropShape === 'rect'}
            minZoom={0.5}
            maxZoom={5}
            objectFit="horizontal-cover"
            restrictPosition={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Controls */}
        <div className="px-6 py-4 space-y-4">
          {/* Zoom slider */}
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="range"
              min={0.5}
              max={5}
              step={0.05}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#1B4332]"
            />
            <ZoomIn className="w-4 h-4 text-gray-400 shrink-0" />
            <button
              onClick={() => setRotation(r => (r + 90) % 360)}
              className="ml-2 w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-primary hover:bg-gray-50 transition-colors"
              title="Rotate"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center">Drag to reposition · Scroll or use slider to zoom</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 text-sm font-bold text-white bg-[#1B4332] rounded-lg hover:bg-[#2D6A4F] transition-colors shadow-lg disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ImageCropModal

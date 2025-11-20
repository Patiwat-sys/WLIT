import { useState, useEffect } from 'react'

const PAPER_SIZES = {
  a4: { name: 'A4', width: 210, height: 297, unit: 'mm' },
  letter: { name: 'Letter', width: 216, height: 279, unit: 'mm' },
  a3: { name: 'A3', width: 297, height: 420, unit: 'mm' },
  legal: { name: 'Legal', width: 216, height: 356, unit: 'mm' },
  custom: { name: 'Custom', width: 210, height: 297, unit: 'mm' },
}

const ORIENTATIONS = {
  portrait: 'Portrait',
  landscape: 'Landscape',
}

const QUALITY_OPTIONS = [
  { value: 1, label: 'Low (1x)' },
  { value: 2, label: 'Medium (2x) - Recommended' },
  { value: 3, label: 'High (3x)' },
]

function PDFExportModal({ isOpen, onClose, onExport, onPreview, defaultFileName, wellId, projectData }) {
  const [fileName, setFileName] = useState(defaultFileName || 'welllog')
  const [paperSize, setPaperSize] = useState('a4')
  const [orientation, setOrientation] = useState('portrait')
  const [quality, setQuality] = useState(2)
  const [margins, setMargins] = useState({ top: 10, right: 10, bottom: 10, left: 10 })
  const [includeMetadata, setIncludeMetadata] = useState(true)
  const [includeFooter, setIncludeFooter] = useState(true)
  const [fitToPaper, setFitToPaper] = useState('fit-and-center') // 'none', 'fit', 'fit-and-center'
  const [customWidth, setCustomWidth] = useState(210)
  const [customHeight, setCustomHeight] = useState(297)

  useEffect(() => {
    if (isOpen && defaultFileName) {
      setFileName(defaultFileName)
    }
  }, [isOpen, defaultFileName])

  if (!isOpen) return null

  const handleExport = () => {
    if (!fileName.trim()) {
      alert('Please enter a file name')
      return
    }

    const selectedSize = PAPER_SIZES[paperSize]
    const finalWidth = paperSize === 'custom' ? customWidth : selectedSize.width
    const finalHeight = paperSize === 'custom' ? customHeight : selectedSize.height

    // Swap width/height if landscape
    const width = orientation === 'landscape' ? finalHeight : finalWidth
    const height = orientation === 'landscape' ? finalWidth : finalHeight

    const settings = {
      fileName: fileName.trim(),
      paperSize: {
        name: selectedSize.name,
        width,
        height,
        unit: selectedSize.unit,
      },
      orientation,
      quality,
      margins,
      includeMetadata,
      includeFooter,
      fitToPaper: fitToPaper === 'fit' || fitToPaper === 'fit-and-center',
      centerContent: fitToPaper === 'fit-and-center',
    }

    onExport(settings)
    onClose()
  }

  const handleCancel = () => {
    setFileName(defaultFileName || 'welllog')
    setPaperSize('a4')
    setOrientation('portrait')
    setQuality(2)
    setMargins({ top: 10, right: 10, bottom: 10, left: 10 })
    setIncludeMetadata(true)
    setIncludeFooter(true)
    setFitToPaper('fit-and-center')
    onClose()
  }

  const handleMarginChange = (side, value) => {
    const numValue = parseFloat(value) || 0
    setMargins(prev => ({
      ...prev,
      [side]: Math.max(0, numValue),
    }))
  }

  const selectedSize = PAPER_SIZES[paperSize]
  const displayWidth = orientation === 'landscape' 
    ? (paperSize === 'custom' ? customHeight : selectedSize.height)
    : (paperSize === 'custom' ? customWidth : selectedSize.width)
  const displayHeight = orientation === 'landscape'
    ? (paperSize === 'custom' ? customWidth : selectedSize.width)
    : (paperSize === 'custom' ? customHeight : selectedSize.height)

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={handleCancel}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          minWidth: '500px',
          maxWidth: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Export PDF Settings</h2>
        
        {/* File Name */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            File Name:
          </label>
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="Enter file name"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
            }}
            autoFocus
          />
          <p style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
            The file will be saved as: <strong>{fileName}.pdf</strong>
          </p>
        </div>

        {/* Paper Size */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            Paper Size:
          </label>
          <select
            value={paperSize}
            onChange={(e) => setPaperSize(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          >
            {Object.entries(PAPER_SIZES).map(([key, size]) => (
              <option key={key} value={key}>
                {size.name} ({size.width} × {size.height} {size.unit})
              </option>
            ))}
          </select>
        </div>

        {/* Custom Size */}
        {paperSize === 'custom' && (
          <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500' }}>
                  Width (mm):
                </label>
                <input
                  type="number"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(parseFloat(e.target.value) || 210)}
                  min="50"
                  max="1000"
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500' }}>
                  Height (mm):
                </label>
                <input
                  type="number"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(parseFloat(e.target.value) || 297)}
                  min="50"
                  max="1000"
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Orientation */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            Orientation:
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            {Object.entries(ORIENTATIONS).map(([key, label]) => (
              <label
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  border: `2px solid ${orientation === key ? '#2196F3' : '#ddd'}`,
                  borderRadius: '4px',
                  backgroundColor: orientation === key ? '#e3f2fd' : 'white',
                }}
              >
                <input
                  type="radio"
                  value={key}
                  checked={orientation === key}
                  onChange={(e) => setOrientation(e.target.value)}
                />
                {label}
              </label>
            ))}
          </div>
          <p style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
            Dimensions: {displayWidth} × {displayHeight} mm
          </p>
        </div>

        {/* Quality */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            Quality / Scale:
          </label>
          <select
            value={quality}
            onChange={(e) => setQuality(parseInt(e.target.value))}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          >
            {QUALITY_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
            Higher quality = larger file size and longer export time
          </p>
        </div>

        {/* Margins */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            Margins (mm):
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {['top', 'right', 'bottom', 'left'].map(side => (
              <div key={side}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', textTransform: 'capitalize' }}>
                  {side}:
                </label>
                <input
                  type="number"
                  value={margins[side]}
                  onChange={(e) => handleMarginChange(side, e.target.value)}
                  min="0"
                  max="50"
                  step="1"
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Fit to Paper Options */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            Scaling Options:
          </label>
          <select
            value={fitToPaper}
            onChange={(e) => setFitToPaper(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
            }}
          >
            <option value="none">None - Use original size</option>
            <option value="fit">Fit to Paper - Scale to fit width</option>
            <option value="fit-and-center">Fit to Paper & Center - Scale and center on page</option>
          </select>
          <p style={{ marginTop: '4px', fontSize: '12px', color: '#666' }}>
            {fitToPaper === 'fit-and-center' 
              ? 'Recommended: Scales SVG to fit paper width and centers it horizontally'
              : fitToPaper === 'fit'
              ? 'Scales SVG to fit paper width (may not be centered)'
              : 'Uses original SVG size (may overflow paper width)'}
          </p>
        </div>

        {/* Options */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            Options:
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.target.checked)}
              />
              Include metadata header (Well ID, Date, etc.)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeFooter}
                onChange={(e) => setIncludeFooter(e.target.checked)}
              />
              Include footer (Generated by AdjustLog)
            </label>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={handleCancel}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f5f5f5',
              color: '#333',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Cancel
          </button>
          {onPreview && (
            <button
              onClick={() => {
                const selectedSize = PAPER_SIZES[paperSize]
                const finalWidth = paperSize === 'custom' ? customWidth : selectedSize.width
                const finalHeight = paperSize === 'custom' ? customHeight : selectedSize.height
                const width = orientation === 'landscape' ? finalHeight : finalWidth
                const height = orientation === 'landscape' ? finalWidth : finalHeight
                const settings = {
                  fileName: fileName.trim(),
                  paperSize: {
                    name: selectedSize.name,
                    width,
                    height,
                    unit: selectedSize.unit,
                  },
                  orientation,
                  quality,
                  margins,
                  includeMetadata,
                  includeFooter,
                  fitToPaper: fitToPaper === 'fit' || fitToPaper === 'fit-and-center',
                  centerContent: fitToPaper === 'fit-and-center',
                }
                onPreview(settings)
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Preview
            </button>
          )}
          <button
            onClick={handleExport}
            style={{
              padding: '10px 20px',
              backgroundColor: '#9C27B0',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Export PDF
          </button>
        </div>
      </div>
    </div>
  )
}

export default PDFExportModal


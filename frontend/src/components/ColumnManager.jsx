import { useState } from 'react'

const COLUMN_NAMES = {
  naturalGamma: 'Natural Gamma',
  lithology: 'Lithology',
  density: 'Density',
  from: 'From',
  to: 'To',
  thickness: 'Thickness',
  seam: 'Seam',
  sampleNo: 'Sample No',
  remark: 'Remark',
  clayColor: 'Clay color',
  description: 'Description',
  adjustRange: 'Adjust Range',
}

function ColumnManager({ viewSettings, onUpdate }) {
  const [isOpen, setIsOpen] = useState(false)

  const handleWidthChange = (colKey, newWidth) => {
    const width = Math.max(50, Math.min(500, parseInt(newWidth) || 120))
    onUpdate({
      ...viewSettings,
      columnWidths: {
        ...viewSettings.columnWidths,
        [colKey]: width,
      },
    })
  }

  const handleMoveUp = (index) => {
    if (index === 0) return
    const newOrder = [...viewSettings.columnOrder]
    ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
    onUpdate({
      ...viewSettings,
      columnOrder: newOrder,
    })
  }

  const handleMoveDown = (index) => {
    if (index === viewSettings.columnOrder.length - 1) return
    const newOrder = [...viewSettings.columnOrder]
    ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    onUpdate({
      ...viewSettings,
      columnOrder: newOrder,
    })
  }

  return (
    <div style={{ marginBottom: '10px' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '8px 16px',
          backgroundColor: '#2196F3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        {isOpen ? '▼' : '▶'} Manage Columns
      </button>

      {isOpen && (
        <div style={{
          marginTop: '10px',
          padding: '15px',
          backgroundColor: '#f9f9f9',
          border: '1px solid #ddd',
          borderRadius: '4px',
        }}>
          <h4 style={{ marginTop: 0, marginBottom: '15px' }}>Column Settings</h4>
          
          <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #ddd' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={viewSettings.columnGaps?.enabled || false}
                onChange={(e) => {
                  onUpdate({
                    ...viewSettings,
                    columnGaps: {
                      ...viewSettings.columnGaps,
                      enabled: e.target.checked,
                    },
                  })
                }}
              />
              <span style={{ fontWeight: '500' }}>Enable gaps between columns</span>
            </label>
            {viewSettings.columnGaps?.enabled && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '24px' }}>
                <span style={{ fontSize: '0.9rem' }}>Gap size:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={viewSettings.columnGaps?.size || 30}
                  onChange={(e) => {
                    const size = Math.max(0, Math.min(100, parseInt(e.target.value) || 30))
                    onUpdate({
                      ...viewSettings,
                      columnGaps: {
                        ...viewSettings.columnGaps,
                        size,
                      },
                    })
                  }}
                  style={{
                    width: '80px',
                    padding: '4px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                  }}
                />
                <span style={{ fontSize: '0.85rem', color: '#666' }}>px</span>
              </label>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {viewSettings.columnOrder.map((colKey, index) => (
              <div
                key={colKey}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    style={{
                      width: '24px',
                      height: '20px',
                      padding: 0,
                      fontSize: '12px',
                      cursor: index === 0 ? 'not-allowed' : 'pointer',
                      opacity: index === 0 ? 0.5 : 1,
                    }}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === viewSettings.columnOrder.length - 1}
                    style={{
                      width: '24px',
                      height: '20px',
                      padding: 0,
                      fontSize: '12px',
                      cursor: index === viewSettings.columnOrder.length - 1 ? 'not-allowed' : 'pointer',
                      opacity: index === viewSettings.columnOrder.length - 1 ? 0.5 : 1,
                    }}
                  >
                    ↓
                  </button>
                </div>
                <span style={{ minWidth: '120px', fontWeight: '500' }}>
                  {COLUMN_NAMES[colKey] || colKey}
                </span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.9rem' }}>Width:</span>
                  <input
                    type="number"
                    min="50"
                    max="500"
                    value={viewSettings.columnWidths?.[colKey] || 120}
                    onChange={(e) => handleWidthChange(colKey, e.target.value)}
                    style={{
                      width: '80px',
                      padding: '4px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                    }}
                  />
                  <span style={{ fontSize: '0.85rem', color: '#666' }}>px</span>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ColumnManager


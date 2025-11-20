import { useState, useEffect } from 'react'
import { getExcelSheets, getExcelPreview } from '../services/api.js'

function SheetSelectionModal({ file, onSheetSelect, onClose }) {
  const [sheets, setSheets] = useState([])
  const [selectedSheet, setSelectedSheet] = useState(null)
  const [previewData, setPreviewData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (file) {
      loadSheets()
    }
  }, [file])

  const loadSheets = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await getExcelSheets(file)
      setSheets(response.sheets || [])
      if (response.sheets && response.sheets.length > 0) {
        setSelectedSheet(response.sheets[0])
        loadPreview(response.sheets[0])
      }
    } catch (err) {
      setError(err.message || 'Failed to load sheets')
    } finally {
      setLoading(false)
    }
  }

  const loadPreview = async (sheetName) => {
    if (!file || !sheetName) return
    
    setLoading(true)
    setError(null)
    try {
      const response = await getExcelPreview(file, sheetName, 50)
      setPreviewData(response.preview || [])
    } catch (err) {
      setError(err.message || 'Failed to load preview')
      setPreviewData([])
    } finally {
      setLoading(false)
    }
  }

  const handleSheetChange = (sheetName) => {
    setSelectedSheet(sheetName)
    loadPreview(sheetName)
  }

  const handleConfirm = () => {
    if (selectedSheet) {
      onSheetSelect(selectedSheet)
    }
  }

  const getLithologyColor = (lithologyValue) => {
    if (!lithologyValue) return '#ffffff'
    
    const value = String(lithologyValue).trim().toUpperCase()
    switch (value) {
      case 'LI':
        return '#000000' // Black
      case 'CLLI':
        return '#ff0000' // Red
      case 'LICL':
        return '#ffff00' // Yellow
      case 'CBCL':
        return '#00ff00' // Green
      default:
        return '#ffffff' // White
    }
  }

  const headers = ['From', 'To', 'Thickness', 'Lithology', 'Seam', 'Sample No', 'Remark', 'Clay color', 'Description']

  const formatNumericValue = (value, header) => {
    if (value == null || value === '') return ''
    
    // Format numeric columns to 2 decimal places
    if (header === 'From' || header === 'To' || header === 'Thickness') {
      const numValue = parseFloat(value)
      if (!isNaN(numValue)) {
        return numValue.toFixed(2)
      }
    }
    
    return String(value)
  }

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
        zIndex: 3000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflow: 'auto',
          width: '1200px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Select Excel Sheet</h2>
        
        {error && (
          <div style={{
            padding: '10px',
            backgroundColor: '#ffebee',
            color: '#c62828',
            borderRadius: '4px',
            marginBottom: '20px',
          }}>
            Error: {error}
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Select Sheet:
          </label>
          <select
            value={selectedSheet || ''}
            onChange={(e) => handleSheetChange(e.target.value)}
            disabled={loading}
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '16px',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          >
            {sheets.map((sheet) => (
              <option key={sheet} value={sheet}>
                {sheet}
              </option>
            ))}
          </select>
        </div>

        {selectedSheet && (
          <>
            <h3 style={{ marginTop: '20px', marginBottom: '12px' }}>Preview Data</h3>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>Loading preview...</div>
            ) : previewData.length > 0 ? (
              <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    border: '1px solid #ddd',
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: '#f5f5f5' }}>
                      {headers.map((header) => (
                        <th
                          key={header}
                          style={{
                            padding: '8px',
                            textAlign: 'left',
                            border: '1px solid #ddd',
                            fontWeight: 'bold',
                          }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, index) => {
                      const lithologyValue = row['Lithology']
                      const bgColor = getLithologyColor(lithologyValue)
                      // Determine text color based on background color brightness
                      const isDark = bgColor === '#000000' || bgColor === '#ff0000' // Black or Red
                      const textColor = isDark ? '#ffffff' : '#000000'
                      
                      return (
                        <tr key={index} style={{ backgroundColor: bgColor }}>
                          {headers.map((header) => (
                            <td
                              key={header}
                              style={{
                                padding: '8px',
                                border: '1px solid #ddd',
                                color: textColor,
                                fontWeight: isDark ? '500' : 'normal',
                              }}
                            >
                              {formatNumericValue(row[header], header)}
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                No preview data available
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#ccc',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedSheet || loading}
            style={{
              padding: '10px 20px',
              backgroundColor: selectedSheet && !loading ? '#2196F3' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: selectedSheet && !loading ? 'pointer' : 'not-allowed',
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

export default SheetSelectionModal


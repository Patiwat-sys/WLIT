import { useState, useEffect, useMemo } from 'react'
import { getExcelRawData } from '../services/api.js'

function ColumnMappingModal({ isOpen, onClose, onConfirm, file, sheetName }) {
  const [rawData, setRawData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [mapping, setMapping] = useState({
    DHID: null,
    From: null,
    To: null,
    Thickness: null,
    Lithology: null,
    Seam: null,
    SampleNo: null,
    Remark: null,
    ClayColor: null,
    Description: null,
    DataStartRow: 4,
    HeaderRow: 2,
    MetadataRow: 3,
  })

  useEffect(() => {
    if (isOpen && file && sheetName) {
      loadRawData()
    }
  }, [isOpen, file, sheetName])

  const loadRawData = async () => {
    setLoading(true)
    setError(null)
    try {
      // Load more rows for preview (up to 500 rows for better preview)
      // If file is very large, user can still see a good sample
      const data = await getExcelRawData(file, sheetName, 500)
      setRawData(data)
      
      // Auto-detect columns
      if (data.headers && data.previewRows) {
        autoDetectColumns(data)
      }
    } catch (err) {
      setError(err.message || 'Failed to load Excel data')
    } finally {
      setLoading(false)
    }
  }

  const autoDetectColumns = (data) => {
    const headers = data.headers || []
    const previewRows = data.previewRows || []
    
    const detected = {
      DHID: null,
      From: null,
      To: null,
      Thickness: null,
      Lithology: null,
      Seam: null,
      SampleNo: null,
      Remark: null,
      ClayColor: null,
      Description: null,
    }

    // Try to find columns by header names (case-insensitive)
    headers.forEach((header, index) => {
      if (!header) return
      const headerLower = String(header).toLowerCase().trim()
      const colIndex = index + 1

      if (headerLower.includes('dhid') || headerLower.includes('dh id')) {
        detected.DHID = colIndex
      } else if (headerLower.includes('from') && !detected.From) {
        detected.From = colIndex
      } else if (headerLower.includes('to') && !detected.To && !headerLower.includes('total')) {
        detected.To = colIndex
      } else if (headerLower.includes('thickness') || headerLower.includes('thick')) {
        detected.Thickness = colIndex
      } else if (headerLower.includes('lithology') || headerLower.includes('lith')) {
        detected.Lithology = colIndex
      } else if (headerLower.includes('seam')) {
        detected.Seam = colIndex
      } else if (headerLower.includes('sample') && (headerLower.includes('no') || headerLower.includes('num'))) {
        detected.SampleNo = colIndex
      } else if (headerLower.includes('remark') || headerLower.includes('note')) {
        detected.Remark = colIndex
      } else if (headerLower.includes('clay') && headerLower.includes('color')) {
        detected.ClayColor = colIndex
      } else if (headerLower.includes('description') || headerLower.includes('desc')) {
        detected.Description = colIndex
      }
    })

    // If From/To not found by header, try to detect by data type (numeric columns)
    if (!detected.From || !detected.To) {
      const numericColumns = []
      headers.forEach((header, index) => {
        const colIndex = index + 1
        // Check if first few rows are numeric
        let isNumeric = true
        let hasValue = false
        for (let i = 0; i < Math.min(5, previewRows.length); i++) {
          const value = previewRows[i]?.[`col${colIndex}`]
          if (value !== null && value !== undefined && value !== '') {
            hasValue = true
            const numValue = parseFloat(value)
            if (isNaN(numValue)) {
              isNumeric = false
              break
            }
          }
        }
        if (isNumeric && hasValue) {
          numericColumns.push(colIndex)
        }
      })

      // Assume first two numeric columns are From and To
      if (numericColumns.length >= 2) {
        if (!detected.From) detected.From = numericColumns[0]
        if (!detected.To) detected.To = numericColumns[1]
        if (!detected.Thickness && numericColumns.length >= 3) {
          detected.Thickness = numericColumns[2]
        }
      }
    }

    setMapping(prev => ({ ...prev, ...detected }))
  }

  const handleMappingChange = (field, value) => {
    setMapping(prev => ({
      ...prev,
      [field]: value === '' ? null : parseInt(value)
    }))
  }

  const handleConfirm = () => {
    // Validate required fields
    if (!mapping.From || !mapping.To) {
      setError('From and To columns are required')
      return
    }

    // Prepare mapping object with all fields (including null values for optional fields)
    const finalMapping = {
      DHID: mapping.DHID || null,
      From: mapping.From,
      To: mapping.To,
      Thickness: mapping.Thickness || null,
      Lithology: mapping.Lithology || null,
      Seam: mapping.Seam || null,
      SampleNo: mapping.SampleNo || null,
      Remark: mapping.Remark || null,
      ClayColor: mapping.ClayColor || null,
      Description: mapping.Description || null,
      DataStartRow: mapping.DataStartRow || 4,
      HeaderRow: mapping.HeaderRow || 2,
      MetadataRow: mapping.MetadataRow || 3,
    }

    onConfirm(finalMapping)
  }

  const getColumnLetter = (colNumber) => {
    let result = ''
    let num = colNumber
    while (num > 0) {
      num--
      result = String.fromCharCode(65 + (num % 26)) + result
      num = Math.floor(num / 26)
    }
    return result
  }

  const getColumnOptions = () => {
    if (!rawData || !rawData.maxColumn) return []
    const options = [{ value: '', label: 'None' }]
    for (let i = 1; i <= rawData.maxColumn; i++) {
      const header = rawData.headers?.[i - 1] || ''
      const label = header ? `${getColumnLetter(i)}: ${header}` : `Column ${getColumnLetter(i)}`
      options.push({ value: i, label })
    }
    return options
  }

  const getPreviewValue = (colIndex, rowIndex = 0) => {
    if (!rawData || !rawData.previewRows || !rawData.previewRows[rowIndex]) return ''
    return rawData.previewRows[rowIndex][`col${colIndex}`] || ''
  }

  const requiredFields = ['From', 'To']
  const optionalFields = ['DHID', 'Thickness', 'Lithology', 'Seam', 'SampleNo', 'Remark', 'ClayColor', 'Description']

  if (!isOpen) return null

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
          width: '1000px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Map Excel Columns</h2>
        
        {error && (
          <div style={{
            padding: '10px',
            backgroundColor: '#ffebee',
            color: '#c62828',
            borderRadius: '4px',
            marginBottom: '20px',
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading Excel data...</div>
        ) : rawData ? (
          <>
            <div style={{ marginBottom: '20px' }}>
              <button
                onClick={autoDetectColumns.bind(null, rawData)}
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
                Auto-detect Columns
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '12px' }}>Column Mapping</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {requiredFields.map(field => (
                  <div key={field} style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ marginBottom: '4px', fontWeight: 'bold' }}>
                      {field} <span style={{ color: 'red' }}>*</span>
                    </label>
                    <select
                      value={mapping[field] || ''}
                      onChange={(e) => handleMappingChange(field, e.target.value)}
                      style={{
                        padding: '6px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        fontSize: '14px',
                      }}
                    >
                      {getColumnOptions().map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {mapping[field] && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        Preview: {getPreviewValue(mapping[field])}
                      </div>
                    )}
                  </div>
                ))}
                
                {optionalFields.map(field => (
                  <div key={field} style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ marginBottom: '4px', fontWeight: 'bold' }}>
                      {field}
                    </label>
                    <select
                      value={mapping[field] || ''}
                      onChange={(e) => handleMappingChange(field, e.target.value)}
                      style={{
                        padding: '6px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        fontSize: '14px',
                      }}
                    >
                      {getColumnOptions().map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {mapping[field] && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        Preview: {getPreviewValue(mapping[field])}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '12px' }}>
                Data Preview 
                {rawData.previewRows && (
                  <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#666', marginLeft: '10px' }}>
                    (Showing {rawData.previewRows.length} rows)
                  </span>
                )}
              </h3>
              <div style={{ 
                overflowX: 'auto', 
                overflowY: 'auto', 
                maxHeight: '600px', 
                border: '1px solid #ddd',
                backgroundColor: 'white',
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f5f5f5', position: 'sticky', top: 0, zIndex: 10 }}>
                      {rawData.headers?.map((header, index) => {
                        const colIndex = index + 1
                        const isMapped = Object.values(mapping).includes(colIndex)
                        return (
                          <th
                            key={index}
                            style={{
                              padding: '6px',
                              border: '1px solid #ddd',
                              backgroundColor: isMapped ? '#e3f2fd' : '#f5f5f5',
                              fontWeight: 'bold',
                              minWidth: '100px',
                            }}
                          >
                            {getColumnLetter(colIndex)}: {header || ''}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rawData.previewRows?.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {rawData.headers?.map((header, colIndex) => {
                          const colNum = colIndex + 1
                          const value = row[`col${colNum}`] || ''
                          const isMapped = Object.values(mapping).includes(colNum)
                          return (
                            <td
                              key={colIndex}
                              style={{
                                padding: '6px',
                                border: '1px solid #ddd',
                                backgroundColor: isMapped ? '#e3f2fd' : 'white',
                                whiteSpace: 'nowrap',
                              }}
                              title={String(value)}
                            >
                              {String(value).length > 30 ? String(value).substring(0, 30) + '...' : String(value)}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            No data available
          </div>
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
            disabled={!mapping.From || !mapping.To || loading}
            style={{
              padding: '10px 20px',
              backgroundColor: (!mapping.From || !mapping.To || loading) ? '#ccc' : '#2196F3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: (!mapping.From || !mapping.To || loading) ? 'not-allowed' : 'pointer',
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

export default ColumnMappingModal


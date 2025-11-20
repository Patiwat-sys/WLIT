import { useState, useCallback, useEffect, useRef } from 'react'
import './App.css'
import FileUpload from './components/FileUpload.jsx'
import WellLogViewer from './components/WellLogViewer.jsx'
import ProjectManager from './components/ProjectManager.jsx'
import SheetSelectionModal from './components/SheetSelectionModal.jsx'
import ColumnMappingModal from './components/ColumnMappingModal.jsx'
import ColumnManager from './components/ColumnManager.jsx'
import SaveProjectModal from './components/SaveProjectModal.jsx'
import CommentModal from './components/CommentModal.jsx'
import ExcelValidationModal from './components/ExcelValidationModal.jsx'
import PDFExportModal from './components/PDFExportModal.jsx'
import PDFPreviewModal from './components/PDFPreviewModal.jsx'
import { uploadLAS, uploadExcel, uploadExcelWithMapping, combineData } from './services/api.js'
import { enhanceIntervals, prepareProjectData } from './utils/intervals.js'
import html2pdf from 'html2pdf.js'

const DEFAULT_LITHOLOGY_COLORS = {
  LI: '#2b2727',
  CLLI: '#c34141',
  LICL: '#e7eb24',
  CBCL: '#41fbb4',
}

const DEFAULT_COLUMN_ORDER = [
  'naturalGamma',
  'density',
  'lithology',
  'from',
  'to',
  'thickness',
  'seam',
  'sampleNo',
  'remark',
  'clayColor',
  'description',
  'adjustRange',
]

const DEFAULT_COLUMN_WIDTHS = {
  naturalGamma: 240,
  lithology: 60,
  density: 500,
  from: 65,
  to: 65,
  thickness: 65,
  seam: 65,
  sampleNo: 65,
  remark: 65,
  clayColor: 120,
  description: 300,
  adjustRange: 70,
}

const DEFAULT_COLUMN_FONT_SIZES = {
  lithology: 12,
  from: 11,
  to: 11,
  thickness: 11,
  seam: 11,
  sampleNo: 11,
  remark: 11,
  clayColor: 11,
  description: 11,
  adjustRange: 14,
}

const MAX_HISTORY = 10

const cloneIntervals = (intervals = []) => {
  return intervals.map((interval) => ({
    ...interval,
    additionalFields: {
      ...(interval.additionalFields || {}),
    },
  }))
}

const FONT_SIZE_COLUMNS = [
  { key: 'lithology', label: 'Lithology' },
  { key: 'from', label: 'From' },
  { key: 'to', label: 'To' },
  { key: 'thickness', label: 'Thickness' },
  { key: 'seam', label: 'Seam' },
  { key: 'sampleNo', label: 'Sample No' },
  { key: 'remark', label: 'Remark' },
  { key: 'clayColor', label: 'Clay color' },
  { key: 'description', label: 'Description' },
  { key: 'adjustRange', label: 'Adjust Range' },
]

const createDefaultViewSettings = () => ({
  show: {
    natu: true,
    bore: true,
    long: true,
    high: true,
    lithology: true,
    from: true,
    to: true,
    thickness: true,
    seam: true,
    sampleNo: true,
    remark: true,
    clayColor: true,
    description: true,
    adjustRange: true,
  },
  scales: {
    natu: { min: 0, max: 200 },
    bore: { min: 0, max: 20 },
    density: { min: 0, max: 12000 },
    depthRatio: 50, // 1 meter = 50 pixels (default), can be changed to stretch/compress
  },
  lithologyColors: { ...DEFAULT_LITHOLOGY_COLORS },
  columnOrder: [...DEFAULT_COLUMN_ORDER],
  columnWidths: { ...DEFAULT_COLUMN_WIDTHS },
  columnGaps: {
    enabled: false, // Default: no gaps
    size: 30, // Default gap size when enabled
  },
  showCrosshair: true,
  columnFontSizes: { ...DEFAULT_COLUMN_FONT_SIZES },
  smooth: {
    natu: false, // Smooth Natural Gamma
    density: false, // Smooth Density (long and high)
    natuWindow: 15, // Window size for Natural Gamma smoothing
    densityWindow: 15, // Window size for Density smoothing
  },
  snapTo005: false, // Snap depth adjustments to 0.05 increments
  grid: {
    showMajorLines: true,
    showMinorLines: false,
    majorColor: '#1b5e20',
    minorColor: '#90EE90',
  },
})

const hydrateViewSettings = (incoming) => {
  const defaults = createDefaultViewSettings()
  if (!incoming) return defaults

  const mergedColumnOrder = Array.isArray(incoming.columnOrder) && incoming.columnOrder.length
    ? [...incoming.columnOrder]
    : [...defaults.columnOrder]
  DEFAULT_COLUMN_ORDER.forEach((colKey) => {
    if (!mergedColumnOrder.includes(colKey)) {
      mergedColumnOrder.push(colKey)
    }
  })

  return {
    ...defaults,
    ...incoming,
    show: {
      ...defaults.show,
      ...(incoming.show || {}),
    },
    scales: {
      ...defaults.scales,
      ...(incoming.scales || {}),
    },
    lithologyColors: {
      ...defaults.lithologyColors,
      ...(incoming.lithologyColors || {}),
    },
    columnOrder: mergedColumnOrder,
    columnWidths: {
      ...defaults.columnWidths,
      ...(incoming.columnWidths || {}),
    },
    columnGaps: {
      ...defaults.columnGaps,
      ...(incoming.columnGaps || {}),
    },
    columnFontSizes: {
      ...defaults.columnFontSizes,
      ...(incoming.columnFontSizes || {}),
    },
    grid: {
      ...defaults.grid,
      ...(incoming.grid || {}),
      majorColor: incoming.grid?.majorColor || defaults.grid.majorColor,
      minorColor: incoming.grid?.minorColor || defaults.grid.minorColor,
    },
    smooth: {
      ...defaults.smooth,
      ...(incoming.smooth || {}),
    },
    snapTo005: typeof incoming.snapTo005 === 'boolean' ? incoming.snapTo005 : defaults.snapTo005,
  }
}

function App() {
  const [projectData, setProjectData] = useState(null)
  const [lasFile, setLasFile] = useState(null)
  const [excelFile, setExcelFile] = useState(null)
  const [selectedSheet, setSelectedSheet] = useState(null)
  const [showSheetModal, setShowSheetModal] = useState(false)
  const [showColumnMappingModal, setShowColumnMappingModal] = useState(false)
  const [pendingExcelFile, setPendingExcelFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [displayControlsOpen, setDisplayControlsOpen] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [isEditingWellId, setIsEditingWellId] = useState(false)
  const [editingWellIdValue, setEditingWellIdValue] = useState('')
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [validationErrors, setValidationErrors] = useState([])
  const [pendingExcelData, setPendingExcelData] = useState(null)
  const [commentModalIntervalId, setCommentModalIntervalId] = useState(null)
  const [commentModalValue, setCommentModalValue] = useState('')
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [showPDFExportModal, setShowPDFExportModal] = useState(false)
  const [showPDFPreviewModal, setShowPDFPreviewModal] = useState(false)
  const [pdfPreviewSettings, setPdfPreviewSettings] = useState(null)
  const [viewSettings, setViewSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('adjustlog:viewSettings')
      if (saved) {
        const parsed = JSON.parse(saved)
        return hydrateViewSettings(parsed)
      }
    } catch (err) {
      console.error('Failed to parse saved view settings', err)
    }
    return createDefaultViewSettings()
  })
  const [history, setHistory] = useState({ past: [], future: [] })

  const handleLASUpload = async (file) => {
    setLasFile(file)
    setLoading(true)
    setError(null)
    try {
      const data = await uploadLAS(file)
      console.log('LAS data:', data)
      
      // If Excel is already loaded, combine them
      if (excelFile) {
        const excelData = await uploadExcel(excelFile)
        const combined = await combineData(data, excelData)
        setProjectData(prepareProjectData(combined))
        setHistory({ past: [], future: [] })
        applyDefaultLithologyColors()
      }
    } catch (err) {
      setError(err.message || 'Failed to upload LAS file')
    } finally {
      setLoading(false)
    }
  }

  const handleExcelFileSelect = (file) => {
    setPendingExcelFile(file)
    setShowSheetModal(true)
  }

  const handleCloseSheetModal = () => {
    setShowSheetModal(false)
    setPendingExcelFile(null)
  }

  // Validate Excel data before import
  const validateExcelData = (intervals) => {
    const errors = []
    const tolerance = 0.01 // Small tolerance for floating point comparison

    if (!intervals || intervals.length === 0) {
      errors.push({
        row: 'N/A',
        message: 'ไม่มีข้อมูล intervals',
      })
      return errors
    }

    // Sort intervals by top value
    const sortedIntervals = [...intervals].sort((a, b) => {
      const aTop = a.top || 0
      const bTop = b.top || 0
      return aTop - bTop
    })

    for (let i = 0; i < sortedIntervals.length; i++) {
      const interval = sortedIntervals[i]
      const row = i + 1 // 1-based row number for display
      const from = interval.top
      const to = interval.bottom
      const thickness = interval.thickness !== undefined ? interval.thickness : (to - from)

      // Check for missing values
      if (from === null || from === undefined || isNaN(from)) {
        errors.push({
          row: row,
          message: 'ค่า From (Column B) หายไปหรือไม่ถูกต้อง',
          details: `From: ${from}`,
        })
      }

      if (to === null || to === undefined || isNaN(to)) {
        errors.push({
          row: row,
          message: 'ค่า To (Column C) หายไปหรือไม่ถูกต้อง',
          details: `To: ${to}`,
        })
      }

      if (thickness === null || thickness === undefined || isNaN(thickness)) {
        errors.push({
          row: row,
          message: 'ค่า Thickness (Column D) หายไปหรือไม่ถูกต้อง',
          details: `Thickness: ${thickness}`,
        })
      }

      // Skip further validation if basic values are missing
      if (from === null || from === undefined || isNaN(from) ||
          to === null || to === undefined || isNaN(to)) {
        continue
      }

      // Check for negative thickness
      if (thickness < 0) {
        errors.push({
          row: row,
          message: 'Thickness ติดลบ',
          details: `From: ${from.toFixed(2)}, To: ${to.toFixed(2)}, Thickness: ${thickness.toFixed(2)}`,
        })
      }

      // Check for invalid range (From >= To)
      if (from >= to) {
        errors.push({
          row: row,
          message: 'ค่า From มากกว่าหรือเท่ากับ To',
          details: `From: ${from.toFixed(2)}, To: ${to.toFixed(2)}`,
        })
      }

      // Check for gaps and overlaps with previous interval
      if (i > 0) {
        const prevInterval = sortedIntervals[i - 1]
        const prevFrom = prevInterval.top
        const prevTo = prevInterval.bottom

        if (prevFrom !== null && prevTo !== null && !isNaN(prevFrom) && !isNaN(prevTo)) {
          // Check for gap
          if (Math.abs(prevTo - from) > tolerance) {
            errors.push({
              row: row,
              message: 'มี Gap ระหว่างข้อมูล',
              details: `แถวก่อนหน้า To: ${prevTo.toFixed(2)}, แถวนี้ From: ${from.toFixed(2)}, Gap: ${Math.abs(prevTo - from).toFixed(2)}`,
            })
          }

          // Check for overlap
          if (from < prevTo - tolerance) {
            errors.push({
              row: row,
              message: 'ข้อมูล Overlap กับแถวก่อนหน้า',
              details: `แถวก่อนหน้า To: ${prevTo.toFixed(2)}, แถวนี้ From: ${from.toFixed(2)}, Overlap: ${(prevTo - from).toFixed(2)}`,
            })
          }
        }
      }
    }

    return errors
  }

  const handleSheetSelect = async (sheetName) => {
    setSelectedSheet(sheetName)
    setShowSheetModal(false)
    
    if (!pendingExcelFile) return
    
    // Show column mapping modal instead of uploading directly
    setShowColumnMappingModal(true)
  }

  const handleColumnMappingConfirm = async (mapping) => {
    setShowColumnMappingModal(false)
    
    if (!pendingExcelFile || !selectedSheet) return
    
    setLoading(true)
    setError(null)
    try {
      const data = await uploadExcelWithMapping(pendingExcelFile, selectedSheet, mapping)
      console.log('Excel data with mapping:', data)
      
      // Validate data before importing
      const intervals = data.intervals || []
      const errors = validateExcelData(intervals)
      
      if (errors.length > 0) {
        // Show validation modal
        setValidationErrors(errors)
        setPendingExcelData(data)
        setShowValidationModal(true)
        setLoading(false)
        return
      }
      
      // No errors, proceed with import
      await proceedWithImport(data)
    } catch (err) {
      setError(err.message || 'Failed to upload Excel file')
      setLoading(false)
      setPendingExcelFile(null)
    }
  }

  const proceedWithImport = async (data) => {
    try {
      setExcelFile(pendingExcelFile)
      
      // If LAS is already loaded, combine them
      if (lasFile) {
        const lasData = await uploadLAS(lasFile)
        const combined = await combineData(lasData, data)
        setProjectData(prepareProjectData(combined))
        applyDefaultLithologyColors()
      } else {
        // Only Excel file, create project data with Excel data only
        const excelData = {
          intervals: data.intervals || [],
          metadata: data.metadata || {}
        }
        const projectDataFromExcel = {
          wellId: excelData.metadata.wellId || 'UNKNOWN',
          metadata: excelData.metadata,
          geophysicalLogs: [],
          lithologyIntervals: excelData.intervals,
          adjustments: [],
          version: '1.0.0',
          lastModified: new Date().toISOString()
        }
        setProjectData(prepareProjectData(projectDataFromExcel))
        setHistory({ past: [], future: [] })
        applyDefaultLithologyColors()
      }
    } catch (err) {
      setError(err.message || 'Failed to import Excel file')
    } finally {
      setLoading(false)
      setPendingExcelFile(null)
      setShowValidationModal(false)
      setValidationErrors([])
      setPendingExcelData(null)
    }
  }

  const handleValidationConfirm = async () => {
    if (pendingExcelData) {
      await proceedWithImport(pendingExcelData)
    }
  }

  const handleValidationCancel = () => {
    setShowValidationModal(false)
    setValidationErrors([])
    setPendingExcelData(null)
    setPendingExcelFile(null)
    setLoading(false)
  }

  const handleIntervalUpdate = useCallback((intervalId, top, bottom) => {
    if (!projectData) return

    setProjectData((prev) => {
      if (!prev) return prev

      const intervals = prev.lithologyIntervals
      const currentIndex = intervals.findIndex(i => i.id === intervalId)
      if (currentIndex === -1) return prev

      const currentInterval = intervals[currentIndex]
      const prevInterval = currentIndex > 0 ? intervals[currentIndex - 1] : null
      const nextInterval = currentIndex < intervals.length - 1 ? intervals[currentIndex + 1] : null

      // Determine which boundary was moved
      const currentTop = currentInterval.adjustedTop ?? currentInterval.top
      const currentBottom = currentInterval.adjustedBottom ?? currentInterval.bottom
      const isTopMoved = Math.abs(top - currentTop) > 0.01
      const isBottomMoved = Math.abs(bottom - currentBottom) > 0.01

      const updatedIntervals = intervals.map((interval, index) => {
        if (interval.id === intervalId) {
          // Update current interval
          return {
            ...interval,
            adjustedTop: top,
            adjustedBottom: bottom,
            thickness: bottom - top,
          }
        } else if (isTopMoved && prevInterval && interval.id === prevInterval.id) {
          // If top was moved, update previous interval's bottom to match
          const prevTop = interval.adjustedTop ?? interval.top
          return {
            ...interval,
            adjustedBottom: top,
            thickness: top - prevTop,
          }
        } else if (isBottomMoved && nextInterval && interval.id === nextInterval.id) {
          // If bottom was moved, update next interval's top to match
          const nextBottom = interval.adjustedBottom ?? interval.bottom
          return {
            ...interval,
            adjustedTop: bottom,
            thickness: nextBottom - bottom,
          }
        }
        return interval
      })
      const enhancedIntervals = enhanceIntervals(updatedIntervals)

      // Add to adjustment history
      const adjustment = {
        id: `adj-${Date.now()}`,
        intervalId,
        type: isTopMoved ? 'top' : 'bottom',
        oldValue: isTopMoved ? currentTop : currentBottom,
        newValue: isTopMoved ? top : bottom,
        timestamp: new Date().toISOString(),
      }

      return {
        ...prev,
        lithologyIntervals: enhancedIntervals,
        adjustments: [...prev.adjustments, adjustment],
      }
    })
  }, [projectData])

  const pushHistory = useCallback((intervals) => {
    if (!Array.isArray(intervals)) return
    const snapshot = cloneIntervals(intervals)
    setHistory((prev) => {
      const past = [...prev.past, snapshot]
      if (past.length > MAX_HISTORY) {
        past.shift()
      }
      return {
        past,
        future: [],
      }
    })
  }, [])

  const handleAddInterval = useCallback((afterIntervalId) => {
    if (!projectData) return

    setProjectData((prev) => {
      if (!prev) return prev

      const intervals = prev.lithologyIntervals
      const sourceIndex = intervals.findIndex(i => i.id === afterIntervalId)
      if (sourceIndex === -1) return prev

      const sourceInterval = intervals[sourceIndex]
      const sourceTop = sourceInterval.adjustedTop ?? sourceInterval.top
      const sourceBottom = sourceInterval.adjustedBottom ?? sourceInterval.bottom
      const sourceOriginTop = sourceInterval.originTop ?? sourceInterval.top
      const sourceOriginBottom = sourceInterval.originBottom ?? sourceInterval.bottom
      const sourceGroupId = sourceInterval.adjustGroupId ?? sourceInterval.id

      // Calculate new From/To by splitting the interval in half
      const newFrom = (sourceTop + sourceBottom) / 2
      const newTo = sourceBottom
      const newThickness = newTo - newFrom

      // Create new interval with copied data
      const newInterval = {
        id: `interval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        top: newFrom,
        bottom: newTo,
        thickness: newThickness,
        lithologyType: sourceInterval.lithologyType,
        rockCode: sourceInterval.rockCode,
        splitedSeam: sourceInterval.splitedSeam,
        splitedCode: sourceInterval.splitedCode,
        adjustedTop: null,
        adjustedBottom: null,
        additionalFields: {
          ...sourceInterval.additionalFields,
        },
        originTop: sourceOriginTop,
        originBottom: sourceOriginBottom,
        adjustGroupId: sourceGroupId,
      }

      // Update source interval's bottom to match new interval's top
      const updatedIntervals = intervals.map((interval, index) => {
        if (interval.id === afterIntervalId) {
          const intervalTop = interval.adjustedTop ?? interval.top
          return {
            ...interval,
            bottom: newFrom,
            adjustedBottom: null,
            thickness: newFrom - intervalTop,
            originTop: sourceOriginTop,
            originBottom: sourceOriginBottom,
            adjustGroupId: sourceGroupId,
          }
        }
        return interval
      })

      // Insert new interval after the source interval
      const newIntervals = [
        ...updatedIntervals.slice(0, sourceIndex + 1),
        newInterval,
        ...updatedIntervals.slice(sourceIndex + 1),
      ]

      pushHistory(prev.lithologyIntervals)

      return {
        ...prev,
        lithologyIntervals: enhanceIntervals(newIntervals),
      }
    })
  }, [projectData, pushHistory])

  const handleDeleteInterval = useCallback((intervalId) => {
    if (!projectData) return

    setProjectData((prev) => {
      if (!prev) return prev

      const intervals = prev.lithologyIntervals
      const deleteIndex = intervals.findIndex(i => i.id === intervalId)
      if (deleteIndex === -1) return prev

      const intervalToDelete = intervals[deleteIndex]
      const prevInterval = deleteIndex > 0 ? intervals[deleteIndex - 1] : null
      const nextInterval = deleteIndex < intervals.length - 1 ? intervals[deleteIndex + 1] : null

      // Get boundaries
      const deleteTop = intervalToDelete.adjustedTop ?? intervalToDelete.top
      const deleteBottom = intervalToDelete.adjustedBottom ?? intervalToDelete.bottom

      // Update intervals: remove deleted and adjust adjacent intervals
      let updatedIntervals = intervals.filter((interval, index) => index !== deleteIndex)

      // First pass: update prev interval
      if (prevInterval) {
        updatedIntervals = updatedIntervals.map((interval) => {
          if (interval.id === prevInterval.id) {
            const prevTop = interval.adjustedTop ?? interval.top
            let newBottom
            if (nextInterval) {
              // Connect to next's top
              newBottom = nextInterval.adjustedTop ?? nextInterval.top
            } else {
              // Extend to deleted interval's bottom
              newBottom = deleteBottom
            }
            return {
              ...interval,
              bottom: newBottom,
              adjustedBottom: null,
              thickness: newBottom - prevTop,
            }
          }
          return interval
        })
      }

      // Second pass: update next interval using updated prev
      if (nextInterval) {
        updatedIntervals = updatedIntervals.map((interval) => {
          if (interval.id === nextInterval.id) {
            const nextBottom = interval.adjustedBottom ?? interval.bottom
            let newTop
            if (prevInterval) {
              // Connect to prev's bottom (which was just updated)
              const updatedPrev = updatedIntervals.find(i => i.id === prevInterval.id)
              newTop = updatedPrev?.bottom ?? prevInterval.bottom
            } else {
              // Use deleted interval's top
              newTop = deleteTop
            }
            return {
              ...interval,
              top: newTop,
              adjustedTop: null,
              thickness: nextBottom - newTop,
            }
          }
          return interval
        })
      }

      pushHistory(prev.lithologyIntervals)

      return {
        ...prev,
        lithologyIntervals: enhanceIntervals(updatedIntervals),
      }
    })
  }, [projectData, pushHistory])

  const handleUpdateIntervalField = useCallback((intervalId, field, value) => {
    if (!projectData) return

    setProjectData((prev) => {
      if (!prev) return prev

      let didChange = false
      const updatedIntervals = prev.lithologyIntervals.map((interval) => {
        if (interval.id !== intervalId) return interval

        if (field === 'lithologyType') {
          if (interval.lithologyType === value) {
            return interval
          }
          didChange = true
          return {
            ...interval,
            lithologyType: value,
          }
        } else if (field === 'splitedSeam') {
          if (interval.splitedSeam === value) {
            return interval
          }
          didChange = true
          return {
            ...interval,
            splitedSeam: value,
          }
        } else {
          const currentValue = interval.additionalFields?.[field]
          if (currentValue === value) {
            return interval
          }
          didChange = true
          return {
            ...interval,
            additionalFields: {
              ...interval.additionalFields,
              [field]: value,
            },
          }
        }
      })

      if (!didChange) return prev

      pushHistory(prev.lithologyIntervals)

      return {
        ...prev,
        lithologyIntervals: enhanceIntervals(updatedIntervals),
      }
    })
  }, [projectData, pushHistory])

  const handleCloseCommentModal = useCallback(() => {
    setShowCommentModal(false)
    setCommentModalIntervalId(null)
    setCommentModalValue('')
  }, [])

  const applyCommentChange = useCallback((intervalId, nextValue) => {
    const normalizedValue = nextValue.trim()
    setProjectData((prev) => {
      if (!prev) return prev

      let didChange = false
      const updatedIntervals = prev.lithologyIntervals.map((interval) => {
        if (interval.id !== intervalId) return interval
        const currentValue = interval.comment || ''
        if (currentValue === normalizedValue) {
          return interval
        }
        didChange = true
        return {
          ...interval,
          comment: normalizedValue,
        }
      })

      if (!didChange) return prev

      pushHistory(prev.lithologyIntervals)

      return {
        ...prev,
        lithologyIntervals: enhanceIntervals(updatedIntervals),
      }
    })
  }, [pushHistory])

  const handleRequestComment = useCallback((intervalId) => {
    if (!projectData) return
    const target = projectData.lithologyIntervals?.find(interval => interval.id === intervalId)
    if (!target) return
    setCommentModalIntervalId(intervalId)
    setCommentModalValue(target.comment || '')
    setShowCommentModal(true)
  }, [projectData])

  const handleCommentSave = useCallback((value) => {
    if (!commentModalIntervalId) {
      handleCloseCommentModal()
      return
    }
    applyCommentChange(commentModalIntervalId, value)
    handleCloseCommentModal()
  }, [applyCommentChange, commentModalIntervalId, handleCloseCommentModal])

  const handleCommentDelete = useCallback((intervalId) => {
    applyCommentChange(intervalId, '')
    if (commentModalIntervalId === intervalId) {
      handleCloseCommentModal()
    }
  }, [applyCommentChange, commentModalIntervalId, handleCloseCommentModal])

  const handleSaveClick = () => {
    if (!projectData) {
      alert('No project data to save')
      return
    }
    setShowSaveModal(true)
  }

  const handleSaveProject = async (fileName) => {
    if (!projectData) return

    if (!projectData.wellId || !projectData.wellId.trim()) {
      alert('Please set a Well ID before saving the project.')
      return
    }

    try {
      // Create complete project data with viewSettings
      // The lithologyIntervals already contain all column data including additionalFields
      const completeProjectData = {
        wellId: projectData.wellId,
        metadata: projectData.metadata,
        geophysicalLogs: projectData.geophysicalLogs,
        lithologyIntervals: projectData.lithologyIntervals.map(interval => ({
          ...interval,
          // Ensure all fields are included
          id: interval.id,
          top: interval.top,
          bottom: interval.bottom,
          adjustedTop: interval.adjustedTop,
          adjustedBottom: interval.adjustedBottom,
          thickness: interval.thickness,
          lithologyType: interval.lithologyType,
          rockCode: interval.rockCode,
          splitedSeam: interval.splitedSeam,
          splitedCode: interval.splitedCode,
          originTop: interval.originTop ?? interval.top,
          originBottom: interval.originBottom ?? interval.bottom,
          adjustGroupId: interval.adjustGroupId ?? interval.id,
        comment: interval.comment || '',
          additionalFields: interval.additionalFields || {},
        })),
        adjustments: projectData.adjustments || [],
        viewSettings: {
          ...viewSettings,
        },
        savedAt: new Date().toISOString(),
        version: '1.0.0',
      }

      // Convert to JSON
      const jsonString = JSON.stringify(completeProjectData, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      
      // Use File System Access API if available, otherwise fallback to download
      if ('showSaveFilePicker' in window) {
        try {
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: `${fileName}.wljson`,
            types: [{
              description: 'Well Log JSON files',
              accept: { 'application/json': ['.wljson'] },
            }],
          })
          const writable = await fileHandle.createWritable()
          await writable.write(blob)
          await writable.close()
    } catch (err) {
          // User cancelled or error occurred, fallback to download
          if (err.name !== 'AbortError') {
            console.error('Error saving file:', err)
            // Fallback to download
            downloadFile(blob, `${fileName}.wljson`)
          }
        }
      } else {
        // Fallback for browsers that don't support File System Access API
        downloadFile(blob, `${fileName}.wljson`)
      }
    } catch (err) {
      console.error('Failed to save project:', err)
      alert(`Failed to save project: ${err.message}`)
    }
  }

  const downloadFile = (blob, fileName) => {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
    a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
  }

  const handleExportPDFClick = () => {
    if (!projectData) {
      alert('No project data to export')
      return
    }
    setShowPDFExportModal(true)
  }

  // Shared function to create PDF container (used by both export and preview)
  const createPDFContainer = (settings, svgElement, forPreview = false) => {
    const mmToPx = 3.779527559
    
    // สร้าง outer wrapper สำหรับ preview (แสดง margins)
    let outerWrapper = null
    if (forPreview) {
      outerWrapper = document.createElement('div')
      const paperWidthPx = settings.paperSize.width * mmToPx
      const paperHeightPx = settings.paperSize.height * mmToPx
      outerWrapper.style.width = `${paperWidthPx}px`
      outerWrapper.style.minHeight = `${paperHeightPx}px`
      outerWrapper.style.backgroundColor = '#f0f0f0'
      outerWrapper.style.padding = `${settings.margins.top}${settings.paperSize.unit} ${settings.margins.right}${settings.paperSize.unit} ${settings.margins.bottom}${settings.paperSize.unit} ${settings.margins.left}${settings.paperSize.unit}`
      outerWrapper.style.boxSizing = 'border-box'
    }
    
    // สร้าง container สำหรับ PDF (เหมือนกันทั้ง preview และ export)
    const printContainer = document.createElement('div')
    // สำหรับ preview: width ลบ margins ออก (เพราะ outerWrapper มี padding แล้ว)
    // สำหรับ export: width เท่ากับ paper width (html2pdf.js จะจัดการ margins)
    if (forPreview) {
      const contentWidth = settings.paperSize.width - (settings.margins.left + settings.margins.right)
      printContainer.style.width = `${contentWidth}${settings.paperSize.unit}`
    } else {
      printContainer.style.width = `${settings.paperSize.width}${settings.paperSize.unit}`
    }
    printContainer.style.padding = '0' // ไม่ใส่ padding (html2pdf.js จะจัดการ margins)
    printContainer.style.backgroundColor = 'white'
    printContainer.style.fontFamily = 'Arial, sans-serif'
    printContainer.style.boxSizing = 'border-box'

    // เพิ่ม metadata header ถ้าเลือก
    if (settings.includeMetadata) {
      const metadataDiv = document.createElement('div')
      metadataDiv.style.marginBottom = '20px'
      metadataDiv.style.borderBottom = '2px solid #333'
      metadataDiv.style.paddingBottom = '10px'
      metadataDiv.innerHTML = `
        <h2 style="margin: 0; color: #333; font-size: 24px;">Well: ${projectData.wellId || 'N/A'}</h2>
        <p style="margin: 5px 0; color: #666; font-size: 14px;">
          Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}
        </p>
        ${projectData.metadata?.company ? `<p style="margin: 5px 0; color: #666; font-size: 12px;">Company: ${projectData.metadata.company}</p>` : ''}
        ${projectData.metadata?.line ? `<p style="margin: 5px 0; color: #666; font-size: 12px;">Line: ${projectData.metadata.line}</p>` : ''}
      `
      printContainer.appendChild(metadataDiv)
    }

    // Clone SVG element
    const clonedSvg = svgElement.cloneNode(true)
    clonedSvg.style.display = 'block'
    
    // Fit to Paper: Calculate scale factor and adjust SVG size using viewBox
    if (settings.fitToPaper) {
      // Get SVG dimensions from attributes or bounding box
      const svgWidth = parseFloat(svgElement.getAttribute('width')) || svgElement.getBoundingClientRect().width
      const svgHeight = parseFloat(svgElement.getAttribute('height')) || svgElement.getBoundingClientRect().height
      
      // Calculate available width (paper width - margins)
      const paperWidthPx = settings.paperSize.width * mmToPx
      const availableWidthPx = paperWidthPx - (settings.margins.left + settings.margins.right) * mmToPx
      
      // Calculate scale factor to fit width
      const scaleFactor = Math.min(1, availableWidthPx / svgWidth)
      const scaledWidth = availableWidthPx
      const scaledHeight = svgHeight * scaleFactor
      
      // Use viewBox for proper scaling - this ensures all content scales correctly
      if (!clonedSvg.getAttribute('viewBox')) {
        clonedSvg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`)
      }
      
      // Set width and height with scale - viewBox will handle the scaling
      clonedSvg.setAttribute('width', scaledWidth)
      clonedSvg.setAttribute('height', scaledHeight)
      clonedSvg.style.width = `${scaledWidth}px`
      clonedSvg.style.height = `${scaledHeight}px`
      clonedSvg.style.maxWidth = '100%'
      clonedSvg.style.overflow = 'visible'
      
      // Center content if requested
      if (settings.centerContent) {
        const svgWrapper = document.createElement('div')
        svgWrapper.style.display = 'flex'
        svgWrapper.style.justifyContent = 'center'
        svgWrapper.style.width = '100%'
        svgWrapper.style.margin = '0 auto'
        svgWrapper.appendChild(clonedSvg)
        printContainer.appendChild(svgWrapper)
      } else {
        printContainer.appendChild(clonedSvg)
      }
    } else {
      clonedSvg.style.maxWidth = '100%'
      clonedSvg.style.height = 'auto'
      printContainer.appendChild(clonedSvg)
    }

    // เพิ่ม footer ถ้าเลือก
    if (settings.includeFooter) {
      const footer = document.createElement('div')
      footer.style.marginTop = '20px'
      footer.style.paddingTop = '10px'
      footer.style.borderTop = '1px solid #ccc'
      footer.style.textAlign = 'center'
      footer.style.color = '#666'
      footer.style.fontSize = '10px'
      footer.textContent = `Generated by AdjustLog - ${new Date().toLocaleDateString()}`
      printContainer.appendChild(footer)
    }

    return printContainer
  }

  const handleExportPDFWithSettings = async (settings) => {
    try {
      setLoading(true)
      
      // รอให้ SVG render เสร็จ
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // หา SVG element จาก DOM
      const svgElement = document.querySelector('svg')
      if (!svgElement) {
        alert('SVG element not found. Please wait for the chart to load.')
        setLoading(false)
        return
      }

      // ใช้ shared function เพื่อสร้าง container (forPreview = false สำหรับ export)
      const printContainer = createPDFContainer(settings, svgElement, false)

      // กำหนด format สำหรับ jsPDF
      let pdfFormat = 'a4'
      if (settings.paperSize.name === 'Letter') pdfFormat = 'letter'
      else if (settings.paperSize.name === 'A3') pdfFormat = 'a3'
      else if (settings.paperSize.name === 'Legal') pdfFormat = 'legal'
      else if (settings.paperSize.name === 'Custom') {
        pdfFormat = [settings.paperSize.width, settings.paperSize.height]
      }

      // ตั้งค่า options สำหรับ PDF
      const opt = {
        margin: [settings.margins.top, settings.margins.right, settings.margins.bottom, settings.margins.left],
        filename: `${settings.fileName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: settings.quality,
          useCORS: true,
          logging: false,
          letterRendering: true
        },
        jsPDF: { 
          unit: settings.paperSize.unit, 
          format: pdfFormat, 
          orientation: settings.orientation,
          compress: true
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      }

      // Export เป็น PDF
      await html2pdf().set(opt).from(printContainer).save()
      
      setLoading(false)
    } catch (err) {
      console.error('Failed to export PDF:', err)
      alert(`Failed to export PDF: ${err.message}`)
      setLoading(false)
    }
  }

  const handleExportCSV = () => {
    if (!projectData) {
      alert('No project data to export')
      return
    }

    try {
      // Define column order: DHID, From, To, Thickness, Lithology, Seam, Sample no, remark, clay color, Description, Adjust Range, Comment
      const headers = ['DHID', 'From', 'To', 'Thickness', 'Lithology', 'Seam', 'Sample no', 'remark', 'clay color', 'Description', 'Adjust Range', 'Comment']
      
      // Helper function to escape CSV values
      const escapeCSV = (value) => {
        if (value === null || value === undefined) return ''
        const str = String(value)
        // If contains comma, quote, or newline, wrap in quotes and escape quotes
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }

      // Build CSV rows
      const rows = projectData.lithologyIntervals.map(interval => {
        const from = interval.adjustedTop !== undefined && interval.adjustedTop !== null 
          ? interval.adjustedTop 
          : interval.top
        const to = interval.adjustedBottom !== undefined && interval.adjustedBottom !== null 
          ? interval.adjustedBottom 
          : interval.bottom
        const thickness = to - from

        // Get values from interval and additionalFields
        const getFieldValue = (fieldName) => {
          // Check additionalFields first
          if (interval.additionalFields && interval.additionalFields[fieldName] !== undefined) {
            return interval.additionalFields[fieldName]
          }
          // Check direct properties
          if (interval[fieldName] !== undefined) {
            return interval[fieldName]
          }
          // Special cases for field name variations
          if (fieldName === 'Seam' && interval.splitedSeam !== undefined) {
            return interval.splitedSeam
          }
          if (fieldName === 'Sample no' || fieldName === 'SampleNo') {
            return interval.additionalFields?.SampleNo || interval.SampleNo || ''
          }
          if (fieldName === 'remark' || fieldName === 'Remark') {
            return interval.additionalFields?.Remark || interval.Remark || ''
          }
          if (fieldName === 'clay color' || fieldName === 'ClayColor') {
            return interval.additionalFields?.ClayColor || interval.ClayColor || ''
          }
          if (fieldName === 'Description') {
            return interval.additionalFields?.Description || interval.Description || ''
          }
          return ''
        }

        const adjustRangeValue = typeof interval.adjustRange === 'number' ? interval.adjustRange : 0
        const formattedAdjustRange = adjustRangeValue === 0
          ? '0.00'
          : `${adjustRangeValue > 0 ? '+' : ''}${adjustRangeValue.toFixed(2)}`

        return [
          projectData.wellId, // DHID
          from.toFixed(2), // From
          to.toFixed(2), // To
          thickness.toFixed(2), // Thickness
          interval.lithologyType || '', // Lithology
          getFieldValue('Seam'), // Seam
          getFieldValue('Sample no'), // Sample no
          getFieldValue('remark'), // remark
          getFieldValue('clay color'), // clay color
          getFieldValue('Description'), // Description
          formattedAdjustRange, // Adjust Range
          interval.comment || '',
        ]
      })

      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(escapeCSV).join(','))
      ].join('\n')

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${projectData.wellId}_adjusted.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to export CSV:', err)
      alert(`Failed to export CSV: ${err.message}`)
    }
  }

  const handleProjectLoad = (project) => {
    setProjectData(prepareProjectData(project))
    setLasFile(null)
    setExcelFile(null)
    setHistory({ past: [], future: [] })
    
    // Restore viewSettings if available
    if (project.viewSettings) {
      const mergedSettings = hydrateViewSettings(project.viewSettings)
      setViewSettings(mergedSettings)
      // Also save to localStorage
      try {
        localStorage.setItem('adjustlog:viewSettings', JSON.stringify(mergedSettings))
      } catch (err) {
        console.error('Failed to save view settings to localStorage', err)
      }
    } else {
    applyDefaultLithologyColors()
    }
  }

  const saveViewSettings = useCallback((settings) => {
    try {
      localStorage.setItem('adjustlog:viewSettings', JSON.stringify(settings))
    } catch (err) {
      console.error('Failed to save view settings', err)
    }
  }, [])

  useEffect(() => {
    saveViewSettings(viewSettings)
  }, [viewSettings, saveViewSettings])

  const updateViewSettings = useCallback((updater) => {
    setViewSettings((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      saveViewSettings(next)
      return next
    })
  }, [saveViewSettings])

  const handleUndo = useCallback(() => {
    if (!projectData || !Array.isArray(projectData.lithologyIntervals)) return
    setHistory((prev) => {
      if (!prev.past.length) return prev
      const past = [...prev.past]
      const previousSnapshot = past.pop()
      if (!previousSnapshot) return prev

      const currentSnapshot = cloneIntervals(projectData.lithologyIntervals || [])
      setProjectData((current) => {
        if (!current) return current
        return {
          ...current,
          lithologyIntervals: enhanceIntervals(cloneIntervals(previousSnapshot)),
        }
      })

      const future = [...prev.future, currentSnapshot]
      if (future.length > MAX_HISTORY) {
        future.shift()
      }

      return {
        past,
        future,
      }
    })
  }, [projectData])

  const handleRedo = useCallback(() => {
    if (!projectData) return
    setHistory((prev) => {
      if (!prev.future.length) return prev
      const future = [...prev.future]
      const nextSnapshot = future.pop()
      if (!nextSnapshot) return prev

      const currentSnapshot = cloneIntervals(projectData.lithologyIntervals || [])
      setProjectData((current) => {
        if (!current) return current
        return {
          ...current,
          lithologyIntervals: enhanceIntervals(cloneIntervals(nextSnapshot)),
        }
      })

      const past = [...prev.past, currentSnapshot]
      if (past.length > MAX_HISTORY) {
        past.shift()
      }

      return {
        past,
        future,
      }
    })
  }, [projectData])

  const handleIntervalAdjustStart = useCallback(() => {
    if (!projectData || !Array.isArray(projectData.lithologyIntervals)) return
    pushHistory(projectData.lithologyIntervals)
  }, [projectData, pushHistory])

  const applyDefaultLithologyColors = useCallback(() => {
    updateViewSettings((prev) => ({
      ...prev,
      lithologyColors: {
        ...DEFAULT_LITHOLOGY_COLORS,
        ...(prev?.lithologyColors || {}),
      },
    }))
  }, [updateViewSettings])

  const handleToggleChange = (key) => {
    updateViewSettings((prev) => ({
      ...prev,
      show: {
        ...prev.show,
        [key]: !prev.show[key],
      },
    }))
  }

const handleGridLineToggle = (key) => {
  updateViewSettings((prev) => ({
    ...prev,
    grid: {
      ...prev.grid,
      [key]: !prev.grid?.[key],
    },
  }))
}

const handleGridColorChange = (key, value) => {
  updateViewSettings((prev) => ({
    ...prev,
    grid: {
      ...prev.grid,
      [key]: value || prev.grid?.[key] || (key === 'majorColor' ? '#1b5e20' : '#90EE90'),
    },
  }))
}

  const handleFontSizeChange = (key, value) => {
    const parsed = Number(value)
    if (Number.isNaN(parsed)) return
    const clamped = Math.max(8, Math.min(32, parsed))
    updateViewSettings(prev => ({
      ...prev,
      columnFontSizes: {
        ...prev.columnFontSizes,
        [key]: clamped,
      },
    }))
  }

  const handleScaleChange = (curve, bound, value) => {
    const numeric = value === '' || value === null ? null : Number(value)
    updateViewSettings((prev) => ({
      ...prev,
      scales: {
        ...prev.scales,
        [curve]: {
          ...prev.scales[curve],
          [bound]: (numeric !== null && Number.isFinite(numeric)) ? numeric : null,
        },
      },
    }))
  }

  const handleLithologyColorChange = (lithologyType, color) => {
    updateViewSettings((prev) => ({
      ...prev,
      lithologyColors: {
        ...prev.lithologyColors,
        [lithologyType]: color,
      },
    }))
  }

  // Get all unique lithology types from project data
  const getLithologyTypes = () => {
    if (!projectData || !projectData.lithologyIntervals) return []
    const types = new Set()
    projectData.lithologyIntervals.forEach(interval => {
      if (interval.lithologyType) {
        types.add(interval.lithologyType)
      }
    })
    return Array.from(types).sort()
  }

  const lithologyTypes = getLithologyTypes()
  const canUndo = Boolean(projectData && history.past.length)
  const canRedo = Boolean(projectData && history.future.length)

  return (
    <div className="App">
      <header className="App-header">
        <h1>Interactive Well Log Interpretation Tool</h1>
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <ProjectManager onProjectLoad={handleProjectLoad} />
          {projectData && (
            <>
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: !canUndo ? 'not-allowed' : 'pointer',
                  opacity: !canUndo ? 0.6 : 1,
                }}
              >
                Undo
              </button>
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: !canRedo ? 'not-allowed' : 'pointer',
                  opacity: !canRedo ? 0.6 : 1,
                }}
              >
                Redo
              </button>
              <button
                onClick={handleSaveClick}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                Save Project
              </button>
              <button
                onClick={handleExportCSV}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#FF9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                Export CSV
              </button>
              <button
                onClick={handleExportPDFClick}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#9C27B0',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                Export PDF
              </button>
            </>
          )}
        </div>
      </header>

      <main className="app-main">
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

        {!projectData ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <h2>Upload LAS File</h2>
              <FileUpload
                onFileSelect={handleLASUpload}
                accept=".las"
                label="LAS file"
                disabled={loading}
              />
            </div>
            <div>
              <h2>Upload Excel File</h2>
              <FileUpload
                onFileSelect={handleExcelFileSelect}
                accept=".xlsx,.xls"
                label="Excel file"
                disabled={loading}
              />
            </div>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '20px' }}>
              {isEditingWellId ? (
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  Well:{' '}
                  <input
                    type="text"
                    value={editingWellIdValue}
                    onChange={(e) => setEditingWellIdValue(e.target.value)}
                    onBlur={() => {
                      if (editingWellIdValue.trim()) {
                        setProjectData((prev) => ({
                          ...prev,
                          wellId: editingWellIdValue.trim(),
                        }))
                      } else {
                        setEditingWellIdValue(projectData.wellId)
                      }
                      setIsEditingWellId(false)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        if (editingWellIdValue.trim()) {
                          setProjectData((prev) => ({
                            ...prev,
                            wellId: editingWellIdValue.trim(),
                          }))
                        } else {
                          setEditingWellIdValue(projectData.wellId)
                        }
                        setIsEditingWellId(false)
                      } else if (e.key === 'Escape') {
                        setEditingWellIdValue(projectData.wellId)
                        setIsEditingWellId(false)
                      }
                    }}
                    autoFocus
                    style={{
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      padding: '4px 8px',
                      border: '2px solid #2196F3',
                      borderRadius: '4px',
                      fontFamily: 'inherit',
                      minWidth: '200px',
                    }}
                  />
                </h2>
              ) : (
                <h2
                  onDoubleClick={() => {
                    setEditingWellIdValue(projectData.wellId)
                    setIsEditingWellId(true)
                  }}
                  style={{
                    cursor: 'pointer',
                    userSelect: 'none',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#f0f0f0'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'transparent'
                  }}
                  title="Double click to edit"
                >
                  Well: {projectData.wellId}
                </h2>
              )}
              <p>
                Geophysical Logs: {projectData.geophysicalLogs.length} points | 
                Lithology Intervals: {projectData.lithologyIntervals.length}
              </p>
            </div>
            <div className={`view-controls ${displayControlsOpen ? 'is-open' : 'is-closed'}`}>
              <div className="view-controls__header">
                <h3>Display Controls</h3>
                <button
                  type="button"
                  className="view-controls__toggle"
                  onClick={() => setDisplayControlsOpen(prev => !prev)}
                >
                  {displayControlsOpen ? 'Hide' : 'Show'} Controls
                </button>
              </div>
              {displayControlsOpen && (
              <>
              <div className="control-section">
                <h4>Toggle Curves</h4>
                <label>
                  <input
                    type="checkbox"
                    checked={viewSettings.show.natu}
                    onChange={() => handleToggleChange('natu')}
                  />
                  Show Natural Gamma
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={viewSettings.show.bore}
                    onChange={() => handleToggleChange('bore')}
                  />
                  Show Borehole Diameter
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={viewSettings.show.long}
                    onChange={() => handleToggleChange('long')}
                  />
                  Show Long Spacing Density
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={viewSettings.show.high}
                    onChange={() => handleToggleChange('high')}
                  />
                  Show High Resolution Density
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={viewSettings.show.lithology}
                    onChange={() => handleToggleChange('lithology')}
                  />
                  Show Lithology Blocks
                </label>
              </div>
              <div className="control-section">
                <h4>Smooth Curves</h4>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="checkbox"
                    checked={viewSettings.smooth?.natu || false}
                    onChange={() => {
                      updateViewSettings(prev => ({
                        ...prev,
                        smooth: {
                          ...prev.smooth,
                          natu: !prev.smooth?.natu,
                          natuWindow: prev.smooth?.natuWindow || 15,
                        },
                      }))
                    }}
                  />
                  <span style={{ minWidth: '150px' }}>Smooth Natural Gamma</span>
                  <span style={{ fontSize: '0.9rem', color: '#666' }}>Window:</span>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={viewSettings.smooth?.natuWindow || 15}
                    onChange={(e) => {
                      const window = Math.max(1, Math.min(50, parseInt(e.target.value) || 15))
                      updateViewSettings(prev => ({
                        ...prev,
                        smooth: {
                          ...prev.smooth,
                          natuWindow: window,
                        },
                      }))
                    }}
                    style={{ width: '60px', padding: '4px' }}
                    disabled={!viewSettings.smooth?.natu}
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={viewSettings.smooth?.density || false}
                    onChange={() => {
                      updateViewSettings(prev => ({
                        ...prev,
                        smooth: {
                          ...prev.smooth,
                          density: !prev.smooth?.density,
                          densityWindow: prev.smooth?.densityWindow || 15,
                        },
                      }))
                    }}
                  />
                  <span style={{ minWidth: '150px' }}>Smooth Density (Long & High)</span>
                  <span style={{ fontSize: '0.9rem', color: '#666' }}>Window:</span>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={viewSettings.smooth?.densityWindow || 15}
                    onChange={(e) => {
                      const window = Math.max(1, Math.min(50, parseInt(e.target.value) || 15))
                      updateViewSettings(prev => ({
                        ...prev,
                        smooth: {
                          ...prev.smooth,
                          densityWindow: window,
                        },
                      }))
                    }}
                    style={{ width: '60px', padding: '4px' }}
                    disabled={!viewSettings.smooth?.density}
                  />
                </label>
              </div>
              <div className="control-section">
                <h4>Toggle Columns</h4>
                <label>
                  <input
                    type="checkbox"
                    checked={viewSettings.show.from}
                    onChange={() => handleToggleChange('from')}
                  />
                  Show From
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={viewSettings.show.to}
                    onChange={() => handleToggleChange('to')}
                  />
                  Show To
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={viewSettings.show.thickness}
                    onChange={() => handleToggleChange('thickness')}
                  />
                  Show Thickness
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={viewSettings.show.seam}
                    onChange={() => handleToggleChange('seam')}
                  />
                  Show Seam
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={viewSettings.show.sampleNo}
                    onChange={() => handleToggleChange('sampleNo')}
                  />
                  Show Sample No
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={viewSettings.show.remark}
                    onChange={() => handleToggleChange('remark')}
                  />
                  Show Remark
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={viewSettings.show.clayColor}
                    onChange={() => handleToggleChange('clayColor')}
                  />
                  Show Clay color
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={viewSettings.show.description}
                    onChange={() => handleToggleChange('description')}
                  />
                  Show Description
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={viewSettings.show.adjustRange}
                    onChange={() => handleToggleChange('adjustRange')}
                  />
                  Show Adjust Range
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={viewSettings.showCrosshair}
                    onChange={() => {
                      updateViewSettings(prev => ({
                        ...prev,
                        showCrosshair: !prev.showCrosshair,
                      }))
                    }}
                  />
                  Show Crosshair Cursor
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={viewSettings.snapTo005 || false}
                    onChange={() => {
                      updateViewSettings(prev => ({
                        ...prev,
                        snapTo005: !prev.snapTo005,
                      }))
                    }}
                  />
                  Snap 0.05
                </label>
                <div className="control-section">
                  <h4>Grid Lines</h4>
                  <label>
                    <input
                      type="checkbox"
                      checked={viewSettings.grid?.showMajorLines ?? true}
                      onChange={() => handleGridLineToggle('showMajorLines')}
                    />
                    Show major lines (1 m, black)
                  </label>
                  <label style={{ gap: '6px' }}>
                    <span style={{ fontSize: '0.9rem', minWidth: '120px' }}>Major color:</span>
                    <input
                      type="color"
                      value={viewSettings.grid?.majorColor || '#1b5e20'}
                      onChange={(e) => handleGridColorChange('majorColor', e.target.value)}
                      style={{ width: '60px', height: '30px', padding: 0, border: 'none', background: 'none' }}
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={viewSettings.grid?.showMinorLines ?? false}
                      onChange={() => handleGridLineToggle('showMinorLines')}
                    />
                    Show minor lines (0.2 m, green)
                  </label>
                  <label style={{ gap: '6px' }}>
                    <span style={{ fontSize: '0.9rem', minWidth: '120px' }}>Minor color:</span>
                    <input
                      type="color"
                      value={viewSettings.grid?.minorColor || '#90EE90'}
                      onChange={(e) => handleGridColorChange('minorColor', e.target.value)}
                      style={{ width: '60px', height: '30px', padding: 0, border: 'none', background: 'none' }}
                    />
                  </label>
                </div>
              </div>
              <div className="control-section">
                <h4>Column Font Sizes</h4>
                {FONT_SIZE_COLUMNS.map(({ key, label }) => (
                  <label key={key} style={{ alignItems: 'center' }}>
                    <span style={{ minWidth: '120px' }}>{label}:</span>
                    <input
                      type="number"
                      min={8}
                      max={32}
                      value={viewSettings.columnFontSizes?.[key] ?? DEFAULT_COLUMN_FONT_SIZES[key] ?? 12}
                      onChange={(e) => handleFontSizeChange(key, e.target.value)}
                      style={{ width: '60px' }}
                    />
                    <span style={{ fontSize: '0.85rem', color: '#666' }}>px</span>
                  </label>
                ))}
              </div>
              <div className="control-section" style={{ gridColumn: '1 / -1' }}>
                <h4>Scale (Min / Max)</h4>
                <div className="scale-row">
                  <span>Natural Gamma (CPS):</span>
                  <input
                    type="number"
                    value={viewSettings.scales.natu.min}
                    onChange={(e) => handleScaleChange('natu', 'min', e.target.value)}
                  />
                  <input
                    type="number"
                    value={viewSettings.scales.natu.max}
                    onChange={(e) => handleScaleChange('natu', 'max', e.target.value)}
                  />
                </div>
                <div className="scale-row">
                  <span>Borehole Diameter (INCH):</span>
                  <input
                    type="number"
                    value={viewSettings.scales.bore.min}
                    onChange={(e) => handleScaleChange('bore', 'min', e.target.value)}
                  />
                  <input
                    type="number"
                    value={viewSettings.scales.bore.max}
                    onChange={(e) => handleScaleChange('bore', 'max', e.target.value)}
                  />
                </div>
                <div className="scale-row">
                  <span>Density (CPS):</span>
                  <input
                    type="number"
                    value={viewSettings.scales.density.min}
                    onChange={(e) => handleScaleChange('density', 'min', e.target.value)}
                  />
                  <input
                    type="number"
                    value={viewSettings.scales.density.max}
                    onChange={(e) => handleScaleChange('density', 'max', e.target.value)}
                  />
                </div>
                <div className="scale-row">
                  <span>Depth Scale (pixels/meter):</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={viewSettings.scales.depthRatio ?? 1}
                    onChange={(e) => {
                      const ratio = parseFloat(e.target.value) || 1
                      updateViewSettings((prev) => ({
                        ...prev,
                        scales: {
                          ...prev.scales,
                          depthRatio: Math.max(0.1, ratio),
                        },
                      }))
                    }}
                    placeholder="1"
                    style={{ width: '100px' }}
                  />
                  <span style={{ fontSize: '0.9rem', color: '#666' }}>
                    (1 meter = {viewSettings.scales.depthRatio ?? 1} pixels)
                  </span>
                </div>
              </div>
              <div className="control-section" style={{ gridColumn: '1 / -1' }}>
                <h4>Lithology Colors</h4>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                  gap: '12px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  padding: '8px',
                }}>
                  {lithologyTypes.length > 0 ? (
                    lithologyTypes.map((type) => (
                      <div key={type} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        padding: '4px',
                      }}>
                        <label style={{ 
                          minWidth: '60px', 
                          fontSize: '0.9rem',
                          fontWeight: '500',
                        }}>
                          {type}:
                        </label>
                        <input
                          type="color"
                          value={viewSettings.lithologyColors?.[type] || DEFAULT_LITHOLOGY_COLORS[type] || '#ffffff'}
                          onChange={(e) => handleLithologyColorChange(type, e.target.value)}
                          style={{
                            width: '50px',
                            height: '30px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        />
                        <input
                          type="text"
                          value={viewSettings.lithologyColors?.[type] || DEFAULT_LITHOLOGY_COLORS[type] || '#ffffff'}
                          onChange={(e) => handleLithologyColorChange(type, e.target.value)}
                          style={{
                            width: '80px',
                            padding: '4px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                          }}
                          placeholder="#ffffff"
                        />
                      </div>
                    ))
                  ) : (
                    <div style={{ color: '#666', fontSize: '0.9rem', padding: '8px' }}>
                      No lithology data available
                    </div>
                  )}
                </div>
              </div>
              <div className="control-section">
                <ColumnManager
                  viewSettings={viewSettings}
                  onUpdate={updateViewSettings}
                />
              </div>
              </>
              )}
            </div>
            <WellLogViewer
              geophysicalLogs={projectData.geophysicalLogs}
              lithologyIntervals={projectData.lithologyIntervals}
              onIntervalAdjustStart={handleIntervalAdjustStart}
              onIntervalUpdate={handleIntervalUpdate}
              onAddInterval={handleAddInterval}
              onDeleteInterval={handleDeleteInterval}
              onUpdateIntervalField={handleUpdateIntervalField}
              onRequestComment={handleRequestComment}
              onDeleteComment={handleCommentDelete}
              metadata={projectData.metadata}
              settings={{
                ...viewSettings,
                onColumnWidthChange: (colKey, newWidth) => {
                  updateViewSettings((prev) => ({
                    ...prev,
                    columnWidths: {
                      ...prev.columnWidths,
                      [colKey]: newWidth,
                    },
                  }))
                },
                onDepthRatioChange: (newRatio) => {
                  updateViewSettings((prev) => ({
                    ...prev,
                    scales: {
                      ...prev.scales,
                      depthRatio: Math.max(0.1, Math.min(500, newRatio)),
                    },
                  }))
                },
              }}
            />
          </div>
        )}

        {loading && (
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '20px',
            backgroundColor: 'rgba(0,0,0,0.8)',
            color: 'white',
            borderRadius: '8px',
            zIndex: 2000,
          }}>
            Loading...
          </div>
        )}

        {showSheetModal && pendingExcelFile && (
          <SheetSelectionModal
            file={pendingExcelFile}
            onSheetSelect={handleSheetSelect}
            onClose={handleCloseSheetModal}
          />
        )}

        {showColumnMappingModal && pendingExcelFile && selectedSheet && (
          <ColumnMappingModal
            isOpen={showColumnMappingModal}
            file={pendingExcelFile}
            sheetName={selectedSheet}
            onClose={() => setShowColumnMappingModal(false)}
            onConfirm={handleColumnMappingConfirm}
          />
        )}

        {showSaveModal && (
          <SaveProjectModal
            isOpen={showSaveModal}
            onClose={() => setShowSaveModal(false)}
            onSave={handleSaveProject}
            defaultFileName={projectData?.wellId || 'project'}
          />
        )}
        {showCommentModal && (
          <CommentModal
            isOpen={showCommentModal}
            initialValue={commentModalValue}
            onClose={handleCloseCommentModal}
            onSave={handleCommentSave}
            metadata={(() => {
              if (!commentModalIntervalId || !projectData?.lithologyIntervals) return null
              const target = projectData.lithologyIntervals.find(interval => interval.id === commentModalIntervalId)
              if (!target) return null
              const from = target.adjustedTop ?? target.top
              const to = target.adjustedBottom ?? target.bottom
              return { from, to }
            })()}
          />
        )}

        {showValidationModal && (
          <ExcelValidationModal
            isOpen={showValidationModal}
            onClose={handleValidationCancel}
            onConfirm={handleValidationConfirm}
            errors={validationErrors}
          />
        )}

        {showPDFExportModal && (
          <PDFExportModal
            isOpen={showPDFExportModal}
            onClose={() => setShowPDFExportModal(false)}
            onExport={handleExportPDFWithSettings}
            onPreview={(settings) => {
              setPdfPreviewSettings(settings)
              setShowPDFPreviewModal(true)
            }}
            defaultFileName={`${projectData?.wellId || 'welllog'}_${new Date().toISOString().split('T')[0]}`}
            wellId={projectData?.wellId}
            projectData={projectData}
          />
        )}

        {showPDFPreviewModal && pdfPreviewSettings && (
          <PDFPreviewModal
            isOpen={showPDFPreviewModal}
            onClose={() => setShowPDFPreviewModal(false)}
            onExport={handleExportPDFWithSettings}
            settings={pdfPreviewSettings}
            projectData={projectData}
            createPDFContainer={createPDFContainer}
          />
        )}
      </main>
    </div>
  )
}

export default App


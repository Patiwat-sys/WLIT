import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import * as d3 from 'd3'
import { roundToTwo } from '../utils/intervals.js'

const BASE_CHART_HEIGHT = 900 // Base height, will be scaled by depth ratio
const LEFT_TRACK_WIDTH = 240
const MIDDLE_TRACK_WIDTH = 120
const RIGHT_TRACK_WIDTH = 280
const TRACK_GAP = 30
const MARGIN = { top: 40, right: 80, bottom: 40, left: 80 }
const DEFAULT_MINOR_GRID_COLOR = '#90EE90'
const DEFAULT_MAJOR_GRID_COLOR = '#1b5e20'
const MINOR_GRID_OPACITY = 0.4
const MAJOR_GRID_OPACITY = 0.6
// INNER_WIDTH will be calculated dynamically based on visible tracks
const BASE_INNER_WIDTH = LEFT_TRACK_WIDTH + TRACK_GAP + MIDDLE_TRACK_WIDTH + TRACK_GAP + RIGHT_TRACK_WIDTH
const NATU_DOMAIN = [0, 200]
const BORE_DOMAIN = [0, 20]
const DENSITY_DOMAIN = [0, 12000]
const NATU_TICKS = [0, 50, 100, 150, 200]
const BORE_TICKS = [0, 5, 10, 15, 20]
const DENSITY_TICKS = [0, 2000, 4000, 6000, 8000, 10000, 12000]
const HANDLE_HEIGHT = 8
const COMMENT_PANEL_WIDTH = 160
const COMMENT_PANEL_GAP = 20
const COMMENT_PANEL_MIN_HEIGHT = 32

function WellLogViewer({
  geophysicalLogs,
  lithologyIntervals,
  onIntervalAdjustStart,
  onIntervalUpdate,
  onAddInterval,
  onDeleteInterval,
  onUpdateIntervalField,
  onRequestComment,
  onDeleteComment,
  settings,
  metadata,
}) {
  const svgRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragIntervalId, setDragIntervalId] = useState(null)
  const [dragType, setDragType] = useState(null)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeColumn, setResizeColumn] = useState(null)
  const [resizeStartX, setResizeStartX] = useState(null)
  const [resizeStartWidth, setResizeStartWidth] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [editingCell, setEditingCell] = useState(null) // { intervalId, field, x, y, width, height, value }
  const [previewAdjustments, setPreviewAdjustments] = useState(null)
  const dragCommitRef = useRef(null)
  const previewPendingRef = useRef(null)
  const previewRafRef = useRef(null)

  const sanitizeValue = useCallback((value) => {
    if (value === null || value === undefined) return null
    const numeric = Number(value)
    if (Number.isNaN(numeric)) return null
    if (!Number.isFinite(numeric)) return null
    if (numeric <= -99999) return null
    return numeric
  }, [])

  const sortedLogs = useMemo(() => {
    return [...geophysicalLogs]
      .filter(Boolean)
      .sort((a, b) => (a?.depth ?? 0) - (b?.depth ?? 0))
  }, [geophysicalLogs])

  // Smooth function using centered moving average (window=7, center=True, min_periods=1)
  const smoothData = useCallback((values, window = 7) => {
    if (!values || values.length === 0) return values
    
    const smoothed = []
    const halfWindow = Math.floor(window / 2)
    
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - halfWindow)
      const end = Math.min(values.length, i + halfWindow + 1)
      const windowValues = []
      
      for (let j = start; j < end; j++) {
        if (values[j] !== null && values[j] !== undefined && !isNaN(values[j])) {
          windowValues.push(values[j])
        }
      }
      
      if (windowValues.length > 0) {
        const sum = windowValues.reduce((a, b) => a + b, 0)
        smoothed.push(sum / windowValues.length)
      } else {
        smoothed.push(values[i])
      }
    }
    
    return smoothed
  }, [])

  const processedLogs = useMemo(() => {
    const source = sortedLogs.length ? sortedLogs : geophysicalLogs
    const baseLogs = source
      .filter(Boolean)
      .map(log => ({
        depth: sanitizeValue(log?.depth),
        natu: sanitizeValue(log?.natu),
        bore: sanitizeValue(log?.bore),
        long: sanitizeValue(log?.long),
        high: sanitizeValue(log?.high),
      }))
      .filter(log => log.depth !== null)
      .sort((a, b) => a.depth - b.depth)

    // Apply smoothing if enabled
    const smoothOptions = settings?.smooth || {}
    let logs = [...baseLogs]

    if (smoothOptions.natu) {
      const natuValues = baseLogs.map(log => log.natu)
      const window = smoothOptions.natuWindow || 15
      const smoothedNatu = smoothData(natuValues, window)
      logs = logs.map((log, i) => ({
        ...log,
        natu: smoothedNatu[i] !== undefined ? smoothedNatu[i] : log.natu,
      }))
    }

    if (smoothOptions.density) {
      const longValues = baseLogs.map(log => log.long)
      const highValues = baseLogs.map(log => log.high)
      const window = smoothOptions.densityWindow || 15
      const smoothedLong = smoothData(longValues, window)
      const smoothedHigh = smoothData(highValues, window)
      logs = logs.map((log, i) => ({
        ...log,
        long: smoothedLong[i] !== undefined ? smoothedLong[i] : log.long,
        high: smoothedHigh[i] !== undefined ? smoothedHigh[i] : log.high,
      }))
    }

    return logs
  }, [sortedLogs, geophysicalLogs, sanitizeValue, settings?.smooth, smoothData])

  const getAdjustRangeColor = useCallback((interval) => {
    const baseThickness = interval.adjustRangeOriginalThickness
    if (!baseThickness || baseThickness <= 0) return '#ffffff'

    const ratio = Math.min(1, Math.abs(interval.adjustRange || 0) / baseThickness)
    const targetColor = { r: 183, g: 28, b: 28 } // #b71c1c
    const r = Math.round(255 + (targetColor.r - 255) * ratio)
    const g = Math.round(255 + (targetColor.g - 255) * ratio)
    const b = Math.round(255 + (targetColor.b - 255) * ratio)
    return `rgb(${r},${g},${b})`
  }, [])

  const safeIntervals = useMemo(() => {
    const normalized = (lithologyIntervals ?? [])
      .filter(Boolean)
      .map(interval => {
        let topValue = sanitizeValue(interval?.adjustedTop ?? interval?.top)
        let bottomValue = sanitizeValue(interval?.adjustedBottom ?? interval?.bottom)
        const originTop = sanitizeValue(interval?.originTop ?? interval?.top)
        const originBottom = sanitizeValue(interval?.originBottom ?? interval?.bottom)

        const previewOverride = previewAdjustments?.[interval.id]
        if (previewOverride) {
          if (previewOverride.topValue !== undefined && previewOverride.topValue !== null) {
            topValue = previewOverride.topValue
          }
          if (previewOverride.bottomValue !== undefined && previewOverride.bottomValue !== null) {
            bottomValue = previewOverride.bottomValue
          }
        }

        const currentThickness = bottomValue !== null && topValue !== null
          ? Math.max(0, bottomValue - topValue)
          : 0
        const originalThickness = originBottom !== null && originTop !== null
          ? Math.max(0, originBottom - originTop)
          : 0

        return {
          ...interval,
          topValue,
          bottomValue,
          originTop,
          originBottom,
          currentThickness,
          originalThickness,
          adjustGroupId: interval.adjustGroupId || interval.id,
        }
      })

    const groupInfo = new Map()
    normalized.forEach((interval, index) => {
      const gid = interval.adjustGroupId
      if (!groupInfo.has(gid)) {
        groupInfo.set(gid, {
          indexes: [],
          originalThickness: interval.originalThickness,
          currentThickness: 0,
        })
      }
      const info = groupInfo.get(gid)
      info.indexes.push(index)
      info.currentThickness = roundToTwo((info.currentThickness || 0) + interval.currentThickness)
      // ensure original thickness stored from group root
      if (interval.originTop !== null && interval.originBottom !== null) {
        const groupOriginal = interval.originBottom - interval.originTop
        if (Number.isFinite(groupOriginal) && groupOriginal >= 0) {
          info.originalThickness = groupOriginal
        }
      }
    })

    return normalized.map((interval, index) => {
      const info = groupInfo.get(interval.adjustGroupId) || { indexes: [index], originalThickness: interval.originalThickness, currentThickness: interval.currentThickness }
      const firstIndex = info.indexes[0]
      const lastIndex = info.indexes[info.indexes.length - 1]
      const primaryInterval = normalized[firstIndex] || interval
      const lastInterval = normalized[lastIndex] || interval

      let adjustRange = interval.adjustRange ?? 0
      let adjustRangeColor = interval.adjustRangeColor || '#ffffff'
      if (!isDragging || previewAdjustments === null) {
        adjustRange = roundToTwo((info.currentThickness ?? 0) - (info.originalThickness ?? 0))
        adjustRangeColor = getAdjustRangeColor({
          adjustRange,
          adjustRangeOriginalThickness: info.originalThickness,
        })
      }

      return {
        ...interval,
        adjustRange,
        adjustRangePrimary: index === firstIndex,
        adjustRangeIsLast: index === lastIndex,
        adjustRangeTopValue: primaryInterval.topValue ?? primaryInterval.bottomValue ?? interval.topValue,
        adjustRangeBottomValue: lastInterval.bottomValue ?? lastInterval.topValue ?? interval.bottomValue,
        adjustRangeOriginalThickness: info.originalThickness,
        adjustRangeColor,
      }
    })
  }, [lithologyIntervals, sanitizeValue, getAdjustRangeColor, previewAdjustments, isDragging])

  const showOptions = settings?.show ?? {}
  const scaleOptions = settings?.scales ?? {}

  const computeDomain = useCallback((configKey, dataKeys, fallback) => {
    const overrideMin = sanitizeValue(scaleOptions?.[configKey]?.min)
    const overrideMax = sanitizeValue(scaleOptions?.[configKey]?.max)
    if (overrideMin !== null && overrideMax !== null && overrideMax > overrideMin) {
      return [overrideMin, overrideMax]
    }

    const values = []
    processedLogs.forEach(log => {
      dataKeys.forEach(key => {
        const value = log[key]
        if (value !== null && typeof value === 'number') {
          values.push(value)
        }
      })
    })

    if (values.length) {
      let min = Math.min(...values)
      let max = Math.max(...values)
      if (min === max) {
        const pad = min === 0 ? 1 : Math.abs(min) * 0.05
        min -= pad
        max += pad
      }
      return [min, max]
    }

    return fallback
  }, [processedLogs, scaleOptions, sanitizeValue])

  const natuDomain = useMemo(
    () => computeDomain('natu', ['natu'], NATU_DOMAIN),
    [computeDomain],
  )

  const boreDomain = useMemo(
    () => computeDomain('bore', ['bore'], BORE_DOMAIN),
    [computeDomain],
  )

  const densityDomain = useMemo(
    () => computeDomain('density', ['long', 'high'], DENSITY_DOMAIN),
    [computeDomain],
  )

  const natuTicks = useMemo(() => d3.ticks(natuDomain[0], natuDomain[1], NATU_TICKS.length - 1), [natuDomain])
  const boreTicks = useMemo(() => d3.ticks(boreDomain[0], boreDomain[1], BORE_TICKS.length - 1), [boreDomain])
  const densityTicks = useMemo(() => d3.ticks(densityDomain[0], densityDomain[1], DENSITY_TICKS.length - 1), [densityDomain])

  const getLithologyColor = (type) => {
    // Use colors from settings if available, otherwise use default
    if (settings?.lithologyColors && settings.lithologyColors[type]) {
      return settings.lithologyColors[type]
    }
    
    // Default colors fallback
    const defaultColors = {
      LI: '#2b2727',
      CLLI: '#c34141',
      LICL: '#e7eb24',
      CBCL: '#41fbb4',
    }
    return defaultColors[type] || '#ffffff' // White for other lithology types
  }

  const columnFontSizes = settings?.columnFontSizes || {}
  const getColumnFontSize = (key, fallback = 12) => {
    const value = columnFontSizes[key]
    return typeof value === 'number' ? value : fallback
  }


  const getDepthRange = () => {
    // Always calculate from actual data to show all data in the well
    const depths = geophysicalLogs
      .map(log => sanitizeValue(log.depth))
      .filter(value => value !== null)

    const lithologyDepths = safeIntervals.flatMap(interval => [
      sanitizeValue(interval.topValue),
      sanitizeValue(interval.bottomValue),
    ]).filter(value => value !== null)

    const allDepths = [...depths, ...lithologyDepths]
    if (allDepths.length === 0) return [0, 100]

    const dataMin = Math.min(...allDepths)
    const dataMax = Math.max(...allDepths)

    if (settings?.depthRange) {
      return settings.depthRange
    }

    return [dataMin, dataMax]
  }

  const [minDepth, maxDepth] = getDepthRange()
  
  // Calculate chart height based on depth range and ratio
  const depthRatio = settings?.scales?.depthRatio ?? 1
  const depthRange = maxDepth - minDepth
  const calculatedChartHeight = Math.max(BASE_CHART_HEIGHT, depthRange * depthRatio)

  const startDrag = useCallback((intervalId, handle) => {
    setIsDragging(true)
    setDragIntervalId(intervalId)
    setDragType(handle)
    dragCommitRef.current = null
    setPreviewAdjustments(null)
    previewPendingRef.current = null
    if (previewRafRef.current) {
      cancelAnimationFrame(previewRafRef.current)
      previewRafRef.current = null
    }
    if (typeof onIntervalAdjustStart === 'function') {
      onIntervalAdjustStart(intervalId)
    }
  }, [onIntervalAdjustStart])

  const stopDrag = useCallback(() => {
    setIsDragging(false)
    setDragIntervalId(null)
    setDragType(null)
  }, [])

  const startResize = useCallback((colKey, startX, currentWidth) => {
    setIsResizing(true)
    setResizeColumn(colKey)
    setResizeStartX(startX)
    setResizeStartWidth(currentWidth)
  }, [])

  const stopResize = useCallback(() => {
    setIsResizing(false)
    setResizeColumn(null)
    setResizeStartX(null)
    setResizeStartWidth(null)
  }, [])

  const pointerToDepth = useCallback((clientY) => {
    const bounds = svgRef.current?.getBoundingClientRect()
    if (!bounds) return null
    const y = clientY - bounds.top - MARGIN.top
    if (Number.isNaN(y)) return null
    
    // Get current chart height from settings
    const depthRatio = settings?.scales?.depthRatio ?? 1
    const depthRange = maxDepth - minDepth
    const currentChartHeight = Math.max(BASE_CHART_HEIGHT, depthRange * depthRatio)
    
    const clamped = Math.max(0, Math.min(currentChartHeight, y))
    if (maxDepth === minDepth) return minDepth
    const ratio = clamped / currentChartHeight
    return minDepth + ratio * (maxDepth - minDepth)
  }, [minDepth, maxDepth, settings])

  useEffect(() => {
    if (!isDragging && !isResizing) return

    const handleMouseMove = (event) => {
      if (isResizing && resizeColumn && resizeStartX !== null && resizeStartWidth !== null) {
        const bounds = svgRef.current?.getBoundingClientRect()
        if (!bounds) return
        const currentX = event.clientX - bounds.left - MARGIN.left
        const deltaX = currentX - resizeStartX
        const newWidth = Math.max(50, Math.min(500, resizeStartWidth + deltaX))
        
        // Update column width through settings callback
        if (settings?.onColumnWidthChange) {
          settings.onColumnWidthChange(resizeColumn, newWidth)
        }
        return
      }

      if (isDragging) {
        let depth = pointerToDepth(event.clientY)
        if (depth === null || !dragIntervalId || !dragType) return

        // Apply snap to 0.05 if enabled
        if (settings?.snapTo005) {
          depth = Math.round(depth * 20) / 20 // Round to nearest 0.05
        }

        const intervalIndex = safeIntervals.findIndex(i => i.id === dragIntervalId)
        if (intervalIndex === -1) return
        const interval = safeIntervals[intervalIndex]
        const prevInterval = intervalIndex > 0 ? safeIntervals[intervalIndex - 1] : null
        const nextInterval = intervalIndex < safeIntervals.length - 1 ? safeIntervals[intervalIndex + 1] : null

        const currentTop = sanitizeValue(interval.topValue ?? interval.adjustedTop ?? interval.top) ?? minDepth
        const currentBottom = sanitizeValue(interval.bottomValue ?? interval.adjustedBottom ?? interval.bottom) ?? maxDepth

        let nextTop = currentTop
        let nextBottom = currentBottom
        const preview = {}

        if (dragType === 'top') {
          const newTop = Math.max(minDepth, Math.min(depth, currentBottom - 0.1))
          nextTop = newTop
          preview[dragIntervalId] = {
            topValue: newTop,
            bottomValue: currentBottom,
          }
          if (prevInterval) {
            preview[prevInterval.id] = {
              bottomValue: newTop,
            }
          }
        } else if (dragType === 'bottom') {
          const newBottom = Math.min(maxDepth, Math.max(depth, currentTop + 0.1))
          nextBottom = newBottom
          preview[dragIntervalId] = {
            topValue: currentTop,
            bottomValue: newBottom,
          }
          if (nextInterval) {
            preview[nextInterval.id] = {
              topValue: newBottom,
            }
          }
        }

        if (Object.keys(preview).length) {
          previewPendingRef.current = preview
          if (!previewRafRef.current) {
            previewRafRef.current = requestAnimationFrame(() => {
              setPreviewAdjustments(previewPendingRef.current)
              previewRafRef.current = null
            })
          }
        }

        dragCommitRef.current = {
          intervalId: dragIntervalId,
          top: nextTop,
          bottom: nextBottom,
        }
      }
    }

    const handleMouseUp = () => {
      if (isDragging) {
        if (dragCommitRef.current && typeof onIntervalUpdate === 'function') {
          const { intervalId, top, bottom } = dragCommitRef.current
          onIntervalUpdate(intervalId, top, bottom)
        }
        dragCommitRef.current = null
        setPreviewAdjustments(null)
        previewPendingRef.current = null
        if (previewRafRef.current) {
          cancelAnimationFrame(previewRafRef.current)
          previewRafRef.current = null
        }
        stopDrag()
      }
      if (isResizing) stopResize()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      if (previewRafRef.current) {
        cancelAnimationFrame(previewRafRef.current)
        previewRafRef.current = null
      }
    }
  }, [isDragging, isResizing, dragIntervalId, dragType, resizeColumn, resizeStartX, resizeStartWidth, pointerToDepth, safeIntervals, onIntervalUpdate, stopDrag, stopResize, minDepth, maxDepth, settings, startResize])

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contextMenu && !event.target.closest('[data-context-menu]')) {
        setContextMenu(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [contextMenu])

  useEffect(() => {
    if (!svgRef.current) return

    const logs = processedLogs
    const intervals = safeIntervals
      .map(interval => ({
        ...interval,
        topValue: sanitizeValue(interval.topValue),
        bottomValue: sanitizeValue(interval.bottomValue),
      }))
      .filter(interval => interval.topValue !== null && interval.bottomValue !== null)

    // Calculate dynamic width based on visible tracks and column widths
    const columnWidths = settings?.columnWidths || {}
    const columnOrder = settings?.columnOrder || ['naturalGamma', 'lithology', 'density', 'seam', 'sampleNo', 'remark', 'clayColor', 'description']
    const gapSettings = settings?.columnGaps || { enabled: false, size: 30 }
    const gapSize = gapSettings.enabled ? gapSettings.size : 0
    
    let innerWidth = 0
    let currentOffset = 0
    
    // Calculate width for visible columns in order
    columnOrder.forEach((colKey, index) => {
      if (showOptions[colKey] !== false) {
        const width = columnWidths[colKey] || 120
        innerWidth += width
        if (index < columnOrder.length - 1) {
          innerWidth += gapSize
        }
      }
    })
    
    const commentAreaWidth = COMMENT_PANEL_WIDTH + COMMENT_PANEL_GAP
    const totalWidth = innerWidth + commentAreaWidth + MARGIN.left + MARGIN.right
    const chartHeight = calculatedChartHeight
    const totalHeight = chartHeight + MARGIN.top + MARGIN.bottom

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', totalWidth).attr('height', totalHeight)

    const root = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    const depthScale = d3.scaleLinear().domain([minDepth, maxDepth]).range([0, chartHeight])
    const gridOptions = settings?.grid || {}
    const showMajorLines = gridOptions.showMajorLines !== false
    const showMinorLines = !!gridOptions.showMinorLines
    const majorGridColor = gridOptions.majorColor || DEFAULT_MAJOR_GRID_COLOR
    const minorGridColor = gridOptions.minorColor || DEFAULT_MINOR_GRID_COLOR
    
    // Get widths from settings
    const naturalGammaWidth = columnWidths.naturalGamma || LEFT_TRACK_WIDTH
    const densityWidth = columnWidths.density || RIGHT_TRACK_WIDTH
    
    const leftScale = d3.scaleLinear().domain(natuDomain).range([0, naturalGammaWidth]).clamp(true)
    const boreScale = d3.scaleLinear().domain(boreDomain).range([0, naturalGammaWidth]).clamp(true)
    const rightScale = d3.scaleLinear().domain(densityDomain).range([0, densityWidth]).clamp(true)

    // Define context menu handlers
    const handleContextMenuBackground = (event) => {
      event.preventDefault()
      event.stopPropagation()
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        intervalId: null, // No interval for background context menu
      })
    }

    // Add background rect for context menu on empty space
    root.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerWidth)
      .attr('height', chartHeight)
      .attr('fill', 'transparent')
      .style('pointer-events', 'all')
      .on('contextmenu', handleContextMenuBackground)

    const depthTicks = d3.range(Math.ceil(minDepth), Math.floor(maxDepth) + 1, 1)

    const gridLayer = root.append('g').attr('class', 'grid-layer')

    if (showMinorLines) {
      const minorStep = 0.2
      const start = Math.floor(minDepth / minorStep) * minorStep
      const end = Math.ceil(maxDepth / minorStep) * minorStep
      const minorTicks = []
      for (let d = start; d <= end + 1e-6; d += minorStep) {
        const rounded = Math.round(d * 1000) / 1000
        if (Math.abs(rounded % 1) < 1e-6) continue // skip integer ticks (major lines)
        minorTicks.push(rounded)
      }
      gridLayer.append('g')
        .selectAll('line.depth-grid-minor')
        .data(minorTicks)
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', d => depthScale(d))
        .attr('y2', d => depthScale(d))
        .attr('stroke', minorGridColor)
        .attr('stroke-width', 0.5)
        .attr('stroke-opacity', MINOR_GRID_OPACITY)
        .style('pointer-events', 'none')
    }

    if (showMajorLines) {
      gridLayer.append('g')
        .selectAll('line.depth-grid-major')
        .data(depthTicks)
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', d => depthScale(d))
        .attr('y2', d => depthScale(d))
        .attr('stroke', majorGridColor)
        .attr('stroke-width', 1)
        .attr('stroke-opacity', MAJOR_GRID_OPACITY)
        .style('pointer-events', 'none')
    }

    // Column configuration mapping
    const columnConfig = {
      naturalGamma: { 
        name: 'Natural Gamma (CPS)', 
        type: 'naturalGamma',
        width: naturalGammaWidth,
        create: (group, width, offset) => {
          group.append('rect')
            .attr('width', width)
            .attr('height', chartHeight)
            .attr('fill', '#fff')
            .attr('stroke', '#222')
            .attr('stroke-width', 1)
            .style('pointer-events', 'none')

          group.append('g')
            .attr('class', 'axis axis-top')
            .call(d3.axisTop(leftScale).tickValues(natuTicks))
            .call(g => g.selectAll('text').style('font-size', '11px'))
          group.append('text')
            .attr('x', width / 2)
            .attr('y', -24)
            .attr('text-anchor', 'middle')
            .attr('font-size', 12)
            .text('Natural Gamma (CPS)')
            .style('pointer-events', 'none')

          group.append('g')
            .attr('class', 'axis axis-bottom')
            .attr('transform', `translate(0,${chartHeight})`)
            .call(d3.axisBottom(boreScale).tickValues(boreTicks))
            .call(g => g.selectAll('text').style('font-size', '11px'))
          group.append('text')
            .attr('x', width / 2)
            .attr('y', chartHeight + 28)
            .attr('text-anchor', 'middle')
            .attr('font-size', 12)
            .attr('fill', '#c62828')
            .text('Borehole Diameter (INCH)')
            .style('pointer-events', 'none')

          const leftLine = d3.line()
            .defined(d => d.value !== null && !isNaN(d.value))
            .x(d => leftScale(d.value))
            .y(d => depthScale(d.depth))

          if (showOptions.natu !== false) {
            const natuSeries = logs.map(log => ({
              depth: log.depth,
              value: log.natu,
            }))
            group.append('path')
              .datum(natuSeries)
              .attr('fill', 'none')
              .attr('stroke', '#111')
              .attr('stroke-width', 1.5)
              .attr('d', leftLine)
              .style('pointer-events', 'none')
          }

          if (showOptions.bore !== false) {
            const boreSeries = logs.map(log => ({
              depth: log.depth,
              value: log.bore,
            }))
            const boreLine = d3.line()
              .defined(d => d.value !== null && !isNaN(d.value))
              .x(d => boreScale(d.value))
              .y(d => depthScale(d.depth))
            group.append('path')
              .datum(boreSeries)
              .attr('fill', 'none')
              .attr('stroke', '#d62828')
              .attr('stroke-width', 1.5)
              .attr('d', boreLine)
              .style('pointer-events', 'none')
          }

          // Add horizontal divider lines and drag handles for intervals
          const intervalLines = group.selectAll('.interval-line')
            .data(intervals, d => d.id)
            .enter()
            .append('g')
            .attr('class', 'interval-line')

          // Top boundary lines
          intervalLines.append('line')
            .attr('x1', 0)
            .attr('x2', width)
            .attr('y1', d => depthScale(d.topValue))
            .attr('y2', d => depthScale(d.topValue))
            .attr('stroke', '#666')
            .attr('stroke-width', 1)
            .style('pointer-events', 'none')

          // Bottom boundary lines
          intervalLines.append('line')
            .attr('x1', 0)
            .attr('x2', width)
            .attr('y1', d => depthScale(d.bottomValue))
            .attr('y2', d => depthScale(d.bottomValue))
            .attr('stroke', '#666')
            .attr('stroke-width', 1)
            .style('pointer-events', 'none')

          // Top drag handles
          intervalLines.append('rect')
            .attr('x', 0)
            .attr('width', width)
            .attr('y', d => depthScale(d.topValue) - HANDLE_HEIGHT / 2)
            .attr('height', HANDLE_HEIGHT)
            .attr('fill', 'transparent')
            .style('cursor', 'ns-resize')
            .on('mousedown', (event, d) => {
              event.preventDefault()
              startDrag(d.id, 'top')
            })

          // Bottom drag handles
          intervalLines.append('rect')
            .attr('x', 0)
            .attr('width', width)
            .attr('y', d => depthScale(d.bottomValue) - HANDLE_HEIGHT / 2)
            .attr('height', HANDLE_HEIGHT)
            .attr('fill', 'transparent')
            .style('cursor', 'ns-resize')
            .on('mousedown', (event, d) => {
              event.preventDefault()
              startDrag(d.id, 'bottom')
            })

          // Add right-click handler overlay for context menu
          intervalLines.append('rect')
            .attr('x', 0)
            .attr('width', width)
            .attr('y', d => depthScale(d.topValue))
            .attr('height', d => depthScale(d.bottomValue) - depthScale(d.topValue))
            .attr('fill', 'transparent')
            .style('pointer-events', 'all')
            .style('cursor', 'default')
            .on('contextmenu', handleContextMenu)
        }
      },
      density: {
        name: 'Density (CPS)',
        type: 'density',
        width: densityWidth,
        create: (group, width, offset) => {
          group.append('rect')
            .attr('width', width)
            .attr('height', chartHeight)
            .attr('fill', '#fff')
            .attr('stroke', '#222')
            .attr('stroke-width', 1)
            .style('pointer-events', 'none')

          group.append('g')
            .attr('class', 'axis axis-top')
            .call(d3.axisTop(rightScale).tickValues(densityTicks))
            .call(g => g.selectAll('text').style('font-size', '11px'))
            .style('pointer-events', 'none')
          group.append('text')
            .attr('x', width / 2)
            .attr('y', -24)
            .attr('text-anchor', 'middle')
            .attr('font-size', 12)
            .text('Density (CPS)')
            .style('pointer-events', 'none')

          const densityLine = d3.line()
            .defined(d => d.value !== null && !isNaN(d.value))
            .x(d => rightScale(d.value))
            .y(d => depthScale(d.depth))

          if (showOptions.long !== false) {
            const longSeries = logs.map(log => ({
              depth: log.depth,
              value: log.long,
            }))
            group.append('path')
              .datum(longSeries)
              .attr('fill', 'none')
              .attr('stroke', '#0d47a1')
              .attr('stroke-width', 1.5)
              .attr('d', densityLine)
              .style('pointer-events', 'none')
          }

          if (showOptions.high !== false) {
            const highSeries = logs.map(log => ({
              depth: log.depth,
              value: log.high,
            }))
            group.append('path')
              .datum(highSeries)
              .attr('fill', 'none')
              .attr('stroke', '#111')
              .attr('stroke-width', 1.5)
              .attr('d', densityLine)
              .style('pointer-events', 'none')
          }

          // Add horizontal divider lines and drag handles for intervals
          const intervalLines = group.selectAll('.interval-line')
            .data(intervals, d => d.id)
            .enter()
            .append('g')
            .attr('class', 'interval-line')

          // Top boundary lines
          intervalLines.append('line')
            .attr('x1', 0)
            .attr('x2', width)
            .attr('y1', d => depthScale(d.topValue))
            .attr('y2', d => depthScale(d.topValue))
            .attr('stroke', '#666')
            .attr('stroke-width', 1)
            .style('pointer-events', 'none')

          // Bottom boundary lines
          intervalLines.append('line')
            .attr('x1', 0)
            .attr('x2', width)
            .attr('y1', d => depthScale(d.bottomValue))
            .attr('y2', d => depthScale(d.bottomValue))
            .attr('stroke', '#666')
            .attr('stroke-width', 1)
            .style('pointer-events', 'none')

          // Top drag handles
          intervalLines.append('rect')
            .attr('x', 0)
            .attr('width', width)
            .attr('y', d => depthScale(d.topValue) - HANDLE_HEIGHT / 2)
            .attr('height', HANDLE_HEIGHT)
            .attr('fill', 'transparent')
            .style('cursor', 'ns-resize')
            .on('mousedown', (event, d) => {
              event.preventDefault()
              startDrag(d.id, 'top')
            })

          // Bottom drag handles
          intervalLines.append('rect')
            .attr('x', 0)
            .attr('width', width)
            .attr('y', d => depthScale(d.bottomValue) - HANDLE_HEIGHT / 2)
            .attr('height', HANDLE_HEIGHT)
            .attr('fill', 'transparent')
            .style('cursor', 'ns-resize')
            .on('mousedown', (event, d) => {
              event.preventDefault()
              startDrag(d.id, 'bottom')
            })

          // Add right-click handler overlay for context menu
          intervalLines.append('rect')
            .attr('x', 0)
            .attr('width', width)
            .attr('y', d => depthScale(d.topValue))
            .attr('height', d => depthScale(d.bottomValue) - depthScale(d.topValue))
            .attr('fill', 'transparent')
            .style('pointer-events', 'all')
            .style('cursor', 'default')
            .on('contextmenu', handleContextMenu)
        }
      },
      lithology: { name: 'Lithology', fieldKey: 'lithologyType', isLithology: true },
      from: { name: 'From', fieldKey: 'top', isNumeric: true },
      to: { name: 'To', fieldKey: 'bottom', isNumeric: true },
      thickness: { name: 'Thickness', fieldKey: 'thickness', isNumeric: true },
      seam: { name: 'Seam', fieldKey: 'Seam' },
      sampleNo: { name: 'Sample No', fieldKey: 'SampleNo' },
      remark: { name: 'Remark', fieldKey: 'Remark' },
      clayColor: { name: 'Clay color', fieldKey: 'ClayColor' },
      description: { name: 'Description', fieldKey: 'Description' },
      adjustRange: {
        name: 'Adjust Range',
        fieldKey: 'adjustRange',
        isNumeric: true,
        showSign: true,
        getNumericValue: (interval) => interval.adjustRange,
      },
    }

    const depthAxis = d3.axisLeft(depthScale)
      .tickValues(depthTicks)
    root.append('g')
      .attr('transform', 'translate(-40,0)')
      .call(depthAxis)
      .call(g => g.selectAll('text').style('font-size', '11px'))
    root.append('text')
      .attr('transform', `translate(-70,${chartHeight / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle')
      .text('Depth (m)')

    // Add remaining column configs
    columnConfig.lithology = { name: 'Lithology', fieldKey: 'lithologyType', isLithology: true }
    columnConfig.seam = { name: 'Seam', fieldKey: 'Seam' }
    columnConfig.sampleNo = { name: 'Sample No', fieldKey: 'SampleNo' }
    columnConfig.remark = { name: 'Remark', fieldKey: 'Remark' }
    columnConfig.clayColor = { name: 'Clay color', fieldKey: 'ClayColor' }
    columnConfig.description = { name: 'Description', fieldKey: 'Description' }
    columnConfig.adjustRange = {
      name: 'Adjust Range',
      fieldKey: 'adjustRange',
      isNumeric: true,
      showSign: true,
      getNumericValue: (interval) => interval.adjustRange,
    }

    const handleContextMenu = (event, datum) => {
      if (!onAddInterval) return
      event.preventDefault()
      event.stopPropagation()
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        intervalId: datum.id,
      })
    }

    // Helper function to create any column
    const createColumn = (colKey, config, offset, showOption, width) => {
      if (showOption === false) return offset
      
      const colGroup = root.append('g').attr('transform', `translate(${offset},0)`)
      const columnDataFontSize = getColumnFontSize(colKey, config.isLithology ? 12 : 11)
      
      // Create column based on type
      if (config.create) {
        // Special columns (Natural Gamma, Density)
        config.create(colGroup, width, offset)
      } else if (config.isLithology) {
        // Lithology column
        colGroup.append('rect')
          .attr('width', width)
          .attr('height', chartHeight)
          .attr('fill', '#fff')
          .attr('stroke', '#222')
          .attr('stroke-width', 1)
          .style('pointer-events', 'none')
        
        colGroup.append('text')
          .attr('x', width / 2)
          .attr('y', -24)
          .attr('text-anchor', 'middle')
          .attr('font-size', 12)
          .text(config.name)
          .style('pointer-events', 'none')

        const lithGroups = colGroup.selectAll('.lith-interval')
          .data(intervals, d => d.id)
          .enter()
          .append('g')
          .attr('class', 'lith-interval')

        lithGroups.append('rect')
          .attr('x', 0)
          .attr('width', width)
          .attr('y', d => depthScale(d.topValue))
          .attr('height', d => depthScale(d.bottomValue) - depthScale(d.topValue))
          .attr('fill', d => getLithologyColor(d.lithologyType))
          .attr('stroke', '#222')
          .attr('stroke-width', 1)
          .on('contextmenu', handleContextMenu)
          .on('dblclick', (event, d) => {
            event.preventDefault()
            event.stopPropagation()
            const bounds = svgRef.current?.getBoundingClientRect()
            if (bounds && onUpdateIntervalField) {
              const topY = depthScale(d.topValue)
              const bottomY = depthScale(d.bottomValue)
              const centerY = (topY + bottomY) / 2
              setEditingCell({
                intervalId: d.id,
                field: 'lithologyType',
                x: bounds.left + MARGIN.left + offset,
                y: bounds.top + MARGIN.top + centerY,
                width: width,
                height: bottomY - topY,
                value: d.lithologyType || '',
              })
            }
          })

        // Add horizontal divider lines at top and bottom of each interval
        lithGroups.append('line')
          .attr('x1', 0)
          .attr('x2', width)
          .attr('y1', d => depthScale(d.topValue))
          .attr('y2', d => depthScale(d.topValue))
          .attr('stroke', '#666')
          .attr('stroke-width', 1)
          .style('pointer-events', 'none')

        lithGroups.append('line')
          .attr('x1', 0)
          .attr('x2', width)
          .attr('y1', d => depthScale(d.bottomValue))
          .attr('y2', d => depthScale(d.bottomValue))
          .attr('stroke', '#666')
          .attr('stroke-width', 1)
          .style('pointer-events', 'none')

        lithGroups.append('text')
          .attr('x', width / 2)
          .attr('y', d => {
            const topY = depthScale(d.topValue)
            const bottomY = depthScale(d.bottomValue)
            return (topY + bottomY) / 2
          })
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', `${columnDataFontSize}px`)
          .attr('font-weight', 'bold')
          .attr('fill', d => {
            const bgColor = getLithologyColor(d.lithologyType)
            const isDark = bgColor === '#2b2727' || bgColor === '#c34141' || bgColor === '#000000'
            return isDark ? '#ffffff' : '#000000'
          })
          .text(d => d.lithologyType || '')
          .style('cursor', 'text')
          .on('contextmenu', handleContextMenu)
          .style('cursor', 'text')
          .on('dblclick', (event, d) => {
            event.preventDefault()
            event.stopPropagation()
            const bounds = svgRef.current?.getBoundingClientRect()
            if (bounds && onUpdateIntervalField) {
              const topY = depthScale(d.topValue)
              const bottomY = depthScale(d.bottomValue)
              const centerY = (topY + bottomY) / 2
              setEditingCell({
                intervalId: d.id,
                field: 'lithologyType',
                x: bounds.left + MARGIN.left + offset,
                y: bounds.top + MARGIN.top + centerY,
                width: width,
                height: bottomY - topY,
                value: d.lithologyType || '',
              })
            }
          })

        // Add drag handles for lithology intervals
        lithGroups.append('rect')
          .attr('x', 0)
          .attr('width', width)
          .attr('y', d => depthScale(d.topValue) - HANDLE_HEIGHT / 2)
          .attr('height', HANDLE_HEIGHT)
          .attr('fill', 'transparent')
          .style('cursor', 'ns-resize')
          .on('mousedown', (event, d) => {
            event.preventDefault()
            startDrag(d.id, 'top')
          })

        lithGroups.append('rect')
          .attr('x', 0)
          .attr('width', width)
          .attr('y', d => depthScale(d.bottomValue) - HANDLE_HEIGHT / 2)
          .attr('height', HANDLE_HEIGHT)
          .attr('fill', 'transparent')
          .style('cursor', 'ns-resize')
          .on('mousedown', (event, d) => {
            event.preventDefault()
            startDrag(d.id, 'bottom')
          })
      } else {
        // Text columns
        colGroup.append('rect')
          .attr('width', width)
          .attr('height', chartHeight)
          .attr('fill', '#fff')
          .attr('stroke', '#222')
          .attr('stroke-width', 1)
          .style('pointer-events', 'none')
        
        colGroup.append('text')
          .attr('x', width / 2)
          .attr('y', -24)
          .attr('text-anchor', 'middle')
          .attr('font-size', 12)
          .text(config.name)
          .style('pointer-events', 'none')

        const textGroups = colGroup.selectAll('.text-interval')
          .data(intervals, d => d.id)
          .enter()
          .append('g')
          .attr('class', 'text-interval')

        // Add right-click and double-click handler for context menu and editing
        textGroups.append('rect')
          .attr('x', 0)
          .attr('width', width)
          .attr('y', d => depthScale(d.topValue))
          .attr('height', d => depthScale(d.bottomValue) - depthScale(d.topValue))
          .attr('fill', 'transparent')
          .style('pointer-events', 'all')
          .on('contextmenu', handleContextMenu)
          .on('dblclick', (event, d) => {
            // Skip numeric fields (from, to, thickness) - they are read-only
            if (config.isNumeric) return
            
            event.preventDefault()
            event.stopPropagation()
            const bounds = svgRef.current?.getBoundingClientRect()
            if (bounds && onUpdateIntervalField) {
              const topY = depthScale(d.topValue)
              const bottomY = depthScale(d.bottomValue)
              const centerY = (topY + bottomY) / 2
              
              // Get current value
              let currentValue = ''
              if (d.additionalFields && d.additionalFields[config.fieldKey]) {
                currentValue = String(d.additionalFields[config.fieldKey] || '')
              } else if (d[config.fieldKey]) {
                currentValue = String(d[config.fieldKey] || '')
              } else if (config.fieldKey === 'Seam' && d.splitedSeam) {
                currentValue = String(d.splitedSeam || '')
              }
              
              // Determine field name for update
              let fieldName = config.fieldKey
              if (fieldName === 'Seam') {
                fieldName = 'splitedSeam'
              }
              
              setEditingCell({
                intervalId: d.id,
                field: fieldName,
                x: bounds.left + MARGIN.left + offset,
                y: bounds.top + MARGIN.top + centerY,
                width: width,
                height: bottomY - topY,
                value: currentValue,
              })
            }
          })

        // Add horizontal divider lines at top and bottom of each interval
        const topLine = textGroups.append('line')
          .attr('x1', 0)
          .attr('x2', width)
          .attr('y1', d => depthScale(d.topValue))
          .attr('y2', d => depthScale(d.topValue))
          .attr('stroke', '#666')
          .attr('stroke-width', 1)
          .style('pointer-events', 'none')

        const bottomLine = textGroups.append('line')
          .attr('x1', 0)
          .attr('x2', width)
          .attr('y1', d => depthScale(d.bottomValue))
          .attr('y2', d => depthScale(d.bottomValue))
          .attr('stroke', '#666')
          .attr('stroke-width', 1)
          .style('pointer-events', 'none')

        if (config.fieldKey === 'adjustRange') {
          topLine.attr('opacity', d => (d.adjustRangePrimary ? 1 : 0))
          bottomLine.attr('opacity', d => (d.adjustRangeIsLast ? 1 : 0))
        }

        let adjustBackground
        if (config.fieldKey === 'adjustRange') {
          adjustBackground = textGroups.append('rect')
            .attr('x', 0)
            .attr('width', width)
            .attr('y', d => {
              if (d.adjustRangePrimary) {
                const top = d.adjustRangeTopValue ?? d.topValue
                return depthScale(top)
              }
              return depthScale(d.topValue)
            })
            .attr('height', d => {
              if (d.adjustRangePrimary) {
                const top = d.adjustRangeTopValue ?? d.topValue
                const bottom = d.adjustRangeBottomValue ?? d.bottomValue
                return Math.max(1, depthScale(bottom) - depthScale(top))
              }
              return Math.max(1, depthScale(d.bottomValue) - depthScale(d.topValue))
            })
            .attr('fill', d => (d.adjustRangePrimary ? (d.adjustRangeColor || '#ffffff') : 'transparent'))
            .attr('opacity', d => (d.adjustRangePrimary ? 0.85 : 0))
            .style('pointer-events', 'none')
        }

        // Add drag handles for top boundary
        textGroups.append('rect')
          .attr('x', 0)
          .attr('width', width)
          .attr('y', d => depthScale(d.topValue) - HANDLE_HEIGHT / 2)
          .attr('height', HANDLE_HEIGHT)
          .attr('fill', 'transparent')
          .style('cursor', 'ns-resize')
          .on('mousedown', (event, d) => {
            event.preventDefault()
            startDrag(d.id, 'top')
          })

        // Add drag handles for bottom boundary
        textGroups.append('rect')
          .attr('x', 0)
          .attr('width', width)
          .attr('y', d => depthScale(d.bottomValue) - HANDLE_HEIGHT / 2)
          .attr('height', HANDLE_HEIGHT)
          .attr('fill', 'transparent')
          .style('cursor', 'ns-resize')
          .on('mousedown', (event, d) => {
            event.preventDefault()
            startDrag(d.id, 'bottom')
          })

        const textElements = textGroups.append('text')
          .attr('x', width / 2)
          .attr('y', d => {
            if (config.fieldKey === 'adjustRange' && d.adjustRangePrimary) {
              const topY = depthScale(d.adjustRangeTopValue ?? d.topValue)
              const bottomY = depthScale(d.adjustRangeBottomValue ?? d.bottomValue)
              return (topY + bottomY) / 2
            }
            const topY = depthScale(d.topValue)
            const bottomY = depthScale(d.bottomValue)
            return (topY + bottomY) / 2
          })
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('font-size', `${columnDataFontSize}px`)
          .attr('fill', '#000')
          .style('cursor', 'text')
          .text(d => {
            let value = null
            // Handle numeric fields (from, to, thickness) - these are read-only
            if (config.isNumeric) {
              if (typeof config.getNumericValue === 'function') {
                value = config.getNumericValue(d)
              } else if (config.fieldKey === 'top') {
                value = d.adjustedTop !== null && d.adjustedTop !== undefined 
                  ? d.adjustedTop 
                  : (d.topValue !== null && d.topValue !== undefined ? d.topValue : d.top)
              } else if (config.fieldKey === 'bottom') {
                value = d.adjustedBottom !== null && d.adjustedBottom !== undefined 
                  ? d.adjustedBottom 
                  : (d.bottomValue !== null && d.bottomValue !== undefined ? d.bottomValue : d.bottom)
              } else if (config.fieldKey === 'thickness') {
                value = d.thickness
              }
              // Format numeric values to 2 decimal places
              if (value !== null && value !== undefined) {
                const numValue = typeof value === 'number' ? value : parseFloat(value)
                if (!isNaN(numValue)) {
                  if (config.fieldKey === 'adjustRange' && !d.adjustRangePrimary) {
                    return ''
                  }
                  const formatted = numValue.toFixed(2)
                  if (config.showSign) {
                    if (numValue === 0) return '0.00'
                    return `${numValue > 0 ? '+' : ''}${formatted}`
                  }
                  return formatted
                }
              }
              return ''
            }
            // Handle other fields
            if (d.additionalFields && d.additionalFields[config.fieldKey]) {
              value = d.additionalFields[config.fieldKey]
            } else if (d[config.fieldKey]) {
              value = d[config.fieldKey]
            } else if (config.fieldKey === 'Seam' && d.splitedSeam) {
              value = d.splitedSeam
            }
            return value ? String(value) : ''
          })
          .on('dblclick', (event, d) => {
            // Skip numeric fields (from, to, thickness) - they are read-only
            if (config.isNumeric) return
            
            event.preventDefault()
            event.stopPropagation()
            const bounds = svgRef.current?.getBoundingClientRect()
            if (bounds && onUpdateIntervalField) {
              const topY = depthScale(d.topValue)
              const bottomY = depthScale(d.bottomValue)
              const centerY = (topY + bottomY) / 2
              
              // Get current value
              let currentValue = ''
              if (d.additionalFields && d.additionalFields[config.fieldKey]) {
                currentValue = String(d.additionalFields[config.fieldKey] || '')
              } else if (d[config.fieldKey]) {
                currentValue = String(d[config.fieldKey] || '')
              } else if (config.fieldKey === 'Seam' && d.splitedSeam) {
                currentValue = String(d.splitedSeam || '')
              }
              
              // Determine field name for update
              let fieldName = config.fieldKey
              if (fieldName === 'Seam') {
                fieldName = 'splitedSeam'
              }
              
              setEditingCell({
                intervalId: d.id,
                field: fieldName,
                x: bounds.left + MARGIN.left + offset,
                y: bounds.top + MARGIN.top + centerY,
                width: width,
                height: bottomY - topY,
                value: currentValue,
              })
            }
          })
          .on('contextmenu', handleContextMenu)
      }

      // Add resize handle AFTER all other elements (so it's on top)
      // This ensures it's clickable and not blocked by other elements
      const resizeHandleGroup = colGroup.append('g')
        .attr('class', 'resize-handle')
        .style('pointer-events', 'all')
      
      // Invisible but clickable resize area (wider for easier interaction)
      resizeHandleGroup.append('rect')
        .attr('x', width - 5)
        .attr('y', 0)
        .attr('width', 10)
        .attr('height', chartHeight)
        .attr('fill', 'transparent')
        .style('cursor', 'ew-resize')
        .on('mousedown', (event) => {
          event.preventDefault()
          event.stopPropagation()
          const bounds = svgRef.current?.getBoundingClientRect()
          if (bounds) {
            const startX = event.clientX - bounds.left - MARGIN.left
            startResize(colKey, startX, width)
          }
        })
        .on('mouseenter', function() {
          d3.select(this.parentNode).select('line').attr('stroke', '#333').attr('stroke-width', 2)
        })
        .on('mouseleave', function() {
          d3.select(this.parentNode).select('line').attr('stroke', '#999').attr('stroke-width', 1)
        })
      
      // Visual indicator for resize handle
      resizeHandleGroup.append('line')
        .attr('x1', width - 1)
        .attr('x2', width - 1)
        .attr('y1', 0)
        .attr('y2', chartHeight)
        .attr('stroke', '#999')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,2')
        .style('pointer-events', 'none')

      return offset + width + gapSize
    }

    // Add columns in order from settings
    columnOrder.forEach((colKey, index) => {
      const config = columnConfig[colKey]
      if (config && showOptions[colKey] !== false) {
        const width = columnWidths[colKey] || (config.width || 120)
        currentOffset = createColumn(colKey, config, currentOffset, showOptions[colKey], width)
      }
    })

    gridLayer.raise()

    const commentPanelX = innerWidth + COMMENT_PANEL_GAP
    const commentsLayer = root.append('g')
      .attr('class', 'comment-layer')
      .attr('transform', `translate(${commentPanelX},0)`)

    const comments = intervals.filter(interval => (interval.comment || '').trim())

    const commentPanels = commentsLayer.selectAll('.comment-panel')
      .data(comments, d => d.id)
      .enter()
      .append('g')
      .attr('class', 'comment-panel')
      .attr('transform', d => `translate(0, ${depthScale(d.topValue)})`)
      .style('cursor', 'pointer')
      .on('dblclick', (event, d) => {
        event.preventDefault()
        event.stopPropagation()
        if (onRequestComment) {
          onRequestComment(d.id)
        }
      })
      .on('contextmenu', (event, d) => {
        event.preventDefault()
        event.stopPropagation()
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          intervalId: d.id,
        })
      })

    commentPanels.append('rect')
      .attr('width', COMMENT_PANEL_WIDTH)
      .attr('height', d => {
        const top = depthScale(d.topValue)
        const bottom = depthScale(d.bottomValue)
        return Math.max(COMMENT_PANEL_MIN_HEIGHT, bottom - top)
      })
      .attr('fill', '#fff8e1')
      .attr('stroke', '#ffb74d')
      .attr('stroke-width', 1.5)
      .attr('rx', 8)
      .attr('ry', 8)

    commentPanels.append('text')
      .attr('x', 10)
      .attr('y', 16)
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .attr('fill', '#bf360c')
      .text('Comment')

    commentPanels.append('text')
      .attr('x', 10)
      .attr('y', 32)
      .attr('font-size', 11)
      .attr('fill', '#444')
      .text(d => `From ${d.topValue?.toFixed?.(2) ?? '-'} m, To ${d.bottomValue?.toFixed?.(2) ?? '-'} m`)

    commentPanels.append('text')
      .attr('x', COMMENT_PANEL_WIDTH - 12)
      .attr('y', 16)
      .attr('text-anchor', 'end')
      .attr('font-size', 14)
      .attr('font-weight', 'bold')
      .attr('fill', '#d32f2f')
      .style('cursor', onDeleteComment ? 'pointer' : 'default')
      .text('×')
      .on('click', (event, d) => {
        event.preventDefault()
        event.stopPropagation()
        if (onDeleteComment) {
          onDeleteComment(d.id)
        }
      })

    commentPanels.append('foreignObject')
      .attr('x', 10)
      .attr('y', 40)
      .attr('width', COMMENT_PANEL_WIDTH - 20)
      .attr('height', d => {
        const top = depthScale(d.topValue)
        const bottom = depthScale(d.bottomValue)
        const totalHeight = Math.max(COMMENT_PANEL_MIN_HEIGHT, bottom - top)
        return Math.max(12, totalHeight - 48)
      })
      .append('xhtml:div')
      .style('font-size', '12px')
      .style('color', '#333')
      .style('font-family', 'inherit')
      .style('line-height', '1.4')
      .style('overflow', 'hidden')
      .style('white-space', 'pre-wrap')
      .style('word-break', 'break-word')
      .text(d => d.comment || '')

    let crosshairCleanup = () => {
      svg.on('mousemove.crosshair', null)
      svg.on('mouseleave.crosshair', null)
    }

    if (settings?.showCrosshair !== false) {
      // Crosshair for cursor position
      const crosshairGroup = root.append('g')
        .attr('class', 'crosshair')
        .style('pointer-events', 'none')
        .style('display', 'none')

      const horizontalLine = crosshairGroup.append('line')
        .attr('stroke', '#ff9800')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,4')

      const verticalLine = crosshairGroup.append('line')
        .attr('stroke', '#ff9800')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,4')

      const cursorCircle = crosshairGroup.append('circle')
        .attr('r', 4)
        .attr('fill', '#ff9800')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)

      const handleCrosshairMove = (event) => {
        const [mx, my] = d3.pointer(event, root.node())
        if (mx >= 0 && mx <= innerWidth && my >= 0 && my <= chartHeight) {
          crosshairGroup.style('display', null)
          horizontalLine
            .attr('x1', 0)
            .attr('x2', innerWidth)
            .attr('y1', my)
            .attr('y2', my)
          verticalLine
            .attr('x1', mx)
            .attr('x2', mx)
            .attr('y1', 0)
            .attr('y2', chartHeight)
          cursorCircle
            .attr('cx', mx)
            .attr('cy', my)
        } else {
          crosshairGroup.style('display', 'none')
        }
      }

      const handleCrosshairLeave = () => {
        crosshairGroup.style('display', 'none')
      }

      svg.on('mousemove.crosshair', handleCrosshairMove)
      svg.on('mouseleave.crosshair', handleCrosshairLeave)

      crosshairCleanup = () => {
        svg.on('mousemove.crosshair', null)
        svg.on('mouseleave.crosshair', null)
      }
    } else {
      crosshairCleanup()
    }

    return crosshairCleanup
  }, [
    processedLogs,
    safeIntervals,
    minDepth,
    maxDepth,
    calculatedChartHeight,
    startDrag,
    sanitizeValue,
    settings,
    natuDomain,
    boreDomain,
    densityDomain,
    showOptions,
    natuTicks,
    boreTicks,
    densityTicks,
    geophysicalLogs,
    startResize,
    onAddInterval,
    onDeleteInterval,
    onRequestComment,
    onDeleteComment,
  ])

  const contextInterval = contextMenu
    ? safeIntervals.find(interval => interval.id === contextMenu.intervalId)
    : null
  const contextHasComment = !!(contextInterval?.comment && contextInterval.comment.trim())

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div style={{ 
        width: '100%', 
        overflowX: 'auto', 
        overflowY: 'hidden',
        border: '1px solid #ddd',
        borderRadius: '4px',
      }}>
        <svg ref={svgRef} style={{ display: 'block' }} />
      </div>
      {isDragging && (
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          padding: '10px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          borderRadius: '4px',
          zIndex: 1000,
        }}>
          Dragging {dragType} boundary...
        </div>
      )}
      {contextMenu && (
        <div
          data-context-menu
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1000,
            minWidth: '150px',
          }}
          onMouseLeave={() => setContextMenu(null)}
        >
          {contextMenu.intervalId && (
            <>
              <button
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 12px',
                  textAlign: 'left',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#f0f0f0'
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent'
                }}
                onClick={() => {
                  if (onAddInterval && contextMenu.intervalId) {
                    onAddInterval(contextMenu.intervalId)
                    setContextMenu(null)
                  }
                }}
              >
                Add Data
              </button>
              <button
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 12px',
                  textAlign: 'left',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#f0f0f0'
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent'
                }}
                onClick={() => {
                  if (onRequestComment && contextMenu.intervalId) {
                    onRequestComment(contextMenu.intervalId)
                    setContextMenu(null)
                  }
                }}
              >
                {contextHasComment ? 'Edit Comment' : 'Add Comment'}
              </button>
              <div
                style={{
                  height: '1px',
                  backgroundColor: '#e0e0e0',
                  margin: '4px 0',
                }}
              />
            </>
          )}
          <button
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 12px',
              textAlign: 'left',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              fontSize: '14px',
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#f0f0f0'
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent'
            }}
            onClick={() => {
              const currentRatio = settings?.scales?.depthRatio ?? 1
              const newRatio = currentRatio * 1.2 // Zoom in: +20%
              if (settings?.onDepthRatioChange) {
                settings.onDepthRatioChange(newRatio)
              }
              setContextMenu(null)
            }}
          >
            Zoom In
          </button>
          <button
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 12px',
              textAlign: 'left',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              fontSize: '14px',
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#f0f0f0'
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent'
            }}
            onClick={() => {
              const currentRatio = settings?.scales?.depthRatio ?? 1
              const newRatio = currentRatio / 1.2 // Zoom out: -20%
              if (settings?.onDepthRatioChange) {
                settings.onDepthRatioChange(newRatio)
              }
              setContextMenu(null)
            }}
          >
            Zoom Out
          </button>
          {contextMenu.intervalId && (
            <>
              <div
                style={{
                  height: '1px',
                  backgroundColor: '#e0e0e0',
                  margin: '4px 0',
                }}
              />
              <button
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 12px',
                  textAlign: 'left',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#d32f2f',
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#ffebee'
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent'
                }}
                onClick={() => {
                  if (onDeleteInterval && contextMenu.intervalId) {
                    if (window.confirm('Are you sure you want to delete this row?')) {
                      onDeleteInterval(contextMenu.intervalId)
                      setContextMenu(null)
                    }
                  }
                }}
              >
                Delete Row & Move Up
              </button>
            </>
          )}
        </div>
      )}
      {editingCell && (
        <input
          type="text"
          value={editingCell.value}
          onChange={(e) => {
            setEditingCell({
              ...editingCell,
              value: e.target.value,
            })
          }}
          onBlur={() => {
            if (onUpdateIntervalField && editingCell.intervalId) {
              onUpdateIntervalField(editingCell.intervalId, editingCell.field, editingCell.value)
            }
            setEditingCell(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (onUpdateIntervalField && editingCell.intervalId) {
                onUpdateIntervalField(editingCell.intervalId, editingCell.field, editingCell.value)
              }
              setEditingCell(null)
            } else if (e.key === 'Escape') {
              setEditingCell(null)
            }
          }}
          autoFocus
          style={{
            position: 'fixed',
            left: editingCell.x,
            top: editingCell.y - 10,
            width: editingCell.width - 4,
            height: Math.max(20, editingCell.height - 4),
            border: '2px solid #2196F3',
            borderRadius: '2px',
            padding: '2px 4px',
            fontSize: '10px',
            fontFamily: 'inherit',
            textAlign: 'center',
            zIndex: 2000,
            backgroundColor: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        />
      )}
    </div>
  )
}

export default WellLogViewer


export const toFiniteNumber = (value, fallback = 0) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

export const roundToTwo = (value) => {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

export const calculateAdjustRange = (interval) => {
  if (!interval) return 0
  const originalTop = toFiniteNumber(interval.top, 0)
  const originalBottom = toFiniteNumber(interval.bottom, originalTop)
  const adjustedTop = interval.adjustedTop !== null && interval.adjustedTop !== undefined
    ? toFiniteNumber(interval.adjustedTop, originalTop)
    : originalTop
  const adjustedBottom = interval.adjustedBottom !== null && interval.adjustedBottom !== undefined
    ? toFiniteNumber(interval.adjustedBottom, originalBottom)
    : originalBottom

  const originalThickness = originalBottom - originalTop
  const adjustedThickness = adjustedBottom - adjustedTop

  return roundToTwo(adjustedThickness - originalThickness)
}

export const enhanceInterval = (interval) => {
  if (!interval) return interval

  const resolvedTop = interval.top ?? interval.originTop ?? interval.adjustedTop ?? 0
  const resolvedBottom = interval.bottom ?? interval.originBottom ?? interval.adjustedBottom ?? resolvedTop
  const originTop = interval.originTop ?? resolvedTop
  const originBottom = interval.originBottom ?? resolvedBottom
  const adjustGroupId = interval.adjustGroupId ?? interval.id

  const normalizedThickness = Number.isFinite(interval.thickness)
    ? interval.thickness
    : roundToTwo(toFiniteNumber(resolvedBottom, originBottom) - toFiniteNumber(resolvedTop, originTop))

  return {
    ...interval,
    top: resolvedTop,
    bottom: resolvedBottom,
    originTop,
    originBottom,
    adjustGroupId,
    thickness: normalizedThickness,
  }
}

export const enhanceIntervals = (intervals = []) => intervals.map(enhanceInterval)

export const prepareProjectData = (project) => {
  if (!project) return project

  return {
    ...project,
    lithologyIntervals: enhanceIntervals(project.lithologyIntervals || []),
  }
}


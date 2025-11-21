import axios from 'axios'

// Auto-detect API URL based on current hostname
const getApiBaseUrl = () => {
  // If environment variable is set, use it
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  
  // Auto-detect based on current hostname
  const hostname = window.location.hostname
  const protocol = window.location.protocol
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000/api'
  } else {
    // Use the same hostname and protocol, but port 5000 for API
    return `${protocol}//${hostname}:5000/api`
  }
}

const API_BASE_URL = getApiBaseUrl()

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const uploadLAS = async (file) => {
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await api.post('/upload/las', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  
  return response.data
}

export const uploadExcel = async (file, sheetName = null, headerRow = null, metadataRow = null, dataStartRow = null) => {
  const formData = new FormData()
  formData.append('file', file)
  
  let url = sheetName 
    ? `/upload/excel?sheetName=${encodeURIComponent(sheetName)}`
    : '/upload/excel'
  
  if (headerRow !== null) {
    url += `${sheetName ? '&' : '?'}headerRow=${headerRow}`
  }
  if (metadataRow !== null) {
    url += `${url.includes('?') ? '&' : '?'}metadataRow=${metadataRow}`
  }
  if (dataStartRow !== null) {
    url += `${url.includes('?') ? '&' : '?'}dataStartRow=${dataStartRow}`
  }
  
  const response = await api.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  
  return response.data
}

export const getExcelSheets = async (file) => {
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await api.post('/upload/excel/sheets', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  
  return response.data
}

export const getExcelPreview = async (file, sheetName, maxRows = 50) => {
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await api.post(`/upload/excel/preview?sheetName=${encodeURIComponent(sheetName)}&maxRows=${maxRows}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  
  return response.data
}

export const getExcelRawData = async (file, sheetName, maxRows = 50, headerRow = null, dataStartRow = null) => {
  const formData = new FormData()
  formData.append('file', file)
  
  let url = `/upload/excel/raw-data?sheetName=${encodeURIComponent(sheetName)}&maxRows=${maxRows}`
  if (headerRow !== null) {
    url += `&headerRow=${headerRow}`
  }
  if (dataStartRow !== null) {
    url += `&dataStartRow=${dataStartRow}`
  }
  
  const response = await api.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

export const uploadExcelWithMapping = async (file, sheetName, mapping) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('mapping', JSON.stringify(mapping))
  
  const response = await api.post(
    `/upload/excel/parse-with-mapping?sheetName=${encodeURIComponent(sheetName)}`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  )
  return response.data
}

export const combineData = async (lasData, excelData) => {
  const response = await api.post('/upload/combine', { lasData, excelData })
  return response.data
}

export const saveProject = async (projectData) => {
  const response = await api.post('/projects/save', projectData)
  return response.data
}

export const loadProject = async (projectId) => {
  const response = await api.get(`/projects/${projectId}`)
  return response.data
}

export const listProjects = async () => {
  const response = await api.get('/projects')
  return response.data
}

export const deleteProject = async (projectId) => {
  await api.delete(`/projects/${projectId}`)
}

export const exportToExcel = async (projectData) => {
  const response = await api.post('/export/excel', projectData, {
    responseType: 'blob',
  })
  return response.data
}

export const exportToCSV = async (projectData) => {
  const response = await api.post('/export/csv', projectData, {
    responseType: 'blob',
  })
  return response.data
}


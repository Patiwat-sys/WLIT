import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

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

export const uploadExcel = async (file, sheetName = null) => {
  const formData = new FormData()
  formData.append('file', file)
  
  const url = sheetName 
    ? `/upload/excel?sheetName=${encodeURIComponent(sheetName)}`
    : '/upload/excel'
  
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

export const getExcelRawData = async (file, sheetName, maxRows = 50) => {
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await api.post(`/upload/excel/raw-data?sheetName=${encodeURIComponent(sheetName)}&maxRows=${maxRows}`, formData, {
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


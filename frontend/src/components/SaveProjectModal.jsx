import { useState } from 'react'

function SaveProjectModal({ isOpen, onClose, onSave, defaultFileName }) {
  const [fileName, setFileName] = useState(defaultFileName || 'project')

  if (!isOpen) return null

  const handleSave = () => {
    if (!fileName.trim()) {
      alert('Please enter a project name')
      return
    }
    onSave(fileName.trim())
    onClose()
  }

  const handleCancel = () => {
    setFileName(defaultFileName || 'project')
    onClose()
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
        zIndex: 2000,
      }}
      onClick={handleCancel}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          minWidth: '400px',
          maxWidth: '90%',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Save Project</h2>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            Project Name:
          </label>
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSave()
              } else if (e.key === 'Escape') {
                handleCancel()
              }
            }}
            placeholder="Enter project name"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
            }}
            autoFocus
          />
          <p style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
            The file will be saved as: <strong>{fileName}.json</strong>
          </p>
        </div>

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
          <button
            onClick={handleSave}
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
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default SaveProjectModal


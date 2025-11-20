import { useRef } from 'react'

function ProjectManager({ onProjectLoad }) {
  const fileInputRef = useRef(null)

  const handleLoadFromFile = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const project = JSON.parse(text)
      
      // Validate project structure
      if (!project.wellId || !project.lithologyIntervals) {
        throw new Error('Invalid project file format')
      }
      
      onProjectLoad(project)
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Failed to load project:', error)
      alert(`Failed to load project: ${error.message}`)
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".wljson"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <button
        onClick={handleLoadFromFile}
        style={{
          padding: '10px 20px',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Load Project
      </button>
    </>
  )
}

export default ProjectManager


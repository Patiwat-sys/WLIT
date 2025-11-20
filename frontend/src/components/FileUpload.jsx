import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

function FileUpload({ onFileSelect, accept, label, disabled }) {
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0])
    }
  }, [onFileSelect])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept ? { [accept]: [] } : undefined,
    disabled,
    multiple: false,
  })

  return (
    <div
      {...getRootProps()}
      style={{
        border: '2px dashed #ccc',
        borderRadius: '8px',
        padding: '20px',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        backgroundColor: isDragActive ? '#f0f0f0' : 'white',
      }}
    >
      <input {...getInputProps()} />
      <p>{isDragActive ? `Drop ${label} here...` : `Click or drag ${label} here`}</p>
    </div>
  )
}

export default FileUpload


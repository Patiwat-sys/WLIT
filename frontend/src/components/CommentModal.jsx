import { useEffect, useState } from 'react'

function CommentModal({
  isOpen,
  initialValue = '',
  onClose,
  onSave,
  metadata,
}) {
  const [value, setValue] = useState(initialValue || '')

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue || '')
    }
  }, [initialValue, isOpen])

  if (!isOpen) return null

  const handleSave = () => {
    onSave?.(value)
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#fff',
          padding: '20px',
          borderRadius: '8px',
          width: '420px',
          maxWidth: '90%',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>Add Comment</h3>
        {metadata?.from !== undefined && metadata?.to !== undefined && (
          <p style={{ marginTop: 0, marginBottom: '10px', color: '#555', fontSize: '0.95rem' }}>
            Depth range: {metadata.from.toFixed(2)} m → {metadata.to.toFixed(2)} m
          </p>
        )}
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={6}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            fontFamily: 'inherit',
            fontSize: '1rem',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
          placeholder="Type your comment..."
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: '16px',
            gap: '10px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2196F3',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default CommentModal


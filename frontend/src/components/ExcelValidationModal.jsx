function ExcelValidationModal({ isOpen, onClose, onConfirm, errors }) {
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
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          minWidth: '500px',
          maxWidth: '90%',
          maxHeight: '80vh',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#d32f2f' }}>
          ⚠️ ข้อมูล Excel มีปัญหา
        </h2>
        
        <div style={{ 
          marginBottom: '20px',
          maxHeight: '400px',
          overflowY: 'auto',
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '12px',
        }}>
          <p style={{ marginTop: 0, marginBottom: '12px', fontWeight: 'bold' }}>
            พบปัญหา {errors.length} รายการ:
          </p>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {errors.map((error, index) => (
              <li key={index} style={{ marginBottom: '8px', color: '#d32f2f' }}>
                <strong>แถว {error.row}:</strong> {error.message}
                {error.details && (
                  <div style={{ marginLeft: '20px', fontSize: '0.9em', color: '#666' }}>
                    {error.details}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
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
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
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
            โหลดข้อมูลต่อไป
          </button>
        </div>
      </div>
    </div>
  )
}

export default ExcelValidationModal


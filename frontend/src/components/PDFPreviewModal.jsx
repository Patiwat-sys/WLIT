import { useEffect, useRef, useState } from 'react'
import html2canvas from 'html2canvas'

function PDFPreviewModal({ isOpen, onClose, onExport, settings, projectData, createPDFContainer }) {
  const previewRef = useRef(null)
  const [isRendering, setIsRendering] = useState(false)
  const [previewPages, setPreviewPages] = useState([])

  useEffect(() => {
    if (!isOpen || !previewRef.current) return

    const renderPreview = async () => {
      setIsRendering(true)
      previewRef.current.innerHTML = '<p style="padding: 20px; text-align: center; color: #666;">Rendering preview...</p>'

      try {
        // Wait for SVG to render (reduced timeout)
        await new Promise(resolve => setTimeout(resolve, 200))

        // Find SVG element
        const svgElement = document.querySelector('svg')
        if (!svgElement) {
          previewRef.current.innerHTML = '<p style="padding: 20px; color: #666;">SVG element not found. Please wait for the chart to load.</p>'
          setIsRendering(false)
          return
        }

        // ใช้ shared function เพื่อสร้าง container (forPreview = false เพื่อให้เหมือน export)
        const printContainer = createPDFContainer(settings, svgElement, false)
        
        // Temporarily add to DOM for html2canvas
        printContainer.style.position = 'absolute'
        printContainer.style.left = '-9999px'
        printContainer.style.top = '0'
        document.body.appendChild(printContainer)

        // Wait for container to render (reduced timeout)
        await new Promise(resolve => setTimeout(resolve, 100))

        // Calculate page dimensions
        const mmToPx = 3.779527559
        const paperWidthPx = settings.paperSize.width * mmToPx
        const paperHeightPx = settings.paperSize.height * mmToPx
        
        // Use lower scale for preview to improve performance (export uses full quality)
        // Preview scale: 1.5 for good quality but faster rendering
        // Export will use settings.quality (usually 2-3)
        const previewScale = Math.min(1.5, settings.quality)
        const canvas = await html2canvas(printContainer, {
          scale: previewScale,
          useCORS: true,
          logging: false,
          letterRendering: true,
          backgroundColor: '#ffffff',
          windowWidth: printContainer.scrollWidth,
          windowHeight: printContainer.scrollHeight,
        })
        
        // Get SVG dimensions for center calculation (after canvas is rendered)
        let svgWidthScaled = null
        let containerWidthScaled = null
        if (settings.centerContent) {
          const svgInContainer = printContainer.querySelector('svg')
          if (svgInContainer) {
            const svgWidthPx = parseFloat(svgInContainer.getAttribute('width')) || svgInContainer.getBoundingClientRect().width
            svgWidthScaled = svgWidthPx * previewScale
            // Canvas width represents the actual rendered container width
            containerWidthScaled = canvas.width
          }
        }

        // Calculate page dimensions
        // Canvas is rendered at previewScale, so we need to account for that
        const marginTopPxScaled = settings.margins.top * mmToPx * previewScale
        const marginRightPxScaled = settings.margins.right * mmToPx * previewScale
        const marginBottomPxScaled = settings.margins.bottom * mmToPx * previewScale
        const marginLeftPxScaled = settings.margins.left * mmToPx * previewScale
        const paperWidthPxScaled = paperWidthPx * previewScale
        const paperHeightPxScaled = paperHeightPx * previewScale
        
        // Available content area per page (in scaled pixels)
        const availableWidthPxScaled = paperWidthPxScaled - marginLeftPxScaled - marginRightPxScaled
        const availableHeightPxScaled = paperHeightPxScaled - marginTopPxScaled - marginBottomPxScaled

        // Calculate how many pages (based on canvas height)
        const contentHeightScaled = canvas.height
        const numPages = Math.ceil(contentHeightScaled / availableHeightPxScaled)

        // Create page previews (scale down to display size)
        // Use requestAnimationFrame to prevent blocking UI
        const pages = []
        const marginTop = settings.margins.top * mmToPx
        const marginRight = settings.margins.right * mmToPx
        const marginBottom = settings.margins.bottom * mmToPx
        const marginLeft = settings.margins.left * mmToPx
        
        // Pre-calculate center offsets if needed
        let centerSourceX = 0
        let centerSourceWidth = canvas.width
        let centerDestX = marginLeft
        let centerAdjustedDestWidth = paperWidthPx - marginLeft - marginRight
        
        if (settings.centerContent && svgWidthScaled !== null && containerWidthScaled !== null) {
          if (svgWidthScaled < containerWidthScaled) {
            centerSourceX = (containerWidthScaled - svgWidthScaled) / 2
            centerSourceWidth = svgWidthScaled
            const svgWidthDisplay = svgWidthScaled / previewScale
            const destWidth = paperWidthPx - marginLeft - marginRight
            if (svgWidthDisplay < destWidth) {
              centerDestX = marginLeft + (destWidth - svgWidthDisplay) / 2
              centerAdjustedDestWidth = svgWidthDisplay
            }
          }
        }
        
        // Process pages in batches to avoid blocking
        const processPage = (i) => {
          return new Promise((resolve) => {
            requestAnimationFrame(() => {
              const pageCanvas = document.createElement('canvas')
              pageCanvas.width = paperWidthPx
              pageCanvas.height = paperHeightPx
              const ctx = pageCanvas.getContext('2d')
              
              // Gray background for margins
              ctx.fillStyle = '#f0f0f0'
              ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
              
              // White background for content area
              ctx.fillStyle = 'white'
              ctx.fillRect(
                marginLeft,
                marginTop,
                pageCanvas.width - marginLeft - marginRight,
                pageCanvas.height - marginTop - marginBottom
              )
              
              // Draw canvas content for this page
              const sourceY = i * availableHeightPxScaled
              const sourceHeight = Math.min(availableHeightPxScaled, contentHeightScaled - sourceY)
              const destHeight = (sourceHeight / previewScale)
              const destY = marginTop
              
              if (settings.centerContent && svgWidthScaled !== null && containerWidthScaled !== null && 
                  svgWidthScaled < containerWidthScaled && centerAdjustedDestWidth < (pageCanvas.width - marginLeft - marginRight)) {
                // Center case
                const aspectRatio = sourceHeight / centerSourceWidth
                const adjustedDestHeight = centerAdjustedDestWidth * aspectRatio
                
                ctx.drawImage(
                  canvas,
                  centerSourceX, sourceY, centerSourceWidth, sourceHeight,
                  centerDestX, destY, centerAdjustedDestWidth, adjustedDestHeight
                )
              } else {
                // Normal case
                const destWidth = pageCanvas.width - marginLeft - marginRight
                ctx.drawImage(
                  canvas,
                  0, sourceY, canvas.width, sourceHeight,
                  marginLeft, destY, destWidth, destHeight
                )
              }
              
              // Use lower quality JPEG for faster encoding (preview only)
              pages.push(pageCanvas.toDataURL('image/jpeg', 0.85))
              resolve()
            })
          })
        }
        
        // Process all pages
        for (let i = 0; i < numPages; i++) {
          await processPage(i)
        }

        // Clean up
        document.body.removeChild(printContainer)
        
        setPreviewPages(pages)
        
        // Render pages
        previewRef.current.innerHTML = ''
        pages.forEach((pageDataUrl, index) => {
          const pageDiv = document.createElement('div')
          pageDiv.style.marginBottom = '20px'
          pageDiv.style.textAlign = 'center'
          
          const pageImg = document.createElement('img')
          pageImg.src = pageDataUrl
          pageImg.style.width = `${paperWidthPx}px`
          pageImg.style.height = 'auto'
          pageImg.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)'
          pageImg.style.display = 'block'
          pageImg.style.margin = '0 auto'
          
          const pageLabel = document.createElement('p')
          pageLabel.textContent = `Page ${index + 1} of ${pages.length}`
          pageLabel.style.margin = '10px 0 0 0'
          pageLabel.style.color = '#666'
          pageLabel.style.fontSize = '14px'
          
          pageDiv.appendChild(pageImg)
          pageDiv.appendChild(pageLabel)
          previewRef.current.appendChild(pageDiv)
        })
        
      } catch (error) {
        console.error('Failed to render preview:', error)
        previewRef.current.innerHTML = `<p style="padding: 20px; color: #d32f2f;">Failed to render preview: ${error.message}</p>`
      } finally {
        setIsRendering(false)
      }
    }

    renderPreview()
  }, [isOpen, settings, projectData, createPDFContainer])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '20px',
          maxWidth: '95%',
          maxHeight: '95vh',
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>PDF Preview</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666',
              padding: '0',
              width: '30px',
              height: '30px',
            }}
          >
            ×
          </button>
        </div>
        
        {isRendering && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            <p>Rendering preview pages...</p>
            <p style={{ fontSize: '12px', marginTop: '10px' }}>This may take a moment for large documents.</p>
          </div>
        )}
        <div
          ref={previewRef}
          style={{
            backgroundColor: '#f5f5f5',
            padding: '20px',
            borderRadius: '4px',
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        />

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
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
            Close
          </button>
          <button
            onClick={() => {
              onExport(settings)
              onClose()
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: '#9C27B0',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Export PDF
          </button>
        </div>
      </div>
    </div>
  )
}

export default PDFPreviewModal


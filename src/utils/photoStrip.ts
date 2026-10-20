import type { CapturedFrame } from '../types'

// Captures the current video frame into a data URL, applying the chosen
// filter directly on the canvas so the saved image matches the live preview.
export function captureFrame(
  videoEl: HTMLVideoElement,
  filterCss: string,
  mirrored = true
): CapturedFrame {
  const canvas = document.createElement('canvas')
  canvas.width = videoEl.videoWidth
  canvas.height = videoEl.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2D canvas context')

  ctx.filter = filterCss
  if (mirrored) {
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
    width: canvas.width,
    height: canvas.height,
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Composites 3 captured frames into a classic vertical photobooth strip:
// cream paper background, sprocket holes down each side, and a
// typewriter-style timestamp at the bottom.
export async function composeStrip(
  frameDataUrls: string[],
  { label = 'PHOTOBOOTH' }: { label?: string } = {}
): Promise<string> {
  const images = await Promise.all(frameDataUrls.map(loadImage))

  const PADDING = 36
  const GAP = 24
  const SPROCKET_ZONE = 34
  const FRAME_W = 480
  const FRAME_H = Math.round((images[0].height / images[0].width) * FRAME_W)
  const FOOTER_H = 90

  const canvas = document.createElement('canvas')
  canvas.width = FRAME_W + PADDING * 2 + SPROCKET_ZONE * 2
  canvas.height =
    PADDING * 2 + FRAME_H * images.length + GAP * (images.length - 1) + FOOTER_H

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2D canvas context')

  // Paper background
  ctx.fillStyle = '#EFE3C8'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Subtle paper grain via noise-like speckles
  ctx.fillStyle = 'rgba(27, 21, 18, 0.03)'
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * canvas.width
    const y = Math.random() * canvas.height
    ctx.fillRect(x, y, 1, 1)
  }

  // Sprocket holes down both edges
  const holeRadius = 7
  const holeSpacing = 30
  ctx.fillStyle = '#5B1A24'
  for (let side = 0; side < 2; side++) {
    const cx = side === 0 ? SPROCKET_ZONE / 2 + 6 : canvas.width - SPROCKET_ZONE / 2 - 6
    for (let y = 20; y < canvas.height - FOOTER_H; y += holeSpacing) {
      ctx.beginPath()
      ctx.arc(cx, y, holeRadius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Frames
  images.forEach((img, i) => {
    const x = PADDING + SPROCKET_ZONE
    const y = PADDING + i * (FRAME_H + GAP)
    ctx.save()
    ctx.shadowColor = 'rgba(27, 21, 18, 0.25)'
    ctx.shadowBlur = 6
    ctx.shadowOffsetY = 2
    ctx.drawImage(img, x, y, FRAME_W, FRAME_H)
    ctx.restore()
    // Thin frame border
    ctx.strokeStyle = 'rgba(27, 21, 18, 0.6)'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, FRAME_W, FRAME_H)
  })

  // Footer stamp
  const footerY = canvas.height - FOOTER_H
  ctx.strokeStyle = 'rgba(27, 21, 18, 0.25)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PADDING, footerY + 14)
  ctx.lineTo(canvas.width - PADDING, footerY + 14)
  ctx.stroke()

  ctx.fillStyle = '#1B1512'
  ctx.textAlign = 'left'
  ctx.font = '600 22px "Special Elite", monospace'
  ctx.fillText(label, PADDING, footerY + 50)

  ctx.textAlign = 'right'
  ctx.font = '16px "Special Elite", monospace'
  const dateStr = new Date()
    .toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    .toUpperCase()
  ctx.fillText(dateStr, canvas.width - PADDING, footerY + 50)

  return canvas.toDataURL('image/jpeg', 0.92)
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const mimeMatch = header.match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

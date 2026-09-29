import { useMemo } from 'react'
import { encode } from 'uqr'

// A QR code for the TV: dark squares on white, with a quiet margin around them so phones can read it
// from across a room.
export function QrCode({ text, label }: { text: string; label: string }) {
  const { path, size } = useMemo(() => {
    const qr = encode(text, { ecc: 'M', border: 3 })
    const squares = qr.data.flatMap((row, y) => row.flatMap((dark, x) => (dark ? [`M${x} ${y}h1v1h-1z`] : [])))
    return { path: squares.join(''), size: qr.size }
  }, [text])
  return (
    <svg className="qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#1f2544" />
    </svg>
  )
}

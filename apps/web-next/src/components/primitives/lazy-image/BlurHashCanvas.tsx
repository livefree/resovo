'use client'

import { useEffect, useRef } from 'react'
import { decode } from 'blurhash'
import type { BlurHashCanvasProps } from './types'

export function BlurHashCanvas({ hash, width, height, punch = 1, className }: BlurHashCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let pixels: Uint8ClampedArray
    try {
      pixels = decode(hash, width, height, punch)
    } catch {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const imageData = ctx.createImageData(width, height)
    imageData.data.set(pixels)
    ctx.putImageData(imageData, 0, 0)
  }, [hash, width, height, punch])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}

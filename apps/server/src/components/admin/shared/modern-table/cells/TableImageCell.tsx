import Image from 'next/image'

interface TableImageCellProps {
  src?: string | null
  alt: string
  width?: number
  height?: number
  className?: string
}

export function TableImageCell({
  src,
  alt,
  width = 40,
  height = 56,
  className,
}: TableImageCellProps) {
  const style = { width: `${width}px`, height: `${height}px` }

  if (!src) {
    return (
      <span
        className={`inline-flex items-center justify-center overflow-hidden rounded bg-[var(--bg3)] text-xs text-[var(--muted)] ${className ?? ''}`.trim()}
        style={style}
        data-testid="table-image-cell-fallback"
      >
        无图
      </span>
    )
  }

  return (
    <span
      className={`inline-flex overflow-hidden rounded bg-[var(--bg3)] ${className ?? ''}`.trim()}
      style={style}
      data-testid="table-image-cell"
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="h-full w-full object-cover"
        unoptimized
      />
    </span>
  )
}

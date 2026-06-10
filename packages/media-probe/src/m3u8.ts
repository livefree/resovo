export type M3u8Variant = {
  resolution: string | null
  bandwidth: number | null
  url: string
}

export type M3u8ParseResult = {
  variants: M3u8Variant[]
  maxResolutionHeight: number | null
  isMaster: boolean
}

const RES_LINE = /RESOLUTION=(\d+)x(\d+)/
const BW_LINE = /BANDWIDTH=(\d+)/
const EXT_X_STREAM = /^#EXT-X-STREAM-INF/

export function parseM3u8(text: string): M3u8ParseResult {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const variants: M3u8Variant[] = []
  let isMaster = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('#EXT-X-STREAM-INF') || EXT_X_STREAM.test(line)) {
      isMaster = true
      const resMatch = RES_LINE.exec(line)
      const bwMatch = BW_LINE.exec(line)
      const url = lines[i + 1] ?? ''
      variants.push({
        resolution: resMatch ? `${resMatch[1]}x${resMatch[2]}` : null,
        bandwidth: bwMatch ? parseInt(bwMatch[1], 10) : null,
        url,
      })
    }
  }

  const heights = variants
    .map((v) => {
      const m = v.resolution?.match(/\d+x(\d+)/)
      return m ? parseInt(m[1], 10) : null
    })
    .filter((h): h is number => h !== null)

  return {
    variants,
    maxResolutionHeight: heights.length > 0 ? Math.max(...heights) : null,
    isMaster,
  }
}

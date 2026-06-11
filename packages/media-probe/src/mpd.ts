export type MpdRepresentation = {
  height: number | null
  bandwidth: number | null
}

export type MpdParseResult = {
  representations: MpdRepresentation[]
  maxResolutionHeight: number | null
  /** 含 <MPD 根元素（DASH 规范）——HTML 错误页等非 manifest 内容为 false */
  isValidMpd: boolean
}

const REP_PATTERN = /<Representation[^>]*/g
const HEIGHT_ATTR = /\bheight="(\d+)"/
const BW_ATTR = /\bbandwidth="(\d+)"/
const MPD_ROOT = /<MPD[\s>]/

export function parseMpd(xml: string): MpdParseResult {
  const representations: MpdRepresentation[] = []
  let match: RegExpExecArray | null

  while ((match = REP_PATTERN.exec(xml)) !== null) {
    const fragment = match[0]
    const hMatch = HEIGHT_ATTR.exec(fragment)
    const bwMatch = BW_ATTR.exec(fragment)
    representations.push({
      height: hMatch ? parseInt(hMatch[1], 10) : null,
      bandwidth: bwMatch ? parseInt(bwMatch[1], 10) : null,
    })
  }

  const heights = representations
    .map((r) => r.height)
    .filter((h): h is number => h !== null)

  return {
    representations,
    maxResolutionHeight: heights.length > 0 ? Math.max(...heights) : null,
    isValidMpd: MPD_ROOT.test(xml),
  }
}

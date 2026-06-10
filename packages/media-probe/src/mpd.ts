export type MpdRepresentation = {
  height: number | null
  bandwidth: number | null
}

export type MpdParseResult = {
  representations: MpdRepresentation[]
  maxResolutionHeight: number | null
}

const REP_PATTERN = /<Representation[^>]*/g
const HEIGHT_ATTR = /\bheight="(\d+)"/
const BW_ATTR = /\bbandwidth="(\d+)"/

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
  }
}

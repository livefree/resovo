type ImageKind = 'poster' | 'backdrop' | 'logo' | 'banner_backdrop' | 'stills' | 'thumbnail'

interface ReportParams {
  videoId: string
  imageKind: ImageKind
  url: string
}

// Session 级去重：同一 URL 在本次页面会话中只上报一次
const reported = new Set<string>()

export function reportBrokenImage({ videoId, imageKind, url }: ReportParams): void {
  const key = `${videoId}:${imageKind}:${url}`
  if (reported.has(key)) return
  reported.add(key)

  if (typeof navigator === 'undefined' || !('sendBeacon' in navigator)) return

  const body = new Blob(
    [JSON.stringify({ video_id: videoId, image_kind: imageKind, url, reason: 'client_load_error' })],
    { type: 'application/json' },
  )
  navigator.sendBeacon('/internal/image-broken', body)
}

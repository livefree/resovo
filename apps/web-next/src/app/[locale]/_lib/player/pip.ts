/**
 * Picture-in-Picture API 封装。
 * Chrome/Edge 支持 document.pictureInPictureEnabled。
 * 不支持的浏览器（Firefox < 136 stable, Safari < 13）能力检测返回 false。
 */

export function isPipSupported(): boolean {
  return (
    typeof document !== 'undefined' &&
    'pictureInPictureEnabled' in document &&
    (document as Document & { pictureInPictureEnabled: boolean }).pictureInPictureEnabled
  )
}

export async function requestPip(videoEl: HTMLVideoElement): Promise<void> {
  if (!isPipSupported()) return
  await videoEl.requestPictureInPicture()
}

export async function exitPip(): Promise<void> {
  if (!isPipSupported()) return
  if (document.pictureInPictureElement) {
    await document.exitPictureInPicture()
  }
}

/**
 * 监听 PiP 窗口关闭事件。
 * 关闭时调用 onClose 回调（通常将 hostMode 切回 mini 或 full）。
 */
export function onPipLeave(videoEl: HTMLVideoElement, onClose: () => void): () => void {
  videoEl.addEventListener('leavepictureinpicture', onClose)
  return () => videoEl.removeEventListener('leavepictureinpicture', onClose)
}

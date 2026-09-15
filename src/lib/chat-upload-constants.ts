/**
 * Pure, client-safe chat-attachment rules (no DB imports) - shared by the browser
 * (to validate before upload and show a toast) and the server routes.
 *
 * Allowed: images (PNG/JPG/GIF/WebP) and documents (PDF, Word, plain text), up to
 * 5 MB. By request there is NO preemptive "max 5 MB" helper text in the UI - the
 * error is only shown (as a toast) when a user actually picks a bad file.
 */
export const CHAT_MAX_BYTES = 5 * 1024 * 1024   // 5 MB
export const CHAT_MAX_LABEL = '5 MB'

// Also used as the file input's `accept` attribute.
export const CHAT_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain'

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'])
const FILE_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
])

export type AttachmentKind = 'image' | 'file'

export function classifyAttachment(type: string): AttachmentKind | null {
  const t = (type || '').toLowerCase()
  if (IMAGE_TYPES.has(t)) return 'image'
  if (FILE_TYPES.has(t)) return 'file'
  return null
}

export interface UploadCheck { ok: boolean; error?: string; kind?: AttachmentKind }

export function validateUpload(type: string, size: number): UploadCheck {
  const kind = classifyAttachment(type)
  if (!kind) return { ok: false, error: 'That file type is not supported. Upload an image (PNG, JPG, GIF, WebP), a PDF, or a Word document.' }
  if (!size) return { ok: false, error: 'That file appears to be empty.' }
  if (size > CHAT_MAX_BYTES) return { ok: false, error: `That file is too large. The maximum size is ${CHAT_MAX_LABEL}.` }
  return { ok: true, kind }
}

/** Human-readable file size, e.g. "1.4 MB". */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

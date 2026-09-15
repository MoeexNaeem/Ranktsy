/**
 * Server-side chat attachment persistence. Validation rules live in the
 * client-safe chat-upload-constants module (imported by both the browser and the
 * routes); this file adds the DB write and is server-only (it imports models).
 */
import { ChatAttachment } from '@/lib/models'
import { classifyAttachment, type AttachmentKind } from '@/lib/chat-upload-constants'

export { CHAT_MAX_BYTES, CHAT_MAX_LABEL, classifyAttachment, validateUpload, type AttachmentKind, type UploadCheck } from '@/lib/chat-upload-constants'

export interface AttachmentMeta {
  attachmentId: string
  attachmentName: string
  attachmentType: string
  attachmentSize: number
  attachmentKind: AttachmentKind
}

/** Persist the bytes as a ChatAttachment (base64) and return the message metadata. */
export async function saveAttachment(
  userId: string,
  file: { name: string; type: string; size: number; buffer: Buffer },
): Promise<AttachmentMeta> {
  const kind = classifyAttachment(file.type)
  if (!kind) throw new Error('Unsupported attachment type')
  const name = (file.name || 'file').slice(0, 200)
  const doc = await ChatAttachment.create({
    userId, name, contentType: file.type, size: file.size, data: file.buffer.toString('base64'),
  })
  return { attachmentId: String(doc._id), attachmentName: name, attachmentType: file.type, attachmentSize: file.size, attachmentKind: kind }
}

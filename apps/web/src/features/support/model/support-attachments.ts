/** Client-side limits — must match backend ticket_service.py */

export const SUPPORT_ATTACHMENT_MAX_BYTES = 2 * 1024 * 1024;

export const SUPPORT_ATTACHMENT_ACCEPT =
  ".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,image/jpeg,image/png,image/gif,image/webp,application/pdf,text/plain";

export function validateSupportAttachment(file: File): string | null {
  if (file.size <= 0) return "invalid";
  if (file.size > SUPPORT_ATTACHMENT_MAX_BYTES) return "too_large";
  const ext = file.name.includes(".") ? `.${file.name.split(".").pop()?.toLowerCase()}` : "";
  const allowedExt = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".txt"];
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
  ];
  if (!allowedExt.includes(ext) && !allowedTypes.includes(file.type)) return "invalid_type";
  return null;
}

export function supportAttachmentUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (typeof window !== "undefined") return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
  return url;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

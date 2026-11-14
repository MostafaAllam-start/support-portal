import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { STORAGE_ROOT } from "@/lib/storage";

// Uploaded user / team-member photos (and company and scope logos) are written to the
// app-managed storage dir, which survives rebuilds as a volume, and served through the
// /uploads/[...path] route. Not /public: Next does not serve files added there at runtime.
const UPLOAD_DIR = join(STORAGE_ROOT, "users-images");
const PUBLIC_PREFIX = "/uploads/users-images";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

// Allowed image MIME types mapped to the extension we save under. We derive the
// extension from the (browser-reported) type rather than trusting the original
// filename, and name files with a random UUID — avoiding collisions and any
// path-traversal from user-supplied names.
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const ACCEPTED_IMAGE_TYPES = Object.keys(MIME_EXT);

// Persists an uploaded image to the storage dir and returns its public path
// (e.g. "/uploads/users-images/<uuid>.png"). Throws a user-facing Error when the file's
// type or size is not allowed.
export async function saveUserImage(file: File): Promise<string> {
  const ext = MIME_EXT[file.type];
  if (!ext) {
    throw new Error("Unsupported image type. Use PNG, JPG, WEBP, or GIF.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image is too large. Maximum size is 5 MB.");
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(join(UPLOAD_DIR, filename), bytes);

  return `${PUBLIC_PREFIX}/${filename}`;
}

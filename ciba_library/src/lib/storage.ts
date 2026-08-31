import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

/*
 * Image storage behind a small interface so the deploy target can change
 * without touching callers. v1 writes to public/uploads and stores only the
 * relative URL key (e.g. "/uploads/recipes/<uuid>.jpg"); swap in an S3/blob
 * implementation later by changing only the `storage` export.
 */
export interface Storage {
  /** Persist an uploaded file and return the relative URL key to store in the DB. */
  saveImage(file: File, folder?: string): Promise<string>;
  /** Remove a previously saved image by its relative URL key. */
  deleteImage(key: string): Promise<void>;
}

const PUBLIC_DIR = path.join(process.cwd(), "public");
const UPLOAD_PREFIX = "/uploads";

class LocalDiskStorage implements Storage {
  async saveImage(file: File, folder = "recipes"): Promise<string> {
    const ext = (file.name.split(".").pop() || "bin")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const filename = `${randomUUID()}.${ext || "bin"}`;
    const dir = path.join(PUBLIC_DIR, "uploads", folder);
    await mkdir(dir, { recursive: true });
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, filename), bytes);
    return `${UPLOAD_PREFIX}/${folder}/${filename}`;
  }

  async deleteImage(key: string): Promise<void> {
    // Only ever touch files under public/uploads.
    if (!key.startsWith(`${UPLOAD_PREFIX}/`)) return;
    const full = path.join(PUBLIC_DIR, key);
    try {
      await unlink(full);
    } catch {
      // Already gone — nothing to do.
    }
  }
}

export const storage: Storage = new LocalDiskStorage();

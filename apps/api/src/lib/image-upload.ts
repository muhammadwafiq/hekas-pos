/**
 * Image upload helper — multipart parsing + local FS storage.
 * Phase 3 Gate 2 — Admin Gudang product image upload.
 *
 * Storage: local FS (apps/api/uploads/products/{productId}/{filename})
 * Production: replace with S3/Cloudflare R2/Supabase Storage adapter.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { BadRequestError, ValidationError } from './errors.js';
import { logger } from '../config/logger.js';

const UPLOAD_ROOT = process.env.UPLOAD_ROOT ?? join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export interface UploadedImage {
  filename: string;
  path: string;
  url: string;
  size: number;
  mimeType: string;
}

export const imageUpload = {
  /**
   * Validate uploaded file metadata (size + mime).
   */
  validate(file: { size: number; type: string; name: string }): void {
    if (file.size === 0) throw new ValidationError('File kosong');
    if (file.size > MAX_FILE_SIZE) {
      throw new ValidationError(`File terlalu besar: ${(file.size / 1024 / 1024).toFixed(2)}MB (max 5MB)`);
    }
    if (!ALLOWED_MIME.has(file.type)) {
      throw new ValidationError(`Tipe file tidak didukung: ${file.type}. Hanya JPEG/PNG/WEBP/GIF.`);
    }
  },

  /**
   * Save uploaded file to disk.
   * Returns relative path + public URL.
   */
  async save(
    file: { data: Uint8Array | Buffer; type: string; name: string; size: number },
    productId: string,
  ): Promise<UploadedImage> {
    this.validate(file);

    const ext = EXT_BY_MIME[file.type] ?? extname(file.name) ?? '.bin';
    const filename = `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`;
    const productDir = join(UPLOAD_ROOT, 'products', productId);
    const fullPath = join(productDir, filename);

    await mkdir(productDir, { recursive: true });
    const buffer = file.data instanceof Uint8Array ? Buffer.from(file.data) : file.data;
    await writeFile(fullPath, buffer);

    const relPath = `products/${productId}/${filename}`;
    const url = `/api/uploads/${relPath}`;

    logger.info({ productId, filename, size: file.size, mimeType: file.type }, 'Image uploaded');

    return { filename, path: relPath, url, size: file.size, mimeType: file.type };
  },

  /**
   * Get absolute path for a stored image (for serving via static route).
   */
  resolvePath(relPath: string): string {
    if (relPath.startsWith('/')) relPath = relPath.slice(1);
    return join(UPLOAD_ROOT, relPath);
  },
};
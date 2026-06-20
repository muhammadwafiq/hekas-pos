/**
 * Product service — full CRUD + image upload (Phase 3 Gate 2).
 * Extends Phase 2 read-only functions with admin actions.
 */

import { eq, and, sql, desc, ilike, inArray, or } from 'drizzle-orm';
import { db } from '../config/database.js';
import { products, categories, productImages } from '../db/schema/master.js';
import { stocks } from '../db/schema/stock.js';
import { NotFoundError, ConflictError, ValidationError, BusinessRuleError } from '../lib/errors.js';
import { logger } from '../config/logger.js';
import { imageUpload } from '../lib/image-upload.js';
import { productImageRepo } from '../repositories/product-image.repo.js';

export interface ProductListFilter {
  q?: string;
  outletId: string;
  categoryId?: string;
  supplierId?: string;
  status?: 'aktif' | 'stok_tipis' | 'habis' | 'nonaktif';
  limit?: number;
  offset?: number;
  sort?: 'name' | 'sku' | 'created' | 'price';
  order?: 'asc' | 'desc';
}

export const productService = {
  /** Phase 2 read-only functions (kept for backward compat) */
  async getById(id: string) {
    const [row] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    if (!row) throw new NotFoundError(`Product ${id} not found`);
    const images = await productImageRepo.listByProduct(id);
    return { ...row, images };
  },

  async getByBarcode(barcode: string) {
    const [row] = await db
      .select()
      .from(products)
      .where(eq(products.barcode, barcode))
      .limit(1);
    if (!row) throw new NotFoundError(`Product with barcode ${barcode} not found`);
    return row;
  },

  async search(filter: ProductListFilter) {
    const limit = Math.min(filter.limit ?? 50, 200);
    const offset = filter.offset ?? 0;
    const conditions: any[] = [eq(products.outletId, filter.outletId)];
    if (filter.q) {
      conditions.push(
        or(ilike(products.name, `%${filter.q}%`), ilike(products.sku, `%${filter.q}%`), ilike(products.barcode, `%${filter.q}%`)),
      );
    }
    if (filter.categoryId) conditions.push(eq(products.categoryId, filter.categoryId));
    if (filter.supplierId) conditions.push(eq(products.supplierId, filter.supplierId));
    if (filter.status) conditions.push(eq(products.status, filter.status));
    const where = and(...conditions);

    const sortCol =
      filter.sort === 'sku' ? products.sku
      : filter.sort === 'created' ? products.createdAt
      : filter.sort === 'price' ? products.sellingPrice
      : products.name;
    const orderDir = filter.order === 'desc' ? desc(sortCol) : sortCol;

    const [items, [{ total }]] = await Promise.all([
      db.select().from(products).where(where).orderBy(orderDir).limit(limit).offset(offset),
      db.select({ total: sql<number>`COUNT(*)::int` }).from(products).where(where),
    ]);

    return { items, total, limit, offset };
  },

  // ===== Phase 3 Admin Gudang CRUD =====

  async create(input: {
    outletId: string;
    categoryId: string;
    supplierId?: string;
    sku: string;
    barcode?: string;
    name: string;
    description?: string;
    purchasePrice: string;
    sellingPrice: string;
    stockMin?: number;
    stockMax?: number;
    unit?: string;
  }) {
    // Validate category exists
    const [cat] = await db.select().from(categories).where(eq(categories.id, input.categoryId)).limit(1);
    if (!cat) throw new ValidationError(`Category ${input.categoryId} not found`);

    // Check SKU uniqueness within outlet
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.sku, input.sku), eq(products.outletId, input.outletId)))
      .limit(1);
    if (existing) throw new ConflictError(`SKU ${input.sku} already exists in this outlet`);

    if (parseFloat(input.sellingPrice) < parseFloat(input.purchasePrice)) {
      throw new BusinessRuleError('Selling price cannot be lower than purchase price');
    }

    const [row] = await db
      .insert(products)
      .values({
        outletId: input.outletId,
        categoryId: input.categoryId,
        supplierId: input.supplierId,
        sku: input.sku,
        barcode: input.barcode,
        name: input.name,
        description: input.description,
        purchasePrice: input.purchasePrice,
        sellingPrice: input.sellingPrice,
        stockMin: input.stockMin ?? 0,
        stockMax: input.stockMax,
        unit: input.unit ?? 'pcs',
      })
      .returning();

    // Initialize stock record to 0
    await db.insert(stocks).values({
      outletId: input.outletId,
      productId: row!.id,
      quantity: 0,
    });

    logger.info({ productId: row!.id, sku: input.sku }, 'Product created');
    return row!;
  },

  async update(
    id: string,
    input: Partial<{
      name: string;
      description: string;
      categoryId: string;
      supplierId: string;
      barcode: string;
      purchasePrice: string;
      sellingPrice: string;
      stockMin: number;
      stockMax: number;
      unit: string;
      status: 'aktif' | 'stok_tipis' | 'habis' | 'nonaktif';
    }>,
  ) {
    const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!existing) throw new NotFoundError(`Product ${id} not found`);

    if (input.sellingPrice && input.purchasePrice &&
        parseFloat(input.sellingPrice) < parseFloat(input.purchasePrice)) {
      throw new BusinessRuleError('Selling price cannot be lower than purchase price');
    }

    const [row] = await db
      .update(products)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return row!;
  },

  async softDelete(id: string) {
    const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!existing) throw new NotFoundError(`Product ${id} not found`);

    // Check no active stock
    const [stock] = await db.select().from(stocks).where(eq(stocks.productId, id)).limit(1);
    if (stock && stock.quantity > 0) {
      throw new BusinessRuleError(`Cannot delete product with stock > 0 (current: ${stock.quantity}). Set status to nonaktif instead.`);
    }

    const [row] = await db
      .update(products)
      .set({ status: 'nonaktif', updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    logger.info({ productId: id }, 'Product soft-deleted (status=nonaktif)');
    return row!;
  },

  // ===== Image management =====

  async uploadImage(
    productId: string,
    file: { data: Uint8Array; type: string; name: string; size: number },
    opts: { isPrimary?: boolean; sortOrder?: number } = {},
  ) {
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product) throw new NotFoundError(`Product ${productId} not found`);

    const uploaded = await imageUpload.save(file, productId);

    const images = await productImageRepo.listByProduct(productId);
    const isPrimary = opts.isPrimary ?? images.length === 0; // First image auto-primary

    const row = await productImageRepo.create({
      productId,
      imageUrl: uploaded.url,
      imagePath: uploaded.path,
      sortOrder: opts.sortOrder ?? images.length,
      isPrimary,
    });

    // Update product.imageUrl if primary
    if (isPrimary) {
      await db
        .update(products)
        .set({ imageUrl: uploaded.url, updatedAt: new Date() })
        .where(eq(products.id, productId));
    }

    return row;
  },

  async deleteImage(productId: string, imageId: string) {
    const [img] = await db
      .select()
      .from(productImages)
      .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)))
      .limit(1);
    if (!img) throw new NotFoundError(`Image ${imageId} not found for product ${productId}`);

    await productImageRepo.delete(imageId);

    // If deleted was primary, set first remaining as primary
    if (img.isPrimary) {
      const remaining = await productImageRepo.listByProduct(productId);
      if (remaining.length > 0) {
        await productImageRepo.setPrimary(productId, remaining[0].id);
        await db
          .update(products)
          .set({ imageUrl: remaining[0].imageUrl, updatedAt: new Date() })
          .where(eq(products.id, productId));
      } else {
        await db
          .update(products)
          .set({ imageUrl: null, updatedAt: new Date() })
          .where(eq(products.id, productId));
      }
    }
    return { deleted: true };
  },

  async setPrimaryImage(productId: string, imageId: string) {
    const img = await productImageRepo.setPrimary(productId, imageId);
    await db
      .update(products)
      .set({ imageUrl: img.imageUrl, updatedAt: new Date() })
      .where(eq(products.id, productId));
    return img;
  },
};
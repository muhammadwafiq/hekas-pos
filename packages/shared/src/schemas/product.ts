/**
 * Product + Master schemas.
 */

import { z } from 'zod';

export const ProductStatusSchema = z.enum(['aktif', 'stok_tipis', 'habis', 'nonaktif']);
export type ProductStatus = z.infer<typeof ProductStatusSchema>;

export const ProductSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  barcode: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  categoryId: z.string().uuid(),
  supplierId: z.string().uuid().nullable(),
  outletId: z.string().uuid(),
  purchasePrice: z.number().nonnegative(),
  sellingPrice: z.number().nonnegative(),
  stockMin: z.number().int().nonnegative(),
  stockMax: z.number().int().nonnegative().nullable(),
  unit: z.string().default('pcs'),
  status: ProductStatusSchema,
  imageUrl: z.string().url().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Product = z.infer<typeof ProductSchema>;

export const CreateProductSchema = ProductSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial({ status: true, imageUrl: true });

export type CreateProductInput = z.infer<typeof CreateProductSchema>;

export const CategorySchema = z.object({
  id: z.string().uuid(),
  outletId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  iconUrl: z.string().nullable(),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
});

export type Category = z.infer<typeof CategorySchema>;

export const SupplierSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  contactPerson: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  address: z.string().nullable(),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
});

export type Supplier = z.infer<typeof SupplierSchema>;

export const MemberTierSchema = z.enum(['silver', 'gold', 'platinum']);
export type MemberTier = z.infer<typeof MemberTierSchema>;

export const MemberSchema = z.object({
  id: z.string().uuid(),
  memberCode: z.string(), // MBR-XXX
  outletId: z.string().uuid(),
  name: z.string(),
  phone: z.string(),
  email: z.string().email().nullable(),
  tier: MemberTierSchema,
  points: z.number().int().nonnegative().default(0),
  totalSpent: z.number().nonnegative().default(0),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
});

export type Member = z.infer<typeof MemberSchema>;
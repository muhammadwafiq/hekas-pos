/**
 * Stock schemas — stock movements, adjustments.
 */

import { z } from 'zod';

export const StockMovementTypeSchema = z.enum([
  'in_purchase',     // barang masuk dari PO
  'in_adjustment',   // adjustment positif (stock opname)
  'in_return',       // retur dari customer
  'out_sale',        // terjual
  'out_adjustment',  // adjustment negatif
  'out_damage',      // rusak/hilang
  'out_transfer',    // transfer ke outlet lain
]);
export type StockMovementType = z.infer<typeof StockMovementTypeSchema>;

export const StockSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  outletId: z.string().uuid(),
  quantity: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative().default(0),
  updatedAt: z.string().datetime(),
});

export type Stock = z.infer<typeof StockSchema>;

export const StockMovementSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  outletId: z.string().uuid(),
  type: StockMovementTypeSchema,
  quantity: z.number().int(), // signed: positive=in, negative=out
  referenceType: z.string().nullable(), // 'order' | 'incoming_good' | 'adjustment'
  referenceId: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export type StockMovement = z.infer<typeof StockMovementSchema>;

export const RestockSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  purchasePrice: z.number().nonnegative().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type RestockInput = z.infer<typeof RestockSchema>;

export const BulkRestockSchema = z.object({
  items: z.array(RestockSchema).min(1).max(500),
  notes: z.string().max(500).nullable().optional(),
});

export type BulkRestockInput = z.infer<typeof BulkRestockSchema>;

export const StockAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  newQuantity: z.number().int().nonnegative(),
  reason: z.string().min(3).max(500),
});

export type StockAdjustmentInput = z.infer<typeof StockAdjustmentSchema>;
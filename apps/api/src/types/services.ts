/**
 * Shared service layer types — DTOs and input shapes.
 * Used across services to give consumers (routes, tests) autocomplete + type-safety.
 *
 * Convention: each interface prefixed with the domain entity.
 * For row types (e.g. `Shift`), import from the schema files directly:
 *   import type { Shift } from '../db/schema/shift.js';
 */

import type { products } from '../db/schema/master.js';

// ===== SHIFT =====
import type { shifts } from '../db/schema/shift.js';
export type Shift = typeof shifts.$inferSelect;

export interface ShiftStartOpts {
  cashierId: string;
  outletId: string;
  startingCash: number;
  notes?: string;
}

export interface ShiftEndOpts {
  shiftId: string;
  endingCash: number;
  notes?: string;
}

export interface ShiftListOpts {
  outletId?: string;
  cashierId?: string;
  status?: 'aktif' | 'selesai' | 'ditutup_paksa';
  limit?: number;
  offset?: number;
}

// ===== PRODUCT =====
export type Product = typeof products.$inferSelect;

export interface ProductSearchOpts {
  q?: string;
  outletId?: string;
  categoryId?: string;
  limit?: number;
  offset?: number;
}

export interface ProductListOpts {
  outletId: string;
  categoryId?: string;
  status?: 'aktif' | 'stok_tipis' | 'habis' | 'nonaktif';
  limit?: number;
  offset?: number;
}

// ===== PAGINATION =====
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset?: number;
}
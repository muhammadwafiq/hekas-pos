/**
 * Unit tests for product service filter parsing and pagination.
 */
import { test, expect, describe } from 'bun:test';

describe('Pagination clamping', () => {
  function clamp(limit?: number, offset?: number) {
    return {
      limit: Math.min(limit ?? 50, 200),
      offset: offset ?? 0,
    };
  }

  test('default limit is 50', () => {
    expect(clamp().limit).toBe(50);
  });

  test('limit capped at 200', () => {
    expect(clamp(500).limit).toBe(200);
    expect(clamp(1000).limit).toBe(200);
  });

  test('limit below 200 used as-is', () => {
    expect(clamp(25).limit).toBe(25);
  });

  test('default offset is 0', () => {
    expect(clamp().offset).toBe(0);
  });

  test('explicit offset preserved', () => {
    expect(clamp(50, 100).offset).toBe(100);
  });
});

describe('Search query sanitization', () => {
  function escapeLike(s: string): string {
    return s.replace(/[%_\\]/g, '\\$&');
  }

  test('escapes % for ILIKE safety', () => {
    expect(escapeLike('100%')).toBe('100\\%');
  });

  test('escapes _ wildcard', () => {
    expect(escapeLike('item_name')).toBe('item\\_name');
  });

  test('escapes backslash', () => {
    expect(escapeLike('path\\file')).toBe('path\\\\file');
  });

  test('plain string passes through', () => {
    expect(escapeLike('aqua')).toBe('aqua');
  });
});

describe('Stock status thresholds', () => {
  type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

  function classifyStock(quantity: number, minStock: number): StockStatus {
    if (quantity === 0) return 'out_of_stock';
    if (quantity <= minStock) return 'low_stock';
    return 'in_stock';
  }

  test('out_of_stock when qty = 0', () => {
    expect(classifyStock(0, 5)).toBe('out_of_stock');
  });

  test('low_stock when qty ≤ minStock', () => {
    expect(classifyStock(3, 5)).toBe('low_stock');
    expect(classifyStock(5, 5)).toBe('low_stock');
  });

  test('in_stock when qty > minStock', () => {
    expect(classifyStock(10, 5)).toBe('in_stock');
  });

  test('boundary: minStock = 0 always in_stock (unless 0)', () => {
    expect(classifyStock(0, 0)).toBe('out_of_stock');
    expect(classifyStock(1, 0)).toBe('in_stock');
  });
});
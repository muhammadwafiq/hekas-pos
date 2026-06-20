/**
 * Unit tests for order total calculations.
 */
import { test, expect, describe } from 'bun:test';

interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

function calcItemSubtotal(item: OrderItem): number {
  return item.unitPrice * item.quantity - item.discount;
}

function calcOrderTotal(items: OrderItem[], globalDiscount = 0, taxRate = 0): number {
  const subtotal = items.reduce((sum, item) => sum + calcItemSubtotal(item), 0);
  const afterDiscount = subtotal - globalDiscount;
  const tax = afterDiscount * taxRate;
  return Math.max(0, afterDiscount + tax);
}

describe('Order item subtotal', () => {
  test('basic item: 2 × 5000 - 1000 = 9000', () => {
    expect(calcItemSubtotal({
      productId: 'p1',
      quantity: 2,
      unitPrice: 5000,
      discount: 1000,
    })).toBe(9000);
  });

  test('zero discount = full price × qty', () => {
    expect(calcItemSubtotal({
      productId: 'p1',
      quantity: 3,
      unitPrice: 10000,
      discount: 0,
    })).toBe(30000);
  });

  test('full discount (item free)', () => {
    expect(calcItemSubtotal({
      productId: 'p1',
      quantity: 1,
      unitPrice: 25000,
      discount: 25000,
    })).toBe(0);
  });
});

describe('Order total with global discount + tax', () => {
  test('sum of items, no discount, no tax', () => {
    const items: OrderItem[] = [
      { productId: 'p1', quantity: 2, unitPrice: 5000, discount: 0 },
      { productId: 'p2', quantity: 1, unitPrice: 10000, discount: 0 },
    ];
    expect(calcOrderTotal(items)).toBe(20000);
  });

  test('applies 10% global discount', () => {
    const items: OrderItem[] = [
      { productId: 'p1', quantity: 1, unitPrice: 100000, discount: 0 },
    ];
    expect(calcOrderTotal(items, 10000)).toBe(90000);
  });

  test('applies 11% tax', () => {
    const items: OrderItem[] = [
      { productId: 'p1', quantity: 1, unitPrice: 100000, discount: 0 },
    ];
    expect(calcOrderTotal(items, 0, 0.11)).toBe(111000);
  });

  test('discount + tax combined', () => {
    const items: OrderItem[] = [
      { productId: 'p1', quantity: 1, unitPrice: 100000, discount: 0 },
    ];
    // 100000 - 10% = 90000 + 11% = 99900
    expect(calcOrderTotal(items, 10000, 0.11)).toBe(99900);
  });

  test('never negative even with excessive discount', () => {
    const items: OrderItem[] = [
      { productId: 'p1', quantity: 1, unitPrice: 1000, discount: 0 },
    ];
    expect(calcOrderTotal(items, 5000)).toBe(0);
  });
});

describe('Order number generation', () => {
  function generateOrderNumber(prefix: string, counter: number): string {
    const padded = counter.toString(36).toUpperCase().padStart(4, '0');
    return `${prefix}-${padded}`;
  }

  test('formats with 4-char base36', () => {
    expect(generateOrderNumber('ORD', 1)).toBe('ORD-0001');
  });

  test('higher counter uses larger chars', () => {
    expect(generateOrderNumber('ORD', 35)).toBe('ORD-000Z');
  });

  test('pads with zeros when needed', () => {
    expect(generateOrderNumber('SHF', 10)).toBe('SHF-000A');
  });
});
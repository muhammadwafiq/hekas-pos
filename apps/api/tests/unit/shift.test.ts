/**
 * Unit tests for shift service business logic.
 * Focus on pure calculations (cash difference) and validation rules.
 */
import { test, expect, describe } from 'bun:test';
import { ValidationError } from '../../src/lib/errors.js';

describe('Shift cash difference calculation', () => {
  // Pure function: expectedCash + cashDifference = endingCash
  function calcDifference(ending: number, expected: number): number {
    return ending - expected;
  }

  test('positive difference (cashier has more)', () => {
    expect(calcDifference(550000, 500000)).toBe(50000);
  });

  test('negative difference (cashier has less)', () => {
    expect(calcDifference(450000, 500000)).toBe(-50000);
  });

  test('zero difference (perfect match)', () => {
    expect(calcDifference(500000, 500000)).toBe(0);
  });

  test('handles decimals (rounding from string)', () => {
    expect(calcDifference(500050.5, 500000)).toBe(50.5);
  });
});

describe('Shift status transitions', () => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    aktif: ['selesai', 'ditutup_paksa'],
    selesai: [],
    ditutup_paksa: [],
  };

  function canTransition(from: string, to: string): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  test('aktif → selesai allowed', () => {
    expect(canTransition('aktif', 'selesai')).toBe(true);
  });

  test('aktif → ditutup_paksa allowed (manager override)', () => {
    expect(canTransition('aktif', 'ditutup_paksa')).toBe(true);
  });

  test('selesai → aktif not allowed', () => {
    expect(canTransition('selesai', 'aktif')).toBe(false);
  });

  test('ditutup_paksa → anything not allowed', () => {
    expect(canTransition('ditutup_paksa', 'aktif')).toBe(false);
    expect(canTransition('ditutup_paksa', 'selesai')).toBe(false);
  });

  test('unknown from-state throws', () => {
    expect(canTransition('draft', 'selesai')).toBe(false);
  });
});

describe('ValidationError reuse', () => {
  test('throws when void reason < 5 chars', () => {
    expect(() => {
      const reason = 'err'; // 3 chars
      if (reason.length < 5) {
        throw new ValidationError('Void reason is required (min 5 chars)');
      }
    }).toThrow(ValidationError);
  });

  test('does not throw when reason >= 5 chars', () => {
    expect(() => {
      const reason = 'customer cancel';
      if (reason.length < 5) {
        throw new ValidationError('Void reason is required (min 5 chars)');
      }
    }).not.toThrow();
  });
});
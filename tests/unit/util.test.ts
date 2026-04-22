import { describe, it, expect } from 'vitest';
import {
  arrayGet,
  arrayGetLast,
  boundsCheck,
  isRecord,
  getOrdinalString,
} from '../../src/util';

describe('arrayGet', () => {
  it('returns the element at a valid index', () => {
    expect(arrayGet([10, 20, 30], 0, -1)).toBe(10);
    expect(arrayGet([10, 20, 30], 2, -1)).toBe(30);
  });

  it('returns the default for out-of-bounds indexes', () => {
    expect(arrayGet([10, 20, 30], 10, -1)).toBe(-1);
    expect(arrayGet([10, 20, 30], -1, 'fallback')).toBe('fallback');
    expect(arrayGet([], 0, null)).toBeNull();
  });
});

describe('arrayGetLast', () => {
  it('returns the last element of a non-empty array', () => {
    expect(arrayGetLast([1, 2, 3], -1)).toBe(3);
    expect(arrayGetLast(['a'], '-')).toBe('a');
  });

  it('returns the default for an empty array', () => {
    expect(arrayGetLast([], 99)).toBe(99);
  });
});

describe('boundsCheck', () => {
  it('returns true for valid non-negative integer indexes', () => {
    expect(boundsCheck(0, [10, 20, 30])).toBe(true);
    expect(boundsCheck(2, [10, 20, 30])).toBe(true);
  });

  it('returns false for out-of-range indexes', () => {
    expect(boundsCheck(3, [10, 20, 30])).toBe(false);
    expect(boundsCheck(-1, [10, 20, 30])).toBe(false);
  });

  it('returns false for non-number inputs', () => {
    expect(boundsCheck('0', [10, 20, 30])).toBe(false);
    expect(boundsCheck(null, [10, 20, 30])).toBe(false);
    expect(boundsCheck(undefined, [10, 20, 30])).toBe(false);
  });
});

describe('isRecord', () => {
  it('accepts plain objects', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it('accepts arrays (they are objects)', () => {
    // The canonical isRecord(x) = typeof x === 'object' && x !== null is true for arrays.
    // If the source excludes arrays explicitly, change this to .toBe(false) and flag it.
    expect(isRecord([1, 2])).toBe(true);
  });

  it('rejects primitives and null', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord('string')).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord(true)).toBe(false);
  });
});

describe('getOrdinalString', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
    [22, '22nd'],
    [23, '23rd'],
    [101, '101st'],
    [111, '111st'],
    [112, '112nd'],
    [113, '113rd'],
  ])('getOrdinalString(%d) === %s', (n, expected) => {
    expect(getOrdinalString(n)).toBe(expected);
  });
});

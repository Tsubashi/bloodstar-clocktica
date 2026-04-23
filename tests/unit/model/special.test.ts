import { describe, it, expect } from 'vitest';
import {
  BloodSpecial,
  parseSpecial,
  SPECIAL_OPTIONS,
} from '../../../src/model/special';

describe('parseSpecial', () => {
  it('maps lowercase values to enum', () => {
    expect(parseSpecial('none')).toBe(BloodSpecial.NONE);
    expect(parseSpecial('showgrimoire')).toBe(BloodSpecial.SHOW_GRIMOIRE);
    expect(parseSpecial('point')).toBe(BloodSpecial.POINT);
  });

  it('is case-insensitive', () => {
    expect(parseSpecial('NONE')).toBe(BloodSpecial.NONE);
    expect(parseSpecial('ShowGrimoire')).toBe(BloodSpecial.SHOW_GRIMOIRE);
    expect(parseSpecial('SHOWGRIMOIRE')).toBe(BloodSpecial.SHOW_GRIMOIRE);
  });

  it('throws on unknown values', () => {
    expect(() => parseSpecial('invisible')).toThrow(/unhandled value "invisible"/);
    expect(() => parseSpecial('')).toThrow(/unhandled value ""/);
  });
});

describe('SPECIAL_OPTIONS', () => {
  it('contains exactly the 3 specials in canonical order', () => {
    expect(SPECIAL_OPTIONS).toHaveLength(3);
    expect(SPECIAL_OPTIONS.map(o => o.value)).toEqual([
      BloodSpecial.NONE,
      BloodSpecial.SHOW_GRIMOIRE,
      BloodSpecial.POINT,
    ]);
  });

  it('pairs each value with its display string', () => {
    expect(SPECIAL_OPTIONS[0]).toEqual({ display: 'None', value: BloodSpecial.NONE });
    expect(SPECIAL_OPTIONS[1]).toEqual({ display: 'Show Grimoire', value: BloodSpecial.SHOW_GRIMOIRE });
    expect(SPECIAL_OPTIONS[2]).toEqual({ display: 'Point', value: BloodSpecial.POINT });
  });
});

import { describe, it, expect } from 'vitest';
import { EditionAlmanac } from '../../../src/model/edition-almanac';

describe('EditionAlmanac', () => {
  it('defaults the three string properties to the empty string', () => {
    const a = new EditionAlmanac();
    expect(a.synopsis.get()).toBe('');
    expect(a.overview.get()).toBe('');
    expect(a.changelog.get()).toBe('');
  });

  it('serializes to {} when at default', async () => {
    const a = new EditionAlmanac();
    await expect(a.serialize()).resolves.toEqual({});
  });

  it('serializes only non-default fields and round-trips', async () => {
    const a = new EditionAlmanac();
    await a.synopsis.set('synop');
    await a.changelog.set('v1');
    const data = await a.serialize();
    expect(data).toEqual({ synopsis: 'synop', changelog: 'v1' });

    const b = new EditionAlmanac();
    await b.deserialize(data as Record<string, unknown>);
    expect(b.synopsis.get()).toBe('synop');
    expect(b.changelog.get()).toBe('v1');
    expect(b.overview.get()).toBe('');
  });
});

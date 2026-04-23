import { describe, it, expect } from 'vitest';
import { CharacterAlmanac } from '../../../src/model/character-almanac';

describe('CharacterAlmanac', () => {
  it('defaults all five string properties to the empty string', () => {
    const c = new CharacterAlmanac();
    expect(c.examples.get()).toBe('');
    expect(c.flavor.get()).toBe('');
    expect(c.howToRun.get()).toBe('');
    expect(c.overview.get()).toBe('');
    expect(c.tip.get()).toBe('');
  });

  it('serializes to an empty object when all properties are at default', async () => {
    const c = new CharacterAlmanac();
    await expect(c.serialize()).resolves.toEqual({});
  });

  it('serializes only the fields that have been set', async () => {
    const c = new CharacterAlmanac();
    await c.flavor.set('spooky');
    await c.tip.set('hold tight');
    const out = await c.serialize();
    expect(out).toEqual({ flavor: 'spooky', tip: 'hold tight' });
  });

  it('round-trips through serialize/deserialize', async () => {
    const a = new CharacterAlmanac();
    await a.examples.set('example');
    await a.howToRun.set('instructions');
    const data = await a.serialize();

    const b = new CharacterAlmanac();
    await b.deserialize(data as Record<string, unknown>);
    expect(b.examples.get()).toBe('example');
    expect(b.howToRun.get()).toBe('instructions');
    expect(b.flavor.get()).toBe('');
  });
});

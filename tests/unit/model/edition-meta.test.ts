import { describe, it, expect } from 'vitest';
import { EditionMeta } from '../../../src/model/edition-meta';

describe('EditionMeta', () => {
  it('defaults: name = "New Edition", author = "", logo = null', () => {
    const m = new EditionMeta();
    expect(m.name.get()).toBe('New Edition');
    expect(m.author.get()).toBe('');
    expect(m.logo.get()).toBeNull();
  });

  it('serializes `name` even at default (saveDefault: true)', async () => {
    const m = new EditionMeta();
    await expect(m.serialize()).resolves.toEqual({ name: 'New Edition' });
  });

  it('omits `author` when at default but includes it when set', async () => {
    const m = new EditionMeta();
    await m.author.set('Tree');
    const out = await m.serialize();
    expect(out).toEqual({ name: 'New Edition', author: 'Tree' });
  });

  it('includes `logo` when set to a non-null string', async () => {
    const m = new EditionMeta();
    await m.logo.set('data:image/png;base64,AAA');
    const out = await m.serialize();
    expect(out).toMatchObject({ logo: 'data:image/png;base64,AAA' });
  });

  it('deserialize resets missing fields to their default values', async () => {
    const m = new EditionMeta();
    await m.name.set('Placeholder');
    await m.deserialize({ author: 'X' });
    // deserializeNonCustomProperties (observable-object.ts:271) calls property.getDefault()
    // for any key absent from data, then sets the property to that default.
    // So missing `name` resets to 'New Edition', not 'Placeholder'.
    expect(m.name.get()).toBe('New Edition');
    expect(m.author.get()).toBe('X');
  });
});

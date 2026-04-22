import { describe, it, expect } from 'vitest';
import { Edition } from '../../../src/model/edition';

describe('Edition (pure surface only — skips asyncNew / open / add)', () => {
  it('raw `new Edition()` populates defaults', () => {
    const e = new Edition();
    expect(e.windowTitle.get()).toBe('Bloodstar Clocktica');
    expect(e.saveName.get()).toBe('');
    expect(e.dirty.get()).toBe(false);
    expect(e.previewOnToken.get()).toBe(true);
  });

  it('exposes child meta and almanac objects with their defaults', () => {
    const e = new Edition();
    expect(e.meta).toBeDefined();
    expect(e.meta.name.get()).toBe('New Edition');
    expect(e.almanac).toBeDefined();
    expect(e.almanac.synopsis.get()).toBe('');
  });

  it('starts with empty characterList and night-order collections', () => {
    const e = new Edition();
    expect(e.characterList).toBeDefined();
    expect(e.firstNightOrder).toBeDefined();
    expect(e.otherNightOrder).toBeDefined();
    // getLength() is synchronous on ObservableCollection
    expect(e.characterList.getLength()).toBe(0);
    expect(e.firstNightOrder.getLength()).toBe(0);
    expect(e.otherNightOrder.getLength()).toBe(0);
  });

  it('serializes the empty edition to a minimal object with meta.name defaulted', async () => {
    const e = new Edition();
    const out = await e.serialize();
    // meta.name has saveDefault:true so it always appears
    expect(out.meta).toMatchObject({ name: 'New Edition' });
    // characterList uses default collection serialization → []
    expect(out.characterList).toEqual([]);
    // night-order collections use serializeJustIds custom serializer → [] for empty
    expect(out.firstNightOrder).toEqual([]);
    expect(out.otherNightOrder).toEqual([]);
    // dirty/saveName/windowTitle/previewOnToken have {write:false} and are excluded from output
    expect(out.dirty).toBeUndefined();
    expect(out.saveName).toBeUndefined();
    expect(out.windowTitle).toBeUndefined();
    expect(out.previewOnToken).toBeUndefined();
  });
});

import { describe, it, expect } from 'vitest';
import { CharacterImageSettings } from '../../../src/model/character-image-settings';

describe('CharacterImageSettings', () => {
  it('initializes all boolean defaults to true', () => {
    const s = new CharacterImageSettings();
    expect(s.shouldRestyle.get()).toBe(true);
    expect(s.shouldCrop.get()).toBe(true);
    expect(s.shouldColorize.get()).toBe(true);
    expect(s.useOutsiderAndMinionColors.get()).toBe(true);
    expect(s.useTexture.get()).toBe(true);
    expect(s.useBorder.get()).toBe(true);
    expect(s.useDropshadow.get()).toBe(true);
  });

  it('initializes numeric defaults', () => {
    const s = new CharacterImageSettings();
    expect(s.borderIntensity.get()).toBe(1);
    expect(s.dropShadowSize.get()).toBe(16);
    expect(s.dropShadowOffsetX.get()).toBe(0);
    expect(s.dropShadowOffsetY.get()).toBe(10);
    expect(s.dropShadowOpacity.get()).toBe(0.5);
  });

  it('serializes only non-default numeric changes', async () => {
    const s = new CharacterImageSettings();
    await s.dropShadowOpacity.set(0.25);
    await s.borderIntensity.set(2);
    const out = await s.serialize();
    expect(out).toEqual({ dropShadowOpacity: 0.25, borderIntensity: 2 });
  });

  it('round-trips a settings payload', async () => {
    const a = new CharacterImageSettings();
    await a.dropShadowSize.set(20);
    await a.useBorder.set(false);
    const data = await a.serialize();

    const b = new CharacterImageSettings();
    await b.deserialize(data as Record<string, unknown>);
    expect(b.dropShadowSize.get()).toBe(20);
    expect(b.useBorder.get()).toBe(false);
    expect(b.dropShadowOpacity.get()).toBe(0.5);
  });
});

import { describe, it, expect } from 'vitest';
import { Character } from '../../../src/model/character';
import { BloodTeam } from '../../../src/model/blood-team';
import { BloodSpecial } from '../../../src/model/special';

// Character's constructor is private (asyncNew() is the public factory).
// asyncNew() calls regenerateStyledImage() which requires DOM/canvas.
// TypeScript's `private` is compile-time only; at runtime the constructor
// is a plain function, so we bypass it with `(Character as any)()`.
// This lets us test the pure data surface without touching DOM/canvas.
const makeCharacter = (): Character => new (Character as any)() as Character;

describe('Character (pure surface only — skips asyncNew / image regen)', () => {
  it('raw constructor populates documented defaults', () => {
    const c = makeCharacter();
    expect(c.id.get()).toBe('newcharacter');
    expect(c.name.get()).toBe('New Character');
    expect(c.team.get()).toBe(BloodTeam.TOWNSFOLK);
    expect(c.special.get()).toBe(BloodSpecial.NONE);
    expect(c.ability.get()).toBe('');
    expect(c.export.get()).toBe(true);
    expect(c.setup.get()).toBe(false);
    expect(c.unStyledImage.get()).toBeNull();
    expect(c.styledImage.get()).toBeNull();
  });

  it('exposes child almanac and imageSettings objects', () => {
    const c = makeCharacter();
    expect(c.almanac).toBeDefined();
    expect(c.almanac.flavor.get()).toBe('');
    expect(c.imageSettings).toBeDefined();
    expect(c.imageSettings.shouldRestyle.get()).toBe(true);
  });

  it('serializes the saveDefault fields even when untouched', async () => {
    const c = makeCharacter();
    const out = await c.serialize();
    expect(out.id).toBe('newcharacter');
    expect(out.name).toBe('New Character');
    expect(out.team).toBe(BloodTeam.TOWNSFOLK);
  });

  it('includes `ability` only once it has been set', async () => {
    const c = makeCharacter();
    expect((await c.serialize()).ability).toBeUndefined();
    await c.ability.set('You start knowing a good player.');
    const out = await c.serialize();
    expect(out.ability).toBe('You start knowing a good player.');
  });

  it('round-trips custom values via serialize + deserialize', async () => {
    const a = makeCharacter();
    await a.name.set('Washerwoman');
    await a.id.set('washerwoman');
    await a.ability.set('You start knowing a Townsfolk.');
    await a.export.set(false);
    const data = await a.serialize();

    const b = makeCharacter();
    await b.deserialize(data);
    expect(b.name.get()).toBe('Washerwoman');
    expect(b.id.get()).toBe('washerwoman');
    expect(b.ability.get()).toBe('You start knowing a Townsfolk.');
    expect(b.export.get()).toBe(false);
  });
});

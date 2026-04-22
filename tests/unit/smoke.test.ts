import { describe, it, expect } from 'vitest';
import { EditionAlmanac } from '../../src/model/edition-almanac';

describe('Vitest smoke', () => {
  it('imports and instantiates a decorated model class', () => {
    const a = new EditionAlmanac();
    expect(a.synopsis.get()).toBe('');
    expect(a.overview.get()).toBe('');
    expect(a.changelog.get()).toBe('');
  });
});

import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePassword,
  validateUsername,
  validateSaveName,
} from '../../src/validate';

describe('validateEmail', () => {
  it.each([
    'user@example.com',
    'first.last@sub.example.co.uk',
    'user+tag@example.com',
    'a@b.c',
  ])('accepts %s', (email) => {
    expect(validateEmail(email)).toBe(true);
  });

  it.each([
    'plain',
    '@example.com',
    'user@',
    'user@.com',
    'user@example.',
    '',
    'two@@example.com',
  ])('rejects %s', (email) => {
    expect(validateEmail(email)).toBe(false);
  });
});

describe('validatePassword', () => {
  it('accepts short-but-complex passwords (>=8 chars, has lower, upper, digit)', () => {
    expect(validatePassword('Abcdef12')).toBe(true);
    expect(validatePassword('AAAA0000aaaa')).toBe(true);
  });

  it('rejects passwords shorter than 8', () => {
    expect(validatePassword('Ab12')).toBe(false);
    expect(validatePassword('')).toBe(false);
    expect(validatePassword('Abcdef1')).toBe(false); // exactly 7
  });

  it('at 8-23 chars, rejects missing lowercase / uppercase / digit', () => {
    expect(validatePassword('ABCDEFGH')).toBe(false); // no lower, no digit
    expect(validatePassword('abcdefgh')).toBe(false); // no upper, no digit
    expect(validatePassword('Abcdefgh')).toBe(false); // no digit
    expect(validatePassword('ABC12345')).toBe(false); // no lower
    expect(validatePassword('abc12345')).toBe(false); // no upper
  });

  it('accepts long passwords (>=24 chars) regardless of complexity', () => {
    expect(validatePassword('aaaaaaaaaaaaaaaaaaaaaaaa')).toBe(true); // 24 a's
    expect(validatePassword('a'.repeat(50))).toBe(true);
  });

  it('rejects a 23-char all-lowercase password (complexity still enforced)', () => {
    expect(validatePassword('a'.repeat(23))).toBe(false);
  });
});

describe('validateUsername / validateSaveName', () => {
  it('accepts letters, digits, hyphens, and underscores', () => {
    expect(validateUsername('abc')).toBe(true);
    expect(validateUsername('A1b2C3')).toBe(true);
    expect(validateUsername('my-name_2')).toBe(true);
    expect(validateSaveName('my-save_1')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateUsername('')).toBe(false);
    expect(validateSaveName('')).toBe(false);
  });

  it.each(['.', ' ', '/', '@', 'a b', 'a/b', 'user@host'])(
    'rejects "%s"',
    (s) => {
      expect(validateUsername(s)).toBe(false);
      expect(validateSaveName(s)).toBe(false);
    }
  );

  it('validateSaveName delegates to validateUsername (same rules)', () => {
    const inputs = ['abc', '', '!', 'a_b-c1'];
    for (const i of inputs) {
      expect(validateSaveName(i)).toBe(validateUsername(i));
    }
  });
});

import { describe, it, expect } from 'vitest';
import {
  BloodTeam,
  parseBloodTeam,
  bloodTeamDisplayString,
  BLOODTEAM_OPTIONS,
} from '../../../src/model/blood-team';

describe('parseBloodTeam', () => {
  it('maps lowercase values to enum', () => {
    expect(parseBloodTeam('townsfolk')).toBe(BloodTeam.TOWNSFOLK);
    expect(parseBloodTeam('outsider')).toBe(BloodTeam.OUTSIDER);
    expect(parseBloodTeam('minion')).toBe(BloodTeam.MINION);
    expect(parseBloodTeam('demon')).toBe(BloodTeam.DEMON);
    expect(parseBloodTeam('traveller')).toBe(BloodTeam.TRAVELLER);
    expect(parseBloodTeam('fabled')).toBe(BloodTeam.FABLED);
    expect(parseBloodTeam('jinxes')).toBe(BloodTeam.JINXES);
  });

  it('is case-insensitive', () => {
    expect(parseBloodTeam('TOWNSFOLK')).toBe(BloodTeam.TOWNSFOLK);
    expect(parseBloodTeam('Demon')).toBe(BloodTeam.DEMON);
  });

  it('accepts "traveler" (US spelling) as an alias for "traveller"', () => {
    expect(parseBloodTeam('traveler')).toBe(BloodTeam.TRAVELLER);
    expect(parseBloodTeam('TRAVELER')).toBe(BloodTeam.TRAVELLER);
  });

  it('throws on unknown values', () => {
    expect(() => parseBloodTeam('wizard')).toThrow(/unhandled team wizard/);
    expect(() => parseBloodTeam('')).toThrow(/unhandled team /);
  });
});

describe('bloodTeamDisplayString', () => {
  it('returns the display string for each team enum value', () => {
    expect(bloodTeamDisplayString(BloodTeam.TOWNSFOLK)).toBe('Townsfolk');
    expect(bloodTeamDisplayString(BloodTeam.OUTSIDER)).toBe('Outsider');
    expect(bloodTeamDisplayString(BloodTeam.MINION)).toBe('Minion');
    expect(bloodTeamDisplayString(BloodTeam.DEMON)).toBe('Demon');
    expect(bloodTeamDisplayString(BloodTeam.TRAVELLER)).toBe('Traveller');
    expect(bloodTeamDisplayString(BloodTeam.FABLED)).toBe('Fabled');
    expect(bloodTeamDisplayString(BloodTeam.JINXES)).toBe('Jinxes');
  });

  it('throws on unknown input', () => {
    expect(() => bloodTeamDisplayString('wizard' as BloodTeam)).toThrow(/unhandled team wizard/);
  });
});

describe('BLOODTEAM_OPTIONS', () => {
  it('contains exactly the 7 non-display teams in canonical order', () => {
    expect(BLOODTEAM_OPTIONS).toHaveLength(7);
    expect(BLOODTEAM_OPTIONS.map(o => o.value)).toEqual([
      BloodTeam.TOWNSFOLK,
      BloodTeam.OUTSIDER,
      BloodTeam.MINION,
      BloodTeam.DEMON,
      BloodTeam.TRAVELLER,
      BloodTeam.FABLED,
      BloodTeam.JINXES,
    ]);
  });

  it('pairs each value with its capitalized display string', () => {
    for (const { display, value } of BLOODTEAM_OPTIONS) {
      expect(display).toBe(bloodTeamDisplayString(value));
    }
  });
});

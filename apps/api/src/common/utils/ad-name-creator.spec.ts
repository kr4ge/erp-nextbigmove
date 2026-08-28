import { describe, expect, it } from '@jest/globals';
import { buildAdNameCreatorLabels } from './ad-name-creator';

const u = (id: string, firstName: string | null, lastName: string | null, email?: string) => ({ id, firstName, lastName, email });

describe('buildAdNameCreatorLabels', () => {
  it('uses the first name alone when it is unique in the tenant', () => {
    const labels = buildAdNameCreatorLabels([u('a', 'Josiah', 'Rosillon'), u('b', 'Henri', 'Canicosa')]);
    expect(labels.get('a')).toBe('Josiah');
    expect(labels.get('b')).toBe('Henri');
  });

  it('adds the initial when two people share a first name', () => {
    const labels = buildAdNameCreatorLabels([u('a', 'Josiah', 'Rosillon'), u('b', 'Josiah', 'Cruz')]);
    expect(labels.get('a')).toBe('Josiah R.');
    expect(labels.get('b')).toBe('Josiah C.');
  });

  it('falls back to the full surname when the initial collides too', () => {
    const labels = buildAdNameCreatorLabels([u('a', 'Josiah', 'Rosillon'), u('b', 'Josiah', 'Reyes'), u('c', 'Josiah', 'Cruz')]);
    expect(labels.get('a')).toBe('Josiah Rosillon');
    expect(labels.get('b')).toBe('Josiah Reyes');
    expect(labels.get('c')).toBe('Josiah C.');
  });

  it('compares first names case-insensitively', () => {
    const labels = buildAdNameCreatorLabels([u('a', 'josiah', 'Rosillon'), u('b', 'JOSIAH', 'Cruz')]);
    expect(labels.get('a')).toBe('josiah R.');
  });

  it('uses the email local part when there is no first name', () => {
    expect(buildAdNameCreatorLabels([u('a', null, null, 'ron.flores@nbm.com')]).get('a')).toBe('ron.flores');
  });
});

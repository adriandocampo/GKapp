import { describe, it, expect } from 'vitest';
import { sanitizeFileName, buildClipFileName } from './clipFileName';

describe('sanitizeFileName', () => {
  it('removes accents', () => {
    expect(sanitizeFileName('Pases')).toBe('Pases');
    expect(sanitizeFileName('Ángulos de posición')).toBe('Angulos_de_posicion');
  });

  it('collapses non-alphanumeric sequences into a single underscore', () => {
    expect(sanitizeFileName('Centros  /  Saques')).toBe('Centros_Saques');
  });

  it('trims leading and trailing underscores', () => {
    expect(sanitizeFileName('  Tiros  ')).toBe('Tiros');
    expect(sanitizeFileName('__Goles__')).toBe('Goles');
  });

  it('handles empty or null input', () => {
    expect(sanitizeFileName('')).toBe('');
    expect(sanitizeFileName(null)).toBe('');
    expect(sanitizeFileName(undefined)).toBe('');
  });

  it('caps length at 80 characters', () => {
    const long = 'a'.repeat(200);
    expect(sanitizeFileName(long).length).toBe(80);
  });
});

describe('buildClipFileName', () => {
  it('builds a default mp4 filename from id and category', () => {
    expect(buildClipFileName('M-001', 'Pases')).toBe('M-001_Pases.mp4');
  });

  it('builds a webm filename when requested', () => {
    expect(buildClipFileName('A-004', 'Tiros', 'webm')).toBe('A-004_Tiros.webm');
  });

  it('normalizes extension (dots and case)', () => {
    expect(buildClipFileName('M-001', 'Goles', '.MP4')).toBe('M-001_Goles.mp4');
  });

  it('sanitizes accents and special characters in the category', () => {
    expect(buildClipFileName('A-007', 'Saques de esquina', 'mp4')).toBe('A-007_Saques_de_esquina.mp4');
  });

  it('falls back to clip.<ext> when no usable name parts remain', () => {
    expect(buildClipFileName('', '', 'mp4')).toBe('clip.mp4');
    expect(buildClipFileName(null, '   ', 'webm')).toBe('clip.webm');
  });
});

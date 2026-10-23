import { lightColors, darkColors } from '../../src/theme/colors';
import { contrastRatio } from '../../src/theme/contrast';

describe('contrastRatio', () => {
  it('matches known WCAG values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1);
  });
});

describe('palettes', () => {
  it('have identical keys', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
  });

  const pairs: Array<[keyof typeof lightColors, keyof typeof lightColors]> = [
    ['text', 'background'],
    ['text', 'surface'],
    ['textMuted', 'surface'],
    ['textMuted', 'background'],
    ['onAccent', 'accent'],
    ['danger', 'surface'],
    ['success', 'surface'],
    ['warning', 'warningMuted'],
    ['text', 'surfaceMuted'],
    ['text', 'accentMuted'],
    ['success', 'successMuted'],
    ['danger', 'dangerMuted'],
    ['accent', 'surface'],
    ['accent', 'background'],
    ['onAccent', 'danger'],
  ];

  for (const [name, palette] of [
    ['light', lightColors],
    ['dark', darkColors],
  ] as const) {
    it(`meet WCAG AA (4.5:1) in ${name} mode`, () => {
      for (const [fg, bg] of pairs) {
        const ratio = contrastRatio(palette[fg], palette[bg]);
        expect({ pair: `${fg} on ${bg}`, ok: ratio >= 4.5, ratio: Math.round(ratio * 100) / 100 }).toMatchObject({
          ok: true,
        });
      }
    });
  }
});

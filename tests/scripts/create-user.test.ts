import { generatePassword } from '../../scripts/create-user';

describe('generatePassword', () => {
  it('maps every byte to one character', () => {
    expect(generatePassword(new Uint8Array(12))).toHaveLength(12);
  });

  it('never uses look-alike characters', () => {
    const all = new Uint8Array(256).map((_, i) => i);
    expect(generatePassword(all)).not.toMatch(/[0O1lI]/);
  });
});

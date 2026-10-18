import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const SCAN = ['app', 'src'];
const ALLOW = [path.join('src', 'theme')];
const LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\(/;

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) return files(full);
    return /\.(ts|tsx)$/.test(d.name) ? [full] : [];
  });
}

describe('no color literals outside src/theme', () => {
  it('finds none', () => {
    const offenders: string[] = [];
    for (const dir of SCAN) {
      for (const file of files(path.join(ROOT, dir))) {
        const rel = path.relative(ROOT, file);
        if (ALLOW.some((a) => rel.startsWith(a))) continue;
        fs.readFileSync(file, 'utf-8')
          .split('\n')
          .forEach((line, i) => {
            if (LITERAL.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
          });
      }
    }
    expect(offenders).toEqual([]);
  });
});

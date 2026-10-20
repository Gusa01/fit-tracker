import sharp from 'sharp';
import { shrinkImage } from '../../scripts/upload-exercise-images';

async function solid(width: number, height: number, format: 'png' | 'jpeg' | 'webp'): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 50, b: 50 } } })
    .toFormat(format)
    .toBuffer();
}

describe('shrinkImage', () => {
  it.each([
    ['image/png', 'png'],
    ['image/jpeg', 'jpeg'],
    ['image/webp', 'webp'],
  ] as const)('downscales %s to 600px on the longest side and keeps the format', async (contentType, format) => {
    const out = await shrinkImage(await solid(1800, 1200, format), contentType);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe(format);
    expect(Math.max(meta.width!, meta.height!)).toBe(600);
    expect(meta.width! / meta.height!).toBeCloseTo(1.5, 1);
  });

  it('never enlarges a small image', async () => {
    const meta = await sharp(await shrinkImage(await solid(300, 200, 'png'), 'image/png')).metadata();
    expect([meta.width, meta.height]).toEqual([300, 200]);
  });
});

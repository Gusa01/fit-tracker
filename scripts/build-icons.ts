import * as fs from 'fs';
import * as path from 'path';
import { Resvg } from '@resvg/resvg-js';

const root = path.join(__dirname, '..', 'assets');

function render(svgName: string, outName: string, size: number): void {
  const svg = fs.readFileSync(path.join(root, 'source', svgName), 'utf8');
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  fs.writeFileSync(path.join(root, outName), png);
  console.log(`${outName} (${size}px)`);
}

render('icon.svg', 'icon.png', 1024);
render('icon.svg', 'favicon.png', 48);
render('icon.svg', 'splash.png', 1024);
render('adaptive-foreground.svg', 'adaptive-icon.png', 1024);
render('notification.svg', 'notification-icon.png', 96);

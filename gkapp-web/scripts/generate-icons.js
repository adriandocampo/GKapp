import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = join(__dirname, '..');
const svgPath = join(rootDir, 'public', 'favicon.svg');
const buildDir = join(rootDir, 'build');
const iconPngPath = join(buildDir, 'icon.png');
const iconIcoPath = join(buildDir, 'icon.ico');
const iconIcnsPath = join(buildDir, 'icon.icns');

async function generateIcons() {
  try {
    // Ensure build directory exists
    if (!existsSync(buildDir)) {
      mkdirSync(buildDir, { recursive: true });
    }

    const svgBuffer = readFileSync(svgPath);

    // Generate 1024x1024 PNG from SVG
    await sharp(svgBuffer)
      .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(iconPngPath);

    console.log('Generated icon.png (1024x1024)');

    // Generate .ico for Windows (256x256)
    await sharp(iconPngPath)
      .resize(256, 256)
      .toFile(iconIcoPath);

    console.log('Generated icon.ico (256x256)');

    // Generate .icns for macOS using multiple sizes
    const sizes = [16, 32, 64, 128, 256, 512, 1024];
    const iconsetDir = join(buildDir, 'icon.iconset');
    
    if (!existsSync(iconsetDir)) {
      mkdirSync(iconsetDir, { recursive: true });
    }

    for (const size of sizes) {
      const normalName = `icon_${size}x${size}.png`;
      const normalPath = join(iconsetDir, normalName);
      await sharp(iconPngPath)
        .resize(size, size)
        .toFile(normalPath);

      // 2x version
      const doubleSize = size * 2;
      if (doubleSize <= 1024) {
        const retinaName = `icon_${size}x${size}@2x.png`;
        const retinaPath = join(iconsetDir, retinaName);
        await sharp(iconPngPath)
          .resize(doubleSize, doubleSize)
          .toFile(retinaPath);
      }
    }

    console.log('Generated iconset for macOS');
    console.log('');
    console.log('NOTE: To generate .icns file on macOS, run:');
    console.log(`  iconutil -c icns "${iconsetDir}" -o "${iconIcnsPath}"`);
    console.log('');
    console.log('For now, electron-builder will use icon.png to generate icons automatically.');

  } catch (error) {
    console.error('Error generating icons:', error.message);
    process.exit(1);
  }
}

generateIcons();

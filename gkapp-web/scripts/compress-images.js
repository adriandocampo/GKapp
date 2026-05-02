import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(ROOT, 'public', 'images');

const QUALITY = 80;
let totalSaved = 0;
let filesProcessed = 0;

function getFilesRecursively(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath));
    } else if (entry.name.toLowerCase().endsWith('.png')) {
      results.push(fullPath);
    }
  }
  return results;
}

async function compressImage(filePath) {
  const { default: sharp } = await import('sharp');
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, '.png');
  const webpPath = path.join(dir, `${base}.webp`);

  const originalSize = fs.statSync(filePath).size;

  await sharp(filePath)
    .webp({ quality: QUALITY, effort: 4 })
    .toFile(webpPath);

  const newSize = fs.statSync(webpPath).size;
  const saved = originalSize - newSize;
  totalSaved += saved;
  filesProcessed++;

  fs.unlinkSync(filePath);

  const pct = ((saved / originalSize) * 100).toFixed(1);
  console.log(`  ${base}.png → ${base}.webp (${(originalSize / 1024).toFixed(0)}KB → ${(newSize / 1024).toFixed(0)}KB, -${pct}%)`);
}

async function main() {
  console.log('Compressing images in public/images/...\n');

  const pngFiles = getFilesRecursively(IMAGES_DIR);
  console.log(`Found ${pngFiles.length} PNG files\n`);

  for (const file of pngFiles) {
    try {
      await compressImage(file);
    } catch (err) {
      console.error(`  Error processing ${path.basename(file)}: ${err.message}`);
    }
  }

  console.log(`\nDone! Processed ${filesProcessed} files`);
  console.log(`Total saved: ${(totalSaved / 1024 / 1024).toFixed(2)} MB`);
}

main();

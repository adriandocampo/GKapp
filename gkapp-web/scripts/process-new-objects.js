import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = 'C:\\Users\\Administrator\\Pictures\\Objetos';
const ROOT = path.resolve(__dirname, '..');
const DEST_DIR = path.join(ROOT, 'public', 'images', 'templates', 'objects');
const QUALITY = 80;

function normalizeName(name) {
  // Safe for filesystems while keeping Spanish chars (tildes, eñes, etc.)
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .trim()
    .toLowerCase();
}

async function processImage(sourcePath, destPath) {
  const ext = path.extname(sourcePath).toLowerCase();
  const baseName = path.basename(sourcePath, ext);
  const normalizedBase = normalizeName(baseName);
  const webpPath = path.join(destPath, `${normalizedBase}.webp`);

  await sharp(sourcePath)
    .webp({ quality: QUALITY, effort: 4 })
    .toFile(webpPath);

  const originalSize = fs.statSync(sourcePath).size;
  const newSize = fs.statSync(webpPath).size;
  const saved = originalSize - newSize;
  const pct = ((saved / originalSize) * 100).toFixed(1);
  console.log(`  ${baseName}${ext} → ${normalizedBase}.webp (${(originalSize / 1024).toFixed(0)}KB → ${(newSize / 1024).toFixed(0)}KB, -${pct}%)`);
}

async function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`Source directory not found: ${SOURCE_DIR}`);
    process.exit(1);
  }

  // Eliminar contenido antiguo de objects/
  if (fs.existsSync(DEST_DIR)) {
    console.log('Removing old objects...');
    fs.rmSync(DEST_DIR, { recursive: true });
  }
  fs.mkdirSync(DEST_DIR, { recursive: true });

  const categories = fs.readdirSync(SOURCE_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);

  let totalFiles = 0;

  for (const cat of categories) {
    const catSource = path.join(SOURCE_DIR, cat);
    const catDest = path.join(DEST_DIR, normalizeName(cat));
    fs.mkdirSync(catDest, { recursive: true });

    const files = fs.readdirSync(catSource)
      .filter(f => /\.(png|jpg|jpeg|gif|webp|bmp|tiff)$/i.test(f));

    if (files.length === 0) continue;

    console.log(`\n[${cat}] → ${normalizeName(cat)}/ (${files.length} files)`);
    for (const file of files) {
      const filePath = path.join(catSource, file);
      try {
        await processImage(filePath, catDest);
        totalFiles++;
      } catch (err) {
        console.error(`  Error processing ${file}: ${err.message}`);
      }
    }
  }

  console.log(`\nDone! Processed ${totalFiles} files into ${categories.length} categories.`);
}

main();

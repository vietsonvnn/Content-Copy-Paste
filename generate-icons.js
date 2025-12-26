/**
 * Generate PNG icons from SVG for Chrome Extension
 * Run: node generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// SVG icon content
const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4285f4"/>
      <stop offset="100%" style="stop-color:#6366f1"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="24" fill="url(#bg)"/>
  <g fill="white">
    <!-- Pen/Write icon -->
    <path d="M92 28L100 36L52 84L40 88L44 76L92 28Z" stroke="white" stroke-width="4" fill="none"/>
    <path d="M84 36L92 44" stroke="white" stroke-width="4"/>
    <!-- Lines representing text -->
    <rect x="28" y="96" width="40" height="4" rx="2"/>
    <rect x="28" y="104" width="56" height="4" rx="2"/>
  </g>
</svg>
`;

// Save SVG
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
}

fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgContent.trim());
console.log('SVG icon created at icons/icon.svg');

// Create simple placeholder PNGs (base64 encoded minimal valid PNGs)
// In production, you would use sharp or canvas to generate proper PNGs

const sizes = [16, 32, 48, 128];

// Minimal valid 1x1 PNG header + IDAT with color
function createPlaceholderPNG(size) {
  // This creates a minimal valid PNG - for production use proper image library
  const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); // length
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(size, 8); // width
  ihdr.writeUInt32BE(size, 12); // height
  ihdr.writeUInt8(8, 16); // bit depth
  ihdr.writeUInt8(6, 17); // color type (RGBA)
  ihdr.writeUInt8(0, 18); // compression
  ihdr.writeUInt8(0, 19); // filter
  ihdr.writeUInt8(0, 20); // interlace

  // Calculate CRC for IHDR
  const ihdrCrc = crc32(ihdr.slice(4, 21));
  ihdr.writeUInt32BE(ihdrCrc, 21);

  // Create simple blue gradient image data
  const rowSize = size * 4 + 1; // RGBA + filter byte
  const rawData = Buffer.alloc(rowSize * size);

  for (let y = 0; y < size; y++) {
    rawData[y * rowSize] = 0; // filter byte
    for (let x = 0; x < size; x++) {
      const offset = y * rowSize + 1 + x * 4;
      // Blue gradient
      const t = (x + y) / (size * 2);
      rawData[offset] = Math.floor(66 + t * 33); // R
      rawData[offset + 1] = Math.floor(133 + t * 30); // G
      rawData[offset + 2] = Math.floor(244 - t * 30); // B
      rawData[offset + 3] = 255; // A

      // Add rounded corners
      const cx = size / 2, cy = size / 2;
      const cornerRadius = size * 0.1875; // 24/128
      const dx = Math.abs(x - cx + 0.5);
      const dy = Math.abs(y - cy + 0.5);
      const cornerDist = Math.sqrt(
        Math.max(0, dx - (cx - cornerRadius)) ** 2 +
        Math.max(0, dy - (cy - cornerRadius)) ** 2
      );
      if (cornerDist > cornerRadius) {
        rawData[offset + 3] = 0; // transparent
      }
    }
  }

  // Compress with zlib
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(rawData);

  // IDAT chunk
  const idat = Buffer.alloc(12 + compressed.length);
  idat.writeUInt32BE(compressed.length, 0);
  idat.write('IDAT', 4);
  compressed.copy(idat, 8);
  const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), compressed]));
  idat.writeUInt32BE(idatCrc, 8 + compressed.length);

  // IEND chunk
  const iend = Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);

  return Buffer.concat([pngSignature, ihdr, idat, iend]);
}

// CRC32 implementation
function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = [];

  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate PNGs
sizes.forEach(size => {
  const png = createPlaceholderPNG(size);
  const filename = `icon${size}.png`;
  fs.writeFileSync(path.join(iconsDir, filename), png);
  console.log(`Created ${filename} (${size}x${size})`);
});

console.log('\nIcons generated successfully!');
console.log('Note: For production, replace with properly designed icons.');

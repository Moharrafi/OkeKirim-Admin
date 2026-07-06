const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const logoPath = path.join(__dirname, '..', 'public', 'logo.png');
const resDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

// Splash screen sizes for different densities
const sizes = [
  // Portrait
  { folder: 'drawable-port-mdpi', width: 320, height: 480 },
  { folder: 'drawable-port-hdpi', width: 480, height: 800 },
  { folder: 'drawable-port-xhdpi', width: 720, height: 1280 },
  { folder: 'drawable-port-xxhdpi', width: 1080, height: 1920 },
  { folder: 'drawable-port-xxxhdpi', width: 1440, height: 2560 },
  // Landscape
  { folder: 'drawable-land-mdpi', width: 480, height: 320 },
  { folder: 'drawable-land-hdpi', width: 800, height: 480 },
  { folder: 'drawable-land-xhdpi', width: 1280, height: 720 },
  { folder: 'drawable-land-xxhdpi', width: 1920, height: 1080 },
  { folder: 'drawable-land-xxxhdpi', width: 2560, height: 1440 },
  // Default drawable
  { folder: 'drawable', width: 480, height: 800 },
];

async function generateSplash() {
  console.log('Generating splash screens from:', logoPath);
  
  const logoBuffer = await sharp(logoPath).png().toBuffer();
  const logoMeta = await sharp(logoBuffer).metadata();
  
  for (const size of sizes) {
    // Logo should be about 45% of the smaller dimension
    const smallerDim = Math.min(size.width, size.height);
    const logoSize = Math.round(smallerDim * 0.45);
    
    // Resize logo
    const resizedLogo = await sharp(logoBuffer)
      .resize(logoSize, logoSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toBuffer();
    
    // Create white background with centered logo
    const splash = await sharp({
      create: {
        width: size.width,
        height: size.height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 255 }
      }
    })
    .composite([{
      input: resizedLogo,
      gravity: 'centre'
    }])
    .png()
    .toBuffer();
    
    const outputPath = path.join(resDir, size.folder, 'splash.png');
    
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, splash);
    console.log(`  ✓ ${size.folder}/splash.png (${size.width}x${size.height})`);
  }
  
  console.log('\nDone! All splash screens generated.');
}

generateSplash().catch(console.error);

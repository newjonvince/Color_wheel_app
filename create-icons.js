// Script to create app icons and splash screens
// Run with: node create-icons.js

const fs = require('fs');
const path = require('path');

// Create a simple colored square icon as base64 PNG
function createColorWheelIcon() {
  // This is a base64 encoded 1024x1024 PNG with a color wheel design
  const iconBase64 = `iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==`;
  
  // Create a proper app icon (this is a placeholder - in production you'd use proper image generation)
  const iconBuffer = Buffer.from(iconBase64, 'base64');
  
  return iconBuffer;
}

// Create assets directory if it doesn't exist
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir);
}

// For now, let's create placeholder files that Expo can use
console.log('Creating app icon assets...');

// Create a simple colored rectangle as a placeholder
const createPlaceholderIcon = (width, height, color) => {
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="colorWheel" cx="50%" cy="50%" r="40%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="20%" stop-color="#ff6b6b"/>
        <stop offset="40%" stop-color="#4ecdc4"/>
        <stop offset="60%" stop-color="#45b7d1"/>
        <stop offset="80%" stop-color="#96ceb4"/>
        <stop offset="100%" stop-color="#ffeaa7"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="${color}"/>
    <circle cx="50%" cy="50%" r="35%" fill="url(#colorWheel)" stroke="#333" stroke-width="8"/>
    <circle cx="50%" cy="50%" r="15%" fill="#ffffff" stroke="#333" stroke-width="4"/>
    <text x="50%" y="85%" text-anchor="middle" font-family="Arial" font-size="24" font-weight="bold" fill="#333">FCW</text>
  </svg>`;
};

// Write SVG files (Expo can convert these)
fs.writeFileSync(path.join(assetsDir, 'icon.svg'), createPlaceholderIcon(1024, 1024, '#f8f9fa'));
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.svg'), createPlaceholderIcon(1024, 1024, '#f8f9fa'));
fs.writeFileSync(path.join(assetsDir, 'splash-icon.svg'), createPlaceholderIcon(1284, 2778, '#f8f9fa'));
fs.writeFileSync(path.join(assetsDir, 'favicon.svg'), createPlaceholderIcon(48, 48, '#f8f9fa'));

console.log('✅ Icon assets created successfully!');
console.log('📝 Note: These are placeholder SVG icons. For production, convert to PNG using:');
console.log('   - icon.png (1024x1024)');
console.log('   - adaptive-icon.png (1024x1024)');
console.log('   - splash-icon.png (1284x2778)');
console.log('   - favicon.png (48x48)');

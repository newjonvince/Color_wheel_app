# Tab Icons for Fashion Color Wheel

## Icon Requirements

For optimal iOS and Expo compatibility, your icons should meet these specifications:

### Image Specifications:
- **Format**: PNG with transparency
- **Size**: 24x24pt (72x72px for @3x)
- **Color**: Single color (black or white) - the app will apply tinting
- **Background**: Transparent
- **Style**: Simple, clean design that works at small sizes

### Required Icon Files:

1. **Community Icons** (Image 2 - People icon):
   - `community-focused.png` - Active state
   - `community-unfocused.png` - Inactive state

2. **ColorWheel Icons** (Image 4 - Color wheel):
   - `colorwheel-focused.png` - Active state  
   - `colorwheel-unfocused.png` - Inactive state

3. **Profile Icons** (Image 1 - Person silhouette):
   - `profile-focused.png` - Active state
   - `profile-unfocused.png` - Inactive state

4. **Settings Icons** (Image 3 - Gear icon):
   - `settings-focused.png` - Active state
   - `settings-unfocused.png` - Inactive state

### iOS Guidelines:
- Icons should be simple and recognizable at small sizes
- Use a single color (preferably black) - the system will apply tinting
- Avoid gradients or complex details
- Test on actual devices for clarity

### Expo Compatibility:
- All icons are bundled with the app (no network requests)
- Supports both iOS and Android automatically
- Optimized for different screen densities
- Fallback emoji icons if images fail to load

## How to Replace Icons:

1. Save your custom icons in this folder with the exact names listed above
2. Ensure they meet the size and format requirements
3. Test on both iOS and Android devices
4. The app will automatically use your custom icons

## Current Status:
- ✅ Icon system implemented
- ⏳ Waiting for your custom icon files
- ✅ Fallback emoji system in place
- ✅ iOS and Expo compatibility ensured

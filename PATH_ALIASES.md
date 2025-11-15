# Path Aliases Configuration

⚠️ **CURRENTLY DISABLED** - Path aliases are temporarily disabled due to Expo bundling issues.

This project has path aliases configured but they are currently commented out due to `babel-plugin-module-resolver` not being found in the Expo build environment.

## Available Aliases

| Alias | Path | Usage |
|-------|------|-------|
| `@` | `./src` | Root source directory |
| `@components` | `./src/components` | Reusable components |
| `@screens` | `./src/screens` | Screen components |
| `@services` | `./src/services` | API and service modules |
| `@utils` | `./src/utils` | Utility functions |
| `@hooks` | `./src/hooks` | Custom React hooks |
| `@config` | `./src/config` | Configuration files |
| `@assets` | `./assets` | Static assets (images, fonts) |

## Usage Examples

### Before (relative imports)
```javascript
import ApiService from '../../services/safeApiService';
import { safeStorage } from '../../../utils/safeStorage';
import LoginHeader from './components/LoginHeader';
```

### After (path aliases)
```javascript
import ApiService from '@services/safeApiService';
import { safeStorage } from '@utils/safeStorage';
import LoginHeader from '@components/LoginHeader';
```

## Configuration Files

**IMPORTANT**: All three configuration files must be kept in sync:

### 1. babel.config.js
```javascript
plugins: [
  [
    'module-resolver',
    {
      root: ['./src'],
      alias: {
        '@': './src',
        '@components': './src/components',
        // ... other aliases
      },
    },
  ],
]
```

### 2. metro.config.js
```javascript
config.resolver.alias = {
  '@': path.resolve(__dirname, 'src'),
  '@components': path.resolve(__dirname, 'src/components'),
  // ... other aliases
};
```

### 3. tsconfig.json
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      // ... other aliases
    }
  }
}
```

## Benefits

- **Cleaner imports**: No more `../../../` chains
- **Refactoring safety**: Moving files doesn't break imports
- **Better IDE support**: Auto-completion and navigation
- **Consistent paths**: Same imports work everywhere

## Migration Strategy

1. **Gradual adoption**: Start with new files, migrate existing ones over time
2. **Focus on deep imports**: Prioritize files with many `../` levels
3. **Test thoroughly**: Ensure Metro bundling works after changes
4. **Team coordination**: Ensure all developers understand the aliases

## Current Status: DISABLED

Path aliases are currently **commented out** in:
- `babel.config.js` - Lines 8-24
- `metro.config.js` - Lines 8-18

### To Re-enable Path Aliases

1. **Ensure babel-plugin-module-resolver is properly installed:**
   ```bash
   npm install --save-dev babel-plugin-module-resolver@^5.0.2
   ```

2. **Uncomment the configuration in babel.config.js:**
   ```javascript
   // Uncomment lines 9-23 in babel.config.js
   ```

3. **Uncomment the configuration in metro.config.js:**
   ```javascript
   // Uncomment lines 9-17 in metro.config.js
   ```

4. **Test the build:**
   ```bash
   npx expo start --clear
   ```

### Troubleshooting

#### Metro bundling issues
- Clear Metro cache: `npx expo start --clear`
- Restart development server
- Check that all config files have matching aliases
- Verify babel-plugin-module-resolver is in devDependencies

#### IDE not recognizing aliases
- Restart TypeScript service in your editor
- Verify tsconfig.json paths are correct
- Check that your editor supports TypeScript path mapping

#### Expo build errors
- Ensure babel-plugin-module-resolver is installed locally
- Check that the plugin version is compatible with your Expo SDK
- Consider moving babel-plugin-module-resolver to dependencies (not devDependencies) if using EAS Build

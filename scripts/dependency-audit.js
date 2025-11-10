#!/usr/bin/env node
// scripts/dependency-audit.js - Comprehensive dependency audit script

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Read package.json files
function readPackageJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    log(`❌ Error reading ${filePath}: ${error.message}`, 'red');
    return null;
  }
}

// Extract require/import statements from files
function extractDependencies(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const dependencies = new Set();
    
    // Match require statements
    const requireMatches = content.match(/require\(['"`]([^'"`]+)['"`]\)/g);
    if (requireMatches) {
      requireMatches.forEach(match => {
        const dep = match.match(/require\(['"`]([^'"`]+)['"`]\)/)[1];
        if (!dep.startsWith('.') && !dep.startsWith('/')) {
          // Extract package name (handle scoped packages)
          const packageName = dep.startsWith('@') ? 
            dep.split('/').slice(0, 2).join('/') : 
            dep.split('/')[0];
          dependencies.add(packageName);
        }
      });
    }
    
    // Match import statements
    const importMatches = content.match(/import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g);
    if (importMatches) {
      importMatches.forEach(match => {
        const dep = match.match(/from\s+['"`]([^'"`]+)['"`]/)[1];
        if (!dep.startsWith('.') && !dep.startsWith('/')) {
          const packageName = dep.startsWith('@') ? 
            dep.split('/').slice(0, 2).join('/') : 
            dep.split('/')[0];
          dependencies.add(packageName);
        }
      });
    }
    
    return Array.from(dependencies);
  } catch (error) {
    return [];
  }
}

// Recursively find all JS/TS files
function findJSFiles(dir, extensions = ['.js', '.jsx', '.ts', '.tsx']) {
  const files = [];
  
  function traverse(currentDir) {
    try {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip node_modules and other common directories
          if (!['node_modules', '.git', '.expo', 'dist', 'build'].includes(item)) {
            traverse(fullPath);
          }
        } else if (extensions.includes(path.extname(item))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }
  
  traverse(dir);
  return files;
}

// Main audit function
function auditDependencies() {
  log('🔍 Starting Dependency Audit...', 'blue');
  log('', 'reset');
  
  const rootDir = path.resolve(__dirname, '..');
  const backendDir = path.join(rootDir, 'backend');
  
  // Read package.json files
  const frontendPackage = readPackageJson(path.join(rootDir, 'package.json'));
  const backendPackage = readPackageJson(path.join(backendDir, 'package.json'));
  
  if (!frontendPackage || !backendPackage) {
    log('❌ Could not read package.json files', 'red');
    return;
  }
  
  // Get all dependencies from package.json files
  const frontendDeps = {
    ...frontendPackage.dependencies || {},
    ...frontendPackage.devDependencies || {},
    ...frontendPackage.optionalDependencies || {}
  };
  
  const backendDeps = {
    ...backendPackage.dependencies || {},
    ...backendPackage.devDependencies || {},
    ...backendPackage.optionalDependencies || {}
  };
  
  // Find all JS/TS files
  const frontendFiles = findJSFiles(path.join(rootDir, 'src'));
  const backendFiles = findJSFiles(backendDir);
  
  log(`📁 Found ${frontendFiles.length} frontend files`, 'blue');
  log(`📁 Found ${backendFiles.length} backend files`, 'blue');
  log('', 'reset');
  
  // Extract dependencies from files
  const usedFrontendDeps = new Set();
  const usedBackendDeps = new Set();
  
  frontendFiles.forEach(file => {
    const deps = extractDependencies(file);
    deps.forEach(dep => usedFrontendDeps.add(dep));
  });
  
  backendFiles.forEach(file => {
    const deps = extractDependencies(file);
    deps.forEach(dep => usedBackendDeps.add(dep));
  });
  
  // Built-in Node.js modules (don't need to be in package.json)
  const builtInModules = new Set([
    'fs', 'path', 'crypto', 'util', 'os', 'url', 'querystring', 'stream',
    'events', 'buffer', 'process', 'child_process', 'cluster', 'dgram',
    'dns', 'domain', 'http', 'https', 'net', 'punycode', 'readline',
    'repl', 'string_decoder', 'tls', 'tty', 'vm', 'zlib', 'assert',
    'constants', 'module', 'timers', 'v8', 'worker_threads'
  ]);
  
  // Filter out built-in modules
  const filteredBackendDeps = Array.from(usedBackendDeps).filter(dep => !builtInModules.has(dep));
  
  // Check for missing dependencies
  log('🔍 FRONTEND DEPENDENCY ANALYSIS:', 'bold');
  log('', 'reset');
  
  const missingFrontendDeps = Array.from(usedFrontendDeps).filter(dep => 
    !frontendDeps[dep] && !builtInModules.has(dep)
  );
  
  if (missingFrontendDeps.length === 0) {
    log('✅ All frontend dependencies are properly tracked!', 'green');
  } else {
    log('❌ Missing frontend dependencies:', 'red');
    missingFrontendDeps.forEach(dep => log(`   - ${dep}`, 'red'));
  }
  
  log('', 'reset');
  log('🔍 BACKEND DEPENDENCY ANALYSIS:', 'bold');
  log('', 'reset');
  
  const missingBackendDeps = filteredBackendDeps.filter(dep => !backendDeps[dep]);
  
  if (missingBackendDeps.length === 0) {
    log('✅ All backend dependencies are properly tracked!', 'green');
  } else {
    log('❌ Missing backend dependencies:', 'red');
    missingBackendDeps.forEach(dep => log(`   - ${dep}`, 'red'));
  }
  
  // Check for unused dependencies
  log('', 'reset');
  log('🔍 UNUSED DEPENDENCY ANALYSIS:', 'bold');
  log('', 'reset');
  
  const unusedFrontendDeps = Object.keys(frontendDeps).filter(dep => 
    !usedFrontendDeps.has(dep) && 
    !['expo', '@expo/vector-icons', 'react', 'react-native'].includes(dep) // Keep essential packages
  );
  
  const unusedBackendDeps = Object.keys(backendDeps).filter(dep => 
    !usedBackendDeps.has(dep) &&
    !['nodemon', 'jest'].includes(dep) // Keep dev tools
  );
  
  if (unusedFrontendDeps.length === 0) {
    log('✅ No unused frontend dependencies found!', 'green');
  } else {
    log('⚠️  Potentially unused frontend dependencies:', 'yellow');
    unusedFrontendDeps.forEach(dep => log(`   - ${dep}`, 'yellow'));
  }
  
  if (unusedBackendDeps.length === 0) {
    log('✅ No unused backend dependencies found!', 'green');
  } else {
    log('⚠️  Potentially unused backend dependencies:', 'yellow');
    unusedBackendDeps.forEach(dep => log(`   - ${dep}`, 'yellow'));
  }
  
  // Summary
  log('', 'reset');
  log('📊 SUMMARY:', 'bold');
  log(`   Frontend dependencies: ${Object.keys(frontendDeps).length}`, 'blue');
  log(`   Backend dependencies: ${Object.keys(backendDeps).length}`, 'blue');
  log(`   Used frontend packages: ${usedFrontendDeps.size}`, 'blue');
  log(`   Used backend packages: ${usedBackendDeps.size}`, 'blue');
  log(`   Missing frontend: ${missingFrontendDeps.length}`, missingFrontendDeps.length > 0 ? 'red' : 'green');
  log(`   Missing backend: ${missingBackendDeps.length}`, missingBackendDeps.length > 0 ? 'red' : 'green');
  log(`   Unused frontend: ${unusedFrontendDeps.length}`, unusedFrontendDeps.length > 0 ? 'yellow' : 'green');
  log(`   Unused backend: ${unusedBackendDeps.length}`, unusedBackendDeps.length > 0 ? 'yellow' : 'green');
  
  // Generate install commands for missing dependencies
  if (missingFrontendDeps.length > 0) {
    log('', 'reset');
    log('🔧 To install missing frontend dependencies:', 'blue');
    log(`   npm install ${missingFrontendDeps.join(' ')}`, 'blue');
  }
  
  if (missingBackendDeps.length > 0) {
    log('', 'reset');
    log('🔧 To install missing backend dependencies:', 'blue');
    log(`   cd backend && npm install ${missingBackendDeps.join(' ')}`, 'blue');
  }
  
  log('', 'reset');
  log('✅ Dependency audit complete!', 'green');
}

// Run the audit
auditDependencies();

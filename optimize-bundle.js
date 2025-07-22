#!/usr/bin/env node

/**
 * Bundle optimization script - Simplified version
 * 
 * This script analyzes bundle sizes and provides optimization suggestions.
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Analyzing application...');

// Build the project
exec('npm run build', (error, stdout, stderr) => {
  if (error) {
    console.error(`❌ Build failed: ${error.message}`);
    return;
  }
  
  console.log('✅ Build complete!');
  
  // Check for large node modules
  console.log('\n📦 Checking for optimization opportunities...');
  
  const packageJson = require('./package.json');
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  
  // List of known large packages and their alternatives
  const largePackages = {
    'moment': 'Consider using date-fns or dayjs which are much smaller',
    'lodash': 'Consider using lodash-es for better tree-shaking or just import individual functions',
    'jquery': 'Modern frameworks rarely need jQuery, consider removing it',
    'chart.js': 'If only using a few chart types, consider a lighter alternative like lightweight-charts',
    'monaco-editor': 'Very large package, ensure it\'s lazy loaded',
    '@material-ui/core': 'Consider using @mui/material which has better tree-shaking'
  };
  
  // Check for large packages
  let foundLargePackages = false;
  Object.keys(dependencies).forEach(dep => {
    if (largePackages[dep]) {
      foundLargePackages = true;
      console.log(`⚠️  Found ${dep}: ${largePackages[dep]}`);
    }
  });
  
  if (!foundLargePackages) {
    console.log('✅ No known large packages detected!');
  }
  
  // Provide general optimization tips
  console.log('\n🚀 General optimization tips:');
  console.log('1. Use dynamic imports for routes and large components');
  console.log('2. Use import() for libraries only needed in specific cases');
  console.log('3. Avoid barrel files (index.js re-exports) as they can break tree-shaking');
  console.log('4. Optimize images with modern formats (WebP, AVIF)');
  console.log('5. Use preconnect for third-party domains');
  console.log('6. Add font-display: swap to font CSS');
  
  console.log('\n📈 Next steps:');
  console.log('- Test your site with tools like Lighthouse');
  console.log('- Consider adding a CDN for assets');
  console.log('- Implement a service worker for caching');
}); 
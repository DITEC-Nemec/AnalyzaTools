import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const distDir = path.join(__dirname, 'dist');

// Create directories
fs.mkdirSync(path.join(distDir, 'algorithm'), { recursive: true });
fs.mkdirSync(path.join(distDir, 'domainModel'), { recursive: true });

// Move algorithm files
const algorithmJsSrc = path.join(distDir, 'algorithm.js');
const algorithmJsDest = path.join(distDir, 'algorithm', 'index.js');
if (fs.existsSync(algorithmJsSrc)) {
  fs.copyFileSync(algorithmJsSrc, algorithmJsDest);
  fs.unlinkSync(algorithmJsSrc);
  console.log(`Moved ${algorithmJsSrc} → ${algorithmJsDest}`);
}

const algorithmCssSrc = path.join(distDir, 'algorithm.css');
const algorithmCssDest = path.join(distDir, 'algorithm', 'index.css');
if (fs.existsSync(algorithmCssSrc)) {
  fs.copyFileSync(algorithmCssSrc, algorithmCssDest);
  fs.unlinkSync(algorithmCssSrc);
  console.log(`Moved ${algorithmCssSrc} → ${algorithmCssDest}`);
}

// Move domainModel files
const domainJsSrc = path.join(distDir, 'domainModel.js');
const domainJsDest = path.join(distDir, 'domainModel', 'index.js');
if (fs.existsSync(domainJsSrc)) {
  fs.copyFileSync(domainJsSrc, domainJsDest);
  fs.unlinkSync(domainJsSrc);
  console.log(`Moved ${domainJsSrc} → ${domainJsDest}`);
}

const domainCssSrc = path.join(distDir, 'domainModel.css');
const domainCssDest = path.join(distDir, 'domainModel', 'index.css');
if (fs.existsSync(domainCssSrc)) {
  fs.copyFileSync(domainCssSrc, domainCssDest);
  fs.unlinkSync(domainCssSrc);
  console.log(`Moved ${domainCssSrc} → ${domainCssDest}`);
}

// Copy HTML files
const algorithmHtmlSrc = path.join(distDir, 'src', 'algorithm', 'index.html');
const algorithmHtmlDest = path.join(distDir, 'algorithm', 'index.html');
if (fs.existsSync(algorithmHtmlSrc)) {
  fs.copyFileSync(algorithmHtmlSrc, algorithmHtmlDest);
  console.log(`Copied ${algorithmHtmlSrc} → ${algorithmHtmlDest}`);
}

const domainHtmlSrc = path.join(distDir, 'src', 'domainModel', 'index.html');
const domainHtmlDest = path.join(distDir, 'domainModel', 'index.html');
if (fs.existsSync(domainHtmlSrc)) {
  fs.copyFileSync(domainHtmlSrc, domainHtmlDest);
  console.log(`Copied ${domainHtmlSrc} → ${domainHtmlDest}`);
}

// Clean up src directory
const srcDir = path.join(distDir, 'src');
if (fs.existsSync(srcDir)) {
  fs.rmSync(srcDir, { recursive: true });
  console.log(`Cleaned up ${srcDir}`);
}

console.log('Build files organized successfully');

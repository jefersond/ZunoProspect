const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/pages/AdminRealtime.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

lines.forEach((line, idx) => {
  if (line.includes('<Sheet open')) {
    console.log(`Linha ${idx + 1}: ${line.trim()}`);
  }
  if (line.includes('</Sheet>')) {
    console.log(`Linha ${idx + 1}: ${line.trim()}`);
  }
});

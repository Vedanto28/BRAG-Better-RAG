import fs from 'node:fs';

const path = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
console.log(`Checking path: "${path}"`);
const exists = fs.existsSync(path);
console.log(`Exists: ${exists}`);

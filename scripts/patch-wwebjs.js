const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'node_modules', 'whatsapp-web.js', 'src', 'Client.js');
const patchPath = path.join(__dirname, '..', 'patches', 'Client.js');

if (fs.existsSync(targetPath) && fs.existsSync(patchPath)) {
    fs.copyFileSync(patchPath, targetPath);
    console.log('Successfully patched whatsapp-web.js Client.js');
} else {
    console.log('Patch or target not found, skipping patch.');
}

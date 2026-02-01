// Bayroqlarni yuklab olish skripti
// Ishlatish: node download-flags.js

const https = require('https');
const fs = require('fs');
const path = require('path');

const flagsDir = path.join(__dirname, 'public', 'flags');

// Papka yo'q bo'lsa yaratish
if (!fs.existsSync(flagsDir)) {
    fs.mkdirSync(flagsDir, { recursive: true });
}

const countries = [
    'uz', 'us', 'tr', 'ru', 'cn', 'jp', 'de', 'fr', 'it', 'es',
    'br', 'ar', 'mx', 'ca', 'au', 'in', 'kr', 'id', 'sa', 'eg',
    'za', 'ng', 'pk', 'bd', 'vn', 'th', 'my', 'ph', 'pl', 'ua',
    'ro', 'nl', 'be', 'se', 'no', 'fi', 'dk', 'ch', 'at', 'gr',
    'pt', 'cz', 'hu', 'ie', 'nz', 'sg', 'ir', 'iq', 'il', 'ae',
    'kz', 'kg', 'tj', 'tm', 'az', 'ge', 'am', 'by', 'md', 'lt'
];

const downloadFlag = (code) => {
    return new Promise((resolve, reject) => {
        const url = `https://flagcdn.com/w80/${code}.png`;
        const filePath = path.join(flagsDir, `${code}.png`);

        // Agar fayl mavjud bo'lsa, o'tkazib yuborish
        if (fs.existsSync(filePath)) {
            console.log(`✓ ${code}.png already exists`);
            resolve();
            return;
        }

        const file = fs.createWriteStream(filePath);

        https.get(url, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    console.log(`✓ Downloaded ${code}.png`);
                    resolve();
                });
            } else {
                file.close();
                fs.unlink(filePath, () => {});
                console.log(`✗ Failed to download ${code}.png (${response.statusCode})`);
                resolve(); // Xato bo'lsa ham davom etamiz
            }
        }).on('error', (err) => {
            file.close();
            fs.unlink(filePath, () => {});
            console.log(`✗ Error downloading ${code}.png: ${err.message}`);
            resolve();
        });
    });
};

const downloadAll = async () => {
    console.log('Bayroqlarni yuklab olish boshlandi...\n');

    for (const code of countries) {
        await downloadFlag(code);
        // Serverga yukni kamaytirish uchun kutish
        await new Promise(r => setTimeout(r, 100));
    }

    console.log('\nBarcha bayroqlar yuklandi!');
};

downloadAll();

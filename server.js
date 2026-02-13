const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8090;
const BASE_DIR = __dirname;
const LETTERS_DIR = path.join(BASE_DIR, 'letters');

// Ensure letters directory exists
if (!fs.existsSync(LETTERS_DIR)) {
    fs.mkdirSync(LETTERS_DIR, { recursive: true });
}

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webmanifest': 'application/manifest+json'
};

function readBody(req) {
    return new Promise(function (resolve, reject) {
        var body = '';
        req.on('data', function (chunk) { body += chunk; });
        req.on('end', function () {
            try { resolve(JSON.parse(body)); }
            catch (e) { reject(e); }
        });
    });
}

function formatDate(d) {
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

function formatTime(d) {
    return String(d.getHours()).padStart(2, '0') + '-' +
        String(d.getMinutes()).padStart(2, '0') + '-' +
        String(d.getSeconds()).padStart(2, '0');
}

const server = http.createServer(async function (req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // ====== API: Save Letter ======
    if (req.method === 'POST' && req.url === '/api/letter') {
        try {
            var data = await readBody(req);
            var now = new Date();
            var filename = formatDate(now) + '_' + formatTime(now) + '.md';
            var filepath = path.join(LETTERS_DIR, filename);

            var content = '# 右右的信 💌\n\n';
            content += '**时间**：' + now.toLocaleString('zh-CN') + '\n\n---\n\n';
            content += data.text + '\n\n---\n\n';
            content += '*——右右 (o´・ェ・｀o)*\n';

            fs.writeFileSync(filepath, content, 'utf-8');

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, file: filename }));
            console.log('🐺💌 收到右右的信：' + filename);
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: e.message }));
        }
        return;
    }

    // ====== API: Save Mood ======
    if (req.method === 'POST' && req.url === '/api/mood') {
        try {
            var data = await readBody(req);
            var moodFile = path.join(BASE_DIR, 'moods-from-right-right.md');

            // Read existing or create new
            var md = '# 右右的心情日历 🌙\n\n| 日期 | 心情 |\n| --- | --- |\n';
            var existing = {};

            if (fs.existsSync(moodFile)) {
                var lines = fs.readFileSync(moodFile, 'utf-8').split('\n');
                lines.forEach(function (line) {
                    var match = line.match(/^\| (\d{4}-\d{2}-\d{2}) \| (.+) \|$/);
                    if (match) existing[match[1]] = match[2];
                });
            }

            // Merge new mood
            existing[data.date] = data.emoji;

            // Rebuild file
            var sortedKeys = Object.keys(existing).sort();
            var newMd = '# 右右的心情日历 🌙\n\n';
            newMd += '*最后更新：' + new Date().toLocaleString('zh-CN') + '*\n\n';
            newMd += '| 日期 | 心情 |\n| --- | --- |\n';
            sortedKeys.forEach(function (k) {
                newMd += '| ' + k + ' | ' + existing[k] + ' |\n';
            });
            newMd += '\n*——右右的心情记录*\n';

            fs.writeFileSync(moodFile, newMd, 'utf-8');

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            console.log('🐺🌙 右右的心情：' + data.date + ' ' + data.emoji);
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: e.message }));
        }
        return;
    }

    // ====== Static File Serving ======
    var urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';

    var filePath = path.join(BASE_DIR, urlPath);

    // Security: don't serve files outside BASE_DIR
    if (!filePath.startsWith(BASE_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, function (err, data) {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
        var ext = path.extname(filePath).toLowerCase();
        var mime = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
            'Content-Type': mime,
            'Cache-Control': 'no-cache'
        });
        res.end(data);
    });
});

server.listen(PORT, function () {
    console.log('');
    console.log('  🐺 Our Den 小窝服务器启动了！');
    console.log('  📍 地址：http://localhost:' + PORT);
    console.log('  💌 信件保存位置：' + LETTERS_DIR);
    console.log('  🌙 心情保存位置：' + path.join(BASE_DIR, 'moods-from-right-right.md'));
    console.log('');
});

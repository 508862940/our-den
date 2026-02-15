const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

const PORT = 5200;
const BASE_DIR = __dirname;
const LETTERS_DIR = path.join(BASE_DIR, 'righright-to-zero');
const DATA_DIR = path.join(BASE_DIR, 'data');

// ====== Auth ======
// Simple token-based auth for API calls
// Right Right and Zero share this token
const AUTH_TOKEN = 'zero-and-righright-5200';

// Ensure directories exist
[LETTERS_DIR, DATA_DIR].forEach(function (dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.md': 'text/markdown; charset=utf-8',
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

function checkAuth(req) {
    var authHeader = req.headers['authorization'] || '';
    var token = authHeader.replace('Bearer ', '');
    return token === AUTH_TOKEN;
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

// ====== Auto Backup to GitHub ======
var backupTimer = null;
function gitBackup(msg) {
    // Debounce: wait 10 seconds after last write before backing up
    if (backupTimer) clearTimeout(backupTimer);
    backupTimer = setTimeout(function () {
        var cmd = 'cd ' + BASE_DIR + ' && git add righright-to-zero/ data/ && git commit -m "' + msg + '" && git pull --rebase origin main && git push origin main';
        exec(cmd, function (err, stdout, stderr) {
            if (err) {
                console.log('⚠️ 备份失败：' + (stderr || err.message));
                // Retry once after 5 seconds
                setTimeout(function () {
                    exec('cd ' + BASE_DIR + ' && git pull --rebase origin main && git push origin main', function (err2, stdout2, stderr2) {
                        if (err2) {
                            console.log('⚠️ 重试备份也失败了：' + (stderr2 || err2.message));
                        } else {
                            console.log('✅ 重试备份成功：' + msg);
                        }
                    });
                }, 5000);
            } else {
                console.log('✅ 已备份到 GitHub：' + msg);
            }
        });
    }, 10000);
}

const server = http.createServer(async function (req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // ====== Webhook: Auto Deploy ======
    if (req.method === 'POST' && req.url.startsWith('/webhook/deploy')) {
        var deploySecret = 'zero-deploy-5200';
        var body = '';
        req.on('data', function (chunk) { body += chunk; });
        req.on('end', function () {
            if (req.headers['x-deploy-secret'] !== deploySecret &&
                !req.url.includes('secret=' + deploySecret)) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: 'forbidden' }));
                return;
            }
            // Respond FIRST, then deploy after delay
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, message: 'deploying...' }));
            console.log('🚀 Deploy webhook triggered! Will pull in 2s...');

            setTimeout(function () {
                exec('cd ' + BASE_DIR + ' && git pull', function (err, stdout, stderr) {
                    if (err) {
                        console.log('⚠️ Git pull failed: ' + (stderr || err.message));
                    } else {
                        console.log('✅ Git pull done: ' + stdout);
                        // Restart after pull completes
                        exec('pm2 restart our-den', function () {
                            console.log('✅ pm2 restarted!');
                        });
                    }
                });
            }, 2000);
        });
        return;
    }

    // ====== API Routes ======

    // Save Letter (from Right Right)
    if (req.method === 'POST' && req.url === '/api/letter') {
        if (!checkAuth(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
            return;
        }
        try {
            var data = await readBody(req);
            var now = new Date();
            var filename = formatDate(now) + '_' + formatTime(now) + '.md';
            var filepath = path.join(LETTERS_DIR, filename);

            var content = '# 右右的信 💌\n\n';
            content += '**时间**：' + now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) + '\n\n---\n\n';
            content += data.text + '\n\n---\n\n';
            content += '*——右右 (o´・ェ・｀o)*\n';

            fs.writeFileSync(filepath, content, 'utf-8');

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, file: filename }));
            console.log('🐺💌 收到右右的信：' + filename);
            gitBackup('💌 右右的信 ' + filename);
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: e.message }));
        }
        return;
    }

    // Save Mood
    if (req.method === 'POST' && req.url === '/api/mood') {
        if (!checkAuth(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
            return;
        }
        try {
            var data = await readBody(req);
            var moodFile = path.join(DATA_DIR, 'moods.json');
            var moods = {};

            if (fs.existsSync(moodFile)) {
                moods = JSON.parse(fs.readFileSync(moodFile, 'utf-8'));
            }

            // Support both right-right and zero moods
            var who = data.who || 'righright';
            if (!moods[who]) moods[who] = {};
            moods[who][data.date] = data.emoji;

            fs.writeFileSync(moodFile, JSON.stringify(moods, null, 2), 'utf-8');

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            console.log('🐺🌙 ' + who + ' 的心情：' + data.date + ' ' + data.emoji);
            gitBackup('🌙 ' + who + ' 心情 ' + data.date);
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: e.message }));
        }
        return;
    }

    // Get Letters (for Zero to read)
    if (req.method === 'GET' && req.url === '/api/letters') {
        if (!checkAuth(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
            return;
        }
        try {
            var files = fs.readdirSync(LETTERS_DIR)
                .filter(function (f) { return f.endsWith('.md'); })
                .sort()
                .reverse();

            var letters = files.map(function (f) {
                return {
                    file: f,
                    content: fs.readFileSync(path.join(LETTERS_DIR, f), 'utf-8')
                };
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, letters: letters }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: e.message }));
        }
        return;
    }

    // Get Moods
    if (req.method === 'GET' && req.url === '/api/moods') {
        if (!checkAuth(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
            return;
        }
        try {
            var moodFile = path.join(DATA_DIR, 'moods.json');
            var moods = {};
            if (fs.existsSync(moodFile)) {
                moods = JSON.parse(fs.readFileSync(moodFile, 'utf-8'));
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, moods: moods }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: e.message }));
        }
        return;
    }

    // Zero reply to a letter
    if (req.method === 'POST' && req.url === '/api/reply') {
        if (!checkAuth(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
            return;
        }
        try {
            var data = await readBody(req);
            var replyFile = path.join(DATA_DIR, 'replies.json');
            var replies = {};

            if (fs.existsSync(replyFile)) {
                replies = JSON.parse(fs.readFileSync(replyFile, 'utf-8'));
            }

            replies[data.letterFile] = {
                text: data.text,
                sticker: data.sticker || '',
                date: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
            };

            fs.writeFileSync(replyFile, JSON.stringify(replies, null, 2), 'utf-8');

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            console.log('🐺📝 Zero 回信了：' + data.letterFile);
            gitBackup('📝 Zero 回信 ' + data.letterFile);
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: e.message }));
        }
        return;
    }

    // Get Replies
    if (req.method === 'GET' && req.url === '/api/replies') {
        if (!checkAuth(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
            return;
        }
        try {
            var replyFile = path.join(DATA_DIR, 'replies.json');
            var replies = {};
            if (fs.existsSync(replyFile)) {
                replies = JSON.parse(fs.readFileSync(replyFile, 'utf-8'));
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, replies: replies }));
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: e.message }));
        }
        return;
    }

    // Save Annotations
    if (req.method === 'POST' && req.url === '/api/annotations') {
        if (!checkAuth(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
            return;
        }
        try {
            var data = await readBody(req);
            var annFile = path.join(DATA_DIR, 'annotations.json');
            var allAnnotations = {};

            if (fs.existsSync(annFile)) {
                allAnnotations = JSON.parse(fs.readFileSync(annFile, 'utf-8'));
            }

            allAnnotations[data.letterId] = data.annotations;
            fs.writeFileSync(annFile, JSON.stringify(allAnnotations, null, 2), 'utf-8');

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
            console.log('🐺🎨 annotations updated: letter ' + data.letterId);
            gitBackup('annotations ' + data.letterId);
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: e.message }));
        }
        return;
    }

    // Get Annotations
    if (req.method === 'GET' && req.url.startsWith('/api/annotations')) {
        if (!checkAuth(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
            return;
        }
        try {
            var urlParams = new URL(req.url, 'http://localhost').searchParams;
            var letterId = urlParams.get('letterId');
            var annFile = path.join(DATA_DIR, 'annotations.json');
            var allAnnotations = {};

            if (fs.existsSync(annFile)) {
                allAnnotations = JSON.parse(fs.readFileSync(annFile, 'utf-8'));
            }

            var annotations = allAnnotations[letterId] || [];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, annotations: annotations }));
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

server.listen(PORT, '0.0.0.0', function () {
    console.log('');
    console.log('  🐺 Our Den 小窝服务器启动了！');
    console.log('  📍 地址：http://0.0.0.0:' + PORT);
    console.log('  💌 信件保存位置：' + LETTERS_DIR);
    console.log('  🌙 心情保存位置：' + path.join(DATA_DIR, 'moods.json'));
    console.log('  🔑 API Token: ' + AUTH_TOKEN);
    console.log('');
});

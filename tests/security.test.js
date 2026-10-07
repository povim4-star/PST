const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3');
const jwt = require('jsonwebtoken');
const xlsx = require('xlsx');
const { imageType } = require('../security');

test('인증·권한·업로드·사진·엑셀 회귀 검증', async t => {
    const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'pst-security-'));
    const dbPath = path.join(dir, 'test.sqlite');
    const secret = 'security-test-secret-with-at-least-32-characters';
    const base = 'http://127.0.0.1:31982';
    Object.assign(process.env, {
        ...process.env, PORT: '31982', HOST: '127.0.0.1', NODE_ENV: 'production',
        JWT_SECRET: secret, ADMIN_PASSWORD: 'Test-admin-password-2026', SQLITE_PATH: dbPath,
        UPLOADS_DIR: dir, DATABASE_URL: '', SUPABASE_URL: '', SUPABASE_SERVICE_KEY: '', ALLOW_REGISTRATION: 'true', RENDER: ''
    });
    const app = require('../server');
    const server = await app.start();
    t.after(async () => {
        await new Promise(resolve => server.close(resolve));
        await new Promise(resolve => app.db.close(resolve));
        fs.rmSync(dir, { recursive: true, force: true });
    });
    let token;
    for (let i = 0; i < 40; i++) {
        try {
            const res = await fetch(base + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'Test-admin-password-2026' }) });
            if (res.ok) { token = (await res.json()).token; break; }
        } catch (_) {}
        await new Promise(r => setTimeout(r, 150));
    }
    assert.ok(token);
    const headers = { Authorization: `Bearer ${token}` };
    await t.test('비로그인 접근과 임의 JWT 차단', async () => {
        for (const route of ['/employees', '/employee/1', '/history/1', '/export/excel', '/media/employees/1']) {
            assert.equal((await fetch(base + route)).status, 401, route);
        }
        assert.equal((await fetch(base + '/employees', { headers: { Authorization: 'Bearer forged' } })).status, 403);
        assert.equal((await fetch(base + '/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'intruder', password: 'intruder-password' }) })).status, 401);
    });
    await t.test('DB 권한이 일반 사용자인 경우 관리자 JWT 주장도 무시', async () => {
        const db = new sqlite3.Database(dbPath);
        await new Promise((resolve, reject) => db.run("INSERT INTO users (id,username,password,role) VALUES (99,'viewer','unused','viewer')", err => err ? reject(err) : resolve()));
        await new Promise(resolve => db.close(resolve));
        const fakeRole = jwt.sign({ id: 99, role: 'admin' }, secret);
        assert.equal((await fetch(base + '/employees', { headers: { Authorization: `Bearer ${fakeRole}` } })).status, 403);
    });
    let employeeId;
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=', 'base64');
    await t.test('사진은 인증 API에서만 조회하고 공개 경로는 차단', async () => {
        const body = new FormData(); body.set('name', '<img src=x onerror=alert(1)>'); body.set('team', 'test'); body.set('position', 'test'); body.set('join_date', '2026-01-01');
        body.set('photo', new Blob([png], { type: 'image/png' }), 'test.png');
        const created = await fetch(base + '/employee', { method: 'POST', headers, body });
        assert.equal(created.status, 200); employeeId = (await created.json()).id;
        const list = await (await fetch(base + '/employees', { headers })).json();
        assert.equal(list[0].photo, `/media/employees/${employeeId}`);
        const photo = await fetch(base + list[0].photo, { headers });
        assert.equal(photo.status, 200); assert.equal(photo.headers.get('cache-control'), 'no-store');
        assert.deepEqual(Buffer.from(await photo.arrayBuffer()), png);
        const filename = fs.readdirSync(dir).find(s => s.endsWith('.png'));
        assert.equal((await fetch(base + '/uploads/' + filename)).status, 404);
    });
    await t.test('위장 HTML 사진과 5MB 초과 파일 차단', async () => {
        assert.equal(imageType(Buffer.from('<svg onload="alert(1)"></svg>')), null);
        const body = new FormData(); body.set('photo', new Blob(['<html>bad</html>'], { type: 'image/png' }), 'fake.png');
        assert.equal((await fetch(base + `/employee/${employeeId}/photo`, { method: 'POST', headers, body })).status, 415);
        const large = new FormData(); large.set('photo', new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)]), 'large.png');
        assert.equal((await fetch(base + `/employee/${employeeId}/photo`, { method: 'POST', headers, body: large })).status, 413);
    });
    await t.test('업데이트한 엑셀 라이브러리의 내보내기·가져오기', async () => {
        const exported = await fetch(base + '/export/excel', { headers }); assert.equal(exported.status, 200);
        const buffer = Buffer.from(await exported.arrayBuffer());
        const workbook = xlsx.read(buffer); assert.ok(workbook.SheetNames.length);
        const body = new FormData(); body.set('file', new Blob([buffer]), 'test.xlsx');
        const imported = await fetch(base + '/upload', { method: 'POST', headers, body });
        assert.equal(imported.status, 200); assert.equal((await imported.json()).count, 1);
    });
    await t.test('출력 인코딩·외부 개인정보 번역 제거·보안 헤더', async () => {
        const vm = require('node:vm'); const context = { MutationObserver: class { observe() {} }, document: { documentElement: {}, addEventListener() {} } };
        vm.createContext(context); vm.runInContext(fs.readFileSync('public/security.js', 'utf8'), context);
        assert.equal(context.escapeHtml('<img "x" onerror=\'y\'>&'), '&lt;img &quot;x&quot; onerror=&#39;y&#39;&gt;&amp;');
        assert.ok(!fs.readFileSync('public/detail.html', 'utf8').includes('translate.googleapis.com'));
        const res = await fetch(base + '/');
        assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
        assert.ok(res.headers.get('content-security-policy').includes("connect-src 'self'"));
    });
    await t.test('로그인 반복 요청 제한', async () => {
        let status;
        for (let i = 0; i < 22; i++) {
            status = (await fetch(base + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'missing', password: 'wrong' }) })).status;
            if (status === 429) break;
        }
        assert.equal(status, 429);
    });
});

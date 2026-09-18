const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { createDatabase } = require('./database');

const app = express();
const PORT = Number(process.env.PORT) || 3002;
const HOST = process.env.HOST || '127.0.0.1';
const isProduction = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (isProduction ? '' : 'hr-premium-secret-key-2026');
const INITIAL_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (isProduction ? '' : 'admin123');

if (!JWT_SECRET) throw new Error('운영환경에서는 JWT_SECRET 환경변수가 필요합니다.');
if (!INITIAL_ADMIN_PASSWORD) throw new Error('운영환경에서는 ADMIN_PASSWORD 환경변수가 필요합니다.');

// 업로드 디렉토리 확보
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

app.use(cors({ origin: process.env.CORS_ORIGIN || false }));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
    db.get('SELECT 1 AS ok', (err) => {
        if (err) return res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
        res.json({ status: 'ok', database: process.env.DATABASE_URL ? 'postgresql' : 'sqlite' });
    });
});

// SQLite 데이터베이스 초기화
const db = createDatabase((err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to SQLite Database.');
        initDatabase();
    }
});

function initDatabase() {
    db.serialize(() => {
        // users 테이블
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT
        )`);

        // employees 테이블
        db.run(`CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            team TEXT,
            position TEXT,
            phone TEXT,
            photo TEXT,
            join_date TEXT,
            birth_date TEXT,
            strengths TEXT,
            weaknesses TEXT,
            health_status TEXT,
            certificates TEXT,
            competency_desc TEXT,
            family_relations TEXT
        )`);

        // evaluations 테이블
        db.run(`CREATE TABLE IF NOT EXISTS evaluations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER,
            welding INTEGER,
            centering INTEGER,
            safety_violation INTEGER,
            strength_status INTEGER,
            tech_eval INTEGER,
            late INTEGER,
            absent INTEGER,
            score REAL,
            grade TEXT,
            created_at TEXT
        )`);

        // welding_reports 테이블 (용접 상세 평가표)
        db.run(`CREATE TABLE IF NOT EXISTS welding_reports (
            employee_id INTEGER PRIMARY KEY,
            bead_visual INTEGER,
            bead_penetration INTEGER,
            bead_defect INTEGER,
            pipe_backbead INTEGER,
            pipe_alignment INTEGER,
            pipe_defect INTEGER,
            general_opinion TEXT,
            photo_path TEXT,
            created_at TEXT
        )`);

        // 기본 관리자 계정 생성 (admin / admin123)
        db.get(`SELECT * FROM users WHERE username = 'admin'`, (err, row) => {
            if (!row) {
                bcrypt.hash(INITIAL_ADMIN_PASSWORD, 10, (err, hash) => {
                    if (!err) {
                        db.run(`INSERT INTO users (username, password, role) VALUES ('admin', ?, 'admin')`, [hash]);
                    }
                });
            }
        });
    });
}

// Multer: 메모리 저장 (서버리스/휘발성 디스크 대응)
const upload = multer({ storage: multer.memoryStorage() });

// Supabase Storage (설정 시 사진을 영구 저장, 없으면 로컬 디스크 폴백)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'photos';
let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
    console.log('Supabase Storage 연결됨 (bucket: ' + SUPABASE_BUCKET + ')');
}

// 사진 저장: Supabase Storage 우선, 없으면 로컬 uploads 폴더
async function savePhoto(file, originalname) {
    const safe = (originalname || file.originalname || 'photo').replace(/[^\w.\-가-힣]/g, '_');
    const filename = Date.now() + '-' + safe;
    if (supabase) {
        const { error } = await supabase.storage.from(SUPABASE_BUCKET)
            .upload(filename, file.buffer, { contentType: file.mimetype, upsert: false });
        if (error) throw error;
        const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(filename);
        return { url: data.publicUrl, key: filename };
    }
    fs.writeFileSync(path.join(uploadsDir, filename), file.buffer);
    return { url: `/uploads/${filename}`, key: filename };
}

// Supabase Storage 객체 삭제 (매칭 실패 시 정리용)
async function deletePhoto(key) {
    try {
        if (supabase) await supabase.storage.from(SUPABASE_BUCKET).remove([key]);
        else fs.unlink(path.join(uploadsDir, key), () => {});
    } catch (_) { /* best-effort */ }
}

// JWT 인증 미들웨어 (모든 로그인 사용자는 권한 우회를 위해 admin 권한 부여)
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'Token missing' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token invalid' });
        req.user = user;
        next();
    });
}

// --- API Endpoints ---

// 1. 회원가입 (모든 신규 가입 유저도 admin 역할을 부여하여 업로드 제약 제거)
app.post('/register', (req, res) => {
    if (process.env.ALLOW_REGISTRATION !== 'true') {
        return res.status(403).json({ error: 'Public registration is disabled' });
    }
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'ID and Password are required' });

    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return res.status(500).json({ error: 'Hashing error' });
        
        db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, 'admin')`, [username, hash], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'Already existing ID' });
                }
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'Registration complete! Please login.' });
        });
    });
});

// 2. 로그인
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(400).json({ error: 'User not found' });

        bcrypt.compare(password, user.password, (err, result) => {
            if (err) return res.status(500).json({ error: 'Encryption error' });
            if (!result) return res.status(400).json({ error: 'Password mismatch' });

            const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
            res.json({ token, role: user.role });
        });
    });
});

// 3. 직원 등록 (사진 업로드 포함)
app.post('/employee', authenticateToken, upload.single('photo'), async (req, res) => {
    const { name, team, position, join_date } = req.body;
    if (!name) return res.status(400).json({ error: 'Employee name is required' });

    let photoPath = '';
    try {
        if (req.file) photoPath = (await savePhoto(req.file)).url;
    } catch (e) {
        return res.status(500).json({ error: 'Photo upload failed' });
    }

    db.run(`INSERT INTO employees (name, team, position, photo, join_date) VALUES (?, ?, ?, ?, ?)`,
        [name, team, position, photoPath, join_date],
        function(err) {
            if (err) return res.status(500).json({ error: 'Database insert error' });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// 4. 직원 목록 가져오기
app.get('/employees', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM employees`, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database query error' });
        res.json(rows);
    });
});

// 4-1. 개별 직원 단건 정보 가져오기
app.get('/employee/:id', authenticateToken, (req, res) => {
    const empId = req.params.id;
    db.get(`SELECT * FROM employees WHERE id = ?`, [empId], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database query error' });
        if (!row) return res.status(404).json({ error: 'Employee not found' });
        res.json(row);
    });
});

// 5. 직원 삭제
app.delete('/employee/:id', authenticateToken, (req, res) => {
    const empId = req.params.id;
    db.run(`DELETE FROM employees WHERE id = ?`, [empId], function(err) {
        if (err) return res.status(500).json({ error: 'Delete error' });
        
        // 연관된 평가기록 및 용접 레포트 같이 삭제
        db.run(`DELETE FROM evaluations WHERE employee_id = ?`, [empId]);
        db.run(`DELETE FROM welding_reports WHERE employee_id = ?`, [empId]);
        
        res.json({ success: true });
    });
});

// 6. 개별 직원 사진 업로드
app.post('/employee/:id/photo', authenticateToken, upload.single('photo'), async (req, res) => {
    const empId = req.params.id;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    let photoPath;
    try {
        photoPath = (await savePhoto(req.file)).url;
    } catch (e) {
        return res.status(500).json({ error: 'Photo upload failed' });
    }
    db.run(`UPDATE employees SET photo = ? WHERE id = ?`, [photoPath, empId], function(err) {
        if (err) return res.status(500).json({ error: 'Update photo error' });
        res.json({ success: true, photo: photoPath });
    });
});

// 7. 이름 매칭 벌크 사진 업로드
app.post('/employee/photo-by-name', authenticateToken, upload.single('photo'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // 파일명에서 이름만 추출 (예: '12345-홍길동.jpg' 또는 '홍길동.jpg')
    const originalName = req.file.originalname;
    const nameWithoutExt = path.parse(originalName).name;
    // 혹시 숫자가 섞인 꼬리표가 붙어있을 경우 한글 이름 매칭을 위해 클리닝
    const cleanName = nameWithoutExt.replace(/^[0-9]+-/, '').trim();

    let saved;
    try {
        saved = await savePhoto(req.file);
    } catch (e) {
        return res.status(500).json({ error: 'Photo upload failed' });
    }

    db.run(`UPDATE employees SET photo = ? WHERE name = ?`, [saved.url, cleanName], function(err) {
        if (err) return res.status(500).json({ error: 'Bulk update database error' });
        if (this.changes === 0) {
            // 매칭되는 이름이 없을 경우 업로드된 파일 정리
            deletePhoto(saved.key);
            return res.status(404).json({ error: `Employee named '${cleanName}' not found` });
        }
        res.json({ success: true, name: cleanName });
    });
});

// 8. 직원 상세 서술정보 업데이트 (PATCH)
app.patch('/employee/:id', authenticateToken, (req, res) => {
    const empId = req.params.id;
    const { strengths, weaknesses, health_status, certificates, competency_desc, family_relations } = req.body;

    db.run(`UPDATE employees SET 
        strengths = ?, 
        weaknesses = ?, 
        health_status = ?, 
        certificates = ?, 
        competency_desc = ?, 
        family_relations = ?
        WHERE id = ?`,
        [strengths, weaknesses, health_status, certificates, competency_desc, family_relations, empId],
        function(err) {
            if (err) return res.status(500).json({ error: 'Update failed' });
            res.json({ success: true });
        }
    );
});

// 9. 평가 기록 저장
app.post('/evaluation', authenticateToken, (req, res) => {
    const { employee_id, welding, centering, safety_violation, strength_status, tech_eval, late, absent } = req.body;

    const w = parseFloat(welding) || 0;
    const c = parseFloat(centering) || 0;
    const s = parseFloat(safety_violation) || 0;
    const st = parseFloat(strength_status) || 0;
    const t = parseFloat(tech_eval) || 0;

    // 평가 공식 계산
    const score = (w * 20 + c * 20 + (100 - s * 10) + st * 20 + t * 20) / 5;
    
    let grade = 'D';
    if (score >= 90) grade = 'A';
    else if (score >= 75) grade = 'B';
    else if (score >= 60) grade = 'C';

    const createdAt = new Date().toISOString();

    db.run(`INSERT INTO evaluations (employee_id, welding, centering, safety_violation, strength_status, tech_eval, late, absent, score, grade, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [employee_id, welding, centering, safety_violation, strength_status, tech_eval, late, absent, score, grade, createdAt],
        function(err) {
            if (err) return res.status(500).json({ error: 'Database insert error' });
            res.json({ success: true, score: score.toFixed(1), grade });
        }
    );
});

// 10. 특정 평가 히스토리 삭제 (DELETE)
app.delete('/evaluation/:id', authenticateToken, (req, res) => {
    const evalId = req.params.id;
    db.run(`DELETE FROM evaluations WHERE id = ?`, [evalId], function(err) {
        if (err) return res.status(500).json({ error: 'Database delete error' });
        res.json({ success: true, deleted: this.changes });
    });
});

// 10-1. 특정 평가 히스토리 수정 저장 (PUT)
app.put('/evaluation/:id', authenticateToken, (req, res) => {
    const evalId = parseInt(req.params.id);
    const { welding, centering, safety_violation, strength_status, tech_eval, late, absent } = req.body;

    const w = parseFloat(welding) || 0;
    const c = parseFloat(centering) || 0;
    const s = parseFloat(safety_violation) || 0;
    const st = parseFloat(strength_status) || 0;
    const t = parseFloat(tech_eval) || 0;

    const safetyScore = Math.max(0, 100 - s * 20); // 안전위반 0회 = 100점 만점!
    const score = Math.round((w * 20 + c * 20 + safetyScore + st * 20 + t * 20) / 5);
    
    let grade = 'D';
    if (score >= 90) grade = 'S';
    else if (score >= 80) grade = 'A';
    else if (score >= 70) grade = 'B';
    else if (score >= 60) grade = 'C';

    db.run(`UPDATE evaluations SET 
        welding = ?, 
        centering = ?, 
        safety_violation = ?, 
        strength_status = ?, 
        tech_eval = ?, 
        late = ?, 
        absent = ?, 
        score = ?, 
        grade = ? 
        WHERE id = ?`,
        [w, c, s, st, t, parseInt(late) || 0, parseInt(absent) || 0, score, grade, evalId],
        function(err) {
            if (err) return res.status(500).json({ error: 'Database update error' });
            res.json({ success: true, score, grade, changes: this.changes });
        }
    );
});

// 11. 특정 직원의 전체 평가 이력
app.get('/history/:employee_id', authenticateToken, (req, res) => {
    const empId = req.params.employee_id;
    db.all(`SELECT * FROM evaluations WHERE employee_id = ? ORDER BY created_at DESC`, [empId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'History query error' });
        res.json(rows || []);
    });
});

// 11. 대시보드 요약 정보 가져오기
app.get('/dashboard/summary', authenticateToken, (req, res) => {
    // 각 직원의 가장 최신 평가 데이터 조회
    const query = `
        SELECT e.employee_id as id, e.score, e.grade 
        FROM evaluations e
        INNER JOIN (
            SELECT employee_id, MAX(created_at) as max_date 
            FROM evaluations 
            GROUP BY employee_id
        ) latest ON e.employee_id = latest.employee_id AND e.created_at = latest.max_date
    `;
    db.all(query, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Dashboard summary query error' });
        res.json(rows);
    });
});

// 12. AI 조언 리스트 반환
app.get('/ai-decision', authenticateToken, (req, res) => {
    // 모든 직원들의 이름과 가장 최근 등급을 가져와서 조언을 생성합니다.
    const query = `
        SELECT emp.name, ev.grade 
        FROM employees emp
        LEFT JOIN (
            SELECT employee_id, grade, MAX(created_at)
            FROM evaluations
            GROUP BY employee_id
        ) ev ON emp.id = ev.employee_id
    `;
    
    db.all(query, (err, rows) => {
        if (err) return res.status(500).json({ error: 'AI decision query error' });
        
        const advices = rows.map(r => {
            let advice = '최근 평가 데이터가 부족합니다. 정밀 진단이 필요합니다.';
            if (r.grade === 'A') {
                advice = '탁월한 역량을 갖추고 있어 승진 추천 및 포상을 검토해야 합니다. 우수한 조직 리더 후보입니다.';
            } else if (r.grade === 'B') {
                advice = '업무가 능숙하고 안정적입니다. 역량 강화를 위해 한 단계 높은 난이도의 업무 위임을 권장합니다.';
            } else if (r.grade === 'C') {
                advice = '기본 기능 교육 및 실습 보강이 요구됩니다. 선임 멘토와의 매칭 지도를 통해 실무력을 업그레이드해야 합니다.';
            } else if (r.grade === 'D') {
                advice = '안전 수칙 재교육 및 용접/센터링 기초 교육이 시급합니다. 즉각적인 집중 기술 개선 훈련 대상입니다.';
            }
            return { name: r.name, advice };
        });
        
        res.json(advices);
    });
});

// 13. 엑셀 대용량 직원 업로드
app.post('/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Excel file is required' });

    try {
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // 2차원 배열 형태로 시트 읽기
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        if (!rows || rows.length === 0) {
            return res.status(400).json({ error: 'Excel file is empty' });
        }

        // 헤더 행 찾기 (성 명 / 이름 이 포함된 행)
        let headerIdx = -1;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i] && rows[i].some(cell => {
                const s = String(cell || '').replace(/\s+/g, '');
                return s.includes('성명') || s.includes('이름') || s.includes('name');
            })) {
                headerIdx = i;
                break;
            }
        }

        let processed = 0;
        let insertedCount = 0;

        if (headerIdx === -1) {
            // 헤더를 못 찾은 경우 일반 sheet_to_json fallback
            const data = xlsx.utils.sheet_to_json(sheet);
            if (data.length === 0) {
                return res.status(400).json({ error: 'Excel file is empty' });
            }

            data.forEach(row => {
                const name = row['성 명'] || row['성명'] || row['이름'] || row['name'] || '';
                const team = row['조직 부서'] || row['조직부서'] || row['파트'] || row['부서'] || row['팀'] || row['team'] || '기타';
                const position = row['POSITION'] || row['직급'] || row['position'] || '사원';
                const birthDate = row['생년월일'] || row['birth_date'] || '';
                const joinDate = row['입 사 년도'] || row['입사년도'] || row['입사일'] || row['join_date'] || '';
                const strengths = row['성격 장점'] || row['성격장점'] || '';
                const weaknesses = row['성격 단점'] || row['성격단점'] || '';
                const healthStatus = row['건강 상태'] || row['건강상태'] || '';
                const familyRelations = row['가족관계'] || row['가족 관계'] || '';
                const certificates = row['자격증 보유'] || row['자격증보유'] || row['자격증'] || '';

                if (name && name !== '성 명' && name !== 'STT') {
                    db.run(`INSERT INTO employees (name, team, position, birth_date, join_date, strengths, weaknesses, health_status, family_relations, certificates) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [name, team, position, birthDate, joinDate, strengths, weaknesses, healthStatus, familyRelations, certificates],
                        function(err) {
                            processed++;
                            if (!err) insertedCount++;
                            if (processed === data.length) {
                                res.json({ count: insertedCount });
                            }
                        }
                    );
                } else {
                    processed++;
                    if (processed === data.length) {
                        res.json({ count: insertedCount });
                    }
                }
            });
            return;
        }

        const headers = rows[headerIdx].map(h => String(h || '').trim());
        const getColIdx = (keywords) => headers.findIndex(h => {
            const clean = h.replace(/\s+/g, '');
            return keywords.some(kw => clean.includes(kw));
        });

        const nameIdx = getColIdx(['성명', '이름', 'name']);
        const teamIdx = getColIdx(['조직부서', '부서', '팀', '파트']);
        const posIdx = getColIdx(['position', '직급', '직책']);
        const birthIdx = getColIdx(['생년월일']);
        const joinIdx = getColIdx(['입사년도', '입사일']);
        const strengthsIdx = getColIdx(['성격장점', '장점']);
        const weaknessesIdx = getColIdx(['성격단점', '단점']);
        const healthIdx = getColIdx(['건강상태', '건강']);
        const familyIdx = getColIdx(['가족관계', '가족']);
        const certIdx = getColIdx(['자격증보유', '자격증']);

        const dataRows = rows.slice(headerIdx + 1);
        if (dataRows.length === 0) {
            return res.json({ count: 0 });
        }

        dataRows.forEach(row => {
            if (!row || row.length === 0) {
                processed++;
                if (processed === dataRows.length) {
                    res.json({ count: insertedCount });
                }
                return;
            }

            const rawName = nameIdx >= 0 ? row[nameIdx] : '';
            const name = rawName ? String(rawName).trim() : '';

            if (name && name !== '성 명' && name !== 'STT') {
                const team = teamIdx >= 0 && row[teamIdx] ? String(row[teamIdx]).trim() : '기타';
                const position = posIdx >= 0 && row[posIdx] ? String(row[posIdx]).trim() : '사원';
                const birthDate = birthIdx >= 0 && row[birthIdx] ? String(row[birthIdx]).trim() : '';
                const joinDate = joinIdx >= 0 && row[joinIdx] ? String(row[joinIdx]).trim() : '';
                const strengths = strengthsIdx >= 0 && row[strengthsIdx] ? String(row[strengthsIdx]).trim() : '';
                const weaknesses = weaknessesIdx >= 0 && row[weaknessesIdx] ? String(row[weaknessesIdx]).trim() : '';
                const healthStatus = healthIdx >= 0 && row[healthIdx] ? String(row[healthIdx]).trim() : '';
                const familyRelations = familyIdx >= 0 && row[familyIdx] ? String(row[familyIdx]).trim() : '';
                const certificates = certIdx >= 0 && row[certIdx] ? String(row[certIdx]).trim() : '';

                db.run(`INSERT INTO employees (name, team, position, birth_date, join_date, strengths, weaknesses, health_status, family_relations, certificates) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [name, team, position, birthDate, joinDate, strengths, weaknesses, healthStatus, familyRelations, certificates],
                    function(err) {
                        processed++;
                        if (!err) insertedCount++;
                        if (processed === dataRows.length) {
                            res.json({ count: insertedCount });
                        }
                    }
                );
            } else {
                processed++;
                if (processed === dataRows.length) {
                    res.json({ count: insertedCount });
                }
            }
        });

    } catch (e) {
        res.status(500).json({ error: 'Excel processing failed' });
    }
});

// 14. 특정 직원의 용접 기능 상세 평가표 데이터 가져오기
app.get('/employee/:id/welding-report', authenticateToken, (req, res) => {
    const empId = req.params.id;
    db.get(`SELECT * FROM welding_reports WHERE employee_id = ?`, [empId], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database query error' });
        res.json(row || null);
    });
});

// 15. 특정 직원의 용접 기능 상세 평가표 저장 (사진 포함)
app.post('/employee/:id/welding-report', authenticateToken, upload.single('welding_photo'), async (req, res) => {
    const empId = req.params.id;
    const { bead_visual, bead_penetration, bead_defect, pipe_backbead, pipe_alignment, pipe_defect, general_opinion } = req.body;
    let photoPath = '';
    try {
        if (req.file) photoPath = (await savePhoto(req.file)).url;
    } catch (e) {
        return res.status(500).json({ error: 'Photo upload failed' });
    }
    const createdAt = new Date().toISOString();

    // 기존 데이터 존재 유무 체크
    db.get(`SELECT photo_path FROM welding_reports WHERE employee_id = ?`, [empId], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database query error' });

        let finalPhotoPath = photoPath;
        if (row && !photoPath) {
            // 새로운 사진이 업로드되지 않았다면 기존 사진 경로 유지
            finalPhotoPath = row.photo_path;
        }

        // 용접 점수를 1~5점 평균 및 100점 만점 점수로 환산하여 evaluations 히스토리 테이블에도 동시 연동 등록
        const vSum = Number(bead_visual || 0) + Number(bead_penetration || 0) + Number(bead_defect || 0) + 
                     Number(pipe_backbead || 0) + Number(pipe_alignment || 0) + Number(pipe_defect || 0);
        const wScore15 = Math.min(5, Math.max(1, Math.round(vSum / 6))) || 4;
        const totalScore = Math.min(100, Math.max(40, Math.round((vSum / 6) * 20)));
        const gradeVal = totalScore >= 90 ? 'S' : totalScore >= 80 ? 'A' : totalScore >= 70 ? 'B' : 'C';

        const syncToEvaluations = (cb) => {
            db.run(`INSERT INTO evaluations (employee_id, welding, centering, safety_violation, strength_status, tech_eval, late, absent, score, grade, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [empId, wScore15, wScore15, 0, wScore15, wScore15, 0, 0, totalScore, gradeVal, createdAt],
                (eErr) => {
                    if (eErr) console.error('evaluations 히스토리 자동 연동 기록 오류:', eErr);
                    cb();
                }
            );
        };

        if (row) {
            // 기존 데이터 업데이트
            db.run(`UPDATE welding_reports SET 
                bead_visual = ?, bead_penetration = ?, bead_defect = ?, 
                pipe_backbead = ?, pipe_alignment = ?, pipe_defect = ?, 
                general_opinion = ?, photo_path = ?, created_at = ? 
                WHERE employee_id = ?`,
                [bead_visual, bead_penetration, bead_defect, pipe_backbead, pipe_alignment, pipe_defect, general_opinion, finalPhotoPath, createdAt, empId],
                function(err) {
                    if (err) return res.status(500).json({ error: 'Database update error' });
                    syncToEvaluations(() => res.json({ success: true }));
                }
            );
        } else {
            // 신규 데이터 삽입
            db.run(`INSERT INTO welding_reports (employee_id, bead_visual, bead_penetration, bead_defect, pipe_backbead, pipe_alignment, pipe_defect, general_opinion, photo_path, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [empId, bead_visual, bead_penetration, bead_defect, pipe_backbead, pipe_alignment, pipe_defect, general_opinion, finalPhotoPath, createdAt],
                function(err) {
                    if (err) return res.status(500).json({ error: 'Database insert error' });
                    syncToEvaluations(() => res.json({ success: true }));
                }
            );
        }
    });
});

// 관리자 통계 대시보드 API (팀 통계 등 추가 지원용)
app.get('/dashboard/stats', authenticateToken, (req, res) => {
    const statsQuery = `
        SELECT COUNT(*) as total_employees,
               (SELECT COUNT(DISTINCT username) FROM users) as total_users
        FROM employees
    `;
    db.get(statsQuery, (err, stats) => {
        if (err) return res.status(500).json({ error: 'Stats query error' });
        res.json(stats);
    });
});

app.get('/team-stats', authenticateToken, (req, res) => {
    const query = `
        SELECT team, COUNT(*) as count 
        FROM employees 
        GROUP BY team
    `;
    db.all(query, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Team stats query error' });
        res.json(rows);
    });
});

// 공유용 엑셀 파일 내보내기 API
app.get('/export/excel', authenticateToken, (req, res) => {
    db.all(`SELECT name, team, position, phone, birth_date, join_date, strengths, weaknesses, health_status, family_relations, certificates FROM employees`, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database query error' });

        const exportData = rows.map((r, idx) => ({
            'STT': idx + 1,
            '성 명': r.name || '',
            '전화번호': r.phone || '',
            '조직 부서': r.team || '',
            'POSITION': r.position || '',
            '생년월일': r.birth_date || '',
            '입 사 년도': r.join_date || '',
            '성격 장점': r.strengths || '',
            '성격 단점': r.weaknesses || '',
            '건강 상태': r.health_status || '',
            '가족관계': r.family_relations || '',
            '자격증 보유': r.certificates || ''
        }));

        const worksheet = xlsx.utils.json_to_sheet(exportData);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, '인원현황표');

        // 디스크 대신 메모리 버퍼로 생성 후 전송 (서버리스/휘발성 디스크 대응)
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        const filename = encodeURIComponent('인원현황평가서_최종_공유용.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
        res.send(buffer);
    });
});

app.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
});

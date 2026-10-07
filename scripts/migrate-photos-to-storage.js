// 기존 로컬 사진(/uploads/...)을 Supabase Storage로 업로드하고 DB의 photo URL을 교체합니다.
// 데이터 이관(migrate:postgres) 이후, 로컬(uploads 파일이 있는 곳)에서 실행하세요.
//
// 필요 환경변수: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY [, SUPABASE_BUCKET=photos, DATABASE_SSL=true]
//   node scripts/migrate-photos-to-storage.js

const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const { imageFile } = require('../security');
const { postgresConfig } = require('../postgres-config');

const { DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
const BUCKET = process.env.SUPABASE_BUCKET || 'photos';

if (!DATABASE_URL || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY 가 모두 필요합니다.');
    process.exit(1);
}

const pool = new Pool(postgresConfig(DATABASE_URL));
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

// 로컬에서 사진 파일을 찾을 후보 디렉토리
const dirs = [
    path.join(__dirname, '..', 'uploads'),
    path.join(__dirname, '..', 'public', 'uploads')
];

const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };

function findFile(basename) {
    for (const d of dirs) {
        const p = path.join(d, basename);
        if (fs.existsSync(p)) return p;
    }
    return null;
}

async function uploadOne(photoValue) {
    // 이미 절대 URL(http)이면 스킵
    if (!photoValue || /^https?:\/\//i.test(photoValue)) return null;
    const basename = decodeURIComponent(photoValue.replace(/^\/uploads\//, ''));
    if (basename !== path.basename(basename) || /[\\/\x00]/.test(basename)) throw new Error('잘못된 사진 경로');
    const file = findFile(basename);
    if (!file) { console.warn('  파일 없음, 스킵:', basename); return null; }

    const ext = path.extname(basename).toLowerCase();
    const buffer = fs.readFileSync(file);
    const { name: key, mime: contentType } = imageFile({ buffer });
    const { error } = await supabase.storage.from(BUCKET).upload(key, buffer, {
        contentType, upsert: false
    });
    if (error) { console.warn('  업로드 실패:', basename, error.message); return null; }
    return `storage:${key}`;
}

async function migrateColumn(table, idCol, photoCol) {
    const { rows } = await pool.query(`SELECT ${idCol} AS id, ${photoCol} AS photo FROM ${table} WHERE ${photoCol} LIKE '/uploads/%'`);
    console.log(`\n[${table}] 대상 ${rows.length}건`);
    let ok = 0;
    for (const row of rows) {
        const url = await uploadOne(row.photo);
        if (url) {
            await pool.query(`UPDATE ${table} SET ${photoCol} = $1 WHERE ${idCol} = $2`, [url, row.id]);
            ok++;
            process.stdout.write('.');
        }
    }
    console.log(`\n[${table}] 완료: ${ok}/${rows.length}`);
}

async function main() {
    try {
        const { error } = await supabase.storage.updateBucket(BUCKET, { public: false });
        if (error) throw error;
        await migrateColumn('employees', 'id', 'photo');
        await migrateColumn('welding_reports', 'employee_id', 'photo_path');
        console.log('\n사진 이관 완료.');
    } catch (e) {
        console.error('사진 이관 실패:', e.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

main();

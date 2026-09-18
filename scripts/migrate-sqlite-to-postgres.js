const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('DATABASE_URL이 필요합니다. 대상 PostgreSQL 접속 문자열을 설정하세요.');
    process.exit(1);
}

const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminPassword) {
    console.error('ADMIN_PASSWORD가 필요합니다. 이관된 기본 관리자 비밀번호를 교체할 값을 설정하세요.');
    process.exit(1);
}

const sqlitePath = process.env.SQLITE_PATH || path.join(__dirname, '..', 'database.sqlite');
const isLocal = /localhost|127\.0\.0\.1|\bpostgres\b/i.test(connectionString);
const useSsl = process.env.DATABASE_SSL === 'true' ||
    (process.env.DATABASE_SSL !== 'false' && !isLocal);

const sqlite = new sqlite3.Database(sqlitePath, sqlite3.OPEN_READONLY);
const postgres = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : false
});

function sqliteAll(sql) {
    return new Promise((resolve, reject) => {
        sqlite.all(sql, [], (error, rows) => error ? reject(error) : resolve(rows));
    });
}

async function createSchema(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT
        );
        CREATE TABLE IF NOT EXISTS employees (
            id SERIAL PRIMARY KEY,
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
        );
        CREATE TABLE IF NOT EXISTS evaluations (
            id SERIAL PRIMARY KEY,
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
        );
        CREATE TABLE IF NOT EXISTS welding_reports (
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
        );
    `);
}

async function copyTable(client, table, keyColumn) {
    const rows = await sqliteAll(`SELECT * FROM ${table}`);
    for (const row of rows) {
        const columns = Object.keys(row);
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
        const updates = columns
            .filter((column) => column !== keyColumn)
            .map((column) => `${column} = EXCLUDED.${column}`)
            .join(', ');
        const conflictAction = updates ? `DO UPDATE SET ${updates}` : 'DO NOTHING';
        await client.query(
            `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ` +
            `ON CONFLICT (${keyColumn}) ${conflictAction}`,
            columns.map((column) => row[column])
        );
    }
    return rows.length;
}

async function resetSequence(client, table) {
    await client.query(`
        SELECT setval(
            pg_get_serial_sequence('${table}', 'id'),
            COALESCE((SELECT MAX(id) FROM ${table}), 1),
            EXISTS(SELECT 1 FROM ${table})
        )
    `);
}

async function main() {
    const client = await postgres.connect();
    try {
        await client.query('BEGIN');
        await createSchema(client);

        const counts = {};
        counts.users = await copyTable(client, 'users', 'id');
        counts.employees = await copyTable(client, 'employees', 'id');
        counts.evaluations = await copyTable(client, 'evaluations', 'id');
        counts.welding_reports = await copyTable(client, 'welding_reports', 'employee_id');

        const adminPasswordHash = await bcrypt.hash(adminPassword, 12);
        await client.query(
            `UPDATE users SET password = $1, role = 'admin' WHERE username = 'admin'`,
            [adminPasswordHash]
        );

        await resetSequence(client, 'users');
        await resetSequence(client, 'employees');
        await resetSequence(client, 'evaluations');
        await client.query('COMMIT');

        console.log('PostgreSQL 데이터 이관 완료');
        console.log(JSON.stringify(counts, null, 2));
        console.log('사진 파일은 별도 영속 uploads 볼륨으로 복사해야 합니다.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('데이터 이관 실패:', error.message);
        process.exitCode = 1;
    } finally {
        client.release();
        sqlite.close();
        await postgres.end();
    }
}

main();

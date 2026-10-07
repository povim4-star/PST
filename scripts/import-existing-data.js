// 운영 관리자 계정을 유지하고 비어 있는 HR 테이블에만 원본을 이관합니다.
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { Client } = require('../.migration-runtime/node_modules/pg');
const { postgresConfig } = require('../postgres-config');
const { privateTablesSql } = require('../security');

async function main() {
    const sqlite = new DatabaseSync(process.env.SQLITE_PATH || path.join(__dirname, '..', 'database.sqlite'), { readOnly: true });
    const tables = ['employees', 'evaluations', 'welding_reports'];
    const rows = Object.fromEntries(tables.map(table => [table, sqlite.prepare(`SELECT * FROM ${table}`).all()]));
    sqlite.close();
    const client = new Client(postgresConfig(process.env.DATABASE_URL));
    let transaction = false;
    try {
        await client.connect();
        await client.query('BEGIN'); transaction = true;
        await client.query('LOCK TABLE employees, evaluations, welding_reports IN ACCESS EXCLUSIVE MODE');
        for (const table of tables) {
            const existing = await client.query(`SELECT COUNT(*) AS count FROM ${table}`);
            if (Number(existing.rows[0].count)) throw new Error('대상 DB에 기존 데이터가 있어 중단했습니다.');
        }
        await client.query(privateTablesSql);
        for (const table of tables) {
            for (const row of rows[table]) {
                const columns = Object.keys(row);
                const quoted = columns.map(column => '"' + column.replaceAll('"', '""') + '"').join(',');
                await client.query(`INSERT INTO ${table} (${quoted}) VALUES (${columns.map((_, i) => '$' + (i + 1)).join(',')})`, columns.map(column => row[column]));
            }
            const copied = await client.query(`SELECT * FROM ${table}`);
            const key = table === 'welding_reports' ? 'employee_id' : 'id';
            const actual = new Map(copied.rows.map(row => [row[key], row]));
            if (actual.size !== rows[table].length) throw new Error('이관 수량 불일치');
            for (const row of rows[table]) {
                if (Object.keys(row).some(column => String(actual.get(row[key])?.[column] ?? '') !== String(row[column] ?? ''))) throw new Error('이관 값 불일치');
            }
            if (table !== 'welding_reports') {
                await client.query(`SELECT setval(pg_get_serial_sequence('${table}','id'), COALESCE((SELECT MAX(id) FROM ${table}),1), EXISTS(SELECT 1 FROM ${table}))`);
            }
        }
        await client.query('COMMIT'); transaction = false;
        for (const table of tables) console.log(`${table}: ${rows[table].length} rows copied and verified`);
        console.log('Existing production admin account preserved.');
    } catch (error) {
        if (transaction) await client.query('ROLLBACK');
        console.error('Migration failed:', error.code || '검증 또는 연결 실패');
        process.exitCode = 1;
    } finally { await client.end(); }
}
main().catch(() => { console.error('Migration initialization failed'); process.exitCode = 1; });

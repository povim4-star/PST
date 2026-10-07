const fs = require('fs');
const path = require('path');

function postgresConfig(connectionString) {
    const url = new URL(connectionString);
    const local = ['localhost', '127.0.0.1', '::1', '[::1]', 'postgres'].includes(url.hostname);
    const useSsl = process.env.DATABASE_SSL === 'true' || (process.env.DATABASE_SSL !== 'false' && !local);
    const caFile = process.env.DATABASE_CA_FILE || (url.hostname.endsWith('.supabase.com') || url.hostname.endsWith('.supabase.co') ? path.join(__dirname, 'certs', 'supabase-ca.crt') : null);
    // 연결 문자열의 sslmode 옵션이 인증서 검증 설정을 덮어쓰지 않게 합니다.
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
    return {
        connectionString: url.toString(),
        ssl: useSsl ? { rejectUnauthorized: true, ...(caFile ? { ca: fs.readFileSync(caFile, 'utf8') } : {}) } : false,
        connectionTimeoutMillis: 10000,
        query_timeout: 15000,
        statement_timeout: 15000,
        max: 10
    };
}
module.exports = { postgresConfig };

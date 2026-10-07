const crypto = require('crypto');

// 확장자나 클라이언트 MIME 대신 파일 시그니처를 확인합니다.
function imageType(buffer) {
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return ['png', 'image/png'];
    if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))) return ['jpg', 'image/jpeg'];
    if (/^GIF8[79]a$/.test(buffer.subarray(0, 6).toString())) return ['gif', 'image/gif'];
    if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return ['webp', 'image/webp'];
    return null;
}

function imageFile(file) {
    const type = imageType(file.buffer);
    if (!type) { const error = new Error('JPEG, PNG, GIF, WebP 이미지만 허용됩니다.'); error.status = 415; throw error; }
    return { name: `${crypto.randomUUID()}.${type[0]}`, mime: type[1] };
}

// Supabase REST API의 익명/일반 인증 역할은 HR 테이블에 직접 접근할 수 없습니다.
const privateTablesSql = `DO $$ BEGIN
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
    ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE welding_reports ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON users, employees, evaluations, welding_reports FROM PUBLIC;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON users, employees, evaluations, welding_reports FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON users, employees, evaluations, welding_reports FROM authenticated;
    END IF;
END $$;`;

module.exports = { imageType, imageFile, privateTablesSql };

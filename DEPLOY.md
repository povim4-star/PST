# 배포 가이드 (Supabase + Render + Netlify)

구조: **프론트=Netlify(정적)** · **백엔드=Render(Express)** · **DB=Supabase Postgres** · **사진=Supabase Storage(신규) + Netlify 정적(기존)**

프론트는 상대경로로 API를 호출하고, `netlify.toml`이 그 경로들을 Render로 프록시합니다(같은 출처 → CORS 불필요).

---

## 0. 준비 (한 번만)
- GitHub에 이 리포 푸시 (Render/Netlify가 리포를 봅니다)
- `.env`는 커밋하지 마세요. 값은 각 서비스 대시보드에 입력합니다.

## 1. Supabase
1. **Storage** > New bucket > 이름 `photos`, **Private(비공개)** > 생성. 서버도 시작 시 비공개 상태를 적용합니다.
2. **Project Settings > API** 에서 복사:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` 키 → `SUPABASE_SERVICE_KEY` (⚠️ 절대 프론트/깃에 노출 금지)
3. **Project Settings > Database > Connection string > URI** 복사 → `DATABASE_URL`
   - **Session pooler(포트 5432)** 연결 문자열을 사용합니다.
   - URI의 `[YOUR-PASSWORD]` 를 실제 DB 비밀번호로 치환.

## 2. 데이터 이관 (로컬에서 한 번)
`database.sqlite`(현재 76명·평가·용접 기록)를 Supabase로 복사합니다.

```bash
# Windows PowerShell 기준
$env:DATABASE_URL="postgresql://postgres.<ref>:<pw>@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres"
$env:DATABASE_SSL="true"
$env:ADMIN_PASSWORD="<운영용 관리자 비밀번호>"
npm run migrate:postgres
```
- 테이블 자동 생성 + 데이터 복사 + 시퀀스 정렬 + admin 비밀번호 설정까지 수행됩니다.

### 2b. 기존 사진 → Supabase Storage 이관 (로컬에서 한 번)
데이터 이관 직후, `uploads/` 파일이 있는 로컬에서 실행합니다.
```bash
$env:DATABASE_URL="..."; $env:DATABASE_SSL="true"
$env:SUPABASE_URL="https://<ref>.supabase.co"
$env:SUPABASE_SERVICE_KEY="<service_role 키>"
npm run migrate:photos
```
- 로컬 `/uploads/...` 사진을 비공개 `photos` 버킷에 올리고 DB에 객체 키를 저장합니다. 사진은 로그인한 관리자가 `/media` API로 조회합니다.
- 신규 업로드 사진도 자동으로 Storage에 저장되므로, 이후 모든 사진은 Supabase Storage 한 곳에서 서빙됩니다.
- (사진은 개인정보라 깃/Netlify에 넣지 않습니다 — `.gitignore`에서 제외됨.)

## 3. 백엔드 → Render
1. Render > **New > Blueprint** 로 리포 연결 (`render.yaml` 자동 인식). 또는 New > Web Service 수동:
   - Build: `npm ci` / Start: `node server.js` / Health check: `/health`
2. **Environment** 에 입력:
   | 키 | 값 |
   |---|---|
   | `NODE_ENV` | `production` |
   | `HOST` | `0.0.0.0` |
   | `JWT_SECRET` | 32자 이상 무작위 |
   | `ADMIN_PASSWORD` | 2번에서 쓴 값과 동일 |
   | `DATABASE_URL` | Supabase pooler URI |
   | `DATABASE_SSL` | `true` |
   | `SUPABASE_URL` | Supabase Project URL |
   | `SUPABASE_SERVICE_KEY` | service_role 키 |
   | `SUPABASE_BUCKET` | `photos` |
3. Deploy 후 주소 확인: `https://<이름>.onrender.com` → 브라우저에서 `/health` 가 `{"status":"ok","database":"postgresql"}` 인지 확인.

## 4. 프론트 → Netlify
1. `netlify.toml` 의 `YOUR-RENDER-APP.onrender.com` 을 **3번 Render 주소로 전부 치환**.
2. Netlify > New site from Git > 리포 선택 (publish = `public`, build 명령 없음). 또는 `public/` 폴더 드래그 배포.
3. 배포 후 사이트 열고 **admin / (ADMIN_PASSWORD)** 로 로그인 확인.

## 5. 점검 체크리스트
- [ ] `/health` → postgresql
- [ ] 로그인 성공, 직원 76명 표시
- [ ] 사진 표시(기존/신규 모두 Supabase Storage `photos` 버킷)
- [ ] 엑셀 내보내기 다운로드 동작
- [ ] 평가 저장/수정/삭제 동작

## 참고
- Render 무료 플랜은 15분 무활동 시 슬립 → 첫 요청이 느립니다(콜드스타트).
- 회원가입은 기본 비활성(`ALLOW_REGISTRATION`=true 로 켤 수 있음).
- 상세/관리자 페이지는 아직 다크 테마입니다(요청 시 밝은 톤 통일).

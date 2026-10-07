# 보안 점검 및 배포 확인

## 수정 내용

- 의존성을 보안 수정 버전으로 갱신하고 package-lock.json으로 고정했습니다. npm의 구형 xlsx 대신 SheetJS 공식 0.20.3 배포본을 사용합니다.
- 회원가입 API는 기존 관리자 인증을 요구합니다. 모든 HR API는 DB의 현재 admin 역할을 확인합니다.
- 로그인 시도 횟수, 업로드 횟수, 파일 크기(5MB), multipart 필드 수를 제한합니다.
- HTML에 삽입하는 직원 정보와 평가 값을 인코딩합니다. 건강·가족·평가 정보를 외부 번역 API로 자동 전송하던 기능을 제거했습니다. UI 라벨 번역은 유지합니다.
- /uploads 정적 공개를 차단하고 사진을 인증된 /media API에서 제공합니다. Supabase photos 버킷은 서버 시작 시 비공개로 전환합니다. 이 작업이 실패하면 서버는 시작하지 않습니다.
- 사진 MIME은 파일 시그니처를 확인하고 파일명은 무작위 식별자로 생성합니다. SVG/HTML 업로드를 허용하지 않습니다.
- Supabase HR 테이블에 RLS를 활성화하고 anon/authenticated 역할의 직접 접근 권한을 회수합니다. 서버 DB 계정으로만 HR 데이터에 접근합니다.
- PostgreSQL TLS 서버 인증서와 호스트를 검증합니다. Supabase CA를 certs/supabase-ca.crt에 포함했습니다.
- 이관 시 대상 DB에 기존 직원·평가·보고서 데이터가 있으면 덮어쓰지 않고 중단합니다.

## 검증

- `npm audit`: 알려진 취약점 0건(검사 시점).
- `npm run test:security`: 임시 SQLite DB로 인증·역할 위조·공개 사진 차단·위장 파일·크기 제한·엑셀 왕복·출력 인코딩·로그인 제한 검증.
- Supabase 도쿄 Session pooler의 인증서를 공식 CA로 검증한 TLS 핸드셰이크 성공. 이 확인은 DB 로그인 검증과는 별개입니다.
- 운영 DB 권한, 기존 사진 버킷 상태, 데이터 이관 수량은 운영 자격증명으로 별도 확인해야 합니다.

## 남은 운영 조건

- JWT_SECRET은 32자 이상 무작위 값, ADMIN_PASSWORD는 강한 운영 비밀번호를 사용합니다. 기존 계정의 비밀번호는 환경변수 변경만으로 갱신되지 않습니다.
- 현재 HR 접근 권한은 admin으로 제한합니다. 팀별·직원별 세분화 권한은 별도 설계가 필요합니다.
- JWT는 localStorage에 보관하며 최대 8시간 유효합니다. 기존 inline 스크립트 때문에 CSP의 unsafe-inline은 유지합니다. 출력 인코딩을 적용했지만 HttpOnly 세션 및 외부 스크립트 자체 호스팅은 후속 강화 항목입니다.
- 로그인 제한은 단일 프로세스 메모리 기준입니다. 다중 인스턴스 운영 시 공용 제한 저장소가 필요합니다.
- 이미 공개된 사진의 외부 복사본이나 캐시는 이 수정으로 회수할 수 없습니다.
- 이 점검은 침해 흔적 조사나 완전한 침투 테스트를 의미하지 않습니다.

## 근거

- [SheetJS 공식 Node 설치](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/)
- [Multer 보안 공지](https://github.com/expressjs/multer/security/advisories)
- [Supabase SSL 설정](https://supabase.com/docs/guides/platform/ssl-enforcement)
- [Supabase 공식 대시보드 CA 다운로드 설정](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json)
- CA 다운로드: https://supabase-downloads.s3.ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

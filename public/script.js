console.log("Script loading started...");
// alert("인사 관리 시스템 스크립트가 로드되었습니다.");

// 글로벌 상태 관리
let currentUser = null;
const token = localStorage.getItem('token');

// 초기화
// --- 다국어 지원 (i18n) ---
const translations = {
    ko: {
        title: "인사·기술·안전 통합 관리",
        login_title: "시스템 로그인",
        register_title: "신규 회원 가입",
        toggle_register: "계정이 없으신가요? 신규 가입하기",
        toggle_login: "이미 계정이 있으신가요? 로그인하기",
        logout: "로그아웃",
        admin_dashboard: "관리자 대시보드",
        status_title: "직원 및 종합 평가 현황",
        add_emp_title: "직원 개별 등록",
        emp_name_label: "직원 이름",
        team_label: "팀/파트",
        pos_label: "직급",
        join_date_label: "입사일",
        photo_label: "직원 사진",
        submit_btn: "등록하기",
        eval_title: "기술·안전 평가",
        target_emp_label: "대상 직원",
        welding_label: "용접 (1-5단계)",
        centering_label: "센터링 (1-5단계)",
        safety_label: "안전위반 (옐로카드)",
        attendance_label: "근태현황 (1-5)",
        tech_label: "기술 평가 (1-5)",
        late_absent_label: "지각/결근 (회)",
        save_eval_btn: "평가 저장",
        excel_upload_title: "엑셀 데이터 업로드",
        excel_desc: "(이름, 파트, 직급, 항목일) 컬럼이 포함된 파일을 업로드하세요.",
        upload_btn: "업로드 실행",
        photo_sync_title: "사진 자동 매칭 업로드",
        photo_sync_desc: "사진 파일명(예: 홍길동.jpg)과 직원 이름이 같으면 자동 등록됩니다.",
        sync_btn: "사진 자동 매칭 시작",
        photo_col: "사진", name_col: "이름", team_col: "팀", pos_col: "직급", score_col: "최근 점수", grade_col: "등급", record_col: "기록",
        username_label: "아이디", password_label: "비밀번호",
        name: "이름", team: "팀 / 부서", pos: "직급", date: "날짜", score: "점수", grade: "등급", birth: "생년월일", join: "입사일", phone: "전화번호", delete: "삭제",
        welding: "용접", centering: "센터링", safety: "안전", attendance: "근태", tech: "기술",
        history_btn: "기록",
        save_btn: "정보 저장",
        back_list: "목록으로",
        print_btn: "출력하기",
        refresh_btn: "새로고침",
        ai_advice: "AI 인사이드 추천",
        skills_chart: "종합 역량 분석",
        history_table: "전체 평가 히스토리",
        strengths: "성격 장점",
        weaknesses: "성격 단점",
        health: "건강 상태",
        certificates: "자격증 보유현황",
        family_relations: "가족관계",
        family_relations_ph: "가족 구성원 및 비상연락처를 기록하세요...",
        competency_desc: "종합 역량 분석 의견",
        competency_desc_ph: "위 차트를 바탕으로 한 종합적인 역량 분석 의견을 기록하세요...",
        welcome: "님, 환영합니다!",
        delete_confirm: "직원을 정말 삭제하시겠습니까?\n모든 평가 기록이 함께 삭제됩니다.",
        delete_success: "삭제되었습니다.",
        delete_fail: "삭제 실패",
        save_success: "저장되었습니다. ✅",
        save_fail: "저장 실패 ❌",
        photo_success: "사진이 업데이트 되었습니다.",
        photo_fail: "사진 업로드 실패",
        network_error: "네트워크 오류",
        // 용접 기능 평가표 추가 번역 (한국어)
        welding_modal_title: "용접 기능 상세 평가표",
        bead_welding_title: "비드 용접 (Bead Welding)",
        bead_visual_label: "1. 비드 외관 균일성 (Appearance)",
        bead_penetration_label: "2. 용융 및 용입 상태 (Penetration)",
        bead_defect_label: "3. 언더컷/오버랩 결함 유무 (Defects)",
        pipe_welding_title: "파이프 용접 (Pipe Welding)",
        pipe_backbead_label: "1. 백비드(이면비드) 형성 상태 (Backbead)",
        pipe_alignment_label: "2. 맞대기 조인트 정렬 정밀도 (Alignment)",
        pipe_defect_label: "3. 기공 및 슬래그 결함 유무 (Defects)",
        welding_photo_label: "용접 평가 사진 첨부",
        welding_photo_hint: "평가 사진을 업로드하려면 클릭하세요",
        welding_opinion_label: "평가자 종합 의견",
        welding_opinion_ph: "용접 작업 결과에 대한 평가의견을 입력하세요...",
        welding_avg_score: "평가 평균 점수",
        cancel_btn: "취소",
        welding_save_btn: "평가 저장",
        welding_info_name: "평가 대상자:",
        welding_info_team: "소속 부서:",
        welding_info_pos: "직급:",
        chart_welding: "용접",
        chart_centering: "센터링",
        chart_safety: "안전관리",
        chart_attendance: "근태관리",
        chart_tech: "기술역량",
        chart_current_val: "현재 역량 수치"
    },
    vi: {
        title: "Quản lý Nhân sự & An toàn",
        login_title: "Đăng nhập hệ thống",
        register_title: "Đăng ký mới",
        toggle_register: "Chưa có tài khoản? Đăng ký ngay",
        toggle_login: "Đã có tài khoản? Đăng nhập",
        toggle_logout: "Đăng xuất", // 혹은 기존과 동일
        logout: "Đăng xuất",
        admin_dashboard: "Bảng quản trị",
        status_title: "Tình trạng nhân sự & Đánh giá",
        add_emp_title: "Đăng ký nhân viên mới",
        emp_name_label: "Tên nhân viên",
        team_label: "Bộ phận/Nhóm",
        pos_label: "Chức vụ",
        join_date_label: "Ngày vào làm",
        photo_label: "Ảnh nhân viên",
        submit_btn: "Đăng ký",
        eval_title: "Đánh giá Kỹ năng & An toàn",
        target_emp_label: "Nhân viên đánh giá",
        welding_label: "Hàn (1-5)",
        centering_label: "Căn tâm (1-5)",
        safety_label: "Vi phạm an toàn (Thẻ vàng)",
        attendance_label: "Chuyên cần (1-5)",
        tech_label: "Đánh giá kỹ thuật (1-5)",
        late_absent_label: "Đi muộn/Vắng mặt",
        save_eval_btn: "Lưu đánh giá",
        excel_upload_title: "Tải lên dữ liệu Excel",
        excel_desc: "Tải lên tệp có các cột (Tên, Bộ phận, Chức vụ, Ngày vào).",
        upload_btn: "Thực hiện tải lên",
        photo_sync_title: "Tải ảnh khớp tự động",
        photo_sync_desc: "Nếu tên tệp ảnh khớp với tên nhân viên, ảnh sẽ tự động được đăng ký.",
        sync_btn: "Bắt đầu khớp ảnh",
        photo_col: "Ảnh", name_col: "Tên", team_col: "Bộ phận", pos_col: "Chức vụ", score_col: "Điểm gần nhất", grade_col: "Xếp loại", record_col: "Lịch sử",
        username_label: "Tài khoản", password_label: "Mật khẩu",
        name: "Họ tên", team: "Bộ phận / Nhóm", pos: "Chức vụ", date: "Ngày tháng", score: "Điểm số", grade: "Xếp loại", birth: "Ngày sinh", join: "Ngày vào làm", phone: "Số điện thoại", delete: "Xóa",
        welding: "Hàn", centering: "Căn tâm", safety: "An toàn", attendance: "Chuyên cần", tech: "Kỹ thuật",
        history_btn: "Lịch sử",
        save_btn: "Lưu thông tin",
        back_list: "Quay lại",
        print_btn: "In báo cáo",
        refresh_btn: "Làm mới",
        ai_advice: "Gợi ý từ AI",
        skills_chart: "Phân tích năng lực",
        history_table: "Lịch sử đánh giá",
        strengths: "Ưu điểm",
        weaknesses: "Nhược điểm",
        health: "Tình trạng sức khỏe",
        certificates: "Bằng cấp / Chứng chỉ",
        family_relations: "Quan hệ gia đình",
        family_relations_ph: "Ghi lại các thành viên trong gia đình và liên hệ khẩn cấp...",
        competency_desc: "Ý kiến phân tích năng lực tổng hợp",
        competency_desc_ph: "Ghi lại ý kiến phân tích năng lực dựa trên biểu đồ trên...",
        welcome: "Chào mừng, ",
        delete_confirm: "Bạn có chắc chắn muốn xóa nhân viên này không?\nTất cả hồ sơ đánh giá sẽ bị xóa.",
        delete_success: "Đã xóa thành công.",
        delete_fail: "Xóa thất bại",
        save_success: "Đã lưu thành công. ✅",
        save_fail: "Lưu thất bại ❌",
        photo_success: "Ảnh đã được cập nhật.",
        photo_fail: "Tải ảnh lên thất bại",
        network_error: "Lỗi kết nối mạng",
        // 용접 기능 평가표 추가 번역 (베트남어)
        welding_modal_title: "Bảng đánh giá chi tiết kỹ năng hàn",
        bead_welding_title: "Hàn đường hàn (Bead Welding)",
        bead_visual_label: "1. Độ đều của ngoại quan đường hàn (Appearance)",
        bead_penetration_label: "2. Tình trạng nóng chảy và ngấu (Penetration)",
        bead_defect_label: "3. Có lỗi chân khuyết/chồng mép không (Defects)",
        pipe_welding_title: "Hàn ống (Pipe Welding)",
        pipe_backbead_label: "1. Tình trạng hình thành mối hàn mặt sau (Backbead)",
        pipe_alignment_label: "2. Độ chính xác căn chỉnh mối nối đối đầu (Alignment)",
        pipe_defect_label: "3. Có lỗ khí và lẫn xỉ hay không (Defects)",
        welding_photo_label: "Đính kèm ảnh đánh giá hàn",
        welding_photo_hint: "Nhấp để tải lên ảnh đánh giá",
        welding_opinion_label: "Ý kiến tổng hợp của người đánh giá",
        welding_opinion_ph: "Nhập ý kiến đánh giá về kết quả hàn...",
        welding_avg_score: "Điểm trung bình đánh giá",
        cancel_btn: "Hủy",
        welding_save_btn: "Lưu đánh giá",
        welding_info_name: "Nhân viên được đánh giá:",
        welding_info_team: "Bộ phận:",
        welding_info_pos: "Chức vụ:",
        chart_welding: "Hàn",
        chart_centering: "Căn tâm",
        chart_safety: "Quản lý an toàn",
        chart_attendance: "Quản lý chuyên cần",
        chart_tech: "Năng lực kỹ thuật",
        chart_current_val: "Chỉ số năng lực hiện tại"
    }
};

let currentLang = localStorage.getItem('lang') || 'ko';

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang][key]) {
            el.innerText = translations[lang][key];
        }
    });

    // 특수 처리 (placeholder 등)
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[lang][key]) {
            el.placeholder = translations[lang][key];
        }
    });

    updateDynamicTexts();
}

function updateDynamicTexts() {
    // 테이블 헤더 등 동적 요소 업데이트
    const headers = document.querySelectorAll('th[data-i18n]');
    headers.forEach(th => {
        const key = th.getAttribute('data-i18n');
        th.innerText = translations[currentLang][key];
    });
}

// 초기 실행
window.addEventListener('DOMContentLoaded', () => {
    setLanguage(currentLang);
    
    // 메인 페이지 전용 로직 (로그인 섹션이 있는 경우에만 실행)
    if (document.getElementById('login-section')) {
        initStarRatings();
        if (token) {
            checkAuth();
        } else {
            showLogin();
        }
    }
});

// --- 별점 관리 ---
function initStarRatings() {
    document.querySelectorAll('.star-rating:not(.readonly)').forEach(container => {
        const stars = container.querySelectorAll('.fa-star');
        const inputId = container.getAttribute('data-input-id');
        const input = document.getElementById(inputId);

        stars.forEach(star => {
            star.addEventListener('click', () => {
                const value = parseInt(star.getAttribute('data-value'));
                input.value = value;
                updateStarDisplay(container, value);
            });
        });
    });
}

function updateStarDisplay(container, value) {
    const stars = container.querySelectorAll('.fa-star');
    stars.forEach(star => {
        const starValue = parseInt(star.getAttribute('data-value'));
        if (starValue <= value) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

function renderStars(score) {
    if (score === '-' || score === null || score === undefined || isNaN(parseFloat(score))) {
        return '<span style="color: var(--text-dim); font-size: 0.85rem;">평가 없음</span>';
    }
    const rawScore = parseFloat(score);
    // 100점 만점 기준을 5점 만점 별점으로 환산 (20점당 별 1개)
    const starCount = Math.min(5, Math.max(1, Math.round(rawScore / 20)));
    
    let starsHtml = `<div class="star-rating readonly" title="최근 평가 점수: ${rawScore.toFixed(1)}점" style="display: inline-flex; align-items: center; gap: 0.2rem;">`;
    for (let i = 1; i <= 5; i++) {
        starsHtml += `<i class="fas fa-star ${i <= starCount ? 'active' : ''}"></i>`;
    }
    starsHtml += `<span style="margin-left: 0.4rem; font-weight: 700; font-size: 0.85rem; color: #fbbf24;">${rawScore.toFixed(1)}점</span></div>`;
    return starsHtml;
}

// 5점 만점 세부 항목용 별점 렌더러 (용접, 센터링, 근태, 기술 등)
function render5Stars(score) {
    if (score === '-' || score === null || score === undefined || isNaN(parseFloat(score))) {
        return '<span style="color: var(--text-dim); font-size: 0.85rem;">-</span>';
    }
    const val = parseFloat(score);
    const numScore = Math.min(5, Math.max(1, Math.round(val)));
    let starsHtml = `<div class="star-rating readonly" style="display: inline-flex; align-items: center; gap: 0.2rem;">`;
    for (let i = 1; i <= 5; i++) {
        starsHtml += `<i class="fas fa-star ${i <= numScore ? 'active' : ''}"></i>`;
    }
    starsHtml += `<span style="margin-left: 0.4rem; font-weight: 700; font-size: 0.85rem; color: #fbbf24;">${val.toFixed(1)}점</span></div>`;
    return starsHtml;
}

// --- 인증 관리 ---
let isRegisterMode = false;

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    const title = document.getElementById('auth-title');
    const btn = document.getElementById('auth-btn');
    const toggle = document.getElementById('toggle-auth');
    
    if (isRegisterMode) {
        title.setAttribute('data-i18n', 'register_title');
        title.innerText = translations[currentLang]['register_title'];
        btn.setAttribute('data-i18n', 'register_title');
        btn.innerText = translations[currentLang]['register_title'];
        toggle.setAttribute('data-i18n', 'toggle_login');
        toggle.innerText = translations[currentLang]['toggle_login'];
    } else {
        title.setAttribute('data-i18n', 'login_title');
        title.innerText = translations[currentLang]['login_title'];
        btn.setAttribute('data-i18n', 'login_title');
        btn.innerText = translations[currentLang]['login_title'];
        toggle.setAttribute('data-i18n', 'toggle_register');
        toggle.innerText = translations[currentLang]['toggle_register'];
    }
}

async function handleAuth() {
    if (isRegisterMode) {
        await register();
    } else {
        await login();
    }
}

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    console.log(`[Frontend Login] Attempting login for: ${username}`);
    try {
        const res = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('role', data.role);
            location.reload();
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert('서버 연결 실패');
    }
}

async function register() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    console.log(`[Frontend Register] Attempting register for: ${username}`);
    try {
        const res = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            alert(data.message);
            toggleAuthMode(); // 회원가입 후 로그인 모드로 전환
            document.getElementById('password').value = '';
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert('서버 연결 실패');
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    location.reload();
}

function showLogin() {
    document.getElementById('login-section').style.display = 'flex';
    document.getElementById('main-content').style.display = 'none';
}

function checkAuth() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('main-content').style.display = 'block';
    
    const role = localStorage.getItem('role');
    if (role === 'admin') {
        const ab = document.getElementById('admin-btn');
        if (ab) ab.style.display = 'flex';
    }
    const info = document.getElementById('user-info');
    if (info) info.textContent = role === 'admin' ? '관리자' : '사용자';
    const av = document.getElementById('user-avatar');
    if (av) av.textContent = role === 'admin' ? 'AD' : 'US';

    loadEmployees();
}

// --- 직원 관리 ---
document.getElementById('employee-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', document.getElementById('emp-name').value);
    formData.append('team', document.getElementById('emp-team').value);
    formData.append('position', document.getElementById('emp-pos').value);
    formData.append('join_date', document.getElementById('emp-join').value);
    
    const photoFile = document.getElementById('emp-photo').files[0];
    if (photoFile) formData.append('photo', photoFile);

    const res = await fetch('/employee', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });

    if (res.ok) {
        alert('직원이 등록되었습니다.');
        loadEmployees();
        e.target.reset();
    } else {
        const err = await res.json();
        alert(err.error);
    }
});

async function loadEmployees() {
    try {
        const res = await fetch('/employees', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            console.warn('인증이 만료되었거나 유효하지 않습니다. 로그아웃합니다.');
            logout();
            return;
        }

        const employees = await res.json();
    
    // 평가 폼의 셀렉트 박스 업데이트
    const select = document.getElementById('eval-emp-id');
    if (select) {
        select.innerHTML = employees.map(e => `<option value="${e.id}">${e.name} (${e.team})</option>`).join('');
    }

    // 대시보드 요약 정보와 결합하여 리스트 출력
    const summaryRes = await fetch('/dashboard/summary', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const summary = await summaryRes.json();

        // ID를 기준으로 정확하게 매칭 (이름 중복 문제 해결)
        employeeRows = employees.map(emp => {
            const evalData = summary.find(s => s.id === emp.id) || { score: '-', grade: '-' };
            return { ...emp, ...evalData };
        });
        if (window.updateKPIs) window.updateKPIs(employees, summary);
        renderEmployeeTable();
    } catch (err) {
        console.error('Error loading employees:', err);
    }
}

// 직원 현황 표: 정렬 상태 + 렌더링
let employeeRows = [];
let sortState = { key: 'name', dir: 1 }; // key: 'name' | 'score', dir: 1 오름차순 / -1 내림차순

function renderEmployeeTable() {
    const tbody = document.querySelector('#employee-table tbody');
    if (!tbody) return;

    const rows = [...employeeRows].sort((a, b) => {
        if (sortState.key === 'score') {
            const av = parseFloat(a.score) || 0;
            const bv = parseFloat(b.score) || 0;
            return (av - bv) * sortState.dir;
        }
        return String(a.name || '').localeCompare(String(b.name || ''), 'ko') * sortState.dir;
    });

    tbody.innerHTML = rows.map(e => `
        <tr class="animate">
            <td>
                <div class="photo-edit-wrapper">
                    ${e.photo ?
                        `<img src="${e.photo}" class="photo-circle" onerror="this.parentElement.innerHTML='<div class=\'photo-circle-default\'><i class=\'fas fa-user\'></i></div>'">` :
                        `<div class="photo-circle-default"><i class="fas fa-user"></i></div>`
                    }
                </div>
            </td>
            <td style="font-weight: 600;">${e.name}</td>
            <td>${e.team}</td>
            <td>${e.position}</td>
            <td>${renderStars(e.score)}</td>
            <td><span class="badge badge-${e.grade}">${e.grade}</span></td>
            <td><button onclick="location.href='detail.html?id=${e.id}'" style="padding: 0.3rem 0.7rem; font-size: 0.8rem;" data-i18n="history_btn">${translations[currentLang].history_btn}</button></td>
        </tr>
    `).join('');

    // 정렬 화살표 표시
    document.querySelectorAll('#employee-table th[data-sort]').forEach(th => {
        const arrow = th.querySelector('.sort-arrow');
        if (arrow) arrow.textContent = th.dataset.sort === sortState.key ? (sortState.dir === 1 ? ' ▲' : ' ▼') : '';
    });
}

function sortEmployees(key) {
    if (sortState.key === key) sortState.dir *= -1;
    else { sortState.key = key; sortState.dir = 1; }
    renderEmployeeTable();
}
window.sortEmployees = sortEmployees;

async function deleteEmployee(id, name) {
    if (!confirm(`'${name}' ${translations[currentLang].delete_confirm}`)) return;

    try {
        const res = await fetch(`/employee/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            // 해당 직원이 있는 모든 행 찾기
            const rows = document.querySelectorAll('#employee-table tbody tr');
            let found = false;
            rows.forEach(row => {
                if (row.querySelector(`button[onclick*="deleteEmployee(${id}"]`)) {
                    row.style.transition = '0.4s';
                    row.style.opacity = '0';
                    row.style.transform = 'translateX(20px)';
                    setTimeout(() => row.remove(), 400);
                    found = true;
                }
            });
            if (!found) loadEmployees(); // 행을 못 찾았다면 전체 새로고침
        } else {
            const err = await res.json().catch(() => ({ error: '권한이 없거나 서버 오류가 발생했습니다.' }));
            alert(`삭제 실패: ${err.error}`);
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('서버와 통신 중 오류가 발생했습니다.');
    }
}

async function uploadProfilePhoto(id, input) {
    if (!input.files[0]) return;
    
    const formData = new FormData();
    formData.append('photo', input.files[0]);

    const res = await fetch(`/employee/${id}/photo`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });

    if (res.ok) {
        alert('사진이 업데이트 되었습니다.');
        loadEmployees();
    } else {
        alert('사진 업로드 실패');
    }
}

// --- 평가 관리 ---
document.getElementById('evaluation-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        employee_id: document.getElementById('eval-emp-id').value,
        welding: document.getElementById('eval-welding').value,
        centering: document.getElementById('eval-centering').value,
        safety_violation: document.getElementById('eval-safety').value,
        strength_status: document.getElementById('eval-strength').value,
        tech_eval: document.getElementById('eval-tech').value,
        late: document.getElementById('eval-late').value,
        absent: 0 // 기본값
    };

    const res = await fetch('/evaluation', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        const data = await res.json();
        alert(`평가가 저장되었습니다. 점수: ${data.score}, 등급: ${data.grade}`);
        loadEmployees();
    } else {
        alert('평가 저장 실패');
    }
});

async function viewHistory(id, name) {
    // 상세 페이지로 이동 (ID를 쿼리 스트링으로 전달)
    location.href = `detail.html?id=${id}`;
}

// --- 엑셀 업로드 ---
async function uploadExcel() {
    const fileInput = document.getElementById('excel-file');
    if (!fileInput.files[0]) return alert('파일을 선택하세요.');

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    const res = await fetch('/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });

    if (res.status === 401) {
        alert('세션이 만료되었습니다. 다시 로그인해 주세요.');
        logout();
        return;
    }

    if (res.ok) {
        const data = await res.json();
        alert(`${data.count}명의 직원이 등록되었습니다.`);
        loadEmployees();
    } else {
        const errorData = await res.json().catch(() => ({ error: '알 수 없는 서버 오류' }));
        alert(`엑셀 업로드 실패: ${errorData.error}`);
    }
}

async function uploadBulkPhotos() {
    const fileInput = document.getElementById('bulk-photo-files');
    const files = fileInput.files;
    if (files.length === 0) return alert('사진 파일들을 선택하세요.');

    let successCount = 0;
    let failCount = 0;

    for (let file of files) {
        const formData = new FormData();
        formData.append('photo', file);

        try {
            const res = await fetch('/employee/photo-by-name', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (res.ok) successCount++;
            else failCount++;
        } catch (err) {
            failCount++;
        }
    }

    alert(`사진 매칭 완료!\n성공: ${successCount}건\n실패: ${failCount}건`);
    loadEmployees();
}

// --- 엑셀 내보내기 (공유용 전체 인원현황표 다운로드) ---
async function exportExcel() {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) return alert('로그인이 필요합니다.');

    try {
        const res = await fetch('/export/excel', {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        });

        if (!res.ok) {
            throw new Error('엑셀 추출 서버 오류');
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const today = new Date().toISOString().slice(0, 10);
        a.download = `인원현황평가서_최종_공유용_${today}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        alert('엑셀 다운로드 중 오류가 발생했습니다: ' + err.message);
    }
}

// DB에서 온 값은 HTML 문법으로 해석되지 않도록 처리합니다.
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 인증 토큰을 URL에 넣지 않고, 인증된 요청의 이미지 응답을 표시합니다.
async function loadPrivateImages() {
    for (const img of document.querySelectorAll('img[data-private-src]')) {
        const url = img.dataset.privateSrc;
        img.removeAttribute('data-private-src');
        if (!/^\/media\/(employees|welding)\/\d+$/.test(url)) continue;
        try {
            const res = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, cache: 'no-store' });
            if (!res.ok) continue;
            const objectUrl = URL.createObjectURL(await res.blob());
            img.onload = img.onerror = () => URL.revokeObjectURL(objectUrl);
            img.src = objectUrl;
        } catch (_) { /* 이미지를 읽을 수 없으면 빈 상태를 유지합니다. */ }
    }
}
new MutationObserver(loadPrivateImages).observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('DOMContentLoaded', loadPrivateImages);

/* ============================================
   v2 인증 모듈 — SHA-256 해시 + sessionStorage
   ============================================ */

const SESSION_KEY = 'sgm2_session';
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8h

const RAW_CREDENTIALS = [
  { id: 'admin',   name: '운영관리팀 관리자', pw: 'Seegene2025!' },
  { id: 'manager', name: '자산담당 매니저',   pw: 'Manager!23' }
];

let credentials = null;

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function ensureCredentials() {
  if (credentials) return credentials;
  credentials = await Promise.all(RAW_CREDENTIALS.map(async c => ({
    id: c.id, name: c.name, pwHash: await sha256(c.pw)
  })));
  return credentials;
}

export async function login(id, pw) {
  const list = await ensureCredentials();
  const hash = await sha256(pw);
  /* localStorage 비밀번호 override 우선 확인 */
  let matched;
  try {
    const overrides = JSON.parse(localStorage.getItem('sgm2_pw_override') || '{}');
    if (overrides[id]) {
      matched = overrides[id] === hash ? list.find(c => c.id === id) : null;
    } else {
      matched = list.find(c => c.id === id && c.pwHash === hash);
    }
  } catch {
    matched = list.find(c => c.id === id && c.pwHash === hash);
  }
  if (!matched) return { ok: false, error: '아이디 또는 비밀번호가 올바르지 않습니다.' };

  const session = {
    adminId: matched.id,
    adminName: matched.name,
    loginAt: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { ok: true, session };
}

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.expiresAt || Date.now() > s.expiresAt) {
      clearSession();
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function isAdmin() {
  return getSession() !== null;
}

export function remainingMs() {
  const s = getSession();
  return s ? s.expiresAt - Date.now() : 0;
}

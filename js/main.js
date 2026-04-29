/* 진입점 */
import { login, getSession, clearSession, isAdmin, remainingMs } from './auth.js';
import { handleRoute, navigate } from './router.js';
import { toast } from './ui/toast.js';
import { seedIfEmpty } from './seed.js';
import { MoveRequests } from './store.js';

/* ─── 화면 토글 ─── */
const $ = sel => document.querySelector(sel);
const views = ['roleScreen', 'loginScreen', 'appLayout'];
function showView(name) {
  views.forEach(v => {
    const el = document.getElementById(v);
    if (!el) return;
    el.classList.toggle('hidden', v !== name);
  });
}

/* ─── 사이드바 메뉴 빌드 ─── */
const MENU = [
  { section: '공통' },
  { route: 'dashboard',   label: '대시보드',     icon: 'fa-chart-line' },
  { route: 'assetSearch', label: '자산 검색',    icon: 'fa-magnifying-glass' },
  { section: '부서 담당자', deptOnly: true },
  { route: 'moveRequest',     label: '이동 신청',    icon: 'fa-paper-plane',  deptOnly: true },
  { route: 'disposalRequest', label: '폐기 신청',    icon: 'fa-trash-can',    deptOnly: true },
  { route: 'myRequests',      label: '내 신청 내역', icon: 'fa-list',         deptOnly: true },
  { section: '운영관리팀', adminOnly: true },
  { route: 'register',    label: '자산 등록',    icon: 'fa-plus',         adminOnly: true },
  { route: 'assetList',   label: '자산 목록',    icon: 'fa-table',        adminOnly: true },
  { route: 'approveRequests', label: '이동 승인', icon: 'fa-check',       adminOnly: true },
  { route: 'moveHistory', label: '이동 이력',    icon: 'fa-clock-rotate-left', adminOnly: true },
  { route: 'floorplan',   label: '평면도',       icon: 'fa-map-location-dot',  adminOnly: true },
  { route: 'excelUpload', label: '일괄 업로드',  icon: 'fa-file-excel',         adminOnly: true },
  { route: 'qr',          label: 'QR 라벨',      icon: 'fa-qrcode',             adminOnly: true },
  { route: 'disposal',    label: '폐기 자산 대장', icon: 'fa-trash-can',         adminOnly: true },
  { route: 'settings',    label: '설정',          icon: 'fa-gear',               adminOnly: true },
  { section: '도움말' },
  { route: 'guide',       label: '사용 가이드',  icon: 'fa-circle-question' }
];

function buildSidebar(role) {
  const nav = document.getElementById('sideNav');
  if (!nav) return;
  nav.innerHTML = '';
  for (const item of MENU) {
    if (item.adminOnly && role !== 'admin') continue;
    if (item.deptOnly  && role !== 'dept')  continue;
    if (item.section) {
      const h = document.createElement('div');
      h.className = 'side-section';
      h.textContent = item.section;
      nav.appendChild(h);
    } else {
      const a = document.createElement('a');
      a.className = 'side-link';
      a.dataset.route = item.route;
      a.href = '#' + item.route;
      const badge = item.route === 'approveRequests'
        ? '<span id="approveNavBadge" class="nav-badge hidden">0</span>' : '';
      a.innerHTML = `<i class="fas ${item.icon} w-4 text-center"></i><span>${item.label}</span>${badge}`;
      nav.appendChild(a);
    }
  }
}

/* ─── 대기 뱃지 갱신 ─── */
async function updatePendingBadge() {
  const badge = document.getElementById('approveNavBadge');
  if (!badge || !isAdmin()) return;
  const all = await MoveRequests.list();
  const n = all.filter(r => r.status === '대기').length;
  badge.textContent = n;
  badge.classList.toggle('hidden', n === 0);
}

/* ─── 역할 전환 탭 업데이트 ─── */
function updateRoleTabs(role) {
  const switcher = $('#roleSwitcher');
  const tabDept  = $('#tabDept');
  const tabAdmin = $('#tabAdmin');
  if (!switcher) return;

  switcher.classList.remove('hidden');
  switcher.classList.add('flex');

  const active   = 'bg-white dark:bg-slate-600 text-brand-500 shadow-sm';
  const inactive = 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300';

  if (role === 'dept') {
    tabDept.className  = `role-tab px-3 py-1.5 rounded-md transition-all ${active}`;
    tabAdmin.className = `role-tab px-3 py-1.5 rounded-md transition-all ${inactive}`;
  } else {
    tabAdmin.className = `role-tab px-3 py-1.5 rounded-md transition-all ${active}`;
    tabDept.className  = `role-tab px-3 py-1.5 rounded-md transition-all ${inactive}`;
  }
}

/* ─── 진입 함수 ─── */
function enterApp(role) {
  document.body.classList.toggle('role-admin', role === 'admin');
  document.body.classList.toggle('role-dept',  role === 'dept');
  buildSidebar(role);
  updateRoleTabs(role);

  const userInfo = $('#sideUserInfo');
  const session = getSession();
  if (role === 'admin' && session) {
    userInfo.innerHTML = `<i class="fas fa-user-shield mr-1"></i>${session.adminName}`;
    $('#logoutBtn').classList.remove('hidden');
    $('#headerLogout').classList.remove('hidden');
  } else {
    userInfo.innerHTML = `<i class="fas fa-user mr-1"></i>부서 담당자`;
    $('#logoutBtn').classList.add('hidden');
    $('#headerLogout').classList.add('hidden');
  }

  showView('appLayout');
  if (!location.hash) location.hash = 'dashboard';
  else handleRoute();
  if (role === 'admin') updatePendingBadge();
}

function backToRole() {
  showView('roleScreen');
  location.hash = '';
}

/* ─── 이벤트 ─── */
function bindEvents() {
  // 역할 카드
  document.querySelectorAll('.role-card').forEach(card => {
    card.addEventListener('click', () => {
      const role = card.dataset.role;
      if (role === 'admin') {
        if (isAdmin()) enterApp('admin');
        else showView('loginScreen');
      } else {
        enterApp('dept');
      }
    });
  });

  // 로그인
  $('#loginForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const id = $('#loginId').value.trim();
    const pw = $('#loginPw').value;
    if (!id || !pw) return;
    const btn = $('#loginBtn');
    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 확인 중...';
    const res = await login(id, pw);
    btn.disabled = false;
    btn.innerHTML = orig;
    if (!res.ok) {
      const err = $('#loginError');
      err.textContent = res.error;
      err.classList.remove('hidden');
      $('#loginPw').value = '';
      $('#loginPw').focus();
      return;
    }
    $('#loginError').classList.add('hidden');
    toast(`${res.session.adminName}님 환영합니다.`, 'success');
    enterApp('admin');
  });

  // 비번 보기
  $('#togglePw')?.addEventListener('click', () => {
    const pw = $('#loginPw');
    const icon = $('#togglePw i');
    if (pw.type === 'password') {
      pw.type = 'text';
      icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
      pw.type = 'password';
      icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
  });

  // 테스트 계정 카드
  document.querySelectorAll('[data-fill]').forEach(b => {
    b.addEventListener('click', () => {
      const [id, pw] = b.dataset.fill.split('|');
      $('#loginId').value = id;
      $('#loginPw').value = pw;
      $('#loginBtn').focus();
    });
  });

  $('#backToRole')?.addEventListener('click', backToRole);

  // ─── 역할 전환 탭 ───
  const openSwitchModal = () => {
    $('#switchId').value = '';
    $('#switchPw').value = '';
    $('#switchError').classList.add('hidden');
    $('#switchModal').classList.remove('hidden');
    $('#switchId').focus();
  };
  const closeSwitchModal = () => {
    $('#switchModal').classList.add('hidden');
  };

  $('#tabDept')?.addEventListener('click', () => {
    if (document.body.classList.contains('role-dept')) return;
    enterApp('dept');
    toast('부서담당자 화면으로 전환했습니다.', 'info');
  });

  $('#tabAdmin')?.addEventListener('click', () => {
    if (document.body.classList.contains('role-admin')) return;
    if (isAdmin()) {
      enterApp('admin');
      toast('운영관리팀 화면으로 전환했습니다.', 'info');
    } else {
      openSwitchModal();
    }
  });

  $('#switchCancel')?.addEventListener('click', closeSwitchModal);
  $('#switchModal')?.addEventListener('click', e => {
    if (e.target === $('#switchModal')) closeSwitchModal();
  });

  // 모달 내 테스트 계정 칩
  document.querySelectorAll('[data-switch-fill]').forEach(b => {
    b.addEventListener('click', () => {
      const [id, pw] = b.dataset.switchFill.split('|');
      $('#switchId').value = id;
      $('#switchPw').value = pw;
    });
  });

  // 모달 비밀번호 토글
  $('#switchTogglePw')?.addEventListener('click', () => {
    const pw = $('#switchPw');
    const icon = $('#switchTogglePw i');
    if (pw.type === 'password') {
      pw.type = 'text';
      icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
      pw.type = 'password';
      icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
  });

  // 모달 로그인 제출
  $('#switchLoginForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const id = $('#switchId').value.trim();
    const pw = $('#switchPw').value;
    if (!id || !pw) return;
    const btn = $('#switchLoginBtn');
    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    const res = await login(id, pw);
    btn.disabled = false;
    btn.innerHTML = orig;
    if (!res.ok) {
      const err = $('#switchError');
      err.textContent = res.error;
      err.classList.remove('hidden');
      $('#switchPw').value = '';
      $('#switchPw').focus();
      return;
    }
    closeSwitchModal();
    toast(`${res.session.adminName}님 — 운영관리팀으로 전환했습니다.`, 'success');
    enterApp('admin');
  });

  // 로그아웃
  const logout = () => {
    if (!confirm('로그아웃 하시겠습니까?')) return;
    clearSession();
    toast('로그아웃되었습니다.', 'info');
    backToRole();
  };
  $('#logoutBtn')?.addEventListener('click', logout);
  $('#headerLogout')?.addEventListener('click', logout);

  // 다크모드
  const applyTheme = t => {
    document.documentElement.classList.toggle('dark', t === 'dark');
    localStorage.setItem('sgm2_theme', t);
    const icon = $('#darkToggle i');
    if (icon) {
      icon.classList.toggle('fa-moon', t !== 'dark');
      icon.classList.toggle('fa-sun',  t === 'dark');
    }
  };
  applyTheme(localStorage.getItem('sgm2_theme') || 'light');
  $('#darkToggle')?.addEventListener('click', () => {
    applyTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
  });

  // 모바일 메뉴
  $('#menuBtn')?.addEventListener('click', () => {
    $('#sidebar')?.classList.toggle('hidden');
  });

  // 라우트 변경
  window.addEventListener('hashchange', () => { handleRoute(); updatePendingBadge(); });
}

/* ─── 세션 타이머 ─── */
function startSessionWatcher() {
  const tick = () => {
    const el = $('#sessionTimer');
    if (!el) return;
    if (!isAdmin()) {
      el.classList.add('hidden');
      // admin 화면이었는데 만료 → 역할 화면으로
      if (document.body.classList.contains('role-admin')) {
        toast('세션이 만료되었습니다. 다시 로그인해주세요.', 'warning');
        backToRole();
      }
      return;
    }
    const ms = remainingMs();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    el.classList.remove('hidden');
    el.querySelector('span').textContent = `${h}h ${m}m`;
  };
  tick();
  setInterval(tick, 60_000);
}

/* ─── 부트 ─── */
async function boot() {
  await seedIfEmpty();
  bindEvents();
  startSessionWatcher();

  // 새로고침 후 세션 살아있으면 관리자로 자동 복귀
  if (isAdmin() && location.hash) {
    enterApp('admin');
  } else if (location.hash) {
    // 부서 담당자 직접 링크 진입
    enterApp('dept');
  } else {
    showView('roleScreen');
  }
}

boot();

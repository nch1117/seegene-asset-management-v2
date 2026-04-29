/* 사용 가이드 — 히어로 + 6탭 + 흐름도 + FAQ */

const TABS = [
  { id: 'overview',   label: '시스템 개요',  icon: 'fa-circle-info' },
  { id: 'dept',       label: '부서 담당자',  icon: 'fa-user' },
  { id: 'admin',      label: '운영관리팀',   icon: 'fa-user-shield' },
  { id: 'features',   label: '주요 기능',    icon: 'fa-star' },
  { id: 'changelog',  label: '변경 사항',    icon: 'fa-code-branch' },
  { id: 'faq',        label: 'FAQ',          icon: 'fa-circle-question' },
];

export async function renderGuide(root) {
  root.innerHTML = `
    <!-- 히어로 -->
    <div class="guide-hero">
      <div class="guide-hero__title"><i class="fas fa-boxes-stacked mr-2"></i>씨젠의료재단 자산관리시스템</div>
      <div class="guide-hero__sub">대구경북검사센터 · 사용 가이드</div>
      <div class="guide-hero__badges">
        <span class="guide-hero__badge"><i class="fas fa-tag"></i>v2.0</span>
        <span class="guide-hero__badge"><i class="fas fa-database"></i>IndexedDB</span>
        <span class="guide-hero__badge"><i class="fas fa-moon"></i>다크모드</span>
        <span class="guide-hero__badge"><i class="fas fa-mobile-screen"></i>반응형</span>
      </div>
    </div>

    <!-- 탭 바 -->
    <div class="guide-tabs">
      ${TABS.map((t, i) => `
        <button class="guide-tab${i === 0 ? ' active' : ''}" data-tab="${t.id}">
          <i class="fas ${t.icon} mr-1"></i>${t.label}
        </button>`).join('')}
    </div>

    <!-- 탭 콘텐츠 -->
    <div id="guideContent"></div>
  `;

  renderTab(root.querySelector('#guideContent'), 'overview');

  root.querySelector('.guide-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.guide-tab');
    if (!btn) return;
    root.querySelectorAll('.guide-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderTab(root.querySelector('#guideContent'), btn.dataset.tab);
  });

  root.querySelector('#guideContent').addEventListener('click', e => {
    const q = e.target.closest('.faq-q');
    if (!q) return;
    const item = q.closest('.faq-item');
    item.classList.toggle('open');
  });
}

function renderTab(el, id) {
  const map = { overview: tabOverview, dept: tabDept, admin: tabAdmin, features: tabFeatures, changelog: tabChangelog, faq: tabFaq };
  el.innerHTML = (map[id] || tabOverview)();
}

/* ── 탭 1: 시스템 개요 ── */
function tabOverview() {
  return `
    <div class="card mb-4">
      <h3 class="font-semibold mb-3"><i class="fas fa-circle-info mr-1 text-brand-500"></i>시스템 소개</h3>
      <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        씨젠의료재단 자산관리시스템은 센터 내 고정 자산(PC, 모니터, 의자 등)의 등록·위치·이동을
        체계적으로 관리하기 위한 웹 기반 시스템입니다. 부서 담당자와 운영관리팀이 역할에 따라
        서로 다른 메뉴를 사용하며 협업합니다.
      </p>
    </div>
    <div class="grid md:grid-cols-2 gap-4 mb-4">
      <div class="card border-l-4 border-l-brand-500">
        <h4 class="font-semibold mb-2"><i class="fas fa-user mr-1 text-brand-500"></i>부서 담당자</h4>
        <ul class="text-sm text-slate-600 dark:text-slate-300 space-y-1 list-disc pl-4">
          <li>자산 검색 · 조회</li>
          <li>이동 신청 작성</li>
          <li>내 신청 내역 확인</li>
        </ul>
      </div>
      <div class="card border-l-4 border-l-brand-500">
        <h4 class="font-semibold mb-2"><i class="fas fa-user-shield mr-1 text-brand-500"></i>운영관리팀</h4>
        <ul class="text-sm text-slate-600 dark:text-slate-300 space-y-1 list-disc pl-4">
          <li>자산 등록 · 목록 · 엑셀 다운로드</li>
          <li>이동 신청 승인 / 반려</li>
          <li>이동 이력 조회</li>
          <li>현황판 차트 · 보고서</li>
        </ul>
      </div>
    </div>
    <div class="card">
      <h4 class="font-semibold mb-3"><i class="fas fa-route mr-1 text-brand-500"></i>이동 처리 전체 흐름</h4>
      <div class="guide-flow">
        ${flow('1','자산 검색','fa-magnifying-glass')}
        <span class="guide-flow__arrow"><i class="fas fa-chevron-right"></i></span>
        ${flow('2','이동 신청','fa-paper-plane')}
        <span class="guide-flow__arrow"><i class="fas fa-chevron-right"></i></span>
        ${flow('3','승인 검토','fa-check-circle')}
        <span class="guide-flow__arrow"><i class="fas fa-chevron-right"></i></span>
        ${flow('4','위치 자동 변경','fa-location-dot')}
        <span class="guide-flow__arrow"><i class="fas fa-chevron-right"></i></span>
        ${flow('5','이력 기록','fa-clock-rotate-left')}
      </div>
    </div>`;
}

/* ── 탭 2: 부서 담당자 ── */
function tabDept() {
  return `
    <div class="card mb-4">
      <h3 class="font-semibold mb-3"><i class="fas fa-user mr-1 text-brand-500"></i>부서 담당자 업무 흐름</h3>
      <div class="guide-flow mb-4">
        ${flow('1','역할 선택','fa-hand-pointer')}
        <span class="guide-flow__arrow"><i class="fas fa-chevron-right"></i></span>
        ${flow('2','자산 검색','fa-magnifying-glass')}
        <span class="guide-flow__arrow"><i class="fas fa-chevron-right"></i></span>
        ${flow('3','이동 신청','fa-paper-plane')}
        <span class="guide-flow__arrow"><i class="fas fa-chevron-right"></i></span>
        ${flow('4','승인 대기','fa-hourglass-half')}
        <span class="guide-flow__arrow"><i class="fas fa-chevron-right"></i></span>
        ${flow('5','결과 확인','fa-list-check')}
      </div>
    </div>
    <div class="grid md:grid-cols-3 gap-3">
      ${featureCard('fa-magnifying-glass','자산 검색','자산코드·자산명·층·상태 조건으로 필터링. 결과를 클릭해 상세 정보를 확인합니다.')}
      ${featureCard('fa-paper-plane','이동 신청','신청자 정보, 이동할 자산, 이동 위치(층/실), 사유를 입력하면 운영관리팀으로 전달됩니다.')}
      ${featureCard('fa-list','내 신청 내역','이름으로 신청 이력을 조회합니다. 상태(대기·승인·반려)와 반려 사유를 확인할 수 있습니다.')}
    </div>`;
}

/* ── 탭 3: 운영관리팀 ── */
function tabAdmin() {
  return `
    <div class="card mb-4">
      <h3 class="font-semibold mb-3"><i class="fas fa-user-shield mr-1 text-brand-500"></i>운영관리팀 업무 흐름</h3>
      <div class="guide-flow mb-4">
        ${flow('1','로그인','fa-key')}
        <span class="guide-flow__arrow"><i class="fas fa-chevron-right"></i></span>
        ${flow('2','자산 등록','fa-plus')}
        <span class="guide-flow__arrow"><i class="fas fa-chevron-right"></i></span>
        ${flow('3','이동 승인','fa-check')}
        <span class="guide-flow__arrow"><i class="fas fa-chevron-right"></i></span>
        ${flow('4','이력 확인','fa-clock-rotate-left')}
        <span class="guide-flow__arrow"><i class="fas fa-chevron-right"></i></span>
        ${flow('5','보고서','fa-chart-bar')}
      </div>
    </div>
    <div class="grid md:grid-cols-3 gap-3">
      ${featureCard('fa-plus','자산 등록','품목·자산코드·층·부서·상태 등을 입력해 신규 자산을 등록합니다.')}
      ${featureCard('fa-table','자산 목록','전체 자산 테이블 조회. 엑셀 다운로드 및 개별 삭제가 가능합니다.')}
      ${featureCard('fa-check','이동 승인','대기 신청을 확인하고 승인 또는 반려(사유 입력)합니다. 승인 시 자산 위치가 자동 변경됩니다.')}
    </div>`;
}

/* ── 탭 4: 주요 기능 ── */
function tabFeatures() {
  return `
    <div class="grid md:grid-cols-2 gap-4">
      ${featureCard('fa-chart-line','현황판','KPI 6종(전체·정상·수리중·폐기·이동대기·이번달처리) + 층별·품목별 차트. 막대를 클릭하면 교차분석이 표시됩니다.')}
      ${featureCard('fa-file-excel','엑셀 다운로드','자산 목록 페이지에서 현재 필터 결과를 .xlsx 형식으로 내보냅니다.')}
      ${featureCard('fa-moon','다크모드','우측 상단 달 아이콘으로 전환. 설정은 브라우저에 저장됩니다.')}
      ${featureCard('fa-rotate','역할 전환','로그인 없이 앱 내 우측 상단 탭으로 부서담당자 ↔ 운영관리팀 전환 가능.')}
      ${featureCard('fa-clock','세션 관리','운영관리팀 로그인 세션은 8시간 후 자동 만료되며 헤더에 남은 시간이 표시됩니다.')}
      ${featureCard('fa-mobile-screen','반응형','모바일/태블릿 화면에서도 최적화된 레이아웃으로 사용할 수 있습니다.')}
    </div>`;
}

/* ── 탭 5: 변경 사항 ── */
function tabChangelog() {
  return `
    <div class="card">
      <h3 class="font-semibold mb-3"><i class="fas fa-code-branch mr-1 text-brand-500"></i>v2 주요 변경 사항</h3>
      <div class="space-y-3 text-sm">
        ${changeItem('fa-cubes','모듈화','단일 파일(app.js 1,915줄)에서 ES6 모듈 12개 파일로 분리. 유지보수성 대폭 향상.')}
        ${changeItem('fa-database','IndexedDB','localStorage 용량 한계를 해소. 대용량 자산 데이터도 안정적으로 저장.')}
        ${changeItem('fa-moon','다크모드','Tailwind dark: 클래스 기반. 모든 컴포넌트에 다크 스타일 적용.')}
        ${changeItem('fa-mobile-screen','반응형 사이드바','모바일에서 햄버거 메뉴로 사이드바 토글. 태블릿·데스크톱 모두 지원.')}
        ${changeItem('fa-rotate','역할 전환 탭','화면 재진입 없이 헤더 탭 한 번으로 역할 즉시 전환.')}
        ${changeItem('fa-palette','디자인 개선','CSS 토큰 시스템, KPI 시맨틱 카드, 글래스모피즘 화면, 호버 리프트 등 시각 품질 향상.')}
      </div>
    </div>`;
}

/* ── 탭 6: FAQ ── */
function tabFaq() {
  const items = [
    ['데이터가 다른 컴퓨터에서 보이지 않아요.', 'IndexedDB는 각 브라우저에 로컬로 저장됩니다. 다른 기기와 공유하려면 백엔드 서버가 필요합니다. 현재 버전은 단일 기기 환경을 위한 데모입니다.'],
    ['브라우저를 닫으면 데이터가 사라지나요?', 'IndexedDB 데이터는 브라우저를 닫아도 유지됩니다. 단, 브라우저의 "사이트 데이터 삭제" 기능을 사용하면 초기화됩니다.'],
    ['세션이 자꾸 만료됩니다.', '운영관리팀 로그인 세션은 보안을 위해 8시간 후 자동 만료됩니다. 헤더에서 남은 시간을 확인하고 만료 전에 재로그인하세요.'],
    ['비밀번호를 잊었어요.', '테스트 계정은 admin / Seegene2025!, manager / Manager!23입니다. 실제 운영 환경에서는 관리자에게 비밀번호 재설정을 요청하세요.'],
    ['이동 신청 후 승인이 되어도 위치가 변경되지 않아요.', '승인 처리 시 자산의 층·실 정보가 자동으로 변경됩니다. 자산 목록 페이지에서 업데이트된 위치를 확인하세요.'],
    ['엑셀 파일이 다운로드되지 않아요.', '브라우저의 다운로드 차단 설정을 확인하세요. 팝업 차단이 활성화된 경우 허용 목록에 이 사이트를 추가해야 합니다.'],
    ['차트가 표시되지 않아요.', '차트는 운영관리팀 로그인 후에만 현황판에 표시됩니다. 로그인 상태를 확인하세요.'],
    ['다크모드가 재시작 후 초기화됩니다.', '테마 설정은 localStorage에 저장됩니다. 브라우저 설정에서 사이트 데이터를 삭제한 경우 초기화될 수 있습니다.'],
  ];
  return `
    <div class="space-y-0">
      ${items.map(([q, a]) => `
        <div class="faq-item">
          <button class="faq-q">
            <span><i class="fas fa-circle-question mr-2 text-brand-500"></i>${q}</span>
            <i class="fas fa-chevron-down chevron text-slate-400 flex-shrink-0"></i>
          </button>
          <div class="faq-a">${a}</div>
        </div>`).join('')}
    </div>`;
}

/* ── 공통 컴포넌트 ── */
function flow(num, label, icon) {
  return `
    <div class="guide-flow__step">
      <span class="guide-flow__num">${num}</span>
      <i class="fas ${icon} text-brand-500 text-sm"></i>
      <span>${label}</span>
    </div>`;
}

function featureCard(icon, title, desc) {
  return `
    <div class="card hover:border-brand-500 hover:-translate-y-0.5 transition cursor-default">
      <i class="fas ${icon} text-xl text-brand-500 mb-2"></i>
      <h4 class="font-semibold mb-1">${title}</h4>
      <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">${desc}</p>
    </div>`;
}

function changeItem(icon, title, desc) {
  return `
    <div class="flex gap-3 items-start py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <span class="mt-0.5 w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/20 grid place-items-center flex-shrink-0">
        <i class="fas ${icon} text-brand-500 text-xs"></i>
      </span>
      <div>
        <p class="font-semibold text-slate-800 dark:text-slate-200">${title}</p>
        <p class="text-slate-500 dark:text-slate-400 text-xs mt-0.5">${desc}</p>
      </div>
    </div>`;
}

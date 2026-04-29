/* 현황판 — KPI + 차트 + 교차분석 + 4종 필터 */
import { Assets, MoveRequests } from '../store.js';
import { isAdmin } from '../auth.js';

const FLOORS = ['2층', '3층', '4층', '5층', '6층', '7층'];
const STATUSES = ['정상', '수리중', '폐기'];
let charts = { floor: null, item: null, cross: null };
let state = { selectedFloor: null, filters: { floor: '', item: '', status: '', dept: '' } };

export async function renderDashboard(root) {
  const [allAssets, requests] = await Promise.all([Assets.list(), MoveRequests.list()]);
  const admin = isAdmin();

  /* 필터 옵션용 — 전체 데이터 기반 */
  const items = [...new Set(allAssets.map(a => a.item_category).filter(Boolean))].sort();
  const depts = [...new Set(allAssets.map(a => a.department).filter(Boolean))].sort();

  root.innerHTML = `
    <!-- 필터 바 -->
    <div class="card mb-4">
      <div class="flex items-center gap-2 mb-3">
        <i class="fas fa-filter text-brand-500"></i>
        <span class="font-semibold text-sm">조건 검색</span>
        <button id="resetFilter" class="ml-auto text-xs text-slate-500 hover:text-brand-500">
          <i class="fas fa-rotate-left mr-1"></i>초기화
        </button>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <select id="fFloor" class="input">
          <option value="">전체 층</option>
          ${FLOORS.map(f => `<option${state.filters.floor===f?' selected':''}>${f}</option>`).join('')}
        </select>
        <select id="fItem" class="input">
          <option value="">전체 품목</option>
          ${items.map(i => `<option${state.filters.item===i?' selected':''}>${i}</option>`).join('')}
        </select>
        <select id="fStatus" class="input">
          <option value="">전체 상태</option>
          ${STATUSES.map(s => `<option${state.filters.status===s?' selected':''}>${s}</option>`).join('')}
        </select>
        <select id="fDept" class="input">
          <option value="">전체 부서</option>
          ${depts.map(d => `<option${state.filters.dept===d?' selected':''}>${d}</option>`).join('')}
        </select>
      </div>
      <p id="filterSummary" class="text-xs text-slate-400 mt-2"></p>
    </div>

    <div id="dashContent"></div>
  `;

  /* 필터 이벤트 */
  ['fFloor','fItem','fStatus','fDept'].forEach(id => {
    root.querySelector('#' + id).addEventListener('change', () => {
      state.filters.floor  = root.querySelector('#fFloor').value;
      state.filters.item   = root.querySelector('#fItem').value;
      state.filters.status = root.querySelector('#fStatus').value;
      state.filters.dept   = root.querySelector('#fDept').value;
      state.selectedFloor = null;
      renderContent();
    });
  });
  root.querySelector('#resetFilter').addEventListener('click', () => {
    state.filters = { floor: '', item: '', status: '', dept: '' };
    state.selectedFloor = null;
    renderDashboard(root);
  });

  function applyFilter(list) {
    const { floor, item, status, dept } = state.filters;
    return list.filter(a =>
      (!floor  || a.floor         === floor)  &&
      (!item   || a.item_category === item)   &&
      (!status || a.status        === status) &&
      (!dept   || a.department    === dept)
    );
  }

  function renderContent() {
    const assets = applyFilter(allAssets);
    const total    = assets.length;
    const ok       = assets.filter(a => a.status === '정상').length;
    const repair   = assets.filter(a => a.status === '수리중').length;
    const disposed = assets.filter(a => a.status === '폐기').length;
    const pending  = requests.filter(r => r.status === '대기').length;
    const thisMonth = monthlyMoves(requests);

    /* 필터 요약 */
    const active = Object.entries(state.filters).filter(([,v])=>v).map(([k,v])=>`${k}:${v}`);
    const sum = root.querySelector('#filterSummary');
    if (sum) sum.textContent = active.length
      ? `필터 적용: ${active.join(' · ')} → ${total}건 / 전체 ${allAssets.length}건`
      : `전체 ${allAssets.length}건`;

    const content = root.querySelector('#dashContent');
    content.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        ${kpi('전체 자산',    total,     'fa-boxes-stacked')}
        ${kpi('정상',         ok,        'fa-circle-check')}
        ${kpi('수리중',       repair,    'fa-screwdriver-wrench')}
        ${kpi('폐기',         disposed,  'fa-trash')}
        ${kpi('이동 대기',    pending,   'fa-paper-plane',  pending > 0)}
        ${kpi('이번 달 처리', thisMonth, 'fa-calendar-check')}
      </div>

      <div class="grid lg:grid-cols-2 gap-4 mb-4">
        <div class="card">
          <div class="flex items-center justify-between mb-1">
            <h3 class="font-semibold text-sm"><i class="fas fa-building mr-1 text-brand-500"></i>층별 자산</h3>
            <span class="text-[11px] text-slate-400">막대 클릭 → 교차분석</span>
          </div>
          <div style="height:180px"><canvas id="chartFloor"></canvas></div>
        </div>
        <div class="card">
          <h3 class="font-semibold text-sm mb-1"><i class="fas fa-chart-pie mr-1 text-brand-500"></i>품목별 분포</h3>
          <div style="height:180px"><canvas id="chartItem"></canvas></div>
        </div>
      </div>

      <div class="card mb-4">
        <div class="flex items-center justify-between mb-1">
          <h3 class="font-semibold text-sm"><i class="fas fa-layer-group mr-1 text-brand-500"></i>교차분석</h3>
          <span id="crossTitle" class="text-[11px] text-slate-400">층을 선택하면 해당 층의 품목 분포를 표시합니다.</span>
        </div>
        <div style="height:140px"><canvas id="chartCross"></canvas></div>
      </div>

      <div class="grid lg:grid-cols-3 gap-4 mb-4">
        <!-- 최근 등록 자산 -->
        <div class="card lg:col-span-2">
          <h3 class="font-semibold text-sm mb-2"><i class="fas fa-clock-rotate-left mr-1 text-brand-500"></i>최근 등록 자산</h3>
          <div class="overflow-x-auto">
            <table class="tbl text-xs">
              <thead><tr>
                <th>자산코드</th><th>자산명</th><th>층</th><th>부서</th><th>상태</th><th>등록일</th>
              </tr></thead>
              <tbody>${recentRows(assets)}</tbody>
            </table>
          </div>
        </div>

        <!-- 부서별 자산 요약 -->
        <div class="card">
          <h3 class="font-semibold text-sm mb-2"><i class="fas fa-building-user mr-1 text-brand-500"></i>부서별 자산</h3>
          ${deptSummary(assets)}
        </div>
      </div>

      <!-- 최근 이동 신청 -->
      <div class="card">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-semibold text-sm"><i class="fas fa-paper-plane mr-1 text-brand-500"></i>최근 이동 신청</h3>
          ${admin ? `<a href="#approveRequests" class="text-xs text-brand-500 hover:underline">전체 보기 →</a>` : `<a href="#myRequests" class="text-xs text-brand-500 hover:underline">내 신청 →</a>`}
        </div>
        ${recentRequests(requests, allAssets)}
      </div>
    `;

    drawFloorChart(assets);
    drawItemChart(assets);
    drawCrossChart(assets, state.selectedFloor);
  }

  renderContent();
}

/* ─── helpers ─── */
const KPI_CLS = {
  '전체 자산': 'kpi--total', '정상': 'kpi--ok', '수리중': 'kpi--repair',
  '폐기': 'kpi--disposed', '이동 대기': 'kpi--pending', '이번 달 처리': 'kpi--monthly'
};

function kpi(label, value, icon, warnDot = false) {
  return `
    <div class="kpi ${KPI_CLS[label] || ''}">
      ${warnDot ? '<span class="stat-warn-dot"></span>' : ''}
      <span class="kpi__label">${label}</span>
      <span class="kpi__value">${value}</span>
      <span class="kpi__icon"><i class="fas ${icon}"></i></span>
    </div>`;
}

function monthlyMoves(requests) {
  const now = new Date();
  const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  return requests.filter(r => r.status === '승인' && (r.processedAt || '').startsWith(ym)).length;
}

function recentRows(assets) {
  const sorted = [...assets].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 8);
  if (!sorted.length) return `<tr><td colspan="6" class="text-center py-6 text-slate-400">조건에 맞는 자산이 없습니다.</td></tr>`;
  return sorted.map(a => `
    <tr>
      <td>${a.asset_code || '-'}</td>
      <td>${a.asset_name || '-'}</td>
      <td>${a.floor || '-'}</td>
      <td>${a.department || '-'}</td>
      <td>${statusBadge(a.status)}</td>
      <td>${(a.acquired_date || '').slice(0, 10)}</td>
    </tr>`).join('');
}

function statusBadge(s) {
  if (s === '정상')   return `<span class="badge badge--ok">정상</span>`;
  if (s === '수리중') return `<span class="badge badge--repair">수리중</span>`;
  if (s === '폐기')   return `<span class="badge badge--disposed">폐기</span>`;
  return `<span class="badge">${s || '-'}</span>`;
}

const DEPT_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#14b8a6'];

function deptSummary(assets) {
  const map = new Map();
  for (const a of assets) {
    const k = a.department || '미지정';
    map.set(k, (map.get(k) || 0) + 1);
  }
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = sorted[0]?.[1] || 1;
  if (!sorted.length) return `<p class="text-xs text-slate-400 text-center py-4">데이터 없음</p>`;
  return sorted.map(([dept, cnt], i) => {
    const color = DEPT_COLORS[i % DEPT_COLORS.length];
    return `
    <div class="mb-1.5">
      <div class="flex justify-between text-xs mb-0.5">
        <span class="truncate max-w-[130px]">${dept}</span>
        <span class="font-bold ml-1" style="color:${color}">${cnt}</span>
      </div>
      <div class="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
        <div class="h-full rounded-full" style="width:${Math.round(cnt/max*100)}%;background:${color}"></div>
      </div>
    </div>`;
  }).join('');
}

function recentRequests(requests, assets) {
  const assetMap = new Map(assets.map(a => [a.id, a]));
  const recent = [...requests].sort((a, b) => (b.createdAt||0) - (a.createdAt||0)).slice(0, 5);
  if (!recent.length) return `<p class="text-xs text-slate-400 text-center py-3">신청 내역이 없습니다.</p>`;
  return `<table class="tbl text-xs">
    <thead><tr><th>신청자</th><th>자산명</th><th>이동위치</th><th>상태</th></tr></thead>
    <tbody>${recent.map(r => {
      const a = assetMap.get(r.asset_id);
      const badge = r.status==='대기' ? 'pending' : r.status==='승인' ? 'ok' : 'disposed';
      return `<tr>
        <td>${r.applicant}</td>
        <td class="text-slate-500">${a?.asset_name || '-'}</td>
        <td>${r.to_floor} ${r.to_room||''}</td>
        <td><span class="badge badge--${badge}">${r.status}</span></td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

function groupCount(items, key) {
  const map = new Map();
  for (const it of items) {
    const k = it[key] || '미지정';
    map.set(k, (map.get(k) || 0) + 1);
  }
  return map;
}

function destroyChart(name) {
  if (charts[name]) { charts[name].destroy(); charts[name] = null; }
}

const FLOOR_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6'];
const FLOOR_HOVER  = ['#dc2626','#ea580c','#ca8a04','#16a34a','#2563eb','#7c3aed'];

function drawFloorChart(assets) {
  const ctx = document.getElementById('chartFloor');
  if (!ctx) return;
  const counts = FLOORS.map(f => assets.filter(a => a.floor === f).length);
  destroyChart('floor');
  charts.floor = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: FLOORS,
      datasets: [{ label: '자산 수', data: counts, backgroundColor: FLOOR_COLORS, hoverBackgroundColor: FLOOR_HOVER, borderRadius: 6 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      onClick: (_e, els) => {
        if (!els.length) return;
        const floor = FLOORS[els[0].index];
        state.selectedFloor = state.selectedFloor === floor ? null : floor;
        drawCrossChart(assets, state.selectedFloor);
      },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    }
  });
}

function drawItemChart(assets) {
  const ctx = document.getElementById('chartItem');
  if (!ctx) return;
  const map = groupCount(assets, 'item_category');
  const labels = [...map.keys()];
  const data = [...map.values()];
  const palette = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
  destroyChart('item');
  charts.item = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: palette.slice(0, labels.length), borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 11 } } } } }
  });
}

function drawCrossChart(assets, floor) {
  const ctx = document.getElementById('chartCross');
  const titleEl = document.getElementById('crossTitle');
  if (!ctx) return;
  destroyChart('cross');
  if (!floor) {
    if (titleEl) titleEl.textContent = '층을 선택하면 해당 층의 품목 분포를 표시합니다.';
    ctx.parentElement.style.opacity = '.5';
    return;
  }
  ctx.parentElement.style.opacity = '1';
  if (titleEl) titleEl.textContent = `${floor} 품목 분포`;
  const subset = assets.filter(a => a.floor === floor);
  const map = groupCount(subset, 'item_category');
  const labels = [...map.keys()];
  const data = [...map.values()];
  charts.cross = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: floor, data, backgroundColor: '#fb7185', borderRadius: 6 }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
  });
}

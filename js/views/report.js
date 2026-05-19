/* 보고서 — 부서별 현황 / 월별 현황 / 노후 자산 */
import { Assets, MoveHistory, RepairHistory } from '../store.js';
import { toast } from '../ui/toast.js';

const AGE_MS = yrs => yrs * 365.25 * 24 * 3600 * 1000;

function ageYears(date) {
  if (!date) return 0;
  return (Date.now() - new Date(date).getTime()) / AGE_MS(1);
}

function xlsxDownload(sheetName, rows, filename) {
  if (typeof XLSX === 'undefined') { toast('Excel 라이브러리를 불러올 수 없습니다.', 'error'); return; }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName);
  XLSX.writeFile(wb, filename);
}

export async function renderReport(root) {
  const [assets, repairs] = await Promise.all([Assets.list(), RepairHistory.list()]);

  /* ── 탭 전환 헬퍼 ── */
  const TAB_IDS   = ['tabDept', 'tabMonthly', 'tabAging'];
  const PANEL_IDS = ['panelDept', 'panelMonthly', 'panelAging'];
  const now = new Date();
  const defaultYear  = now.getFullYear();
  const defaultMonth = now.getMonth() + 1;

  root.innerHTML = `
    <div class="space-y-4">
      <!-- 탭 -->
      <div class="card !p-0 overflow-hidden">
        <div class="flex border-b border-slate-200 dark:border-slate-700">
          <button id="tabDept"    class="report-tab report-tab--active flex-1 py-3 text-sm font-medium"><i class="fas fa-building mr-1"></i>부서별 현황</button>
          <button id="tabMonthly" class="report-tab flex-1 py-3 text-sm font-medium text-slate-500"><i class="fas fa-calendar-alt mr-1"></i>월별 현황</button>
          <button id="tabAging"   class="report-tab flex-1 py-3 text-sm font-medium text-slate-500"><i class="fas fa-triangle-exclamation mr-1"></i>노후 자산</button>
        </div>

        <!-- 부서별 현황 -->
        <div id="panelDept" class="p-5">
          <div class="flex justify-between items-center mb-3">
            <p class="text-xs text-slate-400">전체 ${assets.length}건 기준</p>
            <button id="exportDept" class="btn-secondary text-xs"><i class="fas fa-file-excel mr-1 text-green-600"></i>Excel</button>
          </div>
          <div class="overflow-x-auto">
            <table class="tbl text-xs" id="deptTable">
              <thead><tr>
                <th>부서</th><th>전체</th><th>정상</th><th>수리중</th><th>폐기</th>
                <th>5년↑</th><th>7년↑</th><th>수리 건수</th>
              </tr></thead>
              <tbody id="deptBody"></tbody>
            </table>
          </div>
        </div>

        <!-- 월별 현황 -->
        <div id="panelMonthly" class="p-5 hidden">
          <div class="flex flex-wrap gap-3 mb-4 items-center">
            <select id="selYear" class="input w-28">
              ${[defaultYear, defaultYear-1, defaultYear-2].map(y => `<option value="${y}"${y===defaultYear?' selected':''}>${y}년</option>`).join('')}
            </select>
            <select id="selMonth" class="input w-24">
              ${Array.from({length:12},(_,i)=>i+1).map(m => `<option value="${m}"${m===defaultMonth?' selected':''}>${m}월</option>`).join('')}
            </select>
            <button id="exportMonthly" class="btn-secondary text-xs ml-auto"><i class="fas fa-file-excel mr-1 text-green-600"></i>Excel</button>
          </div>
          <div class="grid grid-cols-3 gap-4 mb-4" id="monthlySummary"></div>
          <div class="overflow-x-auto">
            <table class="tbl text-xs">
              <thead><tr><th>자산코드</th><th>자산명</th><th>품목</th><th>부서</th><th>취득일</th><th>등록일</th></tr></thead>
              <tbody id="monthlyBody"></tbody>
            </table>
          </div>
        </div>

        <!-- 노후 자산 -->
        <div id="panelAging" class="p-5 hidden">
          <div class="flex flex-wrap gap-3 mb-4 items-center">
            <select id="selAging" class="input w-32">
              <option value="5">5년 이상</option>
              <option value="7">7년 이상</option>
            </select>
            <select id="selAgingStatus" class="input w-28">
              <option value="">전체 상태</option>
              <option>정상</option><option>수리중</option>
            </select>
            <button id="exportAging" class="btn-secondary text-xs ml-auto"><i class="fas fa-file-excel mr-1 text-green-600"></i>Excel</button>
          </div>
          <p id="agingHint" class="text-xs text-slate-400 mb-2"></p>
          <div class="overflow-x-auto">
            <table class="tbl text-xs">
              <thead><tr><th>자산코드</th><th>자산명</th><th>품목</th><th>부서</th><th>취득일</th><th>경과</th><th>상태</th></tr></thead>
              <tbody id="agingBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;

  /* ── 탭 전환 ── */
  TAB_IDS.forEach((tid, i) => {
    root.querySelector('#' + tid).addEventListener('click', () => {
      TAB_IDS.forEach((t, j) => {
        root.querySelector('#' + t).classList.toggle('report-tab--active', i === j);
        root.querySelector('#' + t).classList.toggle('text-slate-500', i !== j);
        root.querySelector('#' + PANEL_IDS[j]).classList.toggle('hidden', i !== j);
      });
    });
  });

  /* ════════════════════════════════
     탭 1: 부서별 현황
  ════════════════════════════════ */
  const deptMap = {};
  for (const a of assets) {
    const d = a.department || '미지정';
    if (!deptMap[d]) deptMap[d] = { total:0, ok:0, repair:0, disposed:0, age5:0, age7:0 };
    deptMap[d].total++;
    if (a.status === '정상')  deptMap[d].ok++;
    if (a.status === '수리중') deptMap[d].repair++;
    if (a.status === '폐기')  deptMap[d].disposed++;
    const yrs = ageYears(a.acquired_date);
    if (yrs >= 7) deptMap[d].age7++;
    else if (yrs >= 5) deptMap[d].age5++;
  }
  const repairByDept = {};
  for (const r of repairs) {
    const d = r.department || '미지정';
    repairByDept[d] = (repairByDept[d] || 0) + 1;
  }

  const deptRows = Object.entries(deptMap).sort((a, b) => b[1].total - a[1].total);
  root.querySelector('#deptBody').innerHTML = deptRows.map(([d, s]) => `
    <tr>
      <td class="font-medium">${d}</td>
      <td class="text-center font-semibold">${s.total}</td>
      <td class="text-center text-green-600">${s.ok}</td>
      <td class="text-center text-amber-600">${s.repair}</td>
      <td class="text-center text-red-500">${s.disposed}</td>
      <td class="text-center text-amber-500">${s.age5}</td>
      <td class="text-center text-red-500 font-semibold">${s.age7}</td>
      <td class="text-center">${repairByDept[d] || 0}</td>
    </tr>`).join('');

  root.querySelector('#exportDept').addEventListener('click', () => {
    const rows = [['부서','전체','정상','수리중','폐기','5년↑','7년↑','수리건수']];
    deptRows.forEach(([d,s]) => rows.push([d, s.total, s.ok, s.repair, s.disposed, s.age5, s.age7, repairByDept[d]||0]));
    xlsxDownload('부서별현황', rows, `부서별현황_${new Date().toISOString().slice(0,10)}.xlsx`);
  });

  /* ════════════════════════════════
     탭 2: 월별 현황
  ════════════════════════════════ */
  function renderMonthly() {
    const yr  = parseInt(root.querySelector('#selYear').value);
    const mo  = parseInt(root.querySelector('#selMonth').value);
    const start = new Date(yr, mo - 1, 1).getTime();
    const end   = new Date(yr, mo, 1).getTime();

    const newAssets     = assets.filter(a => a.createdAt >= start && a.createdAt < end);
    const disposedAssets = assets.filter(a => a.disposed_at && (() => { const t = new Date(a.disposed_at).getTime(); return t >= start && t < end; })());
    const completedRepairs = repairs.filter(r => r.completed_at >= start && r.completed_at < end);

    root.querySelector('#monthlySummary').innerHTML = `
      <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
        <p class="text-xl font-bold text-blue-600">${newAssets.length}</p>
        <p class="text-xs text-slate-500 mt-1">신규 등록</p>
      </div>
      <div class="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
        <p class="text-xl font-bold text-red-500">${disposedAssets.length}</p>
        <p class="text-xs text-slate-500 mt-1">폐기 처리</p>
      </div>
      <div class="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
        <p class="text-xl font-bold text-green-600">${completedRepairs.length}</p>
        <p class="text-xs text-slate-500 mt-1">수리 완료</p>
      </div>`;

    root.querySelector('#monthlyBody').innerHTML = newAssets.length
      ? newAssets.map(a => `
          <tr>
            <td class="font-mono text-xs">${a.asset_code}</td>
            <td>${a.asset_name}</td>
            <td>${a.item_category}</td>
            <td>${a.department}</td>
            <td>${a.acquired_date || '-'}</td>
            <td>${new Date(a.createdAt).toLocaleDateString('ko')}</td>
          </tr>`).join('')
      : `<tr><td colspan="6" class="text-center py-6 text-slate-400">해당 월에 등록된 자산이 없습니다.</td></tr>`;

    /* Excel 핸들러 재등록 */
    const btn = root.querySelector('#exportMonthly');
    btn.onclick = () => {
      const rows = [['자산코드','자산명','품목','부서','취득일','등록일']];
      newAssets.forEach(a => rows.push([a.asset_code, a.asset_name, a.item_category, a.department, a.acquired_date||'', new Date(a.createdAt).toLocaleDateString('ko')]));
      xlsxDownload(`${yr}년${mo}월신규`, rows, `신규자산_${yr}${String(mo).padStart(2,'0')}.xlsx`);
    };
  }

  root.querySelector('#selYear').addEventListener('change', renderMonthly);
  root.querySelector('#selMonth').addEventListener('change', renderMonthly);

  /* ════════════════════════════════
     탭 3: 노후 자산
  ════════════════════════════════ */
  function renderAging() {
    const threshold = parseInt(root.querySelector('#selAging').value);
    const status    = root.querySelector('#selAgingStatus').value;
    const aged = assets.filter(a => {
      if (a.status === '폐기') return false;
      if (status && a.status !== status) return false;
      return ageYears(a.acquired_date) >= threshold;
    }).sort((a, b) => ageYears(b.acquired_date) - ageYears(a.acquired_date));

    root.querySelector('#agingHint').textContent = `${threshold}년 이상 자산 ${aged.length}건`;
    root.querySelector('#agingBody').innerHTML = aged.length
      ? aged.map(a => {
          const yrs = ageYears(a.acquired_date);
          const cls = yrs >= 7 ? 'text-red-500 font-semibold' : 'text-amber-500';
          return `<tr>
            <td class="font-mono text-xs">${a.asset_code}</td>
            <td>${a.asset_name}</td>
            <td>${a.item_category}</td>
            <td>${a.department}</td>
            <td>${a.acquired_date || '-'}</td>
            <td class="${cls}">${Math.floor(yrs)}년 ${Math.floor((yrs % 1) * 12)}개월</td>
            <td><span class="badge badge--${a.status==='정상'?'ok':'repair'}">${a.status}</span></td>
          </tr>`;
        }).join('')
      : `<tr><td colspan="7" class="text-center py-6 text-slate-400">해당 조건의 자산이 없습니다.</td></tr>`;

    root.querySelector('#exportAging').onclick = () => {
      const rows = [['자산코드','자산명','품목','부서','취득일','경과(년)','상태']];
      aged.forEach(a => rows.push([a.asset_code, a.asset_name, a.item_category, a.department, a.acquired_date||'', Math.floor(ageYears(a.acquired_date)), a.status]));
      xlsxDownload(`노후자산_${threshold}년↑`, rows, `노후자산_${threshold}년이상.xlsx`);
    };
  }

  root.querySelector('#selAging').addEventListener('change', renderAging);
  root.querySelector('#selAgingStatus').addEventListener('change', renderAging);

  /* 초기 렌더 */
  renderMonthly();
  renderAging();
}

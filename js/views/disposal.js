/* 폐기 자산 대장 */
import { Assets } from '../store.js';
import { isAdmin } from '../auth.js';

const PAGE_SIZE = 20;

export async function renderDisposal(root) {
  if (!isAdmin()) return;
  const all = await Assets.list();
  const disposed = all
    .filter(a => a.status === '폐기')
    .sort((a, b) => {
      const da = a.disposed_at || '';
      const db = b.disposed_at || '';
      return db > da ? 1 : db < da ? -1 : 0;
    });

  const depts = [...new Set(disposed.map(a => a.department).filter(Boolean))].sort();
  const cats  = [...new Set(disposed.map(a => a.item_category).filter(Boolean))].sort();

  const nowYM = (() => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  })();
  const thisMonthCount = disposed.filter(a => (a.disposed_at || '').startsWith(nowYM)).length;

  root.innerHTML = `
    <div class="space-y-4">

      <!-- 요약 통계 -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="card text-center py-3">
          <div class="text-2xl font-bold text-slate-700 dark:text-slate-200">${disposed.length}</div>
          <div class="text-xs text-slate-500 mt-1"><i class="fas fa-trash-can mr-1 text-amber-400"></i>전체 폐기</div>
        </div>
        <div class="card text-center py-3">
          <div class="text-2xl font-bold text-amber-500">${thisMonthCount}</div>
          <div class="text-xs text-slate-500 mt-1"><i class="fas fa-calendar-day mr-1"></i>이번 달</div>
        </div>
        <div class="card text-center py-3">
          <div class="text-2xl font-bold text-blue-500">${new Set(disposed.map(a => a.department).filter(Boolean)).size}</div>
          <div class="text-xs text-slate-500 mt-1"><i class="fas fa-building mr-1"></i>관련 부서 수</div>
        </div>
        <div class="card text-center py-3">
          <div class="text-2xl font-bold text-purple-500">${new Set(disposed.map(a => a.item_category).filter(Boolean)).size}</div>
          <div class="text-xs text-slate-500 mt-1"><i class="fas fa-tags mr-1"></i>품목 종류</div>
        </div>
      </div>

      <!-- 필터 + 테이블 -->
      <div class="card">
        <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 class="font-semibold">
            <i class="fas fa-trash-can mr-1 text-amber-500"></i>
            폐기 자산 대장 <span id="dispTotalBadge" class="text-xs font-normal text-slate-400 ml-1"></span>
          </h3>
          <button id="exportDispBtn" class="btn-secondary text-xs">
            <i class="fas fa-file-excel mr-1"></i>엑셀 다운로드
          </button>
        </div>

        <!-- 필터 바 -->
        <div class="grid md:grid-cols-4 gap-3 mb-4">
          <input id="dispSearch" type="text" placeholder="자산코드 · 자산명 검색" class="input text-sm" />
          <select id="dispDept" class="input text-sm">
            <option value="">전체 부서</option>
            ${depts.map(d => `<option>${d}</option>`).join('')}
          </select>
          <select id="dispCat" class="input text-sm">
            <option value="">전체 품목</option>
            ${cats.map(c => `<option>${c}</option>`).join('')}
          </select>
          <div class="flex gap-1 items-center">
            <input id="dispDateFrom" type="date" class="input text-sm flex-1" title="폐기일 시작" />
            <span class="text-slate-400 text-xs">~</span>
            <input id="dispDateTo"   type="date" class="input text-sm flex-1" title="폐기일 종료" />
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="tbl">
            <thead>
              <tr>
                <th>자산코드</th>
                <th>자산명</th>
                <th>품목</th>
                <th>층/실</th>
                <th>부서</th>
                <th>담당자</th>
                <th>취득일자</th>
                <th>폐기일자</th>
                <th>폐기사유</th>
              </tr>
            </thead>
            <tbody id="dispBody"></tbody>
          </table>
        </div>

        <p id="dispPager" class="text-xs text-slate-400 mt-2 flex items-center gap-2"></p>
      </div>
    </div>
  `;

  let filtered = [...disposed];
  let page = 1;

  function applyFilter() {
    const q    = root.querySelector('#dispSearch').value.trim().toLowerCase();
    const dept = root.querySelector('#dispDept').value;
    const cat  = root.querySelector('#dispCat').value;
    const from = root.querySelector('#dispDateFrom').value;
    const to   = root.querySelector('#dispDateTo').value;

    filtered = disposed.filter(a => {
      const dispDate = a.disposed_at || '';
      return (
        (!q    || a.asset_code.toLowerCase().includes(q) || a.asset_name.toLowerCase().includes(q)) &&
        (!dept || a.department    === dept) &&
        (!cat  || a.item_category === cat)  &&
        (!from || dispDate >= from) &&
        (!to   || dispDate <= to)
      );
    });
    page = 1;
    renderTable();
  }

  function renderTable() {
    const total      = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = Math.min(page, totalPages);
    const items = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    root.querySelector('#dispTotalBadge').textContent = `(${total}건)`;

    root.querySelector('#dispBody').innerHTML = items.length
      ? items.map(a => `
          <tr>
            <td class="font-mono text-xs">${a.asset_code || '-'}</td>
            <td>${a.asset_name || '-'}</td>
            <td>${a.item_category || '-'}</td>
            <td>${a.floor || '-'} ${a.room || ''}</td>
            <td>${a.department || '-'}</td>
            <td>${a.manager || '-'}</td>
            <td class="text-xs">${a.acquired_date || '-'}</td>
            <td class="text-xs font-medium text-red-500">${a.disposed_at || '-'}</td>
            <td class="text-xs text-slate-500">${a.disposal_reason || '-'}</td>
          </tr>`).join('')
      : `<tr><td colspan="9" class="text-center py-8 text-slate-400">
           ${disposed.length ? '검색 결과가 없습니다.' : '폐기 처리된 자산이 없습니다.'}
         </td></tr>`;

    root.querySelector('#dispPager').innerHTML = `
      <span>총 ${total}건 · ${page} / ${totalPages} 페이지</span>
      <span class="inline-flex gap-1">
        <button id="dispPrev" class="px-2 py-0.5 rounded border text-xs
          ${page <= 1 ? 'opacity-30 pointer-events-none' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}">
          ‹ 이전
        </button>
        <button id="dispNext" class="px-2 py-0.5 rounded border text-xs
          ${page >= totalPages ? 'opacity-30 pointer-events-none' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}">
          다음 ›
        </button>
      </span>`;
    root.querySelector('#dispPrev').addEventListener('click', () => { page--; renderTable(); });
    root.querySelector('#dispNext').addEventListener('click', () => { page++; renderTable(); });
  }

  /* 필터 이벤트 */
  root.querySelector('#dispSearch').addEventListener('input', applyFilter);
  root.querySelector('#dispDept').addEventListener('change', applyFilter);
  root.querySelector('#dispCat').addEventListener('change', applyFilter);
  root.querySelector('#dispDateFrom').addEventListener('change', applyFilter);
  root.querySelector('#dispDateTo').addEventListener('change', applyFilter);

  /* 엑셀 다운로드 (필터 적용된 결과) */
  root.querySelector('#exportDispBtn').addEventListener('click', () => {
    const rows = filtered.map(a => ({
      자산코드:  a.asset_code     || '',
      자산명:    a.asset_name     || '',
      품목:      a.item_category  || '',
      층:        a.floor          || '',
      실:        a.room           || '',
      담당부서:  a.department     || '',
      담당자:    a.manager        || '',
      취득일자:  a.acquired_date  || '',
      폐기일자:  a.disposed_at    || '',
      폐기사유:  a.disposal_reason || '',
      비고:      a.note           || ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '폐기자산대장');
    XLSX.writeFile(wb, `폐기자산대장_${new Date().toISOString().slice(0, 10)}.xlsx`);
  });

  renderTable();
}

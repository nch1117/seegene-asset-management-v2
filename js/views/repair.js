/* 수리 이력 전체 목록 (관리자) */
import { Assets, RepairHistory } from '../store.js';
import { toast } from '../ui/toast.js';
import { writeAoaXlsx } from '../utils/excel.js';

export async function renderRepair(root) {
  const [assets, repairs] = await Promise.all([Assets.list(), RepairHistory.list()]);

  const assetMap = Object.fromEntries(assets.map(a => [a.id, a]));
  const depts = [...new Set(assets.map(a => a.department).filter(Boolean))].sort();

  root.innerHTML = `
    <div class="space-y-4">
      <!-- 요약 카드 -->
      <div class="grid grid-cols-3 gap-4">
        <div class="card text-center">
          <p class="text-2xl font-bold text-slate-800 dark:text-white" id="cntTotal">-</p>
          <p class="text-xs text-slate-500 mt-1">전체 수리</p>
        </div>
        <div class="card text-center">
          <p class="text-2xl font-bold text-amber-500" id="cntActive">-</p>
          <p class="text-xs text-slate-500 mt-1">진행 중</p>
        </div>
        <div class="card text-center">
          <p class="text-2xl font-bold text-green-500" id="cntDone">-</p>
          <p class="text-xs text-slate-500 mt-1">완료</p>
        </div>
      </div>

      <!-- 필터 -->
      <div class="card">
        <div class="grid md:grid-cols-4 gap-3">
          <input id="rSearch" class="input md:col-span-2" placeholder="자산코드 / 자산명 / 업체 검색" />
          <select id="rStatus" class="input">
            <option value="">전체 상태</option>
            <option value="진행중">진행 중</option>
            <option value="완료">완료</option>
          </select>
          <select id="rDept" class="input">
            <option value="">전체 부서</option>
            ${depts.map(d => `<option>${d}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- 테이블 -->
      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-sm"><i class="fas fa-wrench mr-1 text-blue-500"></i>수리 이력</h3>
          <button id="exportRepairBtn" class="btn-secondary text-xs">
            <i class="fas fa-file-excel mr-1 text-green-600"></i>Excel 다운로드
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="tbl text-xs">
            <thead><tr>
              <th>접수일</th><th>자산코드</th><th>자산명</th><th>부서</th>
              <th>업체</th><th>증상/내용</th><th>상태</th><th>완료일</th><th>비용(원)</th>
            </tr></thead>
            <tbody id="repairBody"></tbody>
          </table>
        </div>
        <p id="repairHint" class="text-xs text-slate-400 mt-2"></p>
      </div>
    </div>
  `;

  /* ── 상태 집계 ── */
  const active = repairs.filter(r => r.status === '진행중').length;
  const done   = repairs.filter(r => r.status === '완료').length;
  root.querySelector('#cntTotal').textContent = repairs.length;
  root.querySelector('#cntActive').textContent = active;
  root.querySelector('#cntDone').textContent   = done;

  let filtered = [...repairs].sort((a, b) => b.reported_at - a.reported_at);

  function applyFilter() {
    const q      = root.querySelector('#rSearch').value.trim().toLowerCase();
    const status = root.querySelector('#rStatus').value;
    const dept   = root.querySelector('#rDept').value;
    filtered = repairs.filter(r => {
      if (status && r.status !== status) return false;
      if (dept   && r.department !== dept) return false;
      if (q) {
        const hay = `${r.asset_code} ${r.asset_name} ${r.vendor || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => b.reported_at - a.reported_at);
    renderTable();
  }

  function fmt(ts) { return ts ? new Date(ts).toLocaleDateString('ko') : '-'; }

  function renderTable() {
    const body = root.querySelector('#repairBody');
    body.innerHTML = filtered.length
      ? filtered.map(r => `
          <tr>
            <td>${fmt(r.reported_at)}</td>
            <td class="font-mono">${r.asset_code || '-'}</td>
            <td>${r.asset_name || '-'}</td>
            <td>${r.department || '-'}</td>
            <td>${r.vendor || '-'}</td>
            <td class="max-w-[160px] truncate" title="${r.description || ''}">${r.description || '-'}</td>
            <td><span class="badge ${r.status === '완료' ? 'badge--ok' : 'badge--repair'}">${r.status}</span></td>
            <td>${fmt(r.completed_at)}</td>
            <td>${r.cost != null && r.cost > 0 ? r.cost.toLocaleString() : '-'}</td>
          </tr>`).join('')
      : `<tr><td colspan="9" class="text-center py-8 text-slate-400">해당하는 수리 이력이 없습니다.</td></tr>`;
    root.querySelector('#repairHint').textContent = `${filtered.length}건`;
  }

  ['rSearch', 'rStatus', 'rDept'].forEach(id => {
    const el = root.querySelector('#' + id);
    el.addEventListener(id === 'rSearch' ? 'input' : 'change', applyFilter);
  });

  /* ── Excel 내보내기 ── */
  root.querySelector('#exportRepairBtn').addEventListener('click', () => {
    const rows = [['접수일', '자산코드', '자산명', '부서', '업체', '증상/내용', '상태', '완료일', '비용(원)']];
    filtered.forEach(r => rows.push([
      fmt(r.reported_at), r.asset_code || '', r.asset_name || '', r.department || '',
      r.vendor || '', r.description || '', r.status,
      fmt(r.completed_at), r.cost || 0
    ]));
    writeAoaXlsx(rows, '수리이력', `수리이력_${new Date().toISOString().slice(0,10)}.xlsx`);
  });

  renderTable();
}

/* 폐기 자산 대장 */
import { Assets } from '../store.js';
import { isAdmin } from '../auth.js';

export async function renderDisposal(root) {
  if (!isAdmin()) return;
  const all = await Assets.list();
  const disposed = all.filter(a => a.status === '폐기')
    .sort((a, b) => (b.disposed_at || b.createdAt || 0) > (a.disposed_at || a.createdAt || 0) ? 1 : -1);

  root.innerHTML = `
    <div class="card">
      <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 class="font-semibold"><i class="fas fa-trash-can mr-1 text-amber-500"></i>폐기 자산 대장 (${disposed.length}건)</h3>
        <button id="exportDispBtn" class="btn-secondary text-xs"><i class="fas fa-file-excel mr-1"></i>엑셀 다운로드</button>
      </div>
      <div class="overflow-x-auto">
        <table class="tbl">
          <thead><tr>
            <th>자산코드</th><th>자산명</th><th>품목</th><th>층/실</th><th>부서</th><th>폐기일자</th><th>폐기사유</th>
          </tr></thead>
          <tbody>
            ${disposed.length ? disposed.map(a => `
              <tr>
                <td class="font-mono text-xs">${a.asset_code}</td>
                <td>${a.asset_name}</td>
                <td>${a.item_category}</td>
                <td>${a.floor} ${a.room || ''}</td>
                <td>${a.department}</td>
                <td>${a.disposed_at || '-'}</td>
                <td class="text-xs text-slate-500">${a.disposal_reason || '-'}</td>
              </tr>`).join('')
            : `<tr><td colspan="7" class="text-center py-8 text-slate-400">폐기 처리된 자산이 없습니다.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  root.querySelector('#exportDispBtn').addEventListener('click', () => {
    const rows = disposed.map(a => ({
      자산코드: a.asset_code, 자산명: a.asset_name, 품목: a.item_category,
      층: a.floor, 실: a.room || '', 담당부서: a.department, 담당자: a.manager || '',
      취득일자: a.acquired_date || '', 폐기일자: a.disposed_at || '',
      폐기사유: a.disposal_reason || '', 비고: a.note || ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '폐기자산대장');
    XLSX.writeFile(wb, `폐기자산대장_${new Date().toISOString().slice(0,10)}.xlsx`);
  });
}

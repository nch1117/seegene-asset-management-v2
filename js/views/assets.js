/* 자산 검색 / 등록 / 목록 + 상세·수정·폐기 모달 */
import { Assets } from '../store.js';
import { toast } from '../ui/toast.js';
import { isAdmin } from '../auth.js';

const STATUS_OPTS = ['정상', '수리중', '폐기'];
const FLOORS = ['2층', '3층', '4층', '5층', '6층', '7층'];
const CAT_PREFIX = { 'PC': 'PC', '노트북': 'NB', '모니터': 'MN', '프린터': 'PR', '스캐너': 'SC',
  '복합기': 'MF', '서버': 'SV', '네트워크': 'NW', '의자': 'CH', '책상': 'DS', '냉장고': 'RF',
  '에어컨': 'AC', '전화기': 'PH', '태블릿': 'TB', '카메라': 'CM' };
const CATEGORIES = Object.keys(CAT_PREFIX);

function catSelect(name, selected = '', required = false) {
  return `<select name="${name}" class="input"${required ? ' required' : ''}>
    <option value="">품목 선택${required ? ' *' : ''}</option>
    ${CATEGORIES.map(c => `<option value="${c}"${selected === c ? ' selected' : ''}>${c}</option>`).join('')}
  </select>`;
}

function badge(s) {
  const cls = s === '정상' ? 'ok' : s === '수리중' ? 'repair' : s === '폐기' ? 'disposed' : '';
  return `<span class="badge badge--${cls}">${s || '-'}</span>`;
}

/* 자산코드 자동 생성: CAT-YYMMDD-NNNN */
async function generateAssetCode(category) {
  const all = await Assets.list();
  const prefix = CAT_PREFIX[category] || category.slice(0, 2).toUpperCase();
  const today = new Date();
  const yymmdd = String(today.getFullYear()).slice(2)
    + String(today.getMonth() + 1).padStart(2, '0')
    + String(today.getDate()).padStart(2, '0');
  const base = `${prefix}-${yymmdd}`;
  const existing = all.filter(a => a.asset_code && a.asset_code.startsWith(base));
  const seq = String(existing.length + 1).padStart(4, '0');
  return `${base}-${seq}`;
}

/* ─────────────────────────────────────────
   모달 공통 열기/닫기
───────────────────────────────────────── */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('hidden'); document.body.style.overflow = ''; }
}

/* ─────────────────────────────────────────
   상세 모달 표시
───────────────────────────────────────── */
export async function openAssetDetail(assetId, afterAction) {
  const a = await Assets.get(assetId);
  if (!a) return;
  const admin = isAdmin();

  const modal = document.getElementById('assetDetailModal');
  if (!modal) return;

  modal.querySelector('#detailBody').innerHTML = `
    <div class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
      <div><span class="detail-label">자산코드</span><span class="detail-val font-mono">${a.asset_code || '-'}</span></div>
      <div><span class="detail-label">자산명</span><span class="detail-val">${a.asset_name || '-'}</span></div>
      <div><span class="detail-label">품목</span><span class="detail-val">${a.item_category || '-'}</span></div>
      <div><span class="detail-label">상태</span><span class="detail-val">${badge(a.status)}</span></div>
      <div><span class="detail-label">층</span><span class="detail-val">${a.floor || '-'}</span></div>
      <div><span class="detail-label">실</span><span class="detail-val">${a.room || '-'}</span></div>
      <div><span class="detail-label">담당부서</span><span class="detail-val">${a.department || '-'}</span></div>
      <div><span class="detail-label">담당자</span><span class="detail-val">${a.manager || '-'}</span></div>
      <div><span class="detail-label">취득일자</span><span class="detail-val">${a.acquired_date || '-'}</span></div>
      <div><span class="detail-label">등록일</span><span class="detail-val">${a.createdAt ? new Date(a.createdAt).toLocaleDateString('ko') : '-'}</span></div>
      ${a.disposed_at ? `<div><span class="detail-label">폐기일자</span><span class="detail-val text-red-500">${a.disposed_at}</span></div>` : ''}
      ${a.disposal_reason ? `<div class="col-span-2"><span class="detail-label">폐기사유</span><span class="detail-val">${a.disposal_reason}</span></div>` : ''}
      ${a.note ? `<div class="col-span-2"><span class="detail-label">비고</span><span class="detail-val">${a.note}</span></div>` : ''}
      ${(a.pos_x != null && a.pos_x !== 0) ? `<div><span class="detail-label">핀 위치</span><span class="detail-val text-xs font-mono">X:${Number(a.pos_x).toFixed(1)}% Y:${Number(a.pos_y).toFixed(1)}%</span></div>` : ''}
    </div>
  `;

  const editBtn = modal.querySelector('#detailEditBtn');
  const dispBtn = modal.querySelector('#detailDisposalBtn');
  if (editBtn) { editBtn.classList.toggle('hidden', !admin); editBtn.onclick = () => { closeModal('assetDetailModal'); openAssetEdit(assetId, afterAction); }; }
  if (dispBtn) { dispBtn.classList.toggle('hidden', !admin || a.status === '폐기'); dispBtn.onclick = () => { closeModal('assetDetailModal'); openAssetDisposal(assetId, afterAction); }; }

  const closeBtn = modal.querySelector('#detailCloseBtn');
  if (closeBtn) closeBtn.onclick = () => closeModal('assetDetailModal');
  modal.onclick = e => { if (e.target === modal) closeModal('assetDetailModal'); };

  openModal('assetDetailModal');
}

/* ─────────────────────────────────────────
   수정 모달
───────────────────────────────────────── */
export async function openAssetEdit(assetId, afterAction) {
  const a = await Assets.get(assetId);
  if (!a || !isAdmin()) return;

  const modal = document.getElementById('assetEditModal');
  if (!modal) return;

  modal.querySelector('#editForm').innerHTML = `
    <div class="grid md:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm mb-1">자산코드 <span class="text-xs text-slate-400">(변경 불가)</span></label>
        <input name="asset_code" class="input bg-slate-50 dark:bg-slate-700" value="${a.asset_code || ''}" readonly />
      </div>
      <div>
        <label class="block text-sm mb-1">자산명 <span class="text-red-500">*</span></label>
        <input name="asset_name" class="input" value="${a.asset_name || ''}" required />
      </div>
      <div>
        <label class="block text-sm mb-1">품목 <span class="text-red-500">*</span></label>
        ${catSelect('item_category', a.item_category || '', true)}
      </div>
      <div>
        <label class="block text-sm mb-1">상태</label>
        <select name="status" class="input">
          ${STATUS_OPTS.map(s => `<option${a.status === s ? ' selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="block text-sm mb-1">층</label>
        <select name="floor" class="input">
          ${FLOORS.map(f => `<option${a.floor === f ? ' selected' : ''}>${f}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="block text-sm mb-1">실</label>
        <input name="room" class="input" value="${a.room || ''}" placeholder="예: 301호" />
      </div>
      <div>
        <label class="block text-sm mb-1">담당부서 <span class="text-red-500">*</span></label>
        <input name="department" class="input" value="${a.department || ''}" required />
      </div>
      <div>
        <label class="block text-sm mb-1">담당자</label>
        <input name="manager" class="input" value="${a.manager || ''}" />
      </div>
      <div>
        <label class="block text-sm mb-1">취득일자</label>
        <input name="acquired_date" type="date" class="input" value="${a.acquired_date || ''}" />
      </div>
      <div class="md:col-span-2">
        <label class="block text-sm mb-1">비고</label>
        <textarea name="note" class="input" rows="2">${a.note || ''}</textarea>
      </div>
    </div>
  `;

  const form = modal.querySelector('#editForm');
  form.onsubmit = async e => {
    e.preventDefault();
    const patch = Object.fromEntries(new FormData(e.target));
    await Assets.put({ ...a, ...patch });
    toast('자산 정보가 수정되었습니다.', 'success');
    closeModal('assetEditModal');
    if (afterAction) afterAction();
  };

  const closeBtn = modal.querySelector('#editCloseBtn');
  if (closeBtn) closeBtn.onclick = () => closeModal('assetEditModal');
  modal.onclick = e => { if (e.target === modal) closeModal('assetEditModal'); };

  openModal('assetEditModal');
}

/* ─────────────────────────────────────────
   폐기 모달
───────────────────────────────────────── */
export async function openAssetDisposal(assetId, afterAction) {
  const a = await Assets.get(assetId);
  if (!a || !isAdmin()) return;

  const modal = document.getElementById('assetDisposalModal');
  if (!modal) return;

  const today = new Date().toISOString().slice(0, 10);
  modal.querySelector('#disposalAssetName').textContent = `${a.asset_name} (${a.asset_code})`;
  modal.querySelector('#disposalDate').value = today;
  modal.querySelector('#disposalReason').value = '';

  const form = modal.querySelector('#disposalForm');
  form.onsubmit = async e => {
    e.preventDefault();
    const disposed_at = modal.querySelector('#disposalDate').value;
    const disposal_reason = modal.querySelector('#disposalReason').value.trim();
    await Assets.put({ ...a, status: '폐기', disposed_at, disposal_reason });
    toast(`${a.asset_name} 폐기 처리되었습니다.`, 'success');
    closeModal('assetDisposalModal');
    if (afterAction) afterAction();
  };

  const closeBtn = modal.querySelector('#disposalCloseBtn');
  if (closeBtn) closeBtn.onclick = () => closeModal('assetDisposalModal');
  const cancelBtn = modal.querySelector('#disposalCancelBtn');
  if (cancelBtn) cancelBtn.onclick = () => closeModal('assetDisposalModal');
  modal.onclick = e => { if (e.target === modal) closeModal('assetDisposalModal'); };

  openModal('assetDisposalModal');
}

/* ═══════════════════════════════════════════════════
   자산 검색 (공통)
═══════════════════════════════════════════════════ */
export async function renderAssetSearch(root) {
  const assets = await Assets.list();
  root.innerHTML = `
    <div class="card mb-4">
      <div class="grid md:grid-cols-4 gap-3">
        <input id="qText" class="input md:col-span-2" placeholder="자산코드 / 자산명 / 비고 검색" />
        <select id="qFloor" class="input">
          <option value="">전체 층</option>
          ${FLOORS.map(f => `<option>${f}</option>`).join('')}
        </select>
        <select id="qStatus" class="input">
          <option value="">전체 상태</option>
          ${STATUS_OPTS.map(s => `<option>${s}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="card">
      <div class="overflow-x-auto">
        <table class="tbl">
          <thead><tr>
            <th>자산코드</th><th>자산명</th><th>품목</th><th>층/실</th><th>부서</th><th>담당자</th><th>상태</th>
          </tr></thead>
          <tbody id="searchBody"></tbody>
        </table>
      </div>
      <p id="searchHint" class="text-xs text-slate-400 mt-2"></p>
    </div>
  `;

  const renderRows = () => {
    const text   = root.querySelector('#qText').value.trim().toLowerCase();
    const floor  = root.querySelector('#qFloor').value;
    const status = root.querySelector('#qStatus').value;
    const filtered = assets.filter(a => {
      if (floor && a.floor !== floor) return false;
      if (status && a.status !== status) return false;
      if (text) {
        const hay = `${a.asset_code} ${a.asset_name} ${a.note || ''}`.toLowerCase();
        if (!hay.includes(text)) return false;
      }
      return true;
    });
    const body = root.querySelector('#searchBody');
    body.innerHTML = filtered.length ? filtered.map(a => `
      <tr class="cursor-pointer hover:bg-brand-50 dark:hover:bg-slate-700" data-id="${a.id}">
        <td class="font-mono text-xs">${a.asset_code}</td>
        <td>${a.asset_name}</td>
        <td>${a.item_category}</td>
        <td>${a.floor} ${a.room || ''}</td>
        <td>${a.department}</td>
        <td>${a.manager || '-'}</td>
        <td>${badge(a.status)}</td>
      </tr>`).join('')
      : `<tr><td colspan="7" class="text-center py-8 text-slate-400">검색 결과가 없습니다.</td></tr>`;
    root.querySelector('#searchHint').textContent = `${filtered.length}건 / 전체 ${assets.length}건`;

    body.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', () => openAssetDetail(tr.dataset.id, () => renderAssetSearch(root)));
    });
  };

  ['qText', 'qFloor', 'qStatus'].forEach(id =>
    root.querySelector('#' + id).addEventListener('input', renderRows)
  );
  renderRows();
}

/* ═══════════════════════════════════════════════════
   자산 등록 (관리자)
═══════════════════════════════════════════════════ */
export async function renderAssetRegister(root) {
  if (!isAdmin()) return;
  const today = new Date().toISOString().slice(0, 10);

  root.innerHTML = `
    <div class="card max-w-3xl">
      <h3 class="font-semibold mb-4"><i class="fas fa-plus mr-1 text-brand-500"></i>새 자산 등록</h3>
      <form id="regForm" class="grid md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm mb-1">품목 <span class="text-red-500">*</span></label>
          <select id="regCategory" name="item_category" class="input" required>
            <option value="">품목 선택</option>
            ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm mb-1">자산명 <span class="text-red-500">*</span></label>
          <input name="asset_name" class="input" required />
        </div>
        <div>
          <label class="block text-sm mb-1">자산코드 <span class="text-xs text-slate-400">(품목 선택 후 자동 생성)</span></label>
          <div class="flex gap-2">
            <input id="regCode" name="asset_code" class="input" placeholder="품목을 먼저 선택하세요" />
            <button type="button" id="genCodeBtn" class="btn-secondary shrink-0"><i class="fas fa-magic"></i></button>
          </div>
        </div>
        <div>
          <label class="block text-sm mb-1">취득일자</label>
          <input name="acquired_date" type="date" class="input" value="${today}" required />
        </div>
        <div>
          <label class="block text-sm mb-1">층</label>
          <select name="floor" class="input" required>
            ${FLOORS.map(f => `<option>${f}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm mb-1">실</label>
          <input name="room" class="input" placeholder="예: 301호" />
        </div>
        <div>
          <label class="block text-sm mb-1">담당부서 <span class="text-red-500">*</span></label>
          <input name="department" class="input" required />
        </div>
        <div>
          <label class="block text-sm mb-1">담당자</label>
          <input name="manager" class="input" />
        </div>
        <div>
          <label class="block text-sm mb-1">상태</label>
          <select name="status" class="input">
            ${STATUS_OPTS.map(s => `<option>${s}</option>`).join('')}
          </select>
        </div>
        <div class="md:col-span-2">
          <label class="block text-sm mb-1">비고</label>
          <textarea name="note" class="input" rows="2"></textarea>
        </div>
        <div class="md:col-span-2 flex gap-2 justify-end">
          <button type="reset" class="btn-secondary">초기화</button>
          <button type="submit" class="btn-primary"><i class="fas fa-save mr-1"></i>등록</button>
        </div>
      </form>
    </div>
  `;

  /* 자동 생성 버튼 */
  root.querySelector('#genCodeBtn').addEventListener('click', async () => {
    const cat = root.querySelector('#regCategory').value;
    if (!cat) { toast('품목을 먼저 선택하세요.', 'warning'); return; }
    root.querySelector('#regCode').value = await generateAssetCode(cat);
  });

  /* 품목 선택 시 자동으로 코드 채우기 */
  root.querySelector('#regCategory').addEventListener('change', async e => {
    const cat = e.target.value;
    if (cat) root.querySelector('#regCode').value = await generateAssetCode(cat);
  });

  root.querySelector('#regForm').addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    if (!data.asset_code) data.asset_code = await generateAssetCode(data.item_category);
    await Assets.add({ ...data, pos_x: null, pos_y: null });
    toast('자산이 등록되었습니다.', 'success');
    e.target.reset();
    renderAssetRegister(root);
  });
}

/* ═══════════════════════════════════════════════════
   자산 목록 (관리자)
═══════════════════════════════════════════════════ */
export async function renderAssetList(root) {
  if (!isAdmin()) return;
  const assets = await Assets.list();
  root.innerHTML = `
    <div class="card">
      <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 class="font-semibold">전체 자산 (${assets.length}건)</h3>
        <button id="exportBtn" class="btn-secondary"><i class="fas fa-file-excel mr-1"></i>엑셀 내보내기</button>
      </div>
      <div class="overflow-x-auto">
        <table class="tbl">
          <thead><tr>
            <th>자산코드</th><th>자산명</th><th>품목</th><th>층</th><th>부서</th><th>상태</th><th class="text-right">작업</th>
          </tr></thead>
          <tbody>
            ${assets.length ? assets.map(a => `
              <tr class="cursor-pointer" data-id="${a.id}">
                <td class="font-mono text-xs">${a.asset_code}</td>
                <td>${a.asset_name}</td>
                <td>${a.item_category}</td>
                <td>${a.floor}</td>
                <td>${a.department}</td>
                <td>${badge(a.status)}</td>
                <td class="text-right whitespace-nowrap">
                  <button data-edit="${a.id}" class="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-brand-50 hover:text-brand-500 mr-1 dark:bg-slate-700 dark:hover:bg-slate-600" title="수정">
                    <i class="fas fa-pen"></i>
                  </button>
                  ${a.status !== '폐기' ? `<button data-disposal="${a.id}" class="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-amber-50 hover:text-amber-600 mr-1 dark:bg-slate-700" title="폐기처리">
                    <i class="fas fa-trash-can"></i>
                  </button>` : ''}
                  <button data-del="${a.id}" class="text-red-400 hover:text-red-600 text-xs px-1" title="삭제">
                    <i class="fas fa-xmark"></i>
                  </button>
                </td>
              </tr>`).join('')
            : `<tr><td colspan="7" class="text-center py-8 text-slate-400">자산이 없습니다.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  /* 행 클릭 → 상세 */
  root.querySelectorAll('tr[data-id]').forEach(tr => {
    tr.addEventListener('click', e => {
      if (e.target.closest('[data-edit],[data-disposal],[data-del]')) return;
      openAssetDetail(tr.dataset.id, () => renderAssetList(root));
    });
  });

  /* 수정 */
  root.querySelectorAll('[data-edit]').forEach(b => {
    b.addEventListener('click', e => { e.stopPropagation(); openAssetEdit(b.dataset.edit, () => renderAssetList(root)); });
  });

  /* 폐기 */
  root.querySelectorAll('[data-disposal]').forEach(b => {
    b.addEventListener('click', e => { e.stopPropagation(); openAssetDisposal(b.dataset.disposal, () => renderAssetList(root)); });
  });

  /* 삭제 */
  root.querySelectorAll('[data-del]').forEach(b => {
    b.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('정말 삭제하시겠습니까?')) return;
      await Assets.remove(b.dataset.del);
      toast('자산이 삭제되었습니다.', 'success');
      renderAssetList(root);
    });
  });

  /* 엑셀 */
  root.querySelector('#exportBtn').addEventListener('click', () => {
    const ws = XLSX.utils.json_to_sheet(assets.map(a => ({
      자산코드: a.asset_code, 자산명: a.asset_name, 품목: a.item_category,
      층: a.floor, 실: a.room, 담당부서: a.department, 담당자: a.manager,
      상태: a.status, 취득일자: a.acquired_date, 비고: a.note,
      폐기일자: a.disposed_at, 폐기사유: a.disposal_reason
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '자산목록');
    XLSX.writeFile(wb, `자산목록_${new Date().toISOString().slice(0, 10)}.xlsx`);
  });
}

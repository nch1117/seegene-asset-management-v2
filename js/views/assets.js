/* 자산 검색 / 등록 / 목록 + 상세·수정·폐기 모달 */
import { Assets, AssetHistory, RepairHistory } from '../store.js';
import { toast } from '../ui/toast.js';
import { isAdmin, getSession } from '../auth.js';

/* ── 수정 이력 추적 필드 ── */
const TRACKED_FIELDS = {
  asset_name: '자산명', item_category: '품목', status: '상태',
  floor: '층', room: '실', department: '담당부서', manager: '담당자',
  acquired_date: '취득일자', note: '비고',
  disposed_at: '폐기일자', disposal_reason: '폐기사유'
};

async function logChange(oldAsset, newAsset, type = '수정') {
  const session = getSession();
  const changes = Object.entries(TRACKED_FIELDS)
    .filter(([k]) => (oldAsset[k] || '') !== (newAsset[k] || ''))
    .map(([k, label]) => ({ field: k, label, old: oldAsset[k] || '-', new: newAsset[k] || '-' }));
  if (!changes.length) return;
  await AssetHistory.add({
    asset_id:        oldAsset.id,
    asset_code:      oldAsset.asset_code,
    changed_by:      session?.adminId   || '알수없음',
    changed_by_name: session?.adminName || '알수없음',
    changed_at:      Date.now(),
    change_type:     type,
    changes
  });
}

/* ── 노후 경고 배지 ── */
export function ageBadge(acquired_date) {
  if (!acquired_date) return '';
  const yrs = (Date.now() - new Date(acquired_date).getTime()) / (365.25 * 24 * 3600 * 1000);
  if (yrs >= 7) return `<span class="badge badge--disposed text-[10px] ml-1" title="${Math.floor(yrs)}년 경과"><i class="fas fa-triangle-exclamation mr-0.5"></i>${Math.floor(yrs)}년</span>`;
  if (yrs >= 5) return `<span class="badge badge--repair text-[10px] ml-1" title="${Math.floor(yrs)}년 경과"><i class="fas fa-clock mr-0.5"></i>${Math.floor(yrs)}년</span>`;
  return '';
}

const STATUS_OPTS = ['정상', '수리중', '폐기'];
const FLOORS = ['2층', '3층', '4층', '5층', '6층', '7층'];
const CAT_PREFIX = { 'PC': 'PC', '노트북': 'NB', '모니터': 'MN', '프린터': 'PR', '스캐너': 'SC',
  '복합기': 'MF', '서버': 'SV', '네트워크': 'NW', '의자': 'CH', '책상': 'DS', '냉장고': 'RF',
  '에어컨': 'AC', '전화기': 'PH', '태블릿': 'TB', '카메라': 'CM', '기타': 'ETC' };
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
    <!-- 탭 -->
    <div class="flex gap-1 mb-4 border-b border-slate-200 dark:border-slate-700">
      <button id="tabInfo"    class="detail-tab detail-tab--active px-4 py-2 text-sm font-medium">상세 정보</button>
      <button id="tabHistory" class="detail-tab px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">수정 이력</button>
      <button id="tabRepair"  class="detail-tab px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">수리 이력</button>
    </div>

    <!-- 상세 정보 패널 -->
    <div id="panelInfo">
      <div class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div><span class="detail-label">자산코드</span><span class="detail-val font-mono">${a.asset_code || '-'}</span></div>
        <div><span class="detail-label">자산명</span><span class="detail-val">${a.asset_name || '-'}</span></div>
        <div><span class="detail-label">품목</span><span class="detail-val">${a.item_category || '-'}</span></div>
        <div><span class="detail-label">상태</span><span class="detail-val">${badge(a.status)}</span></div>
        <div><span class="detail-label">층</span><span class="detail-val">${a.floor || '-'}</span></div>
        <div><span class="detail-label">실</span><span class="detail-val">${a.room || '-'}</span></div>
        <div><span class="detail-label">담당부서</span><span class="detail-val">${a.department || '-'}</span></div>
        <div><span class="detail-label">담당자</span><span class="detail-val">${a.manager || '-'}</span></div>
        <div><span class="detail-label">취득일자</span><span class="detail-val">${a.acquired_date || '-'}${ageBadge(a.acquired_date)}</span></div>
        <div><span class="detail-label">등록일</span><span class="detail-val">${a.createdAt ? new Date(a.createdAt).toLocaleDateString('ko') : '-'}</span></div>
        ${a.maker ? `<div><span class="detail-label">제조사</span><span class="detail-val">${a.maker}</span></div>` : ''}
        ${a.model ? `<div><span class="detail-label">모델명</span><span class="detail-val">${a.model}</span></div>` : ''}
        ${a.serial ? `<div class="col-span-2"><span class="detail-label">시리얼번호</span><span class="detail-val font-mono text-xs">${a.serial}</span></div>` : ''}
        ${a.disposed_at ? `<div><span class="detail-label">폐기일자</span><span class="detail-val text-red-500">${a.disposed_at}</span></div>` : ''}
        ${a.disposal_reason ? `<div class="col-span-2"><span class="detail-label">폐기사유</span><span class="detail-val">${a.disposal_reason}</span></div>` : ''}
        ${a.note ? `<div class="col-span-2"><span class="detail-label">비고</span><span class="detail-val">${a.note}</span></div>` : ''}
        ${(a.pos_x != null && a.pos_x !== 0) ? `<div><span class="detail-label">핀 위치</span><span class="detail-val text-xs font-mono">X:${Number(a.pos_x).toFixed(1)}% Y:${Number(a.pos_y).toFixed(1)}%</span></div>` : ''}
      </div>
    </div>

    <!-- 수정 이력 패널 -->
    <div id="panelHistory" class="hidden">
      <div id="historyList" class="space-y-2 text-sm">
        <p class="text-slate-400 text-center py-6"><i class="fas fa-spinner fa-spin mr-1"></i>이력 로딩 중...</p>
      </div>
    </div>

    <!-- 수리 이력 패널 -->
    <div id="panelRepair" class="hidden">
      <div id="repairList" class="space-y-2 text-sm">
        <p class="text-slate-400 text-center py-6"><i class="fas fa-spinner fa-spin mr-1"></i>이력 로딩 중...</p>
      </div>
    </div>
  `;

  /* ── 탭 전환 헬퍼 ── */
  const tabs   = ['tabInfo', 'tabHistory', 'tabRepair'].map(id => modal.querySelector('#' + id));
  const panels = ['panelInfo', 'panelHistory', 'panelRepair'].map(id => modal.querySelector('#' + id));
  function activateTab(idx) {
    tabs.forEach((t, i) => {
      t.classList.toggle('detail-tab--active', i === idx);
      t.classList.toggle('text-slate-500', i !== idx);
    });
    panels.forEach((p, i) => p.classList.toggle('hidden', i !== idx));
  }

  tabs[0].addEventListener('click', () => activateTab(0));

  tabs[1].addEventListener('click', async () => {
    activateTab(1);
    const logs = await AssetHistory.listByAsset(assetId);
    const listEl = modal.querySelector('#historyList');
    if (!logs.length) { listEl.innerHTML = `<p class="text-slate-400 text-center py-6">수정 이력이 없습니다.</p>`; return; }
    listEl.innerHTML = logs.map(log => `
      <div class="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
        <div class="flex items-center justify-between mb-2">
          <span class="font-medium text-xs"><i class="fas fa-user-pen mr-1 text-brand-500"></i>${log.changed_by_name} <span class="text-slate-400">(${log.changed_by})</span></span>
          <span class="text-[11px] text-slate-400">${new Date(log.changed_at).toLocaleString('ko')}</span>
        </div>
        <div class="space-y-1">
          ${log.changes.map(c => `
            <div class="flex items-center gap-2 text-xs">
              <span class="font-medium text-slate-600 dark:text-slate-400 w-16 shrink-0">${c.label}</span>
              <span class="text-slate-400 line-through">${c.old}</span>
              <i class="fas fa-arrow-right text-slate-300 text-[10px]"></i>
              <span class="text-slate-800 dark:text-slate-200 font-medium">${c.new}</span>
            </div>`).join('')}
        </div>
      </div>`).join('');
  });

  tabs[2].addEventListener('click', async () => {
    activateTab(2);
    const repairs = await RepairHistory.listByAsset(assetId);
    const listEl = modal.querySelector('#repairList');
    if (!repairs.length) { listEl.innerHTML = `<p class="text-slate-400 text-center py-6">수리 이력이 없습니다.</p>`; return; }
    listEl.innerHTML = repairs.map(r => `
      <div class="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
        <div class="flex items-center justify-between mb-2">
          <span class="font-medium text-xs">
            <i class="fas fa-wrench mr-1 text-blue-500"></i>${new Date(r.reported_at).toLocaleDateString('ko')} 접수
            ${r.vendor ? `<span class="text-slate-400 ml-1">— ${r.vendor}</span>` : ''}
          </span>
          <span class="badge ${r.status === '완료' ? 'badge--ok' : 'badge--repair'} text-[10px]">${r.status}</span>
        </div>
        ${r.description ? `<p class="text-xs text-slate-600 dark:text-slate-300 mb-1">${r.description}</p>` : ''}
        ${r.completed_at ? `<p class="text-xs text-slate-400">완료: ${new Date(r.completed_at).toLocaleDateString('ko')}${r.cost ? ' · ' + r.cost.toLocaleString() + '원' : ''}</p>` : ''}
        ${r.result_note ? `<p class="text-xs text-slate-400 mt-0.5">${r.result_note}</p>` : ''}
      </div>`).join('');
  });

  /* ── 버튼 ── */
  const editBtn = modal.querySelector('#detailEditBtn');
  const dispBtn = modal.querySelector('#detailDisposalBtn');
  const repairBtn = modal.querySelector('#detailRepairBtn');
  const repairCompleteBtn = modal.querySelector('#detailRepairCompleteBtn');

  if (editBtn) { editBtn.classList.toggle('hidden', !admin); editBtn.onclick = () => { closeModal('assetDetailModal'); openAssetEdit(assetId, afterAction); }; }
  if (dispBtn) { dispBtn.classList.toggle('hidden', !admin || a.status === '폐기'); dispBtn.onclick = () => { closeModal('assetDetailModal'); openAssetDisposal(assetId, afterAction); }; }
  if (repairBtn) { repairBtn.classList.toggle('hidden', !admin || a.status === '수리중' || a.status === '폐기'); repairBtn.onclick = () => { closeModal('assetDetailModal'); openRepairForm(assetId, afterAction); }; }
  if (repairCompleteBtn) { repairCompleteBtn.classList.toggle('hidden', !admin || a.status !== '수리중'); repairCompleteBtn.onclick = () => { closeModal('assetDetailModal'); openRepairCompleteForm(assetId, afterAction); }; }

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
    const updated = { ...a, ...patch };
    await Assets.put(updated);
    await logChange(a, updated, '수정');
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
    const updated = { ...a, status: '폐기', disposed_at, disposal_reason };
    await Assets.put(updated);
    await logChange(a, updated, '폐기');
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

/* ─────────────────────────────────────────
   수리 접수 모달
───────────────────────────────────────── */
export async function openRepairForm(assetId, afterAction) {
  const a = await Assets.get(assetId);
  if (!a || !isAdmin()) return;

  document.getElementById('repairAssetName').textContent = `[${a.asset_code}] ${a.asset_name}`;
  document.getElementById('repairDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('repairVendor').value = '';
  document.getElementById('repairDesc').value = '';

  const form = document.getElementById('repairForm');
  const handler = async e => {
    e.preventDefault();
    form.removeEventListener('submit', handler);
    const record = {
      asset_id:    a.id,
      asset_code:  a.asset_code,
      asset_name:  a.asset_name,
      department:  a.department,
      reported_at: new Date(document.getElementById('repairDate').value).getTime(),
      vendor:      document.getElementById('repairVendor').value.trim(),
      description: document.getElementById('repairDesc').value.trim(),
      status:      '진행중'
    };
    await RepairHistory.add(record);
    const updated = { ...a, status: '수리중' };
    await Assets.put(updated);
    await logChange(a, updated, '수리접수');
    toast('수리가 접수되었습니다.', 'success');
    closeModal('repairModal');
    if (afterAction) afterAction();
  };
  form.addEventListener('submit', handler);

  document.getElementById('repairCloseBtn').onclick  = () => { closeModal('repairModal'); form.removeEventListener('submit', handler); };
  document.getElementById('repairCancelBtn').onclick = () => { closeModal('repairModal'); form.removeEventListener('submit', handler); };
  openModal('repairModal');
}

/* ─────────────────────────────────────────
   수리 완료 모달
───────────────────────────────────────── */
export async function openRepairCompleteForm(assetId, afterAction) {
  const a = await Assets.get(assetId);
  if (!a || !isAdmin()) return;

  const repairs = await RepairHistory.listByAsset(assetId);
  const active  = repairs.find(r => r.status === '진행중');

  document.getElementById('repairCompleteAssetName').textContent = `[${a.asset_code}] ${a.asset_name}`;
  document.getElementById('repairCompleteDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('repairCost').value = '';
  document.getElementById('repairResultNote').value = '';

  const form = document.getElementById('repairCompleteForm');
  const handler = async e => {
    e.preventDefault();
    form.removeEventListener('submit', handler);
    const completedAt = new Date(document.getElementById('repairCompleteDate').value).getTime();
    const cost        = parseInt(document.getElementById('repairCost').value) || 0;
    const resultNote  = document.getElementById('repairResultNote').value.trim();

    if (active) {
      await RepairHistory.put({ ...active, completed_at: completedAt, cost, result_note: resultNote, status: '완료' });
    } else {
      await RepairHistory.add({ asset_id: a.id, asset_code: a.asset_code, asset_name: a.asset_name, department: a.department, reported_at: completedAt, completed_at: completedAt, cost, result_note: resultNote, status: '완료' });
    }
    const updated = { ...a, status: '정상' };
    await Assets.put(updated);
    await logChange(a, updated, '수리완료');
    toast('수리 완료 처리되었습니다.', 'success');
    closeModal('repairCompleteModal');
    if (afterAction) afterAction();
  };
  form.addEventListener('submit', handler);

  document.getElementById('repairCompleteCloseBtn').onclick  = () => { closeModal('repairCompleteModal'); form.removeEventListener('submit', handler); };
  document.getElementById('repairCompleteCancelBtn').onclick = () => { closeModal('repairCompleteModal'); form.removeEventListener('submit', handler); };
  openModal('repairCompleteModal');
}

/* ═══════════════════════════════════════════════════
   자산 검색 (공통)
═══════════════════════════════════════════════════ */
export async function renderAssetSearch(root, params) {
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

  /* QR 스캔 또는 URL params로 자동 검색 */
  const initCode = params instanceof URLSearchParams ? params.get('code') : null;
  if (initCode) {
    root.querySelector('#qText').value = initCode;
  }
  renderRows();

  /* 정확히 1건 매칭이면 바로 상세 모달 열기 */
  if (initCode) {
    const exact = assets.filter(a => a.asset_code === initCode);
    if (exact.length === 1) {
      openAssetDetail(exact[0].id, () => renderAssetSearch(root, params));
    }
  }
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

  const depts = [...new Set(assets.map(a => a.department).filter(Boolean))].sort();
  const items = [...new Set(assets.map(a => a.item_category).filter(Boolean))].sort();

  root.innerHTML = `
    <!-- 필터 바 -->
    <div class="card mb-4">
      <div class="flex items-center gap-2 mb-3">
        <i class="fas fa-filter text-brand-500"></i>
        <span class="font-semibold text-sm">조건 검색</span>
        <button id="alResetFilter" class="ml-auto text-xs text-slate-500 hover:text-brand-500">
          <i class="fas fa-rotate-left mr-1"></i>초기화
        </button>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
        <input id="alText" class="input md:col-span-1" placeholder="코드 / 자산명 검색" />
        <select id="alFloor" class="input">
          <option value="">전체 층</option>
          ${FLOORS.map(f => `<option>${f}</option>`).join('')}
        </select>
        <select id="alItem" class="input">
          <option value="">전체 품목</option>
          ${items.map(i => `<option>${i}</option>`).join('')}
        </select>
        <select id="alStatus" class="input">
          <option value="">전체 상태</option>
          ${STATUS_OPTS.map(s => `<option>${s}</option>`).join('')}
        </select>
        <select id="alDept" class="input">
          <option value="">전체 부서</option>
          ${depts.map(d => `<option>${d}</option>`).join('')}
        </select>
      </div>
      <p id="alSummary" class="text-xs text-slate-400 mt-2"></p>
    </div>

    <div class="card">
      <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 class="font-semibold" id="alTitle">전체 자산 (${assets.length}건)</h3>
        <button id="exportBtn" class="btn-secondary"><i class="fas fa-file-excel mr-1"></i>엑셀 내보내기</button>
      </div>
      <div class="overflow-x-auto">
        <table class="tbl">
          <thead><tr>
            <th>자산코드</th><th>자산명</th><th>품목</th><th>층</th><th>부서</th><th>상태</th><th class="text-right">작업</th>
          </tr></thead>
          <tbody id="alBody"></tbody>
        </table>
      </div>
      <p id="alPager" class="text-xs text-slate-400 mt-2"></p>
    </div>
  `;

  const PAGE_SIZE = 20;
  let currentPage = 1;
  let filtered = [...assets];

  const applyFilter = () => {
    const text   = root.querySelector('#alText').value.trim().toLowerCase();
    const floor  = root.querySelector('#alFloor').value;
    const item   = root.querySelector('#alItem').value;
    const status = root.querySelector('#alStatus').value;
    const dept   = root.querySelector('#alDept').value;
    filtered = assets.filter(a =>
      (!floor  || a.floor         === floor)  &&
      (!item   || a.item_category === item)   &&
      (!status || a.status        === status) &&
      (!dept   || a.department    === dept)   &&
      (!text   || `${a.asset_code} ${a.asset_name}`.toLowerCase().includes(text))
    );
    const active = [floor&&`층:${floor}`, item&&`품목:${item}`, status&&`상태:${status}`, dept&&`부서:${dept}`, text&&`검색:"${text}"`].filter(Boolean);
    root.querySelector('#alSummary').textContent = active.length
      ? `필터 적용: ${active.join(' · ')} → ${filtered.length}건 / 전체 ${assets.length}건`
      : `전체 ${assets.length}건`;
    currentPage = 1;
    renderPage();
  };

  const renderPage = () => {
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);
    const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const body = root.querySelector('#alBody');
    body.innerHTML = pageItems.length ? pageItems.map(a => `
      <tr class="cursor-pointer" data-id="${a.id}">
        <td class="font-mono text-xs">${a.asset_code}</td>
        <td>${a.asset_name}${ageBadge(a.acquired_date)}</td>
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
      : `<tr><td colspan="7" class="text-center py-8 text-slate-400">조건에 맞는 자산이 없습니다.</td></tr>`;

    root.querySelector('#alTitle').textContent = `자산 목록 (${filtered.length}건)`;

    const pager = root.querySelector('#alPager');
    pager.innerHTML = total > PAGE_SIZE ? `
      <span>총 ${total}건 (${currentPage}/${totalPages} 페이지)</span>
      <span class="inline-flex gap-1 ml-3">
        <button id="alPrev" class="px-2 py-0.5 rounded border text-xs ${currentPage <= 1 ? 'opacity-30 pointer-events-none' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}">‹ 이전</button>
        <button id="alNext" class="px-2 py-0.5 rounded border text-xs ${currentPage >= totalPages ? 'opacity-30 pointer-events-none' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}">다음 ›</button>
      </span>` : '';

    pager.querySelector('#alPrev')?.addEventListener('click', () => { currentPage--; renderPage(); });
    pager.querySelector('#alNext')?.addEventListener('click', () => { currentPage++; renderPage(); });

    bindRowEvents();
  };

  const bindRowEvents = () => {
    root.querySelectorAll('#alBody tr[data-id]').forEach(tr => {
      tr.addEventListener('click', e => {
        if (e.target.closest('[data-edit],[data-disposal],[data-del]')) return;
        openAssetDetail(tr.dataset.id, () => renderAssetList(root));
      });
    });
    root.querySelectorAll('#alBody [data-edit]').forEach(b => {
      b.addEventListener('click', e => { e.stopPropagation(); openAssetEdit(b.dataset.edit, () => renderAssetList(root)); });
    });
    root.querySelectorAll('#alBody [data-disposal]').forEach(b => {
      b.addEventListener('click', e => { e.stopPropagation(); openAssetDisposal(b.dataset.disposal, () => renderAssetList(root)); });
    });
    root.querySelectorAll('#alBody [data-del]').forEach(b => {
      b.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('정말 삭제하시겠습니까?')) return;
        await Assets.remove(b.dataset.del);
        toast('자산이 삭제되었습니다.', 'success');
        renderAssetList(root);
      });
    });
  };

  ['alText'].forEach(id => root.querySelector('#' + id).addEventListener('input', applyFilter));
  ['alFloor','alItem','alStatus','alDept'].forEach(id => root.querySelector('#' + id).addEventListener('change', applyFilter));
  root.querySelector('#alResetFilter').addEventListener('click', () => {
    root.querySelector('#alText').value = '';
    ['alFloor','alItem','alStatus','alDept'].forEach(id => { root.querySelector('#' + id).value = ''; });
    applyFilter();
  });

  applyFilter();

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

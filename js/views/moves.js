/* 이동 신청 / 승인 / 이력 */
import { Assets, MoveRequests, MoveHistory } from '../store.js';
import { toast } from '../ui/toast.js';
import { getSession, isAdmin } from '../auth.js';

const FLOORS = ['2층', '3층', '4층', '5층', '6층', '7층'];

function statusBadge(s) {
  if (s === '대기') return `<span class="badge badge--pending">대기</span>`;
  if (s === '승인') return `<span class="badge badge--ok">승인</span>`;
  if (s === '반려') return `<span class="badge badge--disposed">반려</span>`;
  return `<span class="badge">${s}</span>`;
}

/* ═══════════════════════════════════════════════════
   이동 신청 — 2단계 UI
   1단계: 자산 검색·선택
   2단계: 이동 정보 입력
═══════════════════════════════════════════════════ */
export async function renderMoveRequest(root) {
  const assets = await Assets.list();
  const depts  = [...new Set(assets.map(a => a.department).filter(Boolean))].sort();

  let step = 1;
  let selectedAsset = null;

  function renderStep1() {
    root.innerHTML = `
      <div class="card max-w-3xl">
        <h3 class="font-semibold mb-4"><i class="fas fa-paper-plane mr-1 text-brand-500"></i>자산 이동 신청
          <span class="ml-2 text-xs font-normal text-slate-400">1단계 — 대상 자산 선택</span>
        </h3>

        <!-- 진행 표시 -->
        <div class="flex items-center gap-2 mb-5 text-xs">
          <span class="flex items-center gap-1 font-bold text-brand-500"><span class="w-5 h-5 rounded-full bg-brand-500 text-white grid place-items-center text-[10px]">1</span>자산 선택</span>
          <span class="flex-1 border-t border-dashed border-slate-300 dark:border-slate-600"></span>
          <span class="flex items-center gap-1 text-slate-400"><span class="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-500 grid place-items-center text-[10px]">2</span>이동 정보 입력</span>
        </div>

        <!-- 검색 필터 -->
        <div class="grid md:grid-cols-3 gap-3 mb-3">
          <input id="s1Text" class="input md:col-span-1" placeholder="자산코드 / 자산명 검색" />
          <select id="s1Floor" class="input">
            <option value="">전체 층</option>
            ${FLOORS.map(f => `<option>${f}</option>`).join('')}
          </select>
          <select id="s1Dept" class="input">
            <option value="">전체 부서</option>
            ${depts.map(d => `<option>${d}</option>`).join('')}
          </select>
        </div>

        <!-- 자산 목록 -->
        <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table class="tbl">
            <thead><tr>
              <th></th><th>자산코드</th><th>자산명</th><th>품목</th><th>층/실</th><th>부서</th><th>상태</th>
            </tr></thead>
            <tbody id="s1Body"></tbody>
          </table>
        </div>
        <p id="s1Hint" class="text-xs text-slate-400 mt-2"></p>
        <div class="flex justify-end mt-4">
          <button id="s1Next" class="btn-primary" disabled>
            다음 <i class="fas fa-arrow-right ml-1"></i>
          </button>
        </div>
      </div>
    `;

    let filteredAssets = assets.filter(a => a.status !== '폐기');

    const renderList = () => {
      const text  = root.querySelector('#s1Text').value.trim().toLowerCase();
      const floor = root.querySelector('#s1Floor').value;
      const dept  = root.querySelector('#s1Dept').value;
      filteredAssets = assets.filter(a => {
        if (a.status === '폐기') return false;
        if (floor && a.floor !== floor) return false;
        if (dept  && a.department !== dept) return false;
        if (text) {
          const hay = `${a.asset_code} ${a.asset_name}`.toLowerCase();
          if (!hay.includes(text)) return false;
        }
        return true;
      });
      const body = root.querySelector('#s1Body');
      body.innerHTML = filteredAssets.length
        ? filteredAssets.map(a => {
            const sel = selectedAsset?.id === a.id;
            return `<tr class="cursor-pointer ${sel ? 'bg-brand-50 dark:bg-red-950' : ''}" data-id="${a.id}">
              <td><input type="radio" class="accent-brand-500" name="assetPick"${sel ? ' checked' : ''} /></td>
              <td class="font-mono text-xs">${a.asset_code}</td>
              <td class="font-medium">${a.asset_name}</td>
              <td>${a.item_category}</td>
              <td>${a.floor} ${a.room || ''}</td>
              <td>${a.department}</td>
              <td><span class="badge badge--${a.status==='정상'?'ok':'repair'}">${a.status}</span></td>
            </tr>`;
          }).join('')
        : `<tr><td colspan="7" class="text-center py-8 text-slate-400">검색 결과가 없습니다.</td></tr>`;

      root.querySelector('#s1Hint').textContent = `${filteredAssets.length}건`;
      updateNext();
    };

    const updateNext = () => {
      root.querySelector('#s1Next').disabled = !selectedAsset;
    };

    root.querySelector('#s1Body').addEventListener('click', e => {
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      selectedAsset = assets.find(a => a.id === tr.dataset.id) || null;
      renderList();
    });

    ['s1Text','s1Floor','s1Dept'].forEach(id =>
      root.querySelector('#' + id).addEventListener('input', renderList)
    );
    root.querySelector('#s1Floor').addEventListener('change', renderList);
    root.querySelector('#s1Dept').addEventListener('change', renderList);

    root.querySelector('#s1Next').addEventListener('click', () => {
      if (!selectedAsset) return;
      step = 2;
      renderStep2();
    });

    renderList();
  }

  function renderStep2() {
    root.innerHTML = `
      <div class="card max-w-2xl">
        <h3 class="font-semibold mb-4"><i class="fas fa-paper-plane mr-1 text-brand-500"></i>자산 이동 신청
          <span class="ml-2 text-xs font-normal text-slate-400">2단계 — 이동 정보 입력</span>
        </h3>

        <!-- 진행 표시 -->
        <div class="flex items-center gap-2 mb-5 text-xs">
          <span class="flex items-center gap-1 text-slate-400"><span class="w-5 h-5 rounded-full bg-green-500 text-white grid place-items-center text-[10px]"><i class="fas fa-check" style="font-size:7px"></i></span>자산 선택</span>
          <span class="flex-1 border-t border-dashed border-slate-300 dark:border-slate-600"></span>
          <span class="flex items-center gap-1 font-bold text-brand-500"><span class="w-5 h-5 rounded-full bg-brand-500 text-white grid place-items-center text-[10px]">2</span>이동 정보 입력</span>
        </div>

        <!-- 선택된 자산 미리보기 -->
        <div class="p-3 mb-4 bg-brand-50 dark:bg-red-950/30 border border-brand-100 dark:border-red-900 rounded-lg text-sm flex items-start gap-3">
          <i class="fas fa-box text-brand-500 mt-0.5"></i>
          <div>
            <p class="font-semibold">${selectedAsset.asset_name}
              <span class="ml-2 font-mono text-xs text-slate-500">${selectedAsset.asset_code}</span>
            </p>
            <p class="text-xs text-slate-500 mt-0.5">현재 위치: ${selectedAsset.floor} ${selectedAsset.room || ''} · ${selectedAsset.department}</p>
          </div>
          <button id="backStep1" class="ml-auto text-xs text-slate-400 hover:text-brand-500 shrink-0">
            <i class="fas fa-pencil mr-1"></i>재선택
          </button>
        </div>

        <form id="reqForm" class="space-y-3">
          <div class="grid md:grid-cols-2 gap-3">
            <div>
              <label class="block text-sm mb-1">신청자명 <span class="text-red-500">*</span></label>
              <input name="applicant" class="input" required />
            </div>
            <div>
              <label class="block text-sm mb-1">부서 <span class="text-red-500">*</span></label>
              <input name="department" class="input" value="${selectedAsset.department}" required />
            </div>
          </div>
          <div>
            <label class="block text-sm mb-1">연락처</label>
            <input name="phone" class="input" placeholder="010-0000-0000" />
          </div>
          <div class="grid md:grid-cols-2 gap-3">
            <div>
              <label class="block text-sm mb-1">이동할 층 <span class="text-red-500">*</span></label>
              <select name="to_floor" class="input" required>
                ${FLOORS.map(f => `<option${selectedAsset.floor===f?' selected':''}>${f}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-sm mb-1">이동할 실</label>
              <input name="to_room" class="input" placeholder="예: 301호" />
            </div>
          </div>
          <div>
            <label class="block text-sm mb-1">이동 사유</label>
            <textarea name="reason" class="input" rows="2" placeholder="이동이 필요한 사유를 입력해주세요"></textarea>
          </div>
          <div class="flex gap-2 justify-end pt-1">
            <button type="button" id="backStep1b" class="btn-secondary"><i class="fas fa-arrow-left mr-1"></i>이전</button>
            <button type="submit" class="btn-primary"><i class="fas fa-paper-plane mr-1"></i>신청 제출</button>
          </div>
        </form>
      </div>
    `;

    root.querySelector('#backStep1')?.addEventListener('click', () => { step = 1; renderStep1(); });
    root.querySelector('#backStep1b')?.addEventListener('click', () => { step = 1; renderStep1(); });

    root.querySelector('#reqForm').addEventListener('submit', async e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target));
      await MoveRequests.add({ ...data, asset_id: selectedAsset.id, status: '대기' });
      toast('이동 신청이 접수되었습니다.', 'success');
      selectedAsset = null;
      step = 1;
      renderStep1();
    });
  }

  renderStep1();
}

/* ═══════════════════════════════════════════════════
   내 신청 내역
═══════════════════════════════════════════════════ */
export async function renderMyRequests(root) {
  const requests = await MoveRequests.list();
  const assets   = await Assets.list();
  const assetMap = new Map(assets.map(a => [a.id, a]));
  const sorted   = [...requests].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  root.innerHTML = `
    <div class="card">
      <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 class="font-semibold"><i class="fas fa-list mr-1 text-brand-500"></i>이동 신청 내역</h3>
        <button id="exportReqBtn" class="btn-secondary text-xs"><i class="fas fa-file-excel mr-1"></i>엑셀 다운로드</button>
      </div>
      <div class="overflow-x-auto">
        <table class="tbl">
          <thead><tr><th>신청일</th><th>신청자</th><th>부서</th><th>대상 자산</th><th>이동위치</th><th>사유</th><th>상태</th></tr></thead>
          <tbody>
            ${sorted.length ? sorted.map(r => {
              const a = assetMap.get(r.asset_id);
              return `<tr>
                <td>${new Date(r.createdAt).toLocaleString('ko')}</td>
                <td>${r.applicant}</td>
                <td>${r.department}</td>
                <td class="text-xs">${a ? `${a.asset_code}<br>${a.asset_name}` : '-'}</td>
                <td>${r.to_floor} ${r.to_room || ''}</td>
                <td class="text-xs text-slate-500">${r.reason || '-'}</td>
                <td>${statusBadge(r.status)}</td>
              </tr>`;
            }).join('') : `<tr><td colspan="7" class="text-center py-8 text-slate-400">신청 내역이 없습니다.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  root.querySelector('#exportReqBtn').addEventListener('click', () => {
    exportRequestsExcel(sorted, assetMap);
  });
}

/* ═══════════════════════════════════════════════════
   이동 승인 (관리자)
═══════════════════════════════════════════════════ */
export async function renderApproveRequests(root) {
  if (!isAdmin()) return;
  const requests = (await MoveRequests.list()).filter(r => r.status === '대기');
  const assets   = await Assets.list();
  const assetMap = new Map(assets.map(a => [a.id, a]));

  root.innerHTML = `
    <div class="card">
      <h3 class="font-semibold mb-3"><i class="fas fa-check mr-1 text-brand-500"></i>이동 승인 대기 (${requests.length}건)</h3>
      <div class="overflow-x-auto">
        <table class="tbl">
          <thead><tr><th>신청일</th><th>신청자</th><th>대상 자산</th><th>이동위치</th><th>사유</th><th></th></tr></thead>
          <tbody>
            ${requests.length ? requests.map(r => {
              const a = assetMap.get(r.asset_id);
              return `<tr data-id="${r.id}">
                <td>${new Date(r.createdAt).toLocaleDateString('ko')}</td>
                <td>${r.applicant}<br><span class="text-xs text-slate-400">${r.department}</span></td>
                <td>${a ? `${a.asset_code} ${a.asset_name}<br><span class="text-xs text-slate-400">${a.floor} ${a.room || ''}</span>` : '<span class="text-red-500">자산 없음</span>'}</td>
                <td>${r.to_floor} ${r.to_room || ''}</td>
                <td class="text-xs">${r.reason || '-'}</td>
                <td class="text-right whitespace-nowrap">
                  <button class="btn-primary text-xs mr-1" data-act="approve">승인</button>
                  <button class="btn-secondary text-xs" data-act="reject">반려</button>
                </td>
              </tr>`;
            }).join('') : `<tr><td colspan="6" class="text-center py-8 text-slate-400">대기 중인 신청이 없습니다.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  root.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tr  = btn.closest('tr');
      const id  = tr.dataset.id;
      const act = btn.dataset.act;
      const req = await MoveRequests.get(id);
      if (!req) return;

      if (act === 'approve') {
        const asset = assetMap.get(req.asset_id);
        if (asset) {
          const before = `${asset.floor} ${asset.room || ''}`;
          const after  = `${req.to_floor} ${req.to_room || ''}`;
          await Assets.put({ ...asset, floor: req.to_floor, room: req.to_room });
          await MoveHistory.add({
            asset_id: asset.id, asset_code: asset.asset_code, asset_name: asset.asset_name,
            before, after, moved_at: new Date().toISOString(),
            handler: getSession()?.adminName || '-', type: '신청승인'
          });
        }
        await MoveRequests.put({ ...req, status: '승인', processedAt: new Date().toISOString(), approver: getSession()?.adminName });
        toast('승인 처리되었습니다.', 'success');
      } else {
        const reason = prompt('반려 사유를 입력하세요.', '');
        if (reason === null) return;
        await MoveRequests.put({ ...req, status: '반려', processedAt: new Date().toISOString(), reject_reason: reason });
        toast('반려 처리되었습니다.', 'info');
      }
      renderApproveRequests(root);
    });
  });
}

/* ═══════════════════════════════════════════════════
   이동 이력 (관리자)
═══════════════════════════════════════════════════ */
export async function renderMoveHistory(root) {
  if (!isAdmin()) return;
  const history = (await MoveHistory.list()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  root.innerHTML = `
    <div class="card">
      <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 class="font-semibold"><i class="fas fa-clock-rotate-left mr-1 text-brand-500"></i>이동 이력</h3>
        <button id="exportHistBtn" class="btn-secondary text-xs"><i class="fas fa-file-excel mr-1"></i>엑셀 다운로드</button>
      </div>
      <div class="overflow-x-auto">
        <table class="tbl">
          <thead><tr><th>일시</th><th>자산코드</th><th>자산명</th><th>이전 위치</th><th>이후 위치</th><th>처리자</th><th>유형</th></tr></thead>
          <tbody>
            ${history.length ? history.map(h => `
              <tr>
                <td>${new Date(h.moved_at || h.createdAt).toLocaleString('ko')}</td>
                <td class="font-mono text-xs">${h.asset_code}</td>
                <td>${h.asset_name}</td>
                <td>${h.before}</td>
                <td class="font-semibold text-brand-600 dark:text-red-400">${h.after}</td>
                <td>${h.handler}</td>
                <td><span class="badge badge--pending">${h.type}</span></td>
              </tr>`).join('') : `<tr><td colspan="7" class="text-center py-8 text-slate-400">이동 이력이 없습니다.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  root.querySelector('#exportHistBtn').addEventListener('click', () => {
    exportHistoryExcel(history);
  });
}

/* ═══════════════════════════════════════════════════
   엑셀 다운로드 헬퍼
═══════════════════════════════════════════════════ */
function exportHistoryExcel(history) {
  const rows = history.map(h => ({
    일시: new Date(h.moved_at || h.createdAt).toLocaleString('ko'),
    자산코드: h.asset_code, 자산명: h.asset_name,
    이전위치: h.before, 이후위치: h.after,
    처리자: h.handler, 유형: h.type
  }));
  downloadXlsx(rows, '이동이력', `이동이력_${dateTag()}.xlsx`);
}

function exportRequestsExcel(requests, assetMap) {
  const rows = requests.map(r => {
    const a = assetMap?.get(r.asset_id);
    return {
      신청일: new Date(r.createdAt).toLocaleString('ko'),
      신청자: r.applicant, 부서: r.department, 연락처: r.phone || '',
      자산코드: a?.asset_code || '', 자산명: a?.asset_name || '',
      현재위치: a ? `${a.floor} ${a.room||''}` : '',
      이동층: r.to_floor, 이동실: r.to_room || '',
      사유: r.reason || '', 상태: r.status,
      처리일: r.processedAt ? new Date(r.processedAt).toLocaleString('ko') : '',
      처리자: r.approver || '', 반려사유: r.reject_reason || ''
    };
  });
  downloadXlsx(rows, '이동신청대장', `이동신청대장_${dateTag()}.xlsx`);
}

export async function exportAllRequestsExcel() {
  const requests = await MoveRequests.list();
  const assets   = await Assets.list();
  const assetMap = new Map(assets.map(a => [a.id, a]));
  exportRequestsExcel(requests.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)), assetMap);
}

function downloadXlsx(rows, sheetName, fileName) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

function dateTag() {
  return new Date().toISOString().slice(0, 10);
}

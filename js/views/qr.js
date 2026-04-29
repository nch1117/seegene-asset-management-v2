/* QR 라벨 생성 · 인쇄 */
import { Assets } from '../store.js';
import { toast } from '../ui/toast.js';

const FLOORS = ['2층', '3층', '4층', '5층', '6층', '7층'];

export async function renderQR(root) {
  const assets = await Assets.list();

  /* 필터 옵션 */
  const depts  = [...new Set(assets.map(a => a.department).filter(Boolean))].sort();
  const cats   = [...new Set(assets.map(a => a.item_category).filter(Boolean))].sort();

  root.innerHTML = `
    <div class="max-w-6xl space-y-4">
      <div class="card">
        <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 class="font-semibold"><i class="fas fa-qrcode mr-1 text-brand-500"></i>QR 라벨 생성</h3>
          <div class="flex gap-2">
            <button id="selectAll" class="btn-secondary text-xs">전체 선택</button>
            <button id="deselectAll" class="btn-secondary text-xs">전체 해제</button>
            <button id="printBtn" class="btn-primary"><i class="fas fa-print mr-1"></i>선택 인쇄 (<span id="selCount">0</span>건)</button>
          </div>
        </div>

        <!-- 필터 -->
        <div class="grid md:grid-cols-4 gap-3 mb-4">
          <select id="qrFloor" class="input">
            <option value="">전체 층</option>
            ${FLOORS.map(f => `<option>${f}</option>`).join('')}
          </select>
          <select id="qrDept" class="input">
            <option value="">전체 부서</option>
            ${depts.map(d => `<option>${d}</option>`).join('')}
          </select>
          <select id="qrCat" class="input">
            <option value="">전체 품목</option>
            ${cats.map(c => `<option>${c}</option>`).join('')}
          </select>
          <select id="qrStatus" class="input">
            <option value="">전체 상태</option>
            <option>정상</option><option>수리중</option><option>폐기</option>
          </select>
        </div>

        <!-- 자산 선택 테이블 -->
        <div class="overflow-x-auto">
          <table class="tbl text-xs">
            <thead><tr>
              <th><input id="masterChk" type="checkbox" class="accent-brand-500" /></th>
              <th>자산코드</th><th>자산명</th><th>품목</th><th>층/실</th><th>부서</th><th>상태</th>
            </tr></thead>
            <tbody id="assetSelectBody"></tbody>
          </table>
        </div>
        <p id="filterHint" class="text-xs text-slate-400 mt-2"></p>
      </div>

      <!-- 라벨 미리보기 -->
      <div id="previewCard" class="hidden card">
        <div class="flex items-center justify-between mb-3">
          <h4 class="font-semibold text-sm"><i class="fas fa-eye mr-1"></i>라벨 미리보기</h4>
          <label class="flex items-center gap-2 text-xs text-slate-500">
            <input id="urlMode" type="checkbox" class="accent-brand-500" />
            QR에 URL 포함
          </label>
        </div>
        <div id="labelGrid" class="qr-label-grid"></div>
      </div>
    </div>
  `;

  let filtered = [...assets];
  let selected = new Set();

  /* 필터 이벤트 */
  ['qrFloor','qrDept','qrCat','qrStatus'].forEach(id =>
    root.querySelector('#' + id).addEventListener('change', applyFilter)
  );

  function applyFilter() {
    const floor  = root.querySelector('#qrFloor').value;
    const dept   = root.querySelector('#qrDept').value;
    const cat    = root.querySelector('#qrCat').value;
    const status = root.querySelector('#qrStatus').value;
    filtered = assets.filter(a =>
      (!floor  || a.floor         === floor)  &&
      (!dept   || a.department    === dept)   &&
      (!cat    || a.item_category === cat)    &&
      (!status || a.status        === status)
    );
    renderTable();
  }

  function renderTable() {
    const body = root.querySelector('#assetSelectBody');
    body.innerHTML = filtered.length ? filtered.map(a => `
      <tr>
        <td><input type="checkbox" class="asset-chk accent-brand-500" data-id="${a.id}"${selected.has(a.id) ? ' checked' : ''} /></td>
        <td class="font-mono">${a.asset_code}</td>
        <td>${a.asset_name}</td>
        <td>${a.item_category}</td>
        <td>${a.floor}${a.room ? ' ' + a.room : ''}</td>
        <td>${a.department}</td>
        <td><span class="badge badge--${a.status==='정상'?'ok':a.status==='수리중'?'repair':'disposed'}">${a.status}</span></td>
      </tr>`).join('')
      : `<tr><td colspan="7" class="text-center py-6 text-slate-400">필터 결과가 없습니다.</td></tr>`;

    root.querySelector('#filterHint').textContent = `${filtered.length}건 표시`;

    body.querySelectorAll('.asset-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        if (chk.checked) selected.add(chk.dataset.id);
        else selected.delete(chk.dataset.id);
        updateSelCount();
        renderPreview();
      });
    });

    const master = root.querySelector('#masterChk');
    master.indeterminate = false;
    master.checked = filtered.length > 0 && filtered.every(a => selected.has(a.id));
  }

  function updateSelCount() {
    root.querySelector('#selCount').textContent = selected.size;
  }

  /* 전체 선택/해제 */
  root.querySelector('#masterChk').addEventListener('change', e => {
    filtered.forEach(a => { if (e.target.checked) selected.add(a.id); else selected.delete(a.id); });
    renderTable();
    updateSelCount();
    renderPreview();
  });
  root.querySelector('#selectAll').addEventListener('click', () => {
    assets.forEach(a => selected.add(a.id));
    renderTable(); updateSelCount(); renderPreview();
  });
  root.querySelector('#deselectAll').addEventListener('click', () => {
    selected.clear();
    renderTable(); updateSelCount(); renderPreview();
  });

  root.querySelector('#urlMode').addEventListener('change', renderPreview);

  /* 라벨 미리보기 */
  function renderPreview() {
    const selAssets = assets.filter(a => selected.has(a.id));
    const previewCard = root.querySelector('#previewCard');
    if (!selAssets.length) { previewCard.classList.add('hidden'); return; }
    previewCard.classList.remove('hidden');
    const urlMode = root.querySelector('#urlMode').checked;
    root.querySelector('#labelGrid').innerHTML = selAssets.map(a => labelHtml(a, urlMode, false)).join('');
    /* QR 생성 */
    selAssets.forEach(a => generateQR(a, urlMode, `qrimg-${a.id}`));
  }

  /* 인쇄 */
  root.querySelector('#printBtn').addEventListener('click', () => {
    if (!selected.size) { toast('인쇄할 자산을 선택하세요.', 'warning'); return; }
    const selAssets = assets.filter(a => selected.has(a.id));
    const urlMode = root.querySelector('#urlMode').checked;

    /* body 직접 자식으로 삽입해야 @media print CSS가 정상 동작 */
    const printArea = document.createElement('div');
    printArea.id = 'printArea';
    printArea.innerHTML = `<div id="printGrid" class="qr-label-grid">${
      selAssets.map(a => labelHtml(a, urlMode, true)).join('')
    }</div>`;
    document.body.appendChild(printArea);

    selAssets.forEach(a => generateQR(a, urlMode, `qrprint-${a.id}`));

    /* QR 렌더링 완료 후 인쇄 */
    setTimeout(() => {
      window.print();
      document.body.removeChild(printArea);
      toast('인쇄 창이 열렸습니다. PDF로 저장할 수 있습니다.', 'info');
    }, 500);
  });

  renderTable();
}

function labelHtml(a, urlMode, forPrint) {
  const prefix = forPrint ? 'qrprint' : 'qrimg';
  return `
    <div class="qr-label">
      <div id="${prefix}-${a.id}" class="qr-label__img flex items-center justify-center">
        <i class="fas fa-spinner fa-spin text-slate-300 text-2xl"></i>
      </div>
      <div class="qr-label__code">${a.asset_code}</div>
      <div class="qr-label__name">${a.asset_name}</div>
      <div class="qr-label__loc">${a.floor}${a.room ? ' ' + a.room : ''} · ${a.department}</div>
    </div>`;
}

function generateQR(a, urlMode, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const text = urlMode
    ? `${location.origin}${location.pathname}#assetSearch?code=${encodeURIComponent(a.asset_code)}`
    : a.asset_code;

  /* QRCode 라이브러리 사용 */
  if (typeof QRCode !== 'undefined') {
    el.innerHTML = '';
    try {
      new QRCode(el, {
        text,
        width: 90, height: 90,
        colorDark: '#0f172a', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch(e) {
      el.innerHTML = '<span class="text-xs text-red-400">QR 오류</span>';
    }
  } else {
    /* 폴백: canvas로 직접 그리기 (단순 버전) */
    el.innerHTML = `<div class="text-xs text-slate-400 text-center p-2">QR 라이브러리<br>로드 중...</div>`;
  }
}

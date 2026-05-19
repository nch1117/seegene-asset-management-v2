/* QR 라벨 생성 · 인쇄 · 카메라 스캔 */
import { Assets } from '../store.js';
import { toast } from '../ui/toast.js';

const FLOORS = ['2층', '3층', '4층', '5층', '6층', '7층'];

/* ── 카메라 스캔 상태 ── */
let scanStream   = null;
let scanFrameId  = null;

function stopCamera() {
  if (scanStream)  { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
  if (scanFrameId) { cancelAnimationFrame(scanFrameId); scanFrameId = null; }
}

export async function renderQR(root) {
  const assets = await Assets.list();

  const depts = [...new Set(assets.map(a => a.department).filter(Boolean))].sort();
  const cats  = [...new Set(assets.map(a => a.item_category).filter(Boolean))].sort();

  root.innerHTML = `
    <div class="max-w-6xl space-y-4">

      <!-- QR 스캔 카드 -->
      <div class="card">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 class="font-semibold"><i class="fas fa-camera mr-1 text-brand-500"></i>QR 스캔</h3>
            <p class="text-xs text-slate-400 mt-0.5">카메라로 QR 코드를 인식하면 해당 자산을 바로 검색합니다.</p>
          </div>
          <button id="openScanBtn" class="btn-primary">
            <i class="fas fa-qrcode mr-1"></i>카메라로 QR 스캔
          </button>
        </div>
      </div>

      <!-- QR 라벨 생성 카드 -->
      <div class="card">
        <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 class="font-semibold"><i class="fas fa-qrcode mr-1 text-brand-500"></i>QR 라벨 생성</h3>
          <div class="flex gap-2">
            <button id="selectAll"  class="btn-secondary text-xs">전체 선택</button>
            <button id="deselectAll" class="btn-secondary text-xs">전체 해제</button>
            <button id="printBtn"   class="btn-primary">
              <i class="fas fa-print mr-1"></i>선택 인쇄 (<span id="selCount">0</span>건)
            </button>
          </div>
        </div>

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

    <!-- 카메라 스캔 모달 -->
    <div id="qrScanModal" class="modal-backdrop hidden">
      <div class="modal-box max-w-sm w-full">
        <div class="flex items-center justify-between mb-3">
          <h4 class="font-semibold"><i class="fas fa-camera mr-1 text-brand-500"></i>QR 스캔</h4>
          <button id="closeScanModal" class="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
        </div>

        <div class="relative rounded overflow-hidden bg-black aspect-video">
          <video id="scanVideo" class="w-full h-full object-cover" autoplay muted playsinline></video>
          <canvas id="scanCanvas" class="hidden"></canvas>
          <!-- 스캔 가이드 오버레이 -->
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="w-40 h-40 border-2 border-white rounded opacity-60"></div>
          </div>
        </div>

        <p id="scanStatus" class="text-center text-sm mt-2 text-slate-500">
          <i class="fas fa-spinner fa-spin mr-1"></i>카메라를 QR 코드에 가져다 대세요
        </p>

        <div id="scanResult" class="hidden mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800 text-sm"></div>

        <!-- 수동 입력 -->
        <div class="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
          <p class="text-xs text-slate-400 mb-1">카메라 사용 불가 시 직접 입력</p>
          <div class="flex gap-2">
            <input id="manualCode" class="input flex-1 text-sm" placeholder="자산코드 입력 (예: PC-250519-0001)" />
            <button id="manualSearchBtn" class="btn-primary text-sm px-3">검색</button>
          </div>
        </div>
      </div>
    </div>
  `;

  let filtered = [...assets];
  let selected  = new Set();
  const PAGE_SIZE = 20;
  let currentPage = 1;

  /* ── 스캔 모달 ── */
  const scanModal = root.querySelector('#qrScanModal');

  function openScanModal() {
    scanModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    startCamera();
  }

  function closeScanModal() {
    stopCamera();
    scanModal.classList.add('hidden');
    document.body.style.overflow = '';
    root.querySelector('#scanStatus').innerHTML =
      '<i class="fas fa-spinner fa-spin mr-1"></i>카메라를 QR 코드에 가져다 대세요';
    root.querySelector('#scanResult').classList.add('hidden');
    root.querySelector('#manualCode').value = '';
  }

  root.querySelector('#openScanBtn').addEventListener('click', openScanModal);
  root.querySelector('#closeScanModal').addEventListener('click', closeScanModal);
  scanModal.addEventListener('click', e => { if (e.target === scanModal) closeScanModal(); });

  function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      root.querySelector('#scanStatus').textContent = '이 브라우저에서는 카메라를 지원하지 않습니다.';
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        scanStream = stream;
        const video = root.querySelector('#scanVideo');
        video.srcObject = stream;
        video.play();
        video.addEventListener('loadedmetadata', () => scanFrame(), { once: true });
      })
      .catch(() => {
        root.querySelector('#scanStatus').textContent = '카메라 권한이 거부되었습니다. 아래에서 직접 입력해주세요.';
      });
  }

  function scanFrame() {
    const video  = root.querySelector('#scanVideo');
    const canvas = root.querySelector('#scanCanvas');
    if (!scanStream) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (typeof jsQR !== 'undefined') {
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
        if (code) {
          onQRDetected(code.data);
          return;
        }
      }
    }
    scanFrameId = requestAnimationFrame(scanFrame);
  }

  function onQRDetected(rawText) {
    stopCamera();
    /* URL 모드: https://...#assetSearch?code=SGM-PC-... → code 추출 */
    let code = rawText;
    try {
      const url = new URL(rawText);
      const c = new URLSearchParams(url.hash.split('?')[1] || '').get('code');
      if (c) code = c;
    } catch { /* not a URL, use raw text as code */ }

    const found = assets.find(a => a.asset_code === code);
    const resultEl = root.querySelector('#scanResult');
    const statusEl = root.querySelector('#scanStatus');

    if (found) {
      resultEl.innerHTML = `
        <p class="text-green-700 dark:text-green-400 font-semibold mb-1">
          <i class="fas fa-check-circle mr-1"></i>자산 인식됨
        </p>
        <p class="font-mono text-xs">${found.asset_code}</p>
        <p class="font-medium">${found.asset_name}</p>
        <p class="text-xs text-slate-500">${found.floor} ${found.room || ''} · ${found.department}</p>
        <button id="goToAsset" class="btn-primary text-xs mt-2 w-full">자산 검색으로 이동</button>`;
      resultEl.classList.remove('hidden');
      statusEl.innerHTML = '<i class="fas fa-check text-green-500 mr-1"></i>스캔 완료';

      resultEl.querySelector('#goToAsset').addEventListener('click', () => {
        closeScanModal();
        location.hash = `assetSearch?code=${encodeURIComponent(code)}`;
      });
    } else {
      resultEl.innerHTML = `
        <p class="text-amber-600 dark:text-amber-400">
          <i class="fas fa-triangle-exclamation mr-1"></i>
          자산을 찾을 수 없습니다: <span class="font-mono text-xs">${code}</span>
        </p>
        <button id="retryScan" class="btn-secondary text-xs mt-2 w-full">다시 스캔</button>`;
      resultEl.classList.remove('hidden');
      statusEl.textContent = '인식된 QR 코드가 등록된 자산과 일치하지 않습니다.';

      resultEl.querySelector('#retryScan').addEventListener('click', () => {
        resultEl.classList.add('hidden');
        statusEl.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>카메라를 QR 코드에 가져다 대세요';
        startCamera();
      });
    }
  }

  /* 수동 검색 */
  root.querySelector('#manualSearchBtn').addEventListener('click', () => {
    const code = root.querySelector('#manualCode').value.trim();
    if (!code) { toast('자산코드를 입력하세요.', 'warning'); return; }
    onQRDetected(code);
  });
  root.querySelector('#manualCode').addEventListener('keydown', e => {
    if (e.key === 'Enter') root.querySelector('#manualSearchBtn').click();
  });

  /* ── 필터 ── */
  ['qrFloor', 'qrDept', 'qrCat', 'qrStatus'].forEach(id =>
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
    currentPage = 1;
    renderTable();
  }

  function renderTable() {
    const total      = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    currentPage = Math.min(currentPage, totalPages);
    const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const body = root.querySelector('#assetSelectBody');
    body.innerHTML = pageItems.length
      ? pageItems.map(a => `
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

    const hint = root.querySelector('#filterHint');
    hint.innerHTML = `<span>총 ${total}건 (${currentPage}/${totalPages} 페이지)</span>
      <span class="inline-flex gap-1 ml-3">
        <button id="qrPrev" class="px-2 py-0.5 rounded border text-xs ${currentPage<=1?'opacity-30 pointer-events-none':'hover:bg-slate-100 dark:hover:bg-slate-700'}">‹ 이전</button>
        <button id="qrNext" class="px-2 py-0.5 rounded border text-xs ${currentPage>=totalPages?'opacity-30 pointer-events-none':'hover:bg-slate-100 dark:hover:bg-slate-700'}">다음 ›</button>
      </span>`;
    hint.querySelector('#qrPrev')?.addEventListener('click', () => { currentPage--; renderTable(); });
    hint.querySelector('#qrNext')?.addEventListener('click', () => { currentPage++; renderTable(); });

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
    master.checked = pageItems.length > 0 && pageItems.every(a => selected.has(a.id));
  }

  function updateSelCount() {
    root.querySelector('#selCount').textContent = selected.size;
  }

  root.querySelector('#masterChk').addEventListener('change', e => {
    const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    pageItems.forEach(a => { if (e.target.checked) selected.add(a.id); else selected.delete(a.id); });
    renderTable(); updateSelCount(); renderPreview();
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

  /* ── 라벨 미리보기 ── */
  function renderPreview() {
    const selAssets  = assets.filter(a => selected.has(a.id));
    const previewCard = root.querySelector('#previewCard');
    if (!selAssets.length) { previewCard.classList.add('hidden'); return; }
    previewCard.classList.remove('hidden');
    const urlMode = root.querySelector('#urlMode').checked;
    root.querySelector('#labelGrid').innerHTML = selAssets.map(a => labelHtml(a, urlMode, false)).join('');
    selAssets.forEach(a => generateQR(a, urlMode, `qrimg-${a.id}`));
  }

  /* ── 인쇄 ── */
  root.querySelector('#printBtn').addEventListener('click', () => {
    if (!selected.size) { toast('인쇄할 자산을 선택하세요.', 'warning'); return; }
    const selAssets = assets.filter(a => selected.has(a.id));
    const urlMode   = root.querySelector('#urlMode').checked;

    const printArea = document.createElement('div');
    printArea.id = 'printArea';
    printArea.innerHTML = `<div id="printGrid" class="qr-label-grid">${
      selAssets.map(a => labelHtml(a, urlMode, true)).join('')
    }</div>`;
    document.body.appendChild(printArea);

    selAssets.forEach(a => generateQR(a, urlMode, `qrprint-${a.id}`));

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

  el.innerHTML = '';

  if (typeof QRious === 'undefined') {
    el.innerHTML = '<span class="text-xs text-red-400">QR 라이브러리 로드 실패</span>';
    return;
  }

  try {
    const canvas = document.createElement('canvas');
    el.appendChild(canvas);
    new QRious({
      element: canvas,
      value: text,
      size: 90,
      foreground: '#0f172a',
      background: '#ffffff',
      level: 'M'
    });
  } catch (e) {
    el.innerHTML = `<span class="text-xs text-red-400">QR 오류: ${e.message}</span>`;
  }
}

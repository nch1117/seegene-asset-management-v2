/* 평면도 위치관리 — ES6 모듈 */
import { Assets, Floorplans } from '../store.js';
import { storage } from '../firebase.js';
import {
  ref as storageRef, uploadBytes, getDownloadURL, deleteObject
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';
import { isAdmin } from '../auth.js';
import { toast } from '../ui/toast.js';

const FLOORS = ['2층', '3층', '4층', '5층', '6층', '7층'];
const PIN_COLOR = { '정상': '#ef4444', '수리중': '#d97706', '폐기': '#9ca3af' };
const PIN_DEFAULT = '#6366f1';

/* ─── 모듈 상태 ─── */
let fp = {
  plans: {},
  assets: [],
  floor: '2층',
  zoom: 1.0,
  panX: 0, panY: 0,
  isPanning: false,
  startX: 0, startY: 0,
  mode: 'view',
  pinTarget: null,
  filters: { status: '', dept: '', cat: '' },
  lastTouchDist: 0,
};

/* ══════════════════════════════════════
   진입점
   ══════════════════════════════════════ */
export async function renderFloorplan(root) {
  const [assets, planList] = await Promise.all([Assets.list(), Floorplans.list()]);
  fp.assets = assets;
  fp.plans = {};
  for (const p of planList) {
    if (p && p.image_url) fp.plans[p.id] = p;
  }

  root.innerHTML = buildShell(isAdmin());
  refreshTabs(root);
  refreshUploadPanel(root);
  refreshStats(root);
  refreshFilterBar(root);
  refreshViewer(root);
  refreshUnpinned(root);
  bindEvents(root);
}

/* ══════════════════════════════════════
   HTML 골격
   ══════════════════════════════════════ */
function buildShell(admin) {
  return `
  <div id="fpFloorTabs" class="fp-floor-tabs"></div>
  <div class="fp-layout">
    <aside class="fp-sidebar">
      ${admin ? `<div class="card">
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          <i class="fas fa-upload mr-1"></i>평면도 관리
        </p>
        <div id="fpUploadPanel"></div>
      </div>` : ''}
      <div class="card">
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          <i class="fas fa-chart-bar mr-1"></i>통계
        </p>
        <div id="fpStats"></div>
      </div>
      <div class="card">
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
          <i class="fas fa-circle-dot mr-1"></i>범례
        </p>
        <div class="fp-legend">
          ${Object.entries({ ...PIN_COLOR, '기타': PIN_DEFAULT }).map(([s, c]) =>
            `<div class="fp-legend-item"><span class="fp-legend-dot" style="background:${c}"></span><span>${s}</span></div>`
          ).join('')}
        </div>
      </div>
      <div class="card p-0">
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide p-3 pb-1">
          <i class="fas fa-circle-exclamation mr-1 text-amber-500"></i>위치 미지정
        </p>
        <div id="fpUnpinnedList" class="overflow-y-auto" style="max-height:220px"></div>
      </div>
    </aside>

    <div class="fp-viewer-area">
      <div class="fp-top-bar">
        <div id="fpFilterBar" class="flex gap-2 flex-1 flex-wrap"></div>
        <div class="fp-zoom-ctrl">
          <button id="fpZoomOut"   class="btn-icon" title="축소"><i class="fas fa-minus"></i></button>
          <span  id="fpZoomLabel" class="fp-zoom-label">100%</span>
          <button id="fpZoomIn"    class="btn-icon" title="확대"><i class="fas fa-plus"></i></button>
          <button id="fpZoomReset" class="btn-icon" title="초기화"><i class="fas fa-compress-arrows-alt"></i></button>
        </div>
      </div>
      <div id="fpPlaceBanner" class="fp-place-banner hidden"></div>
      <div class="fp-viewer-card">
        <div id="fpCanvasOuter" class="fp-canvas-outer">
          <div id="fpCanvasInner" class="fp-canvas-inner">
            <img id="fpImg" class="fp-img" />
            <div id="fpPinsLayer" class="fp-pins-layer"></div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

/* ══════════════════════════════════════
   층 탭
   ══════════════════════════════════════ */
function refreshTabs(root) {
  const el = root.querySelector('#fpFloorTabs');
  if (!el) return;
  el.innerHTML = FLOORS.map(f => {
    const plan = fp.plans[f];
    const fa = fp.assets.filter(a => a.floor === f);
    const pinned = fa.filter(a => a.pos_x != null).length;
    const badge = plan
      ? `<span class="fp-tab-cnt">${pinned}/${fa.length}</span>`
      : `<span class="fp-tab-no">미등록</span>`;
    return `<button class="fp-tab${f === fp.floor ? ' active' : ''}" data-floor="${f}">${f} ${badge}</button>`;
  }).join('');
}

/* ══════════════════════════════════════
   업로드 패널 (관리자 전용)
   ══════════════════════════════════════ */
function refreshUploadPanel(root) {
  const el = root.querySelector('#fpUploadPanel');
  if (!el) return;
  const plan = fp.plans[fp.floor];
  if (plan) {
    el.innerHTML = `
      <div class="flex items-center gap-2 flex-wrap">
        <i class="fas fa-map text-brand-500 text-sm flex-shrink-0"></i>
        <span class="flex-1 text-xs text-slate-500 truncate">${plan.image_name || fp.floor + ' 평면도'}</span>
        <label class="btn-secondary text-xs cursor-pointer" style="padding:.25rem .625rem">
          <i class="fas fa-sync mr-1"></i>교체
          <input type="file" id="fpFileReplace" class="hidden" accept="image/png,image/jpeg">
        </label>
        <button id="fpDeleteBtn" class="text-xs text-red-500 hover:text-red-700 px-2 py-1">
          <i class="fas fa-trash"></i>
        </button>
      </div>`;
  } else {
    el.innerHTML = `
      <label class="fp-upload-dropzone" for="fpFileInput">
        <i class="fas fa-cloud-arrow-up"></i>
        <p>${fp.floor} 평면도 업로드</p>
        <small>JPG, PNG · 최대 10MB</small>
        <input type="file" id="fpFileInput" class="hidden" accept="image/png,image/jpeg">
      </label>`;
  }

  root.querySelector('#fpFileInput')?.addEventListener('change', e =>
    handleUpload(e.target.files[0], root));
  root.querySelector('#fpFileReplace')?.addEventListener('change', e =>
    handleUpload(e.target.files[0], root));
  root.querySelector('#fpDeleteBtn')?.addEventListener('click', async () => {
    if (!confirm(`${fp.floor} 평면도를 삭제하시겠습니까?`)) return;
    try {
      await deleteObject(storageRef(storage, `floorplans/${fp.floor}`));
    } catch (_) { /* 이미 없으면 무시 */ }
    await Floorplans.remove(fp.floor);
    delete fp.plans[fp.floor];
    toast(`${fp.floor} 평면도를 삭제했습니다.`, 'info');
    refreshAll(root);
  });
}

async function handleUpload(file, root) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('이미지 파일만 가능합니다.', 'error'); return; }
  if (file.size > 10 * 1024 * 1024) { toast('10MB 이하 파일만 가능합니다.', 'error'); return; }

  toast('업로드 중...', 'info');
  try {
    /* 1. Firebase Storage에 업로드 */
    const fileRef = storageRef(storage, `floorplans/${fp.floor}`);
    await uploadBytes(fileRef, file, { contentType: file.type });
    const downloadURL = await getDownloadURL(fileRef);

    /* 2. 이미지 크기 측정 */
    const dims = await new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.src = URL.createObjectURL(file);
    });

    /* 3. Firestore에 메타데이터 저장 */
    const record = {
      id: fp.floor, floor: fp.floor,
      image_url: downloadURL, image_name: file.name,
      image_type: file.type,
      width: dims.width, height: dims.height,
    };
    await Floorplans.put(record);
    fp.plans[fp.floor] = record;
    fp.zoom = 1; fp.panX = 0; fp.panY = 0;
    toast(`${fp.floor} 평면도를 등록했습니다.`, 'success');
    refreshAll(root);
  } catch (err) {
    console.error(err);
    toast('업로드 실패: ' + err.message, 'error');
  }
}

/* ══════════════════════════════════════
   뷰어
   ══════════════════════════════════════ */
function refreshViewer(root) {
  const outer = root.querySelector('#fpCanvasOuter');
  if (!outer) return;
  const plan = fp.plans[fp.floor];

  if (!plan) {
    outer.innerHTML = `
      <div class="fp-empty">
        <div>
          <i class="fas fa-map text-5xl text-slate-600 mb-3 block"></i>
          <p class="text-slate-400 font-medium">${fp.floor} 평면도가 등록되지 않았습니다.</p>
          ${isAdmin() ? '<p class="text-xs text-slate-500 mt-1">좌측 패널에서 이미지를 업로드하세요.</p>' : ''}
        </div>
      </div>`;
    return;
  }

  if (!root.querySelector('#fpCanvasInner')) {
    outer.innerHTML = `
      <div id="fpCanvasInner" class="fp-canvas-inner">
        <img id="fpImg" class="fp-img" />
        <div id="fpPinsLayer" class="fp-pins-layer"></div>
      </div>`;
  }

  const img = root.querySelector('#fpImg');
  img.src = plan.image_url;
  img.style.width  = plan.width  + 'px';
  img.style.height = plan.height + 'px';
  applyTransform(root.querySelector('#fpCanvasInner'));
  refreshPins(root);
}

function applyTransform(inner) {
  if (!inner) return;
  inner.style.transform = `translate(${fp.panX}px,${fp.panY}px) scale(${fp.zoom})`;
  const label = document.querySelector('#fpZoomLabel');
  if (label) label.textContent = Math.round(fp.zoom * 100) + '%';
}

/* ══════════════════════════════════════
   핀 렌더
   ══════════════════════════════════════ */
function filteredAssets() {
  return fp.assets.filter(a => {
    if (a.floor !== fp.floor || a.pos_x == null || a.pos_y == null) return false;
    if (fp.filters.status && a.status       !== fp.filters.status) return false;
    if (fp.filters.dept   && a.department   !== fp.filters.dept)   return false;
    if (fp.filters.cat    && a.item_category !== fp.filters.cat)    return false;
    return true;
  });
}

function refreshPins(root) {
  const layer = root.querySelector('#fpPinsLayer');
  if (!layer) return;
  layer.innerHTML = filteredAssets().map(a => {
    const color = PIN_COLOR[a.status] || PIN_DEFAULT;
    const label = (a.asset_name || '').slice(0, 5);
    return `
      <div class="fp-pin" data-id="${a.id}" style="left:${a.pos_x}%;top:${a.pos_y}%">
        <i class="fas fa-map-marker-alt" style="color:${color}"></i>
        <span class="fp-pin-label">${label}</span>
      </div>`;
  }).join('');
}

/* ══════════════════════════════════════
   툴팁
   ══════════════════════════════════════ */
function showTooltip(pin, asset, admin, root) {
  document.querySelectorAll('.fp-tooltip').forEach(t => t.remove());
  const color = PIN_COLOR[asset.status] || PIN_DEFAULT;
  const tip = document.createElement('div');
  tip.className = 'fp-tooltip';
  tip.innerHTML = `
    <div class="fp-tooltip-header" style="border-left:4px solid ${color}">
      <span>${asset.asset_name || '-'}</span>
      <button class="fp-close-tip"><i class="fas fa-times"></i></button>
    </div>
    <div class="fp-tooltip-body">
      <div class="fp-tooltip-row"><span>자산코드</span><strong>${asset.asset_code || '-'}</strong></div>
      <div class="fp-tooltip-row"><span>위치</span><span>${asset.floor || '-'} ${asset.room || ''}</span></div>
      <div class="fp-tooltip-row"><span>부서</span><span>${asset.department || '-'}</span></div>
      <div class="fp-tooltip-row"><span>상태</span><span>${asset.status || '-'}</span></div>
    </div>
    ${admin ? `
    <div class="fp-tooltip-footer">
      <button class="fp-btn-repin" data-id="${asset.id}"><i class="fas fa-map-pin mr-1"></i>재지정</button>
      <button class="fp-btn-remove" data-id="${asset.id}"><i class="fas fa-times mr-1"></i>핀 제거</button>
    </div>` : ''}`;

  pin.appendChild(tip);

  tip.querySelector('.fp-close-tip')?.addEventListener('click', e => {
    e.stopPropagation(); tip.remove();
  });
  tip.querySelector('.fp-btn-repin')?.addEventListener('click', e => {
    e.stopPropagation(); tip.remove();
    startPinPlace(asset.id, asset.asset_name || asset.asset_code, root);
  });
  tip.querySelector('.fp-btn-remove')?.addEventListener('click', async e => {
    e.stopPropagation(); tip.remove();
    await removePin(asset.id);
    fp.assets = await Assets.list();
    refreshPins(root); refreshUnpinned(root);
    refreshTabs(root); refreshStats(root);
    toast('핀이 제거되었습니다.', 'info');
  });
}

async function removePin(assetId) {
  const asset = fp.assets.find(a => a.id === assetId);
  if (!asset) return;
  await Assets.put({ ...asset, pos_x: null, pos_y: null });
  fp.assets = fp.assets.map(a =>
    a.id === assetId ? { ...a, pos_x: null, pos_y: null } : a);
}

/* ══════════════════════════════════════
   핀 배치 모드
   ══════════════════════════════════════ */
function startPinPlace(assetId, assetName, root) {
  const plan = fp.plans[fp.floor];
  if (!plan) { toast('평면도를 먼저 등록해주세요.', 'warning'); return; }
  fp.mode = 'pin-place';
  fp.pinTarget = { id: assetId, name: assetName };

  root.querySelector('#fpCanvasOuter')?.classList.add('pin-mode');

  const banner = root.querySelector('#fpPlaceBanner');
  if (banner) {
    banner.classList.remove('hidden');
    banner.innerHTML = `
      <i class="fas fa-crosshairs"></i>
      <span><strong>${assetName}</strong> — 평면도를 클릭하여 위치를 지정하세요.</span>
      <button id="fpCancelPin">취소</button>`;
    banner.querySelector('#fpCancelPin')?.addEventListener('click', () =>
      exitPinPlace(root));
  }
}

function exitPinPlace(root) {
  fp.mode = 'view'; fp.pinTarget = null;
  root?.querySelector('#fpCanvasOuter')?.classList.remove('pin-mode');
  const banner = root?.querySelector('#fpPlaceBanner');
  if (banner) banner.classList.add('hidden');
}

async function savePinCoords(assetId, x, y, root) {
  const asset = fp.assets.find(a => a.id === assetId);
  if (!asset) return;
  const updated = { ...asset, pos_x: parseFloat(x.toFixed(4)), pos_y: parseFloat(y.toFixed(4)) };
  await Assets.put(updated);
  fp.assets = fp.assets.map(a => a.id === assetId ? updated : a);
  exitPinPlace(root);
  toast('위치가 저장되었습니다.', 'success');
  refreshPins(root); refreshUnpinned(root);
  refreshTabs(root); refreshStats(root);
}

/* ══════════════════════════════════════
   줌 / 팬
   ══════════════════════════════════════ */
function setZoom(newZoom, pivotX, pivotY, outer) {
  const clamped = Math.min(6, Math.max(0.2, newZoom));
  if (pivotX != null && outer) {
    const rect = outer.getBoundingClientRect();
    const ox = pivotX - rect.left, oy = pivotY - rect.top;
    fp.panX = ox - (ox - fp.panX) * (clamped / fp.zoom);
    fp.panY = oy - (oy - fp.panY) * (clamped / fp.zoom);
  }
  fp.zoom = clamped;
  const inner = outer?.querySelector('#fpCanvasInner');
  if (inner) applyTransform(inner);
}

function getCoords(clientX, clientY, outer) {
  const plan = fp.plans[fp.floor];
  if (!plan) return null;
  const rect = outer.getBoundingClientRect();
  return {
    x: Math.min(100, Math.max(0, ((clientX - rect.left - fp.panX) / fp.zoom / plan.width)  * 100)),
    y: Math.min(100, Math.max(0, ((clientY - rect.top  - fp.panY) / fp.zoom / plan.height) * 100)),
  };
}

/* ══════════════════════════════════════
   이벤트 바인딩
   ══════════════════════════════════════ */
function bindEvents(root) {
  const outer = root.querySelector('#fpCanvasOuter');

  /* 층 탭 */
  root.querySelector('#fpFloorTabs')?.addEventListener('click', e => {
    const btn = e.target.closest('.fp-tab');
    if (!btn || btn.dataset.floor === fp.floor) return;
    exitPinPlace(root);
    fp.floor = btn.dataset.floor;
    fp.zoom = 1; fp.panX = 0; fp.panY = 0;
    refreshTabs(root); refreshUploadPanel(root);
    refreshViewer(root); refreshUnpinned(root); refreshStats(root);
  });

  /* 핀 클릭 */
  root.addEventListener('click', e => {
    const pin = e.target.closest('.fp-pin');
    if (!pin || fp.mode === 'pin-place') return;
    e.stopPropagation();
    const asset = fp.assets.find(a => a.id === pin.dataset.id);
    if (asset) showTooltip(pin, asset, isAdmin(), root);
  });

  /* 툴팁 바깥 클릭 닫기 */
  root.addEventListener('click', e => {
    if (!e.target.closest('.fp-tooltip') && !e.target.closest('.fp-pin'))
      document.querySelectorAll('.fp-tooltip').forEach(t => t.remove());
  });

  /* 미지정 목록 핀 지정 버튼 */
  root.querySelector('#fpUnpinnedList')?.addEventListener('click', e => {
    const btn = e.target.closest('.fp-btn-pin');
    if (!btn) return;
    startPinPlace(btn.dataset.id, btn.dataset.name, root);
  });

  /* 캔버스 마우스 */
  if (outer) {
    outer.addEventListener('mousedown', e => {
      if (fp.mode === 'pin-place') return;
      if (e.target.closest('.fp-pin') || e.target.closest('.fp-tooltip')) return;
      fp.isPanning = true;
      fp.startX = e.clientX - fp.panX;
      fp.startY = e.clientY - fp.panY;
      outer.classList.add('panning');
    });

    const onMove = e => {
      if (!fp.isPanning) return;
      fp.panX = e.clientX - fp.startX;
      fp.panY = e.clientY - fp.startY;
      const inner = outer.querySelector('#fpCanvasInner');
      if (inner) applyTransform(inner);
    };
    const onUp = () => { fp.isPanning = false; outer.classList.remove('panning'); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    /* 캔버스 클릭 — 핀 배치 */
    outer.addEventListener('click', async e => {
      if (fp.mode !== 'pin-place' || !fp.pinTarget) return;
      if (e.target.closest('#fpPlaceBanner')) return;
      const c = getCoords(e.clientX, e.clientY, outer);
      if (c) await savePinCoords(fp.pinTarget.id, c.x, c.y, root);
    });

    /* 휠 줌 */
    outer.addEventListener('wheel', e => {
      e.preventDefault();
      setZoom(fp.zoom + (e.deltaY < 0 ? 0.1 : -0.1), e.clientX, e.clientY, outer);
    }, { passive: false });

    /* 터치 */
    outer.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        fp.isPanning = true;
        fp.startX = e.touches[0].clientX - fp.panX;
        fp.startY = e.touches[0].clientY - fp.panY;
      } else if (e.touches.length === 2) {
        fp.isPanning = false;
        fp.lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY);
      }
    }, { passive: true });

    outer.addEventListener('touchmove', e => {
      if (e.touches.length === 1 && fp.isPanning) {
        fp.panX = e.touches[0].clientX - fp.startX;
        fp.panY = e.touches[0].clientY - fp.startY;
        const inner = outer.querySelector('#fpCanvasInner');
        if (inner) applyTransform(inner);
      } else if (e.touches.length === 2) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY);
        const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        setZoom(fp.zoom * (d / (fp.lastTouchDist || d)), mx, my, outer);
        fp.lastTouchDist = d;
      }
    }, { passive: true });

    outer.addEventListener('touchend', () => { fp.isPanning = false; });
  }

  /* 줌 버튼 */
  root.querySelector('#fpZoomIn')?.addEventListener('click', () =>
    outer && setZoom(fp.zoom + 0.25, null, null, outer));
  root.querySelector('#fpZoomOut')?.addEventListener('click', () =>
    outer && setZoom(fp.zoom - 0.25, null, null, outer));
  root.querySelector('#fpZoomReset')?.addEventListener('click', () => {
    fp.zoom = 1; fp.panX = 0; fp.panY = 0;
    const inner = outer?.querySelector('#fpCanvasInner');
    if (inner) applyTransform(inner);
  });

  /* 필터 */
  root.querySelector('#fpFilterBar')?.addEventListener('change', e => {
    if (e.target.dataset.filter) {
      fp.filters[e.target.dataset.filter] = e.target.value;
      refreshPins(root);
    }
  });
}

/* ══════════════════════════════════════
   사이드바 갱신
   ══════════════════════════════════════ */
function refreshStats(root) {
  const el = root.querySelector('#fpStats');
  if (!el) return;
  const fa = fp.assets.filter(a => a.floor === fp.floor);
  const pinned = fa.filter(a => a.pos_x != null).length;
  el.innerHTML = `
    <div class="fp-stats">
      <div class="fp-stat-item"><span class="fp-stat-label">전체</span><span class="fp-stat-val">${fa.length}</span></div>
      <div class="fp-stat-item"><span class="fp-stat-label">핀 지정</span><span class="fp-stat-val" style="color:var(--primary)">${pinned}</span></div>
      <div class="fp-stat-item"><span class="fp-stat-label">미지정</span><span class="fp-stat-val" style="color:#d97706">${fa.length - pinned}</span></div>
      <div class="fp-stat-item"><span class="fp-stat-label">정상</span><span class="fp-stat-val" style="color:var(--status-ok)">${fa.filter(a => a.status === '정상').length}</span></div>
    </div>`;
}

function refreshFilterBar(root) {
  const el = root.querySelector('#fpFilterBar');
  if (!el) return;
  const depts = [...new Set(fp.assets.map(a => a.department).filter(Boolean))].sort();
  const cats  = [...new Set(fp.assets.map(a => a.item_category).filter(Boolean))].sort();

  const sel = (f, opts, ph) => `
    <select data-filter="${f}" class="input py-1 text-xs" style="min-width:80px;width:auto">
      <option value="">${ph}</option>
      ${opts.map(o => `<option value="${o}"${fp.filters[f]===o?' selected':''}>${o}</option>`).join('')}
    </select>`;

  el.innerHTML =
    sel('status', ['정상','수리중','폐기'], '상태 전체') +
    sel('dept', depts, '부서 전체') +
    sel('cat',  cats,  '품목 전체') +
    `<button id="fpFilterReset" class="text-xs text-slate-500 hover:text-brand-500 px-2 py-1">초기화</button>`;

  root.querySelector('#fpFilterReset')?.addEventListener('click', () => {
    fp.filters = { status: '', dept: '', cat: '' };
    refreshFilterBar(root); refreshPins(root);
  });
}

function refreshUnpinned(root) {
  const el = root.querySelector('#fpUnpinnedList');
  if (!el) return;
  const items = fp.assets.filter(a =>
    a.floor === fp.floor && (a.pos_x == null || a.pos_y == null));
  if (!items.length) {
    el.innerHTML = `<p class="text-xs text-slate-400 p-3">모든 자산의 위치가 지정되어 있습니다.</p>`;
    return;
  }
  el.innerHTML = items.map(a => `
    <div class="fp-unpinned-item">
      <span class="fp-unpinned-code">${a.asset_code || '-'}</span>
      <span class="fp-unpinned-name">${a.asset_name || '-'}</span>
      ${isAdmin() ? `<button class="fp-btn-pin"
        data-id="${a.id}"
        data-name="${(a.asset_name || a.asset_code || '').replace(/"/g,'&quot;')}">지정</button>` : ''}
    </div>`).join('');
}

function refreshAll(root) {
  refreshTabs(root);
  refreshUploadPanel(root);
  refreshViewer(root);
  refreshStats(root);
  refreshUnpinned(root);
}

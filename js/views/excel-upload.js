/* 엑셀 일괄 업로드 — 3색 검증 + 일괄 등록 */
import { Assets } from '../store.js';
import { toast } from '../ui/toast.js';

const REQUIRED  = ['자산명', '품목', '층', '담당부서'];
const OPTIONAL  = ['담당자', '취득일자'];
const STATUS_OK = ['정상', '수리중', '폐기'];
const FLOORS    = ['2층', '3층', '4층', '5층', '6층', '7층'];

const FIELD_MAP = {
  '자산코드': 'asset_code', '자산명': 'asset_name', '품목': 'item_category',
  '층': 'floor', '실': 'room', '담당부서': 'department', '담당자': 'manager',
  '취득일자': 'acquired_date', '상태': 'status', '비고': 'note'
};

const CAT_PREFIX = {
  'PC':'PC','노트북':'NB','모니터':'MN','프린터':'PR','스캐너':'SC',
  '복합기':'MF','서버':'SV','네트워크장비':'NW','의자':'CH','책상':'DS',
  '냉장고':'RF','에어컨':'AC','전화기':'PH','태블릿':'TB','카메라':'CM'
};

function genCode(cat, seq, existCodes) {
  const prefix = CAT_PREFIX[cat] || cat.slice(0, 2).toUpperCase();
  const today = new Date();
  const yymmdd = String(today.getFullYear()).slice(2)
    + String(today.getMonth()+1).padStart(2,'0')
    + String(today.getDate()).padStart(2,'0');
  let code = `${prefix}-${yymmdd}-${String(seq).padStart(4,'0')}`;
  let i = seq;
  while (existCodes.has(code)) { i++; code = `${prefix}-${yymmdd}-${String(i).padStart(4,'0')}`; }
  existCodes.add(code);
  return code;
}

export async function renderExcelUpload(root) {
  root.innerHTML = `
    <div class="max-w-5xl space-y-4">
      <div class="card">
        <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 class="font-semibold"><i class="fas fa-file-excel mr-1 text-brand-500"></i>자산 일괄 업로드</h3>
          <button id="dlTemplate" class="btn-secondary"><i class="fas fa-download mr-1"></i>템플릿 다운로드</button>
        </div>

        <div id="uploadZone" class="upload-zone">
          <i class="fas fa-cloud-upload-alt"></i>
          <p class="font-semibold text-slate-600 dark:text-slate-300">엑셀 파일을 드래그하거나 클릭하여 선택</p>
          <small class="text-slate-400">.xlsx / .xls 지원 · 첫 행은 헤더(자산명, 품목, 층, 담당부서 필수)</small>
          <input id="xlsxInput" type="file" accept=".xlsx,.xls" class="hidden" />
        </div>
      </div>

      <div id="previewSection" class="hidden space-y-3">
        <div class="card">
          <div class="flex items-center gap-2 flex-wrap mb-3">
            <span class="font-semibold text-sm">검증 결과:</span>
            <span id="kpiOk"  class="upload-kpi upload-kpi--ok"><i class="fas fa-check mr-1"></i><span id="cntOk">0</span>건 정상</span>
            <span id="kpiWarn" class="upload-kpi upload-kpi--warn"><i class="fas fa-triangle-exclamation mr-1"></i><span id="cntWarn">0</span>건 경고</span>
            <span id="kpiErr"  class="upload-kpi upload-kpi--err"><i class="fas fa-xmark mr-1"></i><span id="cntErr">0</span>건 오류</span>
          </div>
          <div class="overflow-x-auto">
            <table class="tbl text-xs">
              <thead>
                <tr id="previewHead"></tr>
              </thead>
              <tbody id="previewBody"></tbody>
            </table>
          </div>
        </div>

        <div id="warnConfirmArea" class="hidden card bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <label class="flex items-start gap-2 cursor-pointer">
            <input id="warnCheck" type="checkbox" class="mt-0.5 accent-brand-500" />
            <span class="text-sm text-amber-800 dark:text-amber-300">
              경고 행은 일부 권장 정보(담당자/취득일자)가 누락되어 있습니다. 경고 행도 포함하여 등록하겠습니까?
            </span>
          </label>
        </div>

        <div class="flex justify-end gap-2">
          <button id="cancelUpload" class="btn-secondary">취소</button>
          <button id="confirmUpload" class="btn-primary"><i class="fas fa-upload mr-1"></i>확정 등록</button>
        </div>
      </div>
    </div>
  `;

  let parsedRows = [];

  /* 템플릿 다운로드 */
  root.querySelector('#dlTemplate').addEventListener('click', () => {
    const headers = ['자산코드','자산명','품목','층','실','담당부서','담당자','취득일자','상태','비고'];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '자산');
    XLSX.writeFile(wb, '자산_업로드_템플릿.xlsx');
  });

  /* 드래그 앤 드롭 */
  const zone = root.querySelector('#uploadZone');
  zone.addEventListener('click', () => root.querySelector('#xlsxInput').click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag-over'); handleFile(e.dataTransfer.files[0]); });
  root.querySelector('#xlsxInput').addEventListener('change', e => handleFile(e.target.files[0]));

  /* 취소 */
  root.querySelector('#cancelUpload').addEventListener('click', () => {
    root.querySelector('#previewSection').classList.add('hidden');
    parsedRows = [];
    root.querySelector('#xlsxInput').value = '';
  });

  /* 확정 등록 */
  root.querySelector('#confirmUpload').addEventListener('click', async () => {
    const includeWarn = root.querySelector('#warnCheck')?.checked ?? false;
    const toUpload = parsedRows.filter(r => r._level === 'ok' || (r._level === 'warn' && includeWarn));
    if (!toUpload.length) { toast('등록할 행이 없습니다.', 'warning'); return; }

    const existing = await Assets.list();
    const existCodes = new Set(existing.map(a => a.asset_code));
    let seq = existing.length + 1;

    for (const row of toUpload) {
      const data = { ...row };
      delete data._level; delete data._msg;
      if (!data.asset_code) data.asset_code = genCode(data.item_category || 'XX', seq++, existCodes);
      if (!data.status) data.status = '정상';
      data.pos_x = null; data.pos_y = null;
      await Assets.add(data);
    }
    toast(`${toUpload.length}건이 등록되었습니다.`, 'success');
    root.querySelector('#previewSection').classList.add('hidden');
    parsedRows = [];
    root.querySelector('#xlsxInput').value = '';
  });

  /* 파일 파싱 + 검증 */
  async function handleFile(file) {
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) { toast('.xlsx 또는 .xls 파일만 지원합니다.', 'error'); return; }

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!raw.length) { toast('파일에 데이터가 없습니다.', 'warning'); return; }

    /* 컬럼 매핑 확인 */
    const headers = Object.keys(raw[0]);
    const missing = REQUIRED.filter(r => !headers.includes(r));
    if (missing.length) {
      toast(`필수 컬럼 누락: ${missing.join(', ')}`, 'error');
      return;
    }

    const existing = await Assets.list();
    const existCodes = new Set(existing.map(a => a.asset_code));

    parsedRows = raw.map(row => {
      const mapped = {};
      for (const [kr, en] of Object.entries(FIELD_MAP)) {
        if (row[kr] !== undefined) mapped[en] = String(row[kr]).trim();
      }

      const errors = [];
      const warns  = [];

      /* 오류 검증 */
      if (!mapped.asset_name)    errors.push('자산명 누락');
      if (!mapped.item_category) errors.push('품목 누락');
      if (!mapped.floor)         errors.push('층 누락');
      else if (!FLOORS.includes(mapped.floor)) errors.push(`층 값 오류(${mapped.floor})`);
      if (!mapped.department)    errors.push('담당부서 누락');
      if (mapped.status && !STATUS_OK.includes(mapped.status)) errors.push(`상태 값 오류(${mapped.status})`);
      if (mapped.asset_code && existCodes.has(mapped.asset_code)) errors.push('자산코드 중복');

      /* 경고 검증 */
      if (!mapped.manager)       warns.push('담당자 미입력');
      if (!mapped.acquired_date) warns.push('취득일 미입력');
      if (!mapped.asset_code)    warns.push('코드 자동 생성 예정');

      const level = errors.length ? 'err' : warns.length ? 'warn' : 'ok';
      const msg   = [...errors, ...warns].join(' · ');
      return { ...mapped, _level: level, _msg: msg };
    });

    renderPreview(root, parsedRows, headers);
  }
}

function renderPreview(root, rows, headers) {
  const cntOk   = rows.filter(r => r._level === 'ok').length;
  const cntWarn = rows.filter(r => r._level === 'warn').length;
  const cntErr  = rows.filter(r => r._level === 'err').length;

  root.querySelector('#cntOk').textContent   = cntOk;
  root.querySelector('#cntWarn').textContent = cntWarn;
  root.querySelector('#cntErr').textContent  = cntErr;

  /* 표 헤더 */
  const mappedHeaders = headers.filter(h => FIELD_MAP[h]).map(h => FIELD_MAP[h]);
  root.querySelector('#previewHead').innerHTML =
    `<th>#</th>` + mappedHeaders.map(h => `<th>${korLabel(h)}</th>`).join('') + `<th>검증</th>`;

  /* 표 바디 */
  root.querySelector('#previewBody').innerHTML = rows.map((r, i) => {
    const rowCls = r._level === 'ok' ? 'row-ok' : r._level === 'warn' ? 'row-warn' : 'row-err';
    const icon   = r._level === 'ok' ? '<i class="fas fa-check text-green-600"></i>'
      : r._level === 'warn' ? '<i class="fas fa-triangle-exclamation text-amber-500"></i>'
      : '<i class="fas fa-xmark text-red-500"></i>';
    const cells  = mappedHeaders.map(h => `<td>${r[h] ?? ''}</td>`).join('');
    return `<tr class="${rowCls}"><td class="text-slate-400">${i+1}</td>${cells}<td><div class="flex items-start gap-1">${icon}<span class="row-msg">${r._msg || ''}</span></div></td></tr>`;
  }).join('');

  /* 경고 체크박스 */
  const warnArea = root.querySelector('#warnConfirmArea');
  if (cntWarn > 0) warnArea.classList.remove('hidden');
  else warnArea.classList.add('hidden');

  root.querySelector('#previewSection').classList.remove('hidden');
}

function korLabel(en) {
  const rev = Object.fromEntries(Object.entries({
    '자산코드':'asset_code','자산명':'asset_name','품목':'item_category',
    '층':'floor','실':'room','담당부서':'department','담당자':'manager',
    '취득일자':'acquired_date','상태':'status','비고':'note'
  }).map(([k,v]) => [v,k]));
  return rev[en] || en;
}

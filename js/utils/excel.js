/* 엑셀 내보내기 공통 헬퍼 */
import { toast } from '../ui/toast.js';

/* 문자열 표시 폭 계산 (한글 = 2.4, ASCII = 1) */
function cw(val) {
  return [...String(val ?? '')].reduce((s, c) => s + (c.charCodeAt(0) > 127 ? 2.4 : 1), 0);
}

/* JSON 배열 → 워크시트 (열 너비 자동) */
function jsonSheet(rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (rows.length) {
    const keys = Object.keys(rows[0]);
    ws['!cols'] = keys.map(k => ({
      wch: Math.min(Math.max(cw(k), rows.reduce((m, r) => Math.max(m, cw(r[k])), 0)) + 1, 52)
    }));
  }
  return ws;
}

/* 2차원 배열 → 워크시트 (열 너비 자동) */
function aoaSheet(rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  if (rows.length) {
    const cols = rows[0].length;
    ws['!cols'] = Array.from({ length: cols }, (_, i) => ({
      wch: Math.min(rows.reduce((m, r) => Math.max(m, cw(r[i])), 0) + 1, 52)
    }));
  }
  return ws;
}

function xlsxCheck() {
  if (typeof XLSX === 'undefined') {
    toast('Excel 라이브러리를 불러올 수 없습니다.', 'error');
    return false;
  }
  return true;
}

/* data: URL 방식 다운로드 — blob: URL은 다운로드 매니저가 가로채 UUID로 저장하는 문제 우회 */
function blobDownload(wb, fileName) {
  /* Legacy Edge (pre-Chromium) */
  if (navigator.msSaveBlob) {
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    navigator.msSaveBlob(
      new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      fileName
    );
    return;
  }
  const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href     = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + base64;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => document.body.removeChild(a), 300);
}

export function writeXlsx(rows, sheetName, fileName) {
  if (!xlsxCheck()) return;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, jsonSheet(rows), sheetName);
  blobDownload(wb, fileName);
}

export function writeAoaXlsx(rows, sheetName, fileName) {
  if (!xlsxCheck()) return;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, aoaSheet(rows), sheetName);
  blobDownload(wb, fileName);
}

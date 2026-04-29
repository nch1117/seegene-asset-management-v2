/* 해시 라우터 + 가드 */
import { isAdmin } from './auth.js';
import { toast } from './ui/toast.js';

import { renderDashboard } from './views/dashboard.js';
import { renderAssetSearch, renderAssetList, renderAssetRegister } from './views/assets.js';
import { renderMoveRequest, renderMyRequests, renderApproveRequests, renderMoveHistory } from './views/moves.js';
import { renderFloorplan } from './views/floorplan.js';
import { renderExcelUpload } from './views/excel-upload.js';
import { renderQR } from './views/qr.js';
import { renderDisposal } from './views/disposal.js';
import { renderSettings } from './views/settings.js';
import { renderGuide } from './views/guide.js';

const ROUTES = {
  dashboard:        { title: '대시보드',         render: renderDashboard,        admin: false },
  assetSearch:      { title: '자산 검색',        render: renderAssetSearch,      admin: false },
  moveRequest:      { title: '자산 이동 신청',   render: renderMoveRequest,      admin: false },
  myRequests:       { title: '내 신청 내역',     render: renderMyRequests,       admin: false },
  guide:            { title: '사용 가이드',      render: renderGuide,            admin: false },
  register:         { title: '자산 등록',        render: renderAssetRegister,    admin: true  },
  assetList:        { title: '자산 목록',        render: renderAssetList,        admin: true  },
  approveRequests:  { title: '이동 신청 승인',   render: renderApproveRequests,  admin: true  },
  moveHistory:      { title: '이동 이력',        render: renderMoveHistory,      admin: true  },
  floorplan:        { title: '평면도 위치관리',  render: renderFloorplan,        admin: true  },
  excelUpload:      { title: '자산 일괄 업로드', render: renderExcelUpload,      admin: true  },
  qr:               { title: 'QR 라벨',          render: renderQR,               admin: true  },
  disposal:         { title: '폐기 자산 대장',    render: renderDisposal,         admin: true  },
  settings:         { title: '설정',              render: renderSettings,         admin: true  }
};

export function getRoutes() { return ROUTES; }

export function navigate(name) {
  if (location.hash !== '#' + name) {
    location.hash = name;
  } else {
    handleRoute();
  }
}

let currentRouteName = null;

export function handleRoute() {
  const hash = location.hash.replace(/^#/, '') || 'dashboard';
  const route = ROUTES[hash];
  if (!route) {
    toast('알 수 없는 페이지입니다.', 'warning');
    location.hash = 'dashboard';
    return;
  }
  if (route.admin && !isAdmin()) {
    toast('관리자 로그인이 필요합니다.', 'warning');
    location.hash = 'dashboard';
    return;
  }

  currentRouteName = hash;
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = route.title;

  const root = document.getElementById('pageRoot');
  if (root) {
    root.classList.remove('fade-in');
    void root.offsetWidth;
    root.classList.add('fade-in');
    Promise.resolve(route.render(root)).catch(err => {
      console.error('[router] render error', err);
      root.innerHTML = `<div class="card"><p class="text-red-500">페이지를 불러오는 중 오류가 발생했습니다.</p></div>`;
    });
  }

  // 사이드바 active
  document.querySelectorAll('.side-link').forEach(a => {
    a.classList.toggle('active', a.dataset.route === hash);
  });
}

export function currentRoute() { return currentRouteName; }

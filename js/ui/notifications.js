/* 알림 센터 — 이동대기 · 수리지연 · 노후자산 */
import { Assets, MoveRequests, RepairHistory } from '../store.js';
import { isAdmin } from '../auth.js';

const REPAIR_DELAY_DAYS = 7;

async function collect() {
  const [assets, requests, repairs] = await Promise.all([
    Assets.list(), MoveRequests.list(), RepairHistory.list()
  ]);

  const items = [];

  /* 1. 이동 신청 대기 */
  const pending = requests.filter(r => r.status === '대기');
  if (pending.length) items.push({
    id: 'pending',
    icon: 'fa-paper-plane',
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    title: `이동 신청 대기 ${pending.length}건`,
    desc: '승인 대기 중인 신청이 있습니다.',
    route: 'approveRequests',
    count: pending.length
  });

  /* 2. 수리 지연 (N일 초과 진행중) */
  const delayed = repairs.filter(r => {
    if (r.status !== '진행중') return false;
    return (Date.now() - r.reported_at) / 86400000 > REPAIR_DELAY_DAYS;
  });
  if (delayed.length) items.push({
    id: 'repair',
    icon: 'fa-wrench',
    color: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    title: `수리 지연 ${delayed.length}건`,
    desc: `${REPAIR_DELAY_DAYS}일 이상 완료되지 않은 수리가 있습니다.`,
    route: 'repair',
    count: delayed.length
  });

  /* 3. 노후 자산 7년↑ (위험) */
  const age7 = assets.filter(a => {
    if (a.status === '폐기' || !a.acquired_date) return false;
    return (Date.now() - new Date(a.acquired_date).getTime()) / (365.25 * 86400000) >= 7;
  });
  if (age7.length) items.push({
    id: 'age7',
    icon: 'fa-triangle-exclamation',
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-900/20',
    title: `노후 자산 ${age7.length}건 (7년↑)`,
    desc: '교체 또는 폐기 검토가 필요합니다.',
    route: 'report',
    count: age7.length
  });

  /* 4. 노후 자산 5~7년 (주의) */
  const age5 = assets.filter(a => {
    if (a.status === '폐기' || !a.acquired_date) return false;
    const yrs = (Date.now() - new Date(a.acquired_date).getTime()) / (365.25 * 86400000);
    return yrs >= 5 && yrs < 7;
  });
  if (age5.length) items.push({
    id: 'age5',
    icon: 'fa-clock',
    color: 'text-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    title: `노후 주의 자산 ${age5.length}건 (5~7년)`,
    desc: '교체 계획 수립을 권장합니다.',
    route: 'report',
    count: age5.length
  });

  return items;
}

let _refreshFn = null;
export function refreshNotifications() { _refreshFn?.(); }

export function initNotifications() {
  const btn    = document.getElementById('notifBtn');
  const panel  = document.getElementById('notifPanel');
  const badge  = document.getElementById('notifBadge');
  const list   = document.getElementById('notifList');
  const reload = document.getElementById('notifRefresh');
  if (!btn || !panel) return;

  async function refresh() {
    if (!isAdmin()) { btn.classList.add('hidden'); return; }
    btn.classList.remove('hidden');

    const items = await collect();
    const total = items.reduce((s, n) => s + n.count, 0);

    badge.textContent = total;
    badge.classList.toggle('hidden', total === 0);
    if (total > 0) btn.classList.add('notif-btn--has');
    else btn.classList.remove('notif-btn--has');

    if (!items.length) {
      list.innerHTML = `
        <div class="py-10 text-center text-sm text-slate-400">
          <i class="fas fa-check-circle text-green-400 text-3xl mb-3 block"></i>
          새 알림이 없습니다.
        </div>`;
      return;
    }

    list.innerHTML = items.map(n => `
      <button class="notif-item" data-route="${n.route}">
        <span class="notif-icon ${n.bg}"><i class="fas ${n.icon} ${n.color}"></i></span>
        <span class="flex-1 min-w-0 text-left">
          <span class="block font-semibold text-sm text-slate-800 dark:text-slate-100">${n.title}</span>
          <span class="block text-xs text-slate-500 mt-0.5">${n.desc}</span>
        </span>
        <i class="fas fa-chevron-right text-slate-300 text-xs shrink-0"></i>
      </button>`).join('');

    list.querySelectorAll('.notif-item').forEach(el => {
      el.addEventListener('click', () => {
        closePanel();
        location.hash = el.dataset.route;
      });
    });
  }

  function openPanel() {
    panel.classList.remove('hidden');
    refresh();
    setTimeout(() => document.addEventListener('click', outsideClick), 0);
  }

  function closePanel() {
    panel.classList.add('hidden');
    document.removeEventListener('click', outsideClick);
  }

  function outsideClick(e) {
    if (!panel.contains(e.target) && !btn.contains(e.target)) closePanel();
  }

  btn.addEventListener('click', e => {
    e.stopPropagation();
    panel.classList.contains('hidden') ? openPanel() : closePanel();
  });

  reload?.addEventListener('click', e => { e.stopPropagation(); refresh(); });

  _refreshFn = refresh;
  refresh();
  setInterval(refresh, 60_000);
}

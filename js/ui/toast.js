/* 토스트 알림 */
const root = () => document.getElementById('toastRoot');

const ICONS = {
  info:    'fa-circle-info',
  success: 'fa-circle-check',
  warning: 'fa-triangle-exclamation',
  error:   'fa-circle-xmark'
};

export function toast(message, type = 'info', duration = 2600) {
  const r = root();
  if (!r) return;
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `<i class="fas ${ICONS[type] || ICONS.info}"></i><span>${message}</span>`;
  r.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s, transform .3s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

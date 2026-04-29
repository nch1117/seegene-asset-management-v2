/* 설정 — 비밀번호 변경 */
import { sha256 } from '../auth.js';
import { toast } from '../ui/toast.js';
import { isAdmin, getSession } from '../auth.js';

/* auth.js의 RAW_CREDENTIALS는 메모리에 있어 런타임 변경만 가능.
   실제 운영 시 서버 API 교체 필요. 여기서는 localStorage에 override 저장. */
const PW_OVERRIDE_KEY = 'sgm2_pw_override';

export function getPwOverrides() {
  try { return JSON.parse(localStorage.getItem(PW_OVERRIDE_KEY) || '{}'); } catch { return {}; }
}

export async function checkCurrentPw(id, pw) {
  const overrides = getPwOverrides();
  const hash = await sha256(pw);
  if (overrides[id]) return overrides[id] === hash;
  /* 기본 비밀번호 해시 */
  const defaults = { admin: await sha256('Seegene2025!'), manager: await sha256('Manager!23') };
  return defaults[id] === hash;
}

export async function renderSettings(root) {
  if (!isAdmin()) return;
  const session = getSession();
  const id = session?.adminId || 'admin';

  root.innerHTML = `
    <div class="max-w-lg space-y-4">
      <div class="card">
        <h3 class="font-semibold mb-4"><i class="fas fa-key mr-1 text-brand-500"></i>비밀번호 변경</h3>
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">
          현재 계정: <span class="font-semibold text-slate-700 dark:text-slate-200">${session?.adminName || id}</span>
        </p>
        <form id="pwForm" class="space-y-4">
          <div>
            <label class="block text-sm mb-1">현재 비밀번호 <span class="text-red-500">*</span></label>
            <div class="relative">
              <input id="curPw" type="password" class="input pr-10" required />
              <button type="button" class="pw-toggle absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 px-2 py-1">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>
          <div>
            <label class="block text-sm mb-1">새 비밀번호 <span class="text-red-500">*</span></label>
            <div class="relative">
              <input id="newPw" type="password" class="input pr-10" required minlength="8"
                placeholder="8자 이상, 영문+숫자+특수문자" />
              <button type="button" class="pw-toggle absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 px-2 py-1">
                <i class="fas fa-eye"></i>
              </button>
            </div>
            <div id="pwStrengthBar" class="mt-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div id="pwStrengthFill" class="h-full transition-all" style="width:0%"></div>
            </div>
            <p id="pwStrengthLabel" class="text-xs text-slate-400 mt-0.5"></p>
          </div>
          <div>
            <label class="block text-sm mb-1">새 비밀번호 확인 <span class="text-red-500">*</span></label>
            <div class="relative">
              <input id="confirmPw" type="password" class="input pr-10" required />
              <button type="button" class="pw-toggle absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 px-2 py-1">
                <i class="fas fa-eye"></i>
              </button>
            </div>
            <p id="confirmMsg" class="text-xs mt-0.5 hidden"></p>
          </div>
          <p id="pwError" class="text-sm text-red-500 hidden"></p>
          <div class="flex justify-end">
            <button type="submit" class="btn-primary"><i class="fas fa-save mr-1"></i>변경 저장</button>
          </div>
        </form>
      </div>
    </div>
  `;

  /* 비밀번호 보기 토글 */
  root.querySelectorAll('.pw-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      const icon  = btn.querySelector('i');
      if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
      } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
      }
    });
  });

  /* 강도 미터 */
  root.querySelector('#newPw').addEventListener('input', e => {
    const pw = e.target.value;
    const score = pwScore(pw);
    const fill = root.querySelector('#pwStrengthFill');
    const label = root.querySelector('#pwStrengthLabel');
    const colors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'];
    const labels = ['', '매우 약함', '약함', '보통', '강함'];
    fill.style.width = `${score * 25}%`;
    fill.style.background = colors[score] || '';
    label.textContent = labels[score] || '';
    label.style.color = colors[score] || '';
  });

  /* 비밀번호 일치 확인 */
  root.querySelector('#confirmPw').addEventListener('input', () => {
    const np = root.querySelector('#newPw').value;
    const cp = root.querySelector('#confirmPw').value;
    const msg = root.querySelector('#confirmMsg');
    if (!cp) { msg.classList.add('hidden'); return; }
    msg.classList.remove('hidden');
    if (np === cp) { msg.textContent = '✓ 일치합니다'; msg.style.color = '#16a34a'; }
    else           { msg.textContent = '✗ 일치하지 않습니다'; msg.style.color = '#ef4444'; }
  });

  /* 폼 제출 */
  root.querySelector('#pwForm').addEventListener('submit', async e => {
    e.preventDefault();
    const curPw     = root.querySelector('#curPw').value;
    const newPw     = root.querySelector('#newPw').value;
    const confirmPw = root.querySelector('#confirmPw').value;
    const errEl     = root.querySelector('#pwError');

    if (newPw !== confirmPw) {
      errEl.textContent = '새 비밀번호가 일치하지 않습니다.';
      errEl.classList.remove('hidden'); return;
    }
    if (pwScore(newPw) < 2) {
      errEl.textContent = '비밀번호가 너무 약합니다. 영문+숫자+특수문자를 포함해주세요.';
      errEl.classList.remove('hidden'); return;
    }

    const ok = await checkCurrentPw(id, curPw);
    if (!ok) {
      errEl.textContent = '현재 비밀번호가 틀립니다.';
      errEl.classList.remove('hidden');
      root.querySelector('#curPw').value = '';
      return;
    }

    const newHash = await sha256(newPw);
    const overrides = getPwOverrides();
    overrides[id] = newHash;
    localStorage.setItem(PW_OVERRIDE_KEY, JSON.stringify(overrides));
    errEl.classList.add('hidden');
    toast('비밀번호가 변경되었습니다.', 'success');
    e.target.reset();
    root.querySelector('#pwStrengthFill').style.width = '0%';
    root.querySelector('#pwStrengthLabel').textContent = '';
    root.querySelector('#confirmMsg').classList.add('hidden');
  });
}

function pwScore(pw) {
  let s = 0;
  if (pw.length >= 8)          s++;
  if (/[a-zA-Z]/.test(pw))     s++;
  if (/[0-9]/.test(pw))        s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  return s;
}

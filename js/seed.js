/* 초기 더미 데이터 시드 (최초 1회) */
import { Assets, count } from './store.js';

const SEED_FLAG = 'sgm2_seeded';

const FLOORS = ['2층', '3층', '4층', '5층', '6층', '7층'];
const ITEMS = ['PC', '모니터', '의자', '책상', '프린터', '복합기'];
const DEPTS = ['진단검사부', '병리검사부', '운영관리팀', '영업팀', '품질관리팀'];
const STATUSES = ['정상', '정상', '정상', '정상', '수리중', '폐기'];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pad(n, w = 4) { return String(n).padStart(w, '0'); }

export async function seedIfEmpty() {
  if (localStorage.getItem(SEED_FLAG) === '1') return;
  const c = await count('assets');
  if (c > 0) {
    localStorage.setItem(SEED_FLAG, '1');
    return;
  }

  const today = new Date();
  const tasks = [];
  for (let i = 1; i <= 60; i++) {
    const item = rand(ITEMS);
    const acquired = new Date(today.getTime() - Math.random() * 365 * 3 * 86400000);
    tasks.push(Assets.add({
      item_category: item,
      asset_name: `${item} #${i}`,
      asset_code: `SGM-${item.slice(0, 2).toUpperCase()}-${pad(i)}`,
      acquired_date: acquired.toISOString().slice(0, 10),
      floor: rand(FLOORS),
      room: `${Math.floor(Math.random() * 20) + 1}호`,
      department: rand(DEPTS),
      manager: '담당자' + (Math.floor(Math.random() * 5) + 1),
      status: rand(STATUSES),
      pos_x: 0, pos_y: 0,
      note: ''
    }));
  }
  await Promise.all(tasks);
  localStorage.setItem(SEED_FLAG, '1');
}

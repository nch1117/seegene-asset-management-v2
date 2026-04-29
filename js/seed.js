/* 초기 더미 데이터 시드 (최초 1회) */
import { Assets, count } from './store.js';

const SEED_FLAG = 'sgm2_seeded_v3';

const FLOORS = ['2층', '3층', '4층', '5층', '6층', '7층'];
const ITEMS  = ['PC', '모니터', '의자', '책상', '프린터', '복합기', '노트북', '서버', '냉장고', '전화기'];
const DEPTS  = ['진단검사부', '병리검사부', '운영관리팀', '영업팀', '품질관리팀', '고객지원팀', '연구개발팀'];
const STATUSES = ['정상', '정상', '정상', '정상', '정상', '수리중', '수리중', '폐기'];
const MAKERS = ['삼성', 'LG', '델', 'HP', '레노버', '애플', '소니', '파나소닉'];
const ROOMS  = ['101호', '102호', '201호', '202호', '301호', '302호', '회의실A', '회의실B', '서버실', '창고'];

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
  for (let i = 1; i <= 100; i++) {
    const item = rand(ITEMS);
    const maker = rand(MAKERS);
    const acquired = new Date(today.getTime() - Math.random() * 365 * 5 * 86400000);
    const cat = item.slice(0, 2).toUpperCase();
    tasks.push(Assets.add({
      item_category: item,
      asset_name:    `${maker} ${item} ${pad(i, 3)}`,
      asset_code:    `SGM-${cat}-${pad(i)}`,
      acquired_date: acquired.toISOString().slice(0, 10),
      floor:         rand(FLOORS),
      room:          rand(ROOMS),
      department:    rand(DEPTS),
      manager:       '담당자' + (Math.floor(Math.random() * 7) + 1),
      status:        rand(STATUSES),
      maker,
      model:         `Model-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      serial:        `SN-${Date.now().toString(36).toUpperCase()}-${pad(i, 3)}`,
      pos_x: null, pos_y: null,
      note: ''
    }));
  }
  await Promise.all(tasks);
  localStorage.setItem(SEED_FLAG, '1');
}

# 씨젠의료재단 자산관리시스템 v2

대구경북검사센터 자산관리시스템의 재구축 버전입니다. v1의 검증된 요구사항을 그대로 가져오면서 **모듈화 / 모바일 / 다크모드 / IndexedDB**를 새로 도입했습니다.

## 빠른 시작

별도 빌드 없이 바로 실행:

```bash
# 어떤 정적 파일 서버라도 가능
npx serve .
# 또는
python -m http.server 5500
```

브라우저에서 `http://localhost:5500/index.html` 열기.

> **주의**: ES 모듈을 사용하므로 `file://`로 직접 열면 동작하지 않습니다. 반드시 정적 서버를 통해 열어주세요.

## 기본 계정

| 아이디 | 비밀번호 | 이름 |
|--------|----------|------|
| admin | Seegene2025! | 운영관리팀 관리자 |
| manager | Manager!23 | 자산담당 매니저 |

## 폴더 구조

```
index.html              메인 페이지
css/style.css           Tailwind 보완 컴포넌트
js/
  main.js               진입점 (화면 토글, 이벤트 바인딩)
  auth.js               SHA-256 로그인, 8h 세션
  store.js              IndexedDB 래퍼 (4개 스토어)
  router.js             해시 라우터 + 가드
  seed.js               초기 더미 데이터 (60건)
  ui/
    toast.js            토스트 알림
  views/
    dashboard.js        대시보드 (KPI, 차트, 교차분석)
    assets.js           자산 검색·등록·목록
    moves.js            이동 신청·승인·이력
    floorplan.js        평면도 (스텁)
    guide.js            사용 가이드
```

## v1 대비 변경

| 영역 | v1 | v2 |
|------|-----|-----|
| 코드 구조 | 단일 파일 (app.js 1,915줄) | ES6 모듈 분리 |
| 스타일 | style.css 3,434줄 | Tailwind + 보완 CSS |
| 데이터 | localStorage / RESTful Table API | IndexedDB |
| UI | 라이트만 | 라이트 + 다크 |
| 반응형 | 데스크톱 위주 | 모바일 사이드바 토글 |

## 향후 작업 (v2.x)

- [ ] 평면도 핀 배치 + 모바일 터치
- [ ] QR 생성/스캔 (qr.js 이식)
- [ ] 엑셀 일괄 업로드 (excel-upload.js 이식)
- [ ] 비밀번호 변경 UI
- [ ] 자산 상세 모달 + 수정
- [ ] 폐기 처리 화면

## 라이선스

내부용.

# 컬처데이 월별 배정 (사다리타기)

팀 멤버를 상반기/하반기 6개월에 사다리타기 애니메이션으로 배정하고, 결과를
연도·반기별로 영구 보관·조회·리플레이하는 정적 웹앱입니다.

- 빌드 단계 없음 (바닐라 HTML/CSS/JS)
- 팀 공유 저장은 Firebase Firestore (무료 티어) 사용
- GitHub Pages 정적 배포

## 배정 규칙

N명을 6개월에 분배할 때, 앞쪽 달부터 채웁니다.
- `base = floor(N/6)`, `rem = N%6`
- 앞쪽 `rem`개 달은 `base+1`명, 나머지는 `base`명
- 예) 15명 → 3,3,3,2,2,2 / 17명 → 3,3,3,3,3,2

## 로컬 실행

```bash
python3 -m http.server 8000
# http://localhost:8000 접속
```

Firebase를 설정하지 않은 상태에서는 자동으로 **localStorage(로컬 전용)**로 동작합니다.
이 경우 결과는 그 브라우저에만 저장되며 팀원과 공유되지 않습니다(사이드바 하단에
`⚠ 로컬 전용` 배지 표시).

## Firebase 설정 (팀 공유 활성화)

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트 생성
2. **Build ▸ Firestore Database ▸ 데이터베이스 만들기** (위치 선택 후 생성)
3. **프로젝트 설정 ▸ 일반 ▸ 내 앱 ▸ 웹앱 추가(`</>`)** 로 웹앱 등록
4. 표시되는 `firebaseConfig` 값을 [`js/firebase-config.js`](js/firebase-config.js)의
   placeholder에 붙여넣기 (이 값들은 공개되어도 안전 — 클라이언트용)
5. 페이지를 새로고침하면 사이드바에 `☁ 팀 공유 (Firestore)` 배지가 표시됩니다.

### Firestore 보안 규칙

내부 팀 도구라 기본은 단순함을 우선합니다. 가장 간단한(완전 공개) 규칙:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if true; }
  }
}
```

> ⚠ 위 규칙은 URL을 아는 누구나 읽기/쓰기가 가능합니다. 사내 비공개 사용에는
> 무난하지만, 공개 배포 시에는 Firebase Anonymous Auth 또는 앱 단 공유 비밀번호
> 등 최소한의 보호를 추가하는 것을 권장합니다.

## GitHub Pages 배포

저장소 push 후 **Settings ▸ Pages ▸ Source: main / (root)** 로 설정하면 배포됩니다.
빌드 과정이 없으므로 별도 워크플로 없이 정적 파일이 그대로 서빙됩니다.

## 데이터 모델 (Firestore)

- `config/members` — `{ names: string[] }`
- `assignments/{id}` — `{ year, half, createdAt, names[], monthCounts[], slotMonths[], rungs[], rows, result }`
  - `rungs`(사다리 가로줄)를 저장하므로 히스토리에서 동일 애니메이션 **재현(리플레이)** 가능

## 파일 구성

- `index.html` — 마크업
- `styles.css` — 스타일
- `js/ladder.js` — 분배 계산·사다리 생성/주행·Canvas 애니메이션·리플레이
- `js/db.js` — Firestore/localStorage 추상화 계층
- `js/firebase-config.js` — Firebase config (직접 채워넣기)
- `js/app.js` — 멤버 관리·실행·히스토리·결과 렌더

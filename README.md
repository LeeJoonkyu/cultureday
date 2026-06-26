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

### 관리자 인증 설정 (v1.1)

쓰기(멤버 저장·배정 확정·삭제·관리자 변경)는 관리자만 가능합니다. 관리자는
`config/admins` 문서의 `emails` 배열로 관리되며, Google 로그인으로 인증합니다.

1. **Authentication → 시작하기 → 로그인 방법 → Google** 사용 설정
2. **Authentication → 설정 → 승인된 도메인 → 도메인 추가 →** `leejoonkyu.github.io`
   (무료. localhost·*.firebaseapp.com은 기본 등록)
3. **Firestore → 데이터** → `config` 컬렉션에 문서 ID `admins` 생성 →
   필드 `emails`(array) = `["ljk6463@gmail.com"]` (최초 관리자 시드)
   - 이후 관리자 추가/제거는 앱의 "관리자 관리" 패널에서(재배포 불필요)

### Firestore 보안 규칙

**읽기는 전체 공개, 쓰기는 관리자 전용.** Firestore → 규칙 탭에 붙여넣고 게시:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null
        && request.auth.token.email in
           get(/databases/$(database)/documents/config/admins).data.emails;
    }
    match /config/members { allow read: if true; allow write: if isAdmin(); }
    match /config/admins  { allow read: if true; allow write: if isAdmin(); }
    match /assignments/{id} {
      allow read: if true;
      allow create, delete: if isAdmin();
    }
  }
}
```

> 서버 규칙이 모든 쓰기를 강제하므로, URL을 알아도 외부인은 DB를 변경할 수 없습니다.
> (이메일 클레임 위조 불가, 자기 자신을 관리자로 추가 불가, admins 미시드 시 fail-closed.)
> Email/Password 제공업체는 켜지 마세요(미검증 이메일 가입 경로 차단). 읽기는 공개이므로
> 명단·히스토리·관리자 이메일 *조회*는 가능합니다(변경 불가) — 민감하면 admins read를
> `if request.auth != null`로 좁힐 수 있습니다.

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

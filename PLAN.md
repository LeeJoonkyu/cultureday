# PLAN.md

> **버전 규칙**
> - 계획이 승인·구현되었을 때만 버전을 올린다.
> - Revision History 표에 한 줄 요약을 추가한다.
> - 본문은 항상 최신 버전 기준으로 제자리에서 재작성한다(과거 버전 본문은 보관하지 않음).

## Revision History

| Version | Date       | Summary |
|---------|------------|---------|
| 1.0     | 2026-06-26 | 컬처데이 월별 배정 웹앱 초기 구현 (분배·사다리 애니메이션·Firestore 히스토리·리플레이) |
| 1.1     | 2026-06-26 | 관리자 인증(Google·Firestore admins 목록)·시작/확정 분리·멤버 저장 확정·삭제 권한·반기당 1회 확정·보안 규칙 |

---

## v1.1 — 관리자 인증 + 시작/확정 분리

### 목적

배포 후 실사용 요구를 반영해 쓰기 권한을 관리자로 일원화하고, "재미 실행(시작)"과
"확정 저장"을 분리한다.

### 핵심 결정

- **관리자 = Firestore 데이터**: `config/admins` 문서 `emails[]`가 단일 출처. 하드코딩
  없이 앱(또는 콘솔)에서 추가/제거 → 오너 이전·복수 관리자 지원, 재배포 불필요.
  최초 1회만 콘솔에서 시드(`["ljk6463@gmail.com"]`).
- **Google 로그인**(Firebase Auth)으로 관리자 식별. `request.auth.token.email`을
  `config/admins.emails`와 대조.
- **시작/확정 분리**: `시작`은 누구나(애니메이션·결과 표시, 저장 안 함). `확정 저장`은
  관리자만 → 히스토리 저장. 같은 연도+반기는 1회만 확정(중복 시 경고).
- **멤버 로컬 편집 + 관리자 저장**: 누구나 로컬에서 멤버 편집·`시작` 가능, DB 반영
  (`멤버 저장(확정)`)은 관리자만.
- **삭제 버튼**은 관리자 로그인 시에만 노출. 조회·리플레이는 누구나.
- **잠금 방지**: 마지막 관리자 1명은 제거 불가.

### 보안 규칙 (읽기 공개 · 쓰기 관리자 전용)

```
function isAdmin() {
  return request.auth != null
    && request.auth.token.email in
       get(/databases/$(database)/documents/config/admins).data.emails;
}
match /config/members { allow read: if true; allow write: if isAdmin(); }
match /config/admins  { allow read: if true; allow write: if isAdmin(); }
match /assignments/{id} { allow read: if true; allow create, delete: if isAdmin(); }
```
서버 규칙이 모든 write를 강제 → URL을 알아도 외부인은 DB 변경 불가, 자기 자신을
관리자로 추가 불가, 이메일 클레임 위조 불가, 부트스트랩 fail-closed.

### 데이터 모델 추가

- `config/admins` — `{ emails: string[] }`

### 콘솔 수동 설정 (1회)

1. Authentication → Google 제공업체 사용 설정
2. Authentication → 설정 → 승인된 도메인에 `leejoonkyu.github.io` 추가(무료)
3. Firestore → `config/admins` 문서에 `emails:["ljk6463@gmail.com"]` 시드
4. Firestore → 규칙에 위 규칙 게시

### 파일 변경

- `js/firebase-config.js` — `OWNER_EMAIL`(시드 참고값)
- `js/db.js` — Auth(Google) + `getAdmins`/`saveAdmins`
- `js/app.js` — 로그인·멤버저장·배정확정 버튼, 관리자 관리 UI, `isOwner` 기반 활성/노출,
  멤버 로컬 편집, 시작=저장안함, 반기 중복 확정 차단
- `index.html` / `styles.css` — 신규 버튼·관리자 패널 UI

### 검증

- 로그아웃: `시작` 가능, 멤버저장·배정확정 비활성, 삭제·관리자 UI 숨김 (헤드리스 확인).
- 관리자 로그인: 멤버저장·확정·삭제·관리자관리 동작, 반기 중복 확정 경고, 관리자 추가
  시 그 계정도 권한 획득(재배포 없이). (실제 Google 로그인은 사용자 확인.)

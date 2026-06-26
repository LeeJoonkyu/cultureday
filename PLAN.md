# PLAN.md

> **버전 규칙**
> - 계획이 승인·구현되었을 때만 버전을 올린다.
> - Revision History 표에 한 줄 요약을 추가한다.
> - 본문은 항상 최신 버전 기준으로 제자리에서 재작성한다(과거 버전 본문은 보관하지 않음).

## Revision History

| Version | Date       | Summary |
|---------|------------|---------|
| 1.0     | 2026-06-26 | 컬처데이 월별 배정 웹앱 초기 구현 (분배·사다리 애니메이션·Firestore 히스토리·리플레이) |

---

## v1.0 — 컬처데이 월별 배정 웹앱

### 목적

팀 멤버를 상반기/하반기 6개월에 배정한다. 앞쪽 달부터 인원을 많이 채우고
(`base+1`), 뒤쪽은 적게(`base`) 배정하며, 배정 과정을 사다리타기 애니메이션으로
보여주고 결과를 연도·반기별로 영구 보관·조회·리플레이한다.

### 핵심 결정

- 바닐라 HTML/CSS/JS, 빌드 없음 → GitHub Pages 정적 배포
- 팀 공유 저장: Firebase Firestore (미설정 시 localStorage 자동 폴백)
- 상/하반기 독립 실행, 멤버 명단 상시 수정·재실행
- 순수 랜덤 배정 + 사다리 가로줄(rungs) 저장으로 리플레이 재현

### 분배 알고리즘

`base = floor(N/6)`, `rem = N%6` → 앞쪽 `rem`개 달 `base+1`명, 나머지 `base`명.
검증: 15→[3,3,3,2,2,2], 17→[3,3,3,3,3,2], 12→[2,2,2,2,2,2], 18→[3,3,3,3,3,3].

### 사다리

상단 N레인 → 하단 N슬롯(월 라벨, count만큼 반복)의 1:1 대응으로 각 달 인원 보장.
amidakuji 규칙(인접 가로줄 비겹침)으로 rungs 무작위 생성, 결정적 주행으로 결과 산출.
Canvas + requestAnimationFrame으로 토큰이 동시에 내려가는 애니메이션. 저장된 rungs로
동일 애니메이션 리플레이.

### 데이터 모델 (Firestore)

- `config/members` — `{ names: string[] }`
- `assignments/{id}` — `{ year, half, createdAt, names[], monthCounts[], slotMonths[], rungs[], rows, result }`

### 파일

- `index.html`, `styles.css`
- `js/ladder.js` — 분배·사다리·애니메이션·리플레이
- `js/db.js` — Firestore/localStorage 추상화
- `js/firebase-config.js` — Firebase config
- `js/app.js` — 멤버 관리·실행·히스토리·결과 렌더

### 검증

- 분배: N=15/17/12/18에서 monthCounts 기대값 일치
- 사다리: 상↔하 1:1 대응(중복·누락 없음), 달별 인원 = monthCounts
- 애니메이션/리플레이/영속성/공유 동작 확인 (`python3 -m http.server`)

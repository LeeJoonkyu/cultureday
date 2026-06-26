// Firebase 프로젝트 설정값. 아래 placeholder를 본인 Firebase 웹앱 config로 교체하세요.
// 이 값들은 공개되어도 안전합니다(클라이언트용). 접근 제어는 Firestore 보안 규칙으로 합니다.
// 설정 방법은 README.md 참고. placeholder 상태이면 앱은 자동으로 localStorage(로컬 전용)로 동작합니다.

export const firebaseConfig = {
  apiKey: 'AIzaSyBw_v3W7TPx7KovRqxwQkKEeKuOAkd_qwo',
  authDomain: 'scl-cultureday.firebaseapp.com',
  projectId: 'scl-cultureday',
  storageBucket: 'scl-cultureday.firebasestorage.app',
  messagingSenderId: '127413337986',
  appId: '1:127413337986:web:31fdf9b26f40877e4ed99b',
};

export const isConfigured = !firebaseConfig.apiKey.startsWith('YOUR_');

// 최초 관리자(부트스트랩) 참고값. 실제 관리자 목록의 단일 출처는 Firestore의
// config/admins 문서(emails 배열)입니다. 콘솔에서 이 이메일로 1회 시드한 뒤로는
// 앱의 "관리자 관리" UI에서 추가/제거하세요. (이 상수는 안내/문서용)
export const OWNER_EMAIL = 'ljk6463@gmail.com';

// Firebase 프로젝트 설정값. 아래 placeholder를 본인 Firebase 웹앱 config로 교체하세요.
// 이 값들은 공개되어도 안전합니다(클라이언트용). 접근 제어는 Firestore 보안 규칙으로 합니다.
// 설정 방법은 README.md 참고. placeholder 상태이면 앱은 자동으로 localStorage(로컬 전용)로 동작합니다.

export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

export const isConfigured = !firebaseConfig.apiKey.startsWith('YOUR_');

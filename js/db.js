// 데이터 접근 계층. Firebase가 설정되어 있으면 Firestore(팀 공유)를, 아니면
// localStorage(로컬 전용)로 자동 폴백한다. 두 경우 모두 동일한 API를 노출한다.
//
//  getMembers(): Promise<string[]>          saveMembers(names): Promise<void>   (쓰기=관리자)
//  listAssignments(): Promise<[...]>        addAssignment(record): Promise<id>  (쓰기=관리자)
//  deleteAssignment(id): Promise<void>      (쓰기=관리자)
//  getAdmins(): Promise<string[]>           saveAdmins(emails): Promise<void>   (쓰기=관리자)
//  signInWithGoogle() / signOutUser() / onAuthChange(cb) / currentEmail()

import { firebaseConfig, isConfigured } from './firebase-config.js';

let backend = null;

async function initFirestore() {
  const appMod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
  const fs = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const au = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
  const app = appMod.initializeApp(firebaseConfig);
  const db = fs.getFirestore(app);
  const auth = au.getAuth(app);

  const membersRef = fs.doc(db, 'config', 'members');
  const adminsRef = fs.doc(db, 'config', 'admins');

  return {
    mode: 'firestore',
    async getMembers() {
      const snap = await fs.getDoc(membersRef);
      return snap.exists() ? snap.data().names || [] : [];
    },
    async saveMembers(names) {
      await fs.setDoc(membersRef, { names });
    },
    async getAdmins() {
      const snap = await fs.getDoc(adminsRef);
      return snap.exists() ? snap.data().emails || [] : [];
    },
    async saveAdmins(emails) {
      await fs.setDoc(adminsRef, { emails });
    },
    async listAssignments() {
      const q = fs.query(fs.collection(db, 'assignments'), fs.orderBy('createdAt', 'desc'));
      const snap = await fs.getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    async addAssignment(record) {
      const ref = await fs.addDoc(fs.collection(db, 'assignments'), {
        ...record,
        createdAt: fs.serverTimestamp(),
      });
      return ref.id;
    },
    async deleteAssignment(id) {
      await fs.deleteDoc(fs.doc(db, 'assignments', id));
    },
    async signInWithGoogle() {
      await au.signInWithPopup(auth, new au.GoogleAuthProvider());
    },
    async signOutUser() {
      await au.signOut(auth);
    },
    onAuthChange(cb) {
      au.onAuthStateChanged(auth, (user) => cb(user ? user.email : null));
    },
    currentEmail() {
      return auth.currentUser ? auth.currentUser.email : null;
    },
  };
}

function initLocal() {
  const MEMBERS_KEY = 'cultureday_members';
  const ASSIGN_KEY = 'cultureday_assignments';
  const ADMINS_KEY = 'cultureday_admins';
  const read = (k, fallback) => {
    try { return JSON.parse(localStorage.getItem(k)) ?? fallback; }
    catch { return fallback; }
  };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  let seq = read('cultureday_seq', 0);

  return {
    mode: 'local',
    async getMembers() { return read(MEMBERS_KEY, []); },
    async saveMembers(names) { write(MEMBERS_KEY, names); },
    async getAdmins() { return read(ADMINS_KEY, []); },
    async saveAdmins(emails) { write(ADMINS_KEY, emails); },
    async listAssignments() {
      const all = read(ASSIGN_KEY, []);
      return all.sort((a, b) => b.createdAt - a.createdAt);
    },
    async addAssignment(record) {
      const all = read(ASSIGN_KEY, []);
      const id = `local-${++seq}`;
      write('cultureday_seq', seq);
      all.push({ id, ...record, createdAt: Date.now() });
      write(ASSIGN_KEY, all);
      return id;
    },
    async deleteAssignment(id) {
      const all = read(ASSIGN_KEY, []).filter((r) => r.id !== id);
      write(ASSIGN_KEY, all);
    },
    // 로컬 모드: 인증 없음. 항상 단일 사용자(관리자)로 취급.
    async signInWithGoogle() {},
    async signOutUser() {},
    onAuthChange(cb) { cb(null); },
    currentEmail() { return null; },
  };
}

async function getBackend() {
  if (backend) return backend;
  if (isConfigured) {
    try {
      backend = await initFirestore();
    } catch (e) {
      console.error('Firestore 초기화 실패 — localStorage로 폴백합니다.', e);
      backend = initLocal();
    }
  } else {
    console.warn('Firebase 미설정 — localStorage(로컬 전용)로 동작합니다. README 참고.');
    backend = initLocal();
  }
  return backend;
}

// createdAt을 밀리초 숫자로 정규화 (Firestore Timestamp 또는 number 모두 처리)
export function toMillis(createdAt) {
  if (!createdAt) return 0;
  if (typeof createdAt === 'number') return createdAt;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (createdAt.seconds) return createdAt.seconds * 1000;
  return 0;
}

export const DB = {
  async mode() { return (await getBackend()).mode; },
  async getMembers() { return (await getBackend()).getMembers(); },
  async saveMembers(names) { return (await getBackend()).saveMembers(names); },
  async getAdmins() { return (await getBackend()).getAdmins(); },
  async saveAdmins(emails) { return (await getBackend()).saveAdmins(emails); },
  async listAssignments() { return (await getBackend()).listAssignments(); },
  async addAssignment(record) { return (await getBackend()).addAssignment(record); },
  async deleteAssignment(id) { return (await getBackend()).deleteAssignment(id); },
  async signInWithGoogle() { return (await getBackend()).signInWithGoogle(); },
  async signOutUser() { return (await getBackend()).signOutUser(); },
  async onAuthChange(cb) { return (await getBackend()).onAuthChange(cb); },
  async currentEmail() { return (await getBackend()).currentEmail(); },
};

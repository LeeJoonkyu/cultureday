// 메인 앱: 멤버 관리(로컬 편집+관리자 저장), 시작/확정 분리, 관리자 인증/관리,
// 히스토리, 결과/리플레이 렌더
import { DB } from './db.js';

const L = window.Ladder;
const HALF_LABEL = { first: '상반기', second: '하반기' };

const state = {
  members: [],
  membersDirty: false,
  half: 'first',
  year: new Date().getFullYear(),
  history: [],
  admins: [],
  email: null,
  mode: 'local',
  isOwner: false,
  lastAssignment: null,
  stopAnim: null,
};

// ── DOM 헬퍼 ──────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

// ── 멤버 관리 (로컬 편집, DB 저장은 관리자 확정 시) ─────────────────────────
function renderMembers() {
  const list = $('member-list');
  list.innerHTML = '';
  state.members.forEach((name, i) => {
    const li = el('li', 'member-item');
    const span = el('span', 'member-name', name);
    span.title = '클릭하여 수정';
    span.onclick = () => editMember(i);
    const del = el('button', 'member-del', '×');
    del.onclick = () => removeMember(i);
    li.append(span, del);
    list.append(li);
  });
  $('member-count').textContent = state.members.length;
  renderDistPreview();
}

function markMembersDirty() {
  state.membersDirty = true;
  const btn = $('save-members-btn');
  btn.classList.add('dirty');
  btn.textContent = '멤버 저장(확정) •';
  $('save-state').textContent = '변경됨 · 저장 필요';
}

function editMember(i) {
  const next = prompt('이름 수정', state.members[i]);
  if (next == null) return;
  const trimmed = next.trim();
  if (trimmed) { state.members[i] = trimmed; markMembersDirty(); renderMembers(); }
}

function removeMember(i) {
  state.members.splice(i, 1);
  markMembersDirty();
  renderMembers();
}

function addMembers(raw) {
  const names = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (!names.length) return;
  state.members.push(...names);
  markMembersDirty();
  renderMembers();
}

async function saveMembers() {
  if (!state.isOwner) return;
  await DB.saveMembers(state.members);
  state.membersDirty = false;
  const btn = $('save-members-btn');
  btn.classList.remove('dirty');
  btn.textContent = '멤버 저장(확정)';
  $('save-state').textContent = '저장됨 ✓';
  setTimeout(() => ($('save-state').textContent = ''), 1500);
}

// ── 분배 미리보기 ─────────────────────────────────────────────────────────
function renderDistPreview() {
  const n = state.members.length;
  const box = $('dist-preview');
  if (n < 1) { box.textContent = '멤버를 추가하세요.'; return; }
  const counts = L.computeMonthCounts(n);
  const months = L.MONTH_LABELS[state.half];
  box.textContent = `${n}명 → ` + counts.map((c, i) => `${months[i]}월:${c}`).join('  ');
}

// ── 시작(누구나, 저장 안 함) ───────────────────────────────────────────────
function runAssignment() {
  if (state.members.length < 2) { alert('최소 2명 이상의 멤버가 필요합니다.'); return; }
  const half = state.half;
  const year = state.year;
  const data = L.computeAssignment(state.members, half);

  state.lastAssignment = null;
  $('result-panel').classList.add('hidden');
  $('start-btn').disabled = true;
  if (state.stopAnim) state.stopAnim();

  state.stopAnim = L.animate($('ladder-canvas'), data, () => {
    $('start-btn').disabled = false;
    state.lastAssignment = { ...data, year };
    renderResult(state.lastAssignment, $('result-title'), $('result-grid'));
    $('result-panel').classList.remove('hidden');
  });
}

// ── 확정(관리자만, DB 저장) ────────────────────────────────────────────────
async function confirmAssignment() {
  if (!state.isOwner) return;
  const d = state.lastAssignment;
  if (!d) { alert('먼저 시작을 눌러 배정을 만드세요.'); return; }
  if (state.history.some((r) => r.year === d.year && r.half === d.half)) {
    alert(`이미 ${d.year}년 ${HALF_LABEL[d.half]} 배정이 확정되었습니다.\n재확정하려면 기존 기록을 삭제하세요.`);
    return;
  }
  await DB.addAssignment({
    year: d.year, half: d.half,
    names: d.names, monthCounts: d.monthCounts, slotMonths: d.slotMonths,
    rungs: d.rungs, rows: d.rows, result: d.result,
  });
  await loadHistory();
  alert(`${d.year}년 ${HALF_LABEL[d.half]} 배정이 확정·저장되었습니다.`);
}

// ── 결과 표 렌더 (이름 → N월) ──────────────────────────────────────────────
function renderResult(data, titleEl, gridEl) {
  if (titleEl) titleEl.textContent = `${data.year}년 ${HALF_LABEL[data.half]} 배정 결과`;
  gridEl.innerHTML = '';
  const months = L.MONTH_LABELS[data.half];
  months.forEach((m) => {
    data.names.filter((nm) => data.result[nm] === m).forEach((nm) => {
      const row = el('div', 'result-row');
      row.append(el('span', 'r-name', nm), el('span', 'r-arrow', '→'), el('span', 'r-month', `${m}월`));
      gridEl.append(row);
    });
  });
}

// ── 히스토리 ──────────────────────────────────────────────────────────────
async function loadHistory() {
  state.history = await DB.listAssignments();
  renderHistory();
}

function renderHistory() {
  const list = $('history-list');
  list.innerHTML = '';
  state.history.forEach((rec) => {
    const li = el('li', 'history-item');
    li.append(el('div', 'hi-label', `${rec.year}년 ${HALF_LABEL[rec.half]}`),
      el('div', 'hi-meta', `${rec.names.length}명`));
    li.onclick = () => showHistory(rec);
    list.append(li);
  });
}

function showView(name) {
  $('compose-view').classList.toggle('hidden', name !== 'compose');
  $('history-view').classList.toggle('hidden', name !== 'history');
}

function showHistory(rec) {
  if (state.stopAnim) state.stopAnim();
  showView('history');
  $('hv-title').textContent = `${rec.year}년 ${HALF_LABEL[rec.half]} 배정 결과`;
  renderResult(rec, null, $('hv-grid'));
  L.renderStatic($('hv-canvas'), rec);
  $('hv-delete').classList.toggle('hidden', !state.isOwner);

  $('hv-replay').onclick = () => {
    if (state.stopAnim) state.stopAnim();
    state.stopAnim = L.animate($('hv-canvas'), rec, () => {});
  };
  $('hv-delete').onclick = async () => {
    if (!state.isOwner) return;
    if (!confirm('이 배정 기록을 삭제할까요?')) return;
    await DB.deleteAssignment(rec.id);
    await loadHistory();
    showView('compose');
  };
}

// ── 관리자 관리 ───────────────────────────────────────────────────────────
function renderAdmins() {
  const list = $('admin-list');
  list.innerHTML = '';
  state.admins.forEach((email) => {
    const li = el('li');
    li.append(el('span', null, email));
    const del = el('button', 'admin-del', '×');
    del.onclick = () => removeAdmin(email);
    li.append(del);
    list.append(li);
  });
}

async function addAdmin(raw) {
  const email = raw.trim().toLowerCase();
  if (!email) return;
  if (state.admins.map((e) => e.toLowerCase()).includes(email)) { alert('이미 관리자입니다.'); return; }
  await DB.saveAdmins([...state.admins, email]);
  state.admins = await DB.getAdmins();
  renderAdmins();
}

async function removeAdmin(email) {
  if (state.admins.length <= 1) { alert('마지막 관리자는 제거할 수 없습니다.'); return; }
  if (!confirm(`${email} 관리자를 제거할까요?`)) return;
  await DB.saveAdmins(state.admins.filter((e) => e !== email));
  state.admins = await DB.getAdmins();
  recomputeOwner();
  renderAdmins();
  updateAuthButton();
  updateOwnerUI();
}

// ── 인증 상태 ─────────────────────────────────────────────────────────────
function recomputeOwner() {
  const email = (state.email || '').toLowerCase();
  state.isOwner = state.mode !== 'firestore'
    || (!!email && state.admins.map((e) => e.toLowerCase()).includes(email));
}

function updateAuthButton() {
  const btn = $('auth-btn');
  if (state.mode !== 'firestore') {
    btn.classList.add('hidden');
    $('auth-state').textContent = '로컬 모드 (관리자)';
    return;
  }
  if (state.email) {
    btn.textContent = '로그아웃';
    btn.classList.add('in');
    $('auth-state').textContent = `${state.email} · ${state.isOwner ? '관리자' : '일반 사용자'}`;
  } else {
    btn.textContent = '관리자 로그인';
    btn.classList.remove('in');
    $('auth-state').textContent = '';
  }
}

function updateOwnerUI() {
  const o = state.isOwner;
  $('save-members-btn').disabled = !o;
  $('confirm-btn').disabled = !o;
  $('admin-panel').classList.toggle('hidden', !o);
  $('hv-delete').classList.toggle('hidden', !o);
  if (o) renderAdmins();
}

// ── 초기화/이벤트 바인딩 ───────────────────────────────────────────────────
async function init() {
  $('year-input').value = state.year;

  $('add-btn').onclick = () => { addMembers($('member-input').value); $('member-input').value = ''; };
  $('member-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { addMembers($('member-input').value); $('member-input').value = ''; }
  });
  $('save-members-btn').onclick = saveMembers;

  $('year-input').addEventListener('change', (e) => {
    state.year = parseInt(e.target.value, 10) || state.year;
  });

  document.querySelectorAll('.half-btn').forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll('.half-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.half = btn.dataset.half;
      renderDistPreview();
    };
  });

  $('start-btn').onclick = runAssignment;
  $('confirm-btn').onclick = confirmAssignment;
  $('new-btn').onclick = () => { showView('compose'); renderMembers(); };

  $('auth-btn').onclick = async () => {
    if (state.email) await DB.signOutUser();
    else await DB.signInWithGoogle();
  };
  $('admin-add-btn').onclick = () => { addAdmin($('admin-input').value); $('admin-input').value = ''; };
  $('admin-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { addAdmin($('admin-input').value); $('admin-input').value = ''; }
  });

  // 데이터 로드
  state.mode = await DB.mode();
  state.members = await DB.getMembers();
  state.admins = await DB.getAdmins();
  renderMembers();
  await loadHistory();

  $('backend-badge').textContent = state.mode === 'firestore'
    ? '☁ 팀 공유 (Firestore)' : '⚠ 로컬 전용 (Firebase 미설정)';
  $('backend-badge').classList.toggle('local', state.mode !== 'firestore');

  // 인증 상태 변화 구독 (로그인/로그아웃 시 UI 갱신)
  await DB.onAuthChange((email) => {
    state.email = email;
    recomputeOwner();
    updateAuthButton();
    updateOwnerUI();
  });

  recomputeOwner();
  updateAuthButton();
  updateOwnerUI();
}

init();

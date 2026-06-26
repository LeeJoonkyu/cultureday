// 메인 앱: 멤버 관리, 분배 실행, 히스토리, 결과/리플레이 렌더
import { DB, toMillis } from './db.js';

const L = window.Ladder;
const HALF_LABEL = { first: '상반기', second: '하반기' };

const state = {
  members: [],
  half: 'first',
  year: new Date().getFullYear(),
  history: [],
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

// ── 멤버 관리 ─────────────────────────────────────────────────────────────
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

function editMember(i) {
  const next = prompt('이름 수정', state.members[i]);
  if (next == null) return;
  const trimmed = next.trim();
  if (trimmed) {
    state.members[i] = trimmed;
    persistMembers();
    renderMembers();
  }
}

function removeMember(i) {
  state.members.splice(i, 1);
  persistMembers();
  renderMembers();
}

function addMembers(raw) {
  const names = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (!names.length) return;
  state.members.push(...names);
  persistMembers();
  renderMembers();
}

let saveTimer = null;
function persistMembers() {
  $('save-state').textContent = '저장 중…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await DB.saveMembers(state.members);
    $('save-state').textContent = '저장됨 ✓';
    setTimeout(() => ($('save-state').textContent = ''), 1500);
  }, 300);
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

// ── 배정 실행 ─────────────────────────────────────────────────────────────
function runAssignment() {
  if (state.members.length < 2) {
    alert('최소 2명 이상의 멤버가 필요합니다.');
    return;
  }
  const data = L.computeAssignment(state.members, state.half);
  state.lastAssignment = data;
  if (state.stopAnim) state.stopAnim();
  $('result-panel').classList.add('hidden');
  $('start-btn').disabled = true;

  const canvas = $('ladder-canvas');
  state.stopAnim = L.animate(canvas, data, async () => {
    $('start-btn').disabled = false;
    renderResult(data, $('result-title'), $('result-grid'));
    $('result-panel').classList.remove('hidden');
    await saveAssignment(data);
  });
}

async function saveAssignment(data) {
  const record = {
    year: state.year,
    half: state.half,
    names: data.names,
    monthCounts: data.monthCounts,
    slotMonths: data.slotMonths,
    rungs: data.rungs,
    rows: data.rows,
    result: data.result,
  };
  await DB.addAssignment(record);
  await loadHistory();
}

// ── 결과 표 렌더 (이미지처럼 이름 → N월) ────────────────────────────────────
function renderResult(data, titleEl, gridEl) {
  if (titleEl) titleEl.textContent =
    `${state.year}년 ${HALF_LABEL[data.half]} 배정 결과`;
  gridEl.innerHTML = '';
  // 월별로 묶어 정렬해 보여준다
  const months = L.MONTH_LABELS[data.half];
  months.forEach((m) => {
    const names = data.names.filter((nm) => data.result[nm] === m);
    names.forEach((nm) => {
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
    const label = el('div', 'hi-label', `${rec.year}년 ${HALF_LABEL[rec.half]}`);
    const meta = el('div', 'hi-meta', `${rec.names.length}명`);
    li.append(label, meta);
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
  renderResult({ ...rec }, null, $('hv-grid'));
  L.renderStatic($('hv-canvas'), rec);

  $('hv-replay').onclick = () => {
    if (state.stopAnim) state.stopAnim();
    state.stopAnim = L.animate($('hv-canvas'), rec, () => {});
  };
  $('hv-delete').onclick = async () => {
    if (!confirm('이 배정 기록을 삭제할까요?')) return;
    await DB.deleteAssignment(rec.id);
    await loadHistory();
    showView('compose');
  };
}

// ── 초기화/이벤트 바인딩 ───────────────────────────────────────────────────
async function init() {
  $('year-input').value = state.year;

  $('add-btn').onclick = () => { addMembers($('member-input').value); $('member-input').value = ''; };
  $('member-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { addMembers($('member-input').value); $('member-input').value = ''; }
  });

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
  $('new-btn').onclick = () => { showView('compose'); renderMembers(); };

  // 데이터 로드
  state.members = await DB.getMembers();
  renderMembers();
  await loadHistory();

  const mode = await DB.mode();
  $('backend-badge').textContent = mode === 'firestore'
    ? '☁ 팀 공유 (Firestore)'
    : '⚠ 로컬 전용 (Firebase 미설정)';
  $('backend-badge').classList.toggle('local', mode !== 'firestore');
}

init();

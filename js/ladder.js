// 사다리타기 핵심 로직: 분배 계산, 사다리 생성/주행, Canvas 애니메이션, 리플레이

const MONTH_LABELS = {
  first: [1, 2, 3, 4, 5, 6],
  second: [7, 8, 9, 10, 11, 12],
};

const TOKEN_COLORS = [
  '#e6194B', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4',
  '#f032e6', '#bfef45', '#fabed4', '#469990', '#dcbeff', '#9A6324',
  '#800000', '#808000', '#000075', '#a9a9a9', '#e6beff', '#aaffc3',
  '#ffd8b1', '#fffac8', '#808080', '#ff4500', '#2e8b57', '#1e90ff',
];

// 암호학적 난수원 (신뢰성). 브라우저/Node 모두 webcrypto 사용, 없으면 Math.random 폴백.
function rand() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const u = new Uint32Array(1);
    crypto.getRandomValues(u);
    return u[0] / 0x100000000;
  }
  return Math.random();
}

// 균등한 [0, max) 정수 (rejection sampling으로 modulo 편향 제거)
function randInt(max) {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const u = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    let x;
    do { crypto.getRandomValues(u); x = u[0]; } while (x >= limit);
    return x % max;
  }
  return Math.floor(Math.random() * max);
}

// Fisher–Yates 균등 셔플 (원본 불변, 새 배열 반환)
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// N명을 6개월에 분배: 앞쪽 (N%6)개 달은 base+1명, 나머지는 base명
function computeMonthCounts(n) {
  const months = 6;
  const base = Math.floor(n / months);
  const rem = n % months;
  const counts = [];
  for (let i = 0; i < months; i++) {
    counts.push(base + (i < rem ? 1 : 0));
  }
  return counts;
}

// monthCounts와 half를 펼쳐 하단 슬롯 N칸의 월 라벨 배열을 만든다
function buildSlotMonths(monthCounts, half) {
  const labels = MONTH_LABELS[half];
  const slots = [];
  monthCounts.forEach((count, idx) => {
    for (let c = 0; c < count; c++) slots.push(labels[idx]);
  });
  return slots;
}

// amidakuji 가로줄 무작위 생성. rungs: [{row, col}] (col은 col↔col+1 레인을 잇는 가로줄)
// 같은 행에서 인접 가로줄이 겹치지 않도록 보장.
function generateRungs(laneCount) {
  // 가독성 우선: 한산한 밀도. (무작위성은 하단 슬롯 셔플이 보장하므로 밀도와 무관)
  const rows = Math.max(8, Math.round(laneCount * 1.6));
  const rungs = [];
  for (let row = 0; row < rows; row++) {
    let col = 0;
    while (col < laneCount - 1) {
      // 인접 겹침 방지: 가로줄을 놓으면 다음 칸은 건너뛴다
      if (rand() < 0.3) {
        rungs.push({ row, col });
        col += 2;
      } else {
        col += 1;
      }
    }
  }
  return { rungs, rows };
}

// 사다리 주행: 상단 레인 i가 도착하는 하단 슬롯 인덱스를 계산
function traverse(laneIndex, rungs, rows) {
  let col = laneIndex;
  for (let row = 0; row < rows; row++) {
    const left = rungs.find((r) => r.row === row && r.col === col - 1);
    const right = rungs.find((r) => r.row === row && r.col === col);
    if (right) col += 1;
    else if (left) col -= 1;
  }
  return col;
}

// 전체 배정 계산: names(상단) → month(하단 슬롯). 결과 객체 반환.
function computeAssignment(names, half) {
  const n = names.length;
  const monthCounts = computeMonthCounts(n);
  // 하단 월 슬롯을 균등 셔플 → 사다리가 국소적이어도 최종 배정은 균등(uniform) 보장.
  const slotMonths = shuffle(buildSlotMonths(monthCounts, half));
  const { rungs, rows } = generateRungs(n);

  const result = {}; // name -> month
  for (let i = 0; i < n; i++) {
    const slot = traverse(i, rungs, rows);
    result[names[i]] = slotMonths[slot];
  }

  return { names: names.slice(), monthCounts, slotMonths, rungs, rows, result, half };
}

// 저장된 데이터로부터 동일한 경로(path)를 재구성 (애니메이션/리플레이 공용)
// 각 레인의 경로: 행마다의 col 위치 배열
function buildPaths(names, rungs, rows) {
  const paths = [];
  for (let i = 0; i < names.length; i++) {
    let col = i;
    const path = [col];
    for (let row = 0; row < rows; row++) {
      const left = rungs.find((r) => r.row === row && r.col === col - 1);
      const right = rungs.find((r) => r.row === row && r.col === col);
      if (right) col += 1;
      else if (left) col -= 1;
      path.push(col);
    }
    paths.push(path);
  }
  return paths;
}

// ── Canvas 렌더링/애니메이션 ──────────────────────────────────────────────

const PADDING = { top: 70, bottom: 70, side: 40 };

function laneX(canvas, laneCount, lane) {
  const usable = canvas.width - PADDING.side * 2;
  if (laneCount === 1) return canvas.width / 2;
  return PADDING.side + (usable * lane) / (laneCount - 1);
}

function rowY(canvas, rows, row) {
  const usable = canvas.height - PADDING.top - PADDING.bottom;
  return PADDING.top + (usable * row) / rows;
}

const STRAIGHT = 0; // 고전 가로줄 (down → 수평 → down, L자)
const DIAGONAL = 1; // 밴드 전체 대각선

function laneGap(canvas, n) {
  return n > 1 ? laneX(canvas, n, 1) - laneX(canvas, n, 0) : 0;
}

// 교차(rung) 모양을 (row, leftCol)에서 결정적으로 파생 → 저장 없이 리플레이 동일.
// 가로줄 다수(60%) / 대각선(40%).
function rungStyle(row, leftCol) {
  const h = ((row * 73856093) ^ (leftCol * 19349663)) >>> 0;
  return (h % 5) < 3 ? STRAIGHT : DIAGONAL;
}

// 단일 세로줄 hop(작은 반원). 교차 없는 세로 구간에서 가끔(~8%) 살짝 튀었다 복귀.
// 같은 열로 돌아오므로 배정에 영향 없음. 양끝 레인은 안쪽으로만 bump.
function hopAt(row, col, n) {
  const h = ((row * 2654435761) ^ (col * 40503)) >>> 0;
  let dir = (h & 8) ? 1 : -1;
  if (col === 0) dir = 1; else if (col === n - 1) dir = -1;
  return { hop: h % 13 === 0, dir };
}

// 세그먼트 한 칸(seg→seg+1)에서 진행도 frac(0~1)의 토큰/선 좌표. drawBoard와 tokenPos 공용.
function pathPoint(canvas, n, rows, colA, colB, seg, frac) {
  const yT = rowY(canvas, rows, seg);
  const yB = rowY(canvas, rows, Math.min(seg + 1, rows));
  const xa = laneX(canvas, n, colA);
  if (colA === colB) { // 세로 (+ 가끔 hop 반원)
    const { hop, dir } = hopAt(seg, colA, n);
    const x = hop ? xa + Math.sin(Math.PI * frac) * laneGap(canvas, n) * 0.22 * dir : xa;
    return { x, y: yT + (yB - yT) * frac };
  }
  const xb = laneX(canvas, n, colB);
  if (rungStyle(seg, Math.min(colA, colB)) === DIAGONAL) {
    return { x: xa + (xb - xa) * frac, y: yT + (yB - yT) * frac };
  }
  // STRAIGHT (L자): down → 수평 → down
  const yMid = (yT + yB) / 2;
  if (frac < 0.38) return { x: xa, y: yT + (yMid - yT) * (frac / 0.38) };
  if (frac < 0.62) return { x: xa + (xb - xa) * ((frac - 0.38) / 0.24), y: yMid };
  return { x: xb, y: yMid + (yB - yMid) * ((frac - 0.62) / 0.38) };
}

function drawBoard(ctx, canvas, data) {
  const { names, slotMonths, rungs, rows } = data;
  const n = names.length;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 세로줄
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  for (let i = 0; i < n; i++) {
    const x = laneX(canvas, n, i);
    ctx.beginPath();
    ctx.moveTo(x, rowY(canvas, rows, 0));
    ctx.lineTo(x, rowY(canvas, rows, rows));
    ctx.stroke();
  }

  // 교차(rung): STRAIGHT는 수평 가로줄, DIAGONAL은 X자(두 대각선). 토큰은 같은 선 위로 지남.
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  rungs.forEach(({ row, col }) => {
    const yT = rowY(canvas, rows, row);
    const yB = rowY(canvas, rows, row + 1);
    const xL = laneX(canvas, n, col);
    const xR = laneX(canvas, n, col + 1);
    if (rungStyle(row, col) === STRAIGHT) {
      const yMid = (yT + yB) / 2;
      ctx.beginPath();
      ctx.moveTo(xL, yMid);
      ctx.lineTo(xR, yMid);
      ctx.stroke();
    } else { // DIAGONAL → X
      ctx.beginPath();
      ctx.moveTo(xL, yT); ctx.lineTo(xR, yB);
      ctx.moveTo(xR, yT); ctx.lineTo(xL, yB);
      ctx.stroke();
    }
  });

  // 단일 세로줄 hop(작은 반원): 교차가 닿지 않는 세로 칸에 가끔.
  const touched = new Set();
  rungs.forEach(({ row, col }) => { touched.add(`${row}:${col}`); touched.add(`${row}:${col + 1}`); });
  const STEPS = 12;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < n; col++) {
      if (touched.has(`${row}:${col}`)) continue;
      if (!hopAt(row, col, n).hop) continue;
      ctx.beginPath();
      for (let s = 0; s <= STEPS; s++) {
        const f = s / STEPS;
        const { x, y } = pathPoint(canvas, n, rows, col, col, row, f);
        if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // 상단 이름 라벨
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < n; i++) {
    const x = laneX(canvas, n, i);
    ctx.fillStyle = TOKEN_COLORS[i % TOKEN_COLORS.length];
    ctx.fillText(names[i], x, PADDING.top - 14);
  }

  // 하단 슬롯(월) 라벨
  ctx.fillStyle = '#0f172a';
  for (let i = 0; i < n; i++) {
    const x = laneX(canvas, n, i);
    ctx.fillText(`${slotMonths[i]}월`, x, canvas.height - PADDING.bottom + 24);
  }
}

// 토큰 위치 보간: path(행별 col)을 따라 진행도 t(0~rows)에 해당하는 {x,y}.
// 교차 세그먼트에서는 해당 rung 스타일의 곡선을 그대로 따라간다(연결선 위 정직 이동).
function tokenPos(canvas, n, rows, path, t) {
  const seg = Math.min(Math.floor(t), rows);
  const frac = t - seg;
  const colA = path[seg];
  const colB = path[Math.min(seg + 1, rows)];
  return pathPoint(canvas, n, rows, colA, colB, seg, frac);
}

// 애니메이션 재생. data로부터 모든 토큰을 동시에 내려보낸다. 완료 시 onDone 호출.
function animate(canvas, data, onDone) {
  const ctx = canvas.getContext('2d');
  const { names, rows } = data;
  const n = names.length;
  const paths = buildPaths(names, data.rungs, rows);

  const DURATION = 2600; // ms
  let start = null;
  let rafId = null;

  function frame(ts) {
    if (start === null) start = ts;
    const elapsed = ts - start;
    const progress = Math.min(elapsed / DURATION, 1);
    const t = progress * rows;

    drawBoard(ctx, canvas, data);

    for (let i = 0; i < n; i++) {
      const { x, y } = tokenPos(canvas, n, rows, paths[i], t);
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = TOKEN_COLORS[i % TOKEN_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (progress < 1) {
      rafId = requestAnimationFrame(frame);
    } else if (onDone) {
      onDone();
    }
  }

  rafId = requestAnimationFrame(frame);
  return () => rafId && cancelAnimationFrame(rafId);
}

// 정적으로 보드만 그리기 (애니메이션 없이 결과 확인용)
function renderStatic(canvas, data) {
  const ctx = canvas.getContext('2d');
  drawBoard(ctx, canvas, data);
}

window.Ladder = {
  MONTH_LABELS,
  computeMonthCounts,
  buildSlotMonths,
  computeAssignment,
  animate,
  renderStatic,
};

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
function generateRungs(laneCount, rowsPerLane = 3) {
  const rows = Math.max(8, laneCount * rowsPerLane);
  const rungs = [];
  for (let row = 0; row < rows; row++) {
    let col = 0;
    while (col < laneCount - 1) {
      // 인접 겹침 방지: 가로줄을 놓으면 다음 칸은 건너뛴다
      if (Math.random() < 0.4) {
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
  const slotMonths = buildSlotMonths(monthCounts, half);
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

  // 가로줄
  ctx.strokeStyle = '#94a3b8';
  rungs.forEach(({ row, col }) => {
    const y = rowY(canvas, rows, row + 0.5);
    ctx.beginPath();
    ctx.moveTo(laneX(canvas, n, col), y);
    ctx.lineTo(laneX(canvas, n, col + 1), y);
    ctx.stroke();
  });

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

// 토큰 위치 보간: path(행별 col)을 따라 진행도 t(0~rows)에 해당하는 {x,y}
function tokenPos(canvas, n, rows, path, t) {
  const seg = Math.min(Math.floor(t), rows);
  const frac = t - seg;
  const colA = path[seg];
  const colB = path[Math.min(seg + 1, rows)];
  const col = colA + (colB - colA) * frac;
  const x = laneX(canvas, n, col);
  const y = rowY(canvas, rows, seg + frac);
  return { x, y };
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

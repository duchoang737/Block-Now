// Ràng buộc data — GDD §8. Chạy trong test trước khi tin bất kỳ level nào.
import { cellKey, neighbors, playableSet } from './board';
import type { Cell, Level } from '../types';

export interface Issue {
  rule: string;
  message: string;
}

const pairKey = (color: string, shape: string) => `${color}/${shape}`;

export function validateLevel(level: Level): Issue[] {
  const issues: Issue[] = [];
  const playable = playableSet(level);

  // §8.1 — cân bằng theo TỪNG cặp (màu, hình)
  const holes = new Map<string, number>();
  const layers = new Map<string, number>();
  for (const h of level.holders)
    for (const shape of h.holes)
      holes.set(pairKey(h.color, shape), (holes.get(pairKey(h.color, shape)) ?? 0) + 1);
  for (const piece of level.pieces)
    for (const peg of piece.pegs)
      for (const l of peg.layers)
        layers.set(pairKey(l.color, l.shape), (layers.get(pairKey(l.color, l.shape)) ?? 0) + 1);

  for (const pair of new Set([...holes.keys(), ...layers.keys()])) {
    const h = holes.get(pair) ?? 0;
    const l = layers.get(pair) ?? 0;
    if (h !== l) issues.push({ rule: '§8.1 balance', message: `${pair}: ${h} lỗ ↔ ${l} lớp chốt` });
  }

  // §8.2 — trong playable, không chồng nhau
  const taken = new Map<string, string>();
  const claim = (cell: Cell, owner: string) => {
    const k = cellKey(cell);
    if (!playable.has(k)) issues.push({ rule: '§8.2 bounds', message: `${owner} ở ô ngoài board: ${k}` });
    const prev = taken.get(k);
    if (prev) issues.push({ rule: '§8.2 overlap', message: `${owner} chồng ${prev} tại ${k}` });
    else taken.set(k, owner);
  };
  for (const h of level.holders) for (const cell of h.cells) claim(cell, `holder ${h.id}`);
  for (const piece of level.pieces)
    for (const peg of piece.pegs) claim(peg.cell, `peg ${peg.id}`);
  // BĂNG KHÔNG tính là chồng lấn với chốt — nó PHỦ LÊN chốt.
  //
  // Cả cơ chế nằm ở đây: băng đóng băng thứ nằm dưới, vỡ ra thì lộ khối bên trong.
  // Cấm chốt nằm dưới băng là cấm luôn cái đáng chơi, chỉ còn lại một bức tường tự
  // tan. Vẫn cấm băng đè lên KHAY: khay là khối đặc, phủ băng lên nó thì lỗ vừa
  // không cắm được vừa không nhìn ra được là đang bị khoá vì cái gì.
  for (const ob of level.obstacles ?? []) {
    if (ob.kind !== 'ice') continue;
    for (const cell of ob.cells) {
      const owner = taken.get(cellKey(cell));
      if (owner?.startsWith('holder'))
        issues.push({ rule: '§8.2 overlap', message: `ice chồng ${owner} tại ${cellKey(cell)}` });
    }
  }

  // §8.3 — khay liền nhau, thẳng hàng, 1..5 ô
  for (const h of level.holders) {
    if (h.cells.length !== h.holes.length)
      issues.push({ rule: '§8.3 shape', message: `${h.id}: ${h.cells.length} ô vs ${h.holes.length} lỗ` });
    if (h.cells.length < 1 || h.cells.length > 5)
      issues.push({ rule: '§8.3 size', message: `${h.id}: ${h.cells.length} ô (phải 1..5)` });

    const rows = new Set(h.cells.map(([r]) => r));
    const cols = new Set(h.cells.map(([, c]) => c));
    if (rows.size !== 1 && cols.size !== 1)
      issues.push({ rule: '§8.3 axis', message: `${h.id}: không thẳng hàng` });

    const sorted = [...h.cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    for (let i = 1; i < sorted.length; i++) {
      const d = Math.abs(sorted[i][0] - sorted[i - 1][0]) + Math.abs(sorted[i][1] - sorted[i - 1][1]);
      if (d !== 1) issues.push({ rule: '§8.3 contiguous', message: `${h.id}: ô không liền nhau` });
    }
  }

  // §8.4 — mảnh phải LIÊN THÔNG (nó di chuyển như một khối cứng) và mọi chốt có ≥1 lớp
  for (const piece of level.pieces) {
    if (piece.pegs.length < 1) {
      issues.push({ rule: '§8.4 piece', message: `piece ${piece.id}: rỗng` });
      continue;
    }
    for (const peg of piece.pegs)
      if (peg.layers.length < 1)
        issues.push({ rule: '§8.4 layers', message: `peg ${peg.id}: 0 lớp` });

    const cells = new Set(piece.pegs.map((p) => cellKey(p.cell)));
    const seen = new Set<string>([cellKey(piece.pegs[0].cell)]);
    const queue: Cell[] = [piece.pegs[0].cell];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const nb of neighbors(cur)) {
        const k = cellKey(nb);
        if (!cells.has(k) || seen.has(k)) continue;
        seen.add(k);
        queue.push(nb);
      }
    }
    if (seen.size !== cells.size)
      issues.push({
        rule: '§8.4 connected',
        message: `piece ${piece.id}: chốt rời rạc (${seen.size}/${cells.size} liên thông)`,
      });
  }

  // §8.5 / §8.6 — badge phải giảm được về 0
  const holderCount = level.holders.length;
  const totalLayers = level.pieces.reduce(
    (n, p) => n + p.pegs.reduce((m, peg) => m + peg.layers.length, 0),
    0,
  );
  for (const ob of level.obstacles ?? []) {
    if (ob.kind === 'ice') {
      const n = ob.count ?? 0;
      if (n < 1 || n > holderCount)
        issues.push({ rule: '§8.5 ice', message: `ice count ${n} ngoài khoảng 1..${holderCount}` });
    }
    if (ob.kind === 'shutter') {
      const covered = new Set(ob.cells.map(cellKey));
      const outside = level.pieces
        .flatMap((p) => p.pegs)
        .filter((peg) => !covered.has(cellKey(peg.cell)))
        .reduce((n, peg) => n + peg.layers.length, 0);
      const n = ob.count ?? 0;
      if (n < 1 || n > outside)
        issues.push({
          rule: '§8.6 shutter',
          message: `shutter count ${n} ngoài khoảng 1..${outside} (tổng lớp ${totalLayers})`,
        });
    }
  }

  // §8.7 — timeLimitMs > 0 và thoả ngân sách thời gian (§5.3) nếu biết minMoves
  if (!(level.timeLimitMs > 0))
    issues.push({ rule: '§8.7 time', message: 'timeLimitMs phải > 0' });
  if (level.minMoves != null) {
    const budget = level.minMoves * 4000 + 20000;
    if (level.timeLimitMs < budget)
      issues.push({
        rule: '§5.3 budget',
        message: `timeLimitMs ${level.timeLimitMs}ms < ngân sách ${budget}ms (minMoves ${level.minMoves})`,
      });
  }

  return issues;
}

/**
 * Cảnh báo thiết kế: chốt đã đứng KỀ một lỗ khớp ngay từ đầu. Không sai luật
 * (cắm chỉ xảy ra sau một nước đi), nhưng là bẫy: người chơi nhấc mảnh lên là
 * mất đúng vị trí đang đứng, và không có Undo để lấy lại.
 */
export function initialFreeSeats(level: Level): string[] {
  const out: string[] = [];
  const holeAt = new Map<string, { color: string; shape: string; id: string }>();
  for (const h of level.holders)
    h.cells.forEach((cell, i) =>
      holeAt.set(cellKey(cell), { color: h.color, shape: h.holes[i], id: h.id }),
    );

  for (const piece of level.pieces) {
    for (const peg of piece.pegs) {
      const layer = peg.layers[0];
      for (const nb of neighbors(peg.cell)) {
        const hole = holeAt.get(cellKey(nb));
        if (!hole) continue;
        if (hole.color === layer.color && hole.shape === layer.shape)
          out.push(`${peg.id} (${layer.color} ${layer.shape}) đã kề lỗ của ${hole.id}`);
      }
    }
  }
  return out;
}

/**
 * Cảnh báo thiết kế: mảnh KHÔNG có bất kỳ cú thả nào cắm được chốt ⇒ nó là
 * vật cản chết. Không sai luật, nhưng gần như luôn là level hỏng.
 */
export function deadPieces(level: Level): string[] {
  const holeSlots = level.holders.flatMap((h) =>
    h.holes.map((shape) => `${h.color}/${shape}`),
  );
  return level.pieces
    .filter((piece) =>
      piece.pegs.every((peg) =>
        peg.layers.every((l) => !holeSlots.includes(`${l.color}/${l.shape}`)),
      ),
    )
    .map((piece) => `${piece.id}: không lớp nào khớp lỗ nào trên board`);
}

// Phép sửa màn — thuần dữ liệu, không đụng gì tới Pixi nên test được thẳng.
//
// LUẬT BẤT DI BẤT DỊCH CỦA FILE NÀY: mọi hàm TRẢ VỀ MỘT `Level` MỚI, không bao
// giờ sửa tại chỗ. Hai lý do, cái thứ hai là bẫy thật sự:
//   1. undo/redo chỉ là một mảng các Level.
//   2. `playableSet` nhớ kết quả theo WeakMap khoá bằng CHÍNH object level. Sửa
//      `level.playable` tại chỗ thì cache không đổi ⇒ board đổi hình mà khung
//      ngoài vẫn bám hình cũ. Object mới thì cache tự tính lại, khung tự bám theo.
import { cellKey, neighbors } from '../core/board';
import type { Cell, Color, Level, PieceSpec, Shape } from '../types';

export const MAX_HOLDER = 5;

const eq = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];
const has = (list: Cell[], cell: Cell) => list.some((c) => eq(c, cell));

/** Ô chơi được, luôn trả về DANH SÁCH TƯỜNG MINH kể cả khi level đang để trống. */
export function playableCells(level: Level): Cell[] {
  if (level.playable && level.playable.length > 0) return level.playable.map((c) => [...c] as Cell);
  const out: Cell[] = [];
  for (let r = 0; r < level.rows; r++) for (let c = 0; c < level.cols; c++) out.push([r, c]);
  return out;
}

export function emptyLevel(rows = 5, cols = 5): Level {
  return {
    id: 'lv_new',
    name: 'Level mới',
    chapter: 1,
    rows,
    cols,
    holders: [],
    pieces: [],
    obstacles: [],
    timeLimitMs: 120_000,
    difficulty: 'normal',
  };
}

// ---------- soi ô ----------

export type Occupant =
  | { kind: 'holder'; id: string; index: number; color: Color; shape: Shape }
  | { kind: 'peg'; pieceId: string; pegId: string; layers: number; color: Color; shape: Shape }
  | { kind: 'obstacle'; index: number }
  | null;

export function occupantAt(level: Level, cell: Cell): Occupant {
  for (const h of level.holders) {
    const i = h.cells.findIndex((c) => eq(c, cell));
    if (i >= 0) return { kind: 'holder', id: h.id, index: i, color: h.color, shape: h.holes[i] };
  }
  for (const p of level.pieces) {
    const peg = p.pegs.find((pg) => eq(pg.cell, cell));
    // `color`/`shape` là lớp TRÊN CÙNG — thứ người dùng nhìn thấy, nên cũng là thứ
    // hợp lý để lấy mẫu khi bấm vào chốt.
    if (peg) {
      const top = peg.layers[0];
      return {
        kind: 'peg',
        pieceId: p.id,
        pegId: peg.id,
        layers: peg.layers.length,
        color: top.color,
        shape: top.shape,
      };
    }
  }
  const oi = (level.obstacles ?? []).findIndex((ob) => has(ob.cells, cell));
  if (oi >= 0) return { kind: 'obstacle', index: oi };
  return null;
}

// ---------- hình board ----------

/**
 * Ô BỎ BỊ VÂY KÍN — ô ngoài board mà không có đường nào (đi ngang/dọc qua các ô bỏ
 * khác) ra tới mép lưới.
 *
 * Đây là ràng buộc HÌNH HỌC, không phải thẩm mỹ vặt. Khung ngoài được dựng bằng
 * cách phình vùng chơi được ra rồi bo góc, nên nó cho ra ĐƯỜNG BAO của vùng đó.
 * Một ô bỏ bị vây kín tạo thêm một đường bao THỨ HAI nằm lọt giữa board, tách rời
 * đường bao ngoài — nhìn ra ngay thành "một hình dán vào giữa" chứ không phải
 * tường. Đã thử khoét tròn, khoét vuông, bo mượt: không cách vẽ nào chữa được,
 * vì hai đường bao rời nhau là sự thật của hình chứ không phải của nét.
 *
 * Chỗ khoét THÔNG RA MÉP thì đường bao ngoài chỉ việc lượn vào rồi lượn ra — vẫn
 * đúng một nét liền từ ngoài vào trong.
 */
export function enclosedHoles(level: Level): Cell[] {
  const play = new Set(playableCells(level).map(cellKey));
  const holes: Cell[] = [];
  for (let r = 0; r < level.rows; r++)
    for (let c = 0; c < level.cols; c++) if (!play.has(cellKey([r, c]))) holes.push([r, c]);

  // lan từ MÉP lưới vào: ô bỏ nào chạm tới được thì thông ra ngoài
  const open = new Set<string>();
  const queue = holes.filter(
    ([r, c]) => r === 0 || c === 0 || r === level.rows - 1 || c === level.cols - 1,
  );
  for (const h of queue) open.add(cellKey(h));
  while (queue.length > 0) {
    const cur = queue.pop()!;
    for (const nb of neighbors(cur)) {
      const k = cellKey(nb);
      if (open.has(k) || play.has(k)) continue;
      if (nb[0] < 0 || nb[1] < 0 || nb[0] >= level.rows || nb[1] >= level.cols) continue;
      open.add(k);
      queue.push(nb);
    }
  }
  return holes.filter((h) => !open.has(cellKey(h)));
}

/**
 * Bật/tắt một ô. Tắt ô nào thì XOÁ LUÔN thứ đang đứng trên đó — để lại khay hay
 * chốt nằm ngoài board là dữ liệu hỏng, `validateLevel` sẽ báo `§8.2 bounds`.
 *
 * TỪ CHỐI nước nào đẻ ra ô bỏ bị vây kín (xem `enclosedHoles`). Phải chặn cả hai
 * chiều: tắt một ô có thể tạo ô kín, mà BẬT một ô cũng có thể BỊT nốt lối thông
 * cuối cùng của một chỗ khoét đang hở.
 */
export function toggleCell(level: Level, cell: Cell): Level {
  const cells = playableCells(level);
  const guard = (next: Level) => (enclosedHoles(next).length > 0 ? level : next);
  if (has(cells, cell)) {
    const left = cells.filter((c) => !eq(c, cell));
    if (left.length === 0) return level; // không cho xoá hết board
    const off = { ...level, playable: left };
    return enclosedHoles(off).length > 0 ? level : eraseAt(off, cell);
  }
  if (cell[0] < 0 || cell[1] < 0 || cell[0] >= level.rows || cell[1] >= level.cols) return level;
  return guard({ ...level, playable: [...cells, cell] });
}

/** Đổi cỡ lưới. Nội dung rơi ra ngoài lưới mới bị cắt bỏ, không giữ lơ lửng. */
export function resize(level: Level, rows: number, cols: number): Level {
  const r = Math.max(1, Math.min(12, rows));
  const c = Math.max(1, Math.min(12, cols));
  const inside = (cell: Cell) => cell[0] < r && cell[1] < c;
  const playable = playableCells(level).filter(inside);

  let next: Level = {
    ...level,
    rows: r,
    cols: c,
    playable: playable.length > 0 ? playable : [[0, 0]],
  };
  for (const cell of allCellsOf(level).filter((x) => !inside(x))) next = eraseAt(next, cell);
  return next;
}

/** Đổi thời gian màn. Kẹp 10s..15 phút — `timeLimitMs > 0` là ràng buộc §8.7. */
export function setTime(level: Level, ms: number): Level {
  const t = Math.max(10_000, Math.min(900_000, Math.round(ms / 5_000) * 5_000));
  return t === level.timeLimitMs ? level : { ...level, timeLimitMs: t };
}

function allCellsOf(level: Level): Cell[] {
  return [
    ...level.holders.flatMap((h) => h.cells),
    ...level.pieces.flatMap((p) => p.pegs.map((pg) => pg.cell)),
    ...(level.obstacles ?? []).flatMap((ob) => ob.cells),
  ];
}

// ---------- xoá ----------

/** Gỡ mọi thứ đang đứng trên ô. Khay/mảnh rỗng thì bỏ hẳn. */
export function eraseAt(level: Level, cell: Cell): Level {
  const holders = level.holders
    .map((h) => {
      const i = h.cells.findIndex((c) => eq(c, cell));
      if (i < 0) return h;
      return { ...h, cells: h.cells.filter((_, k) => k !== i), holes: h.holes.filter((_, k) => k !== i) };
    })
    .filter((h) => h.cells.length > 0);

  // Bỏ một chốt có thể làm mảnh ĐỨT ĐÔI. Mảnh phải liên thông (§8.4) nên tách
  // luôn thành các mảnh rời, không để lại dữ liệu sai cho validate bắt.
  const pieces = level.pieces.flatMap((p) => {
    if (!p.pegs.some((pg) => eq(pg.cell, cell))) return [p];
    return splitPiece({ ...p, pegs: p.pegs.filter((pg) => !eq(pg.cell, cell)) });
  });

  const obstacles = (level.obstacles ?? [])
    .map((ob) => ({ ...ob, cells: ob.cells.filter((c) => !eq(c, cell)) }))
    .filter((ob) => ob.cells.length > 0);

  return { ...level, holders, pieces, obstacles };
}

/** Tách một mảnh thành các cụm chốt LIÊN THÔNG. Mảnh rỗng biến mất. */
function splitPiece(piece: PieceSpec): PieceSpec[] {
  const rest = [...piece.pegs];
  const out: PieceSpec[] = [];
  while (rest.length > 0) {
    const group = [rest.shift()!];
    for (let i = 0; i < group.length; i++) {
      for (const nb of neighbors(group[i].cell)) {
        const j = rest.findIndex((pg) => eq(pg.cell, nb));
        if (j >= 0) group.push(...rest.splice(j, 1));
      }
    }
    out.push({ id: out.length === 0 ? piece.id : `${piece.id}_${out.length}`, pegs: group });
  }
  return out;
}

// ---------- khay ----------

const nextId = (used: Iterable<string>, prefix: string): string => {
  const taken = new Set(used);
  for (let i = 1; ; i++) if (!taken.has(`${prefix}${i}`)) return `${prefix}${i}`;
};

/** Khay phải THẲNG HÀNG, LIỀN NHAU, 1..5 ô (§8.3). Kiểm trước khi cho nối thêm. */
function holderShapeOk(cells: Cell[]): boolean {
  if (cells.length < 1 || cells.length > MAX_HOLDER) return false;
  const rows = new Set(cells.map(([r]) => r));
  const cols = new Set(cells.map(([, c]) => c));
  if (rows.size !== 1 && cols.size !== 1) return false;
  const sorted = [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (let i = 1; i < sorted.length; i++) {
    const d = Math.abs(sorted[i][0] - sorted[i - 1][0]) + Math.abs(sorted[i][1] - sorted[i - 1][1]);
    if (d !== 1) return false;
  }
  return true;
}

/**
 * Đặt lỗ khay. Bấm lên ô đã có khay thì ĐỔI HÌNH lỗ đó.
 *
 * `join` quyết định ô trống kề một khay CÙNG MÀU có nối dài khay đó không, mặc
 * định KHÔNG — giống hệt lý do ở `paintPeg`: dính vào nhau sau lưng người dựng
 * màn là hành vi bất ngờ, và khay 1 ô với khay 2 ô là hai thứ khác nhau hẳn về
 * luật (khay chỉ nổ khi ĐẦY mọi lỗ).
 */
export function paintHolder(
  level: Level,
  cell: Cell,
  color: Color,
  shape: Shape,
  join = false,
): Level {
  const at = occupantAt(level, cell);
  if (at?.kind === 'holder') {
    return {
      ...level,
      holders: level.holders.map((h) =>
        h.id === at.id ? { ...h, color, holes: h.holes.map((s, i) => (i === at.index ? shape : s)) } : h,
      ),
    };
  }
  if (at) return level; // ô đang có chốt / vật cản — không đè
  if (!playableCells(level).some((c) => eq(c, cell))) return level;

  const host = join
    ? level.holders.find(
        (h) =>
          h.color === color &&
          h.cells.length < MAX_HOLDER &&
          h.cells.some((c) => neighbors(c).some((nb) => eq(nb, cell))) &&
          holderShapeOk([...h.cells, cell]),
      )
    : undefined;
  if (host) {
    return {
      ...level,
      holders: level.holders.map((h) =>
        h.id === host.id ? { ...h, cells: [...h.cells, cell], holes: [...h.holes, shape] } : h,
      ),
    };
  }
  const id = nextId(level.holders.map((h) => h.id), 'k');
  return { ...level, holders: [...level.holders, { id, color, cells: [cell], holes: [shape] }] };
}

// ---------- mảnh ----------

/**
 * Đặt chốt. Bấm lên chốt sẵn có thì ĐẮP THÊM MỘT LỚP xuống dưới (shape-in-shape).
 *
 * `join` quyết định chốt mới có NHẬP vào mảnh kề bên không, và mặc định là KHÔNG.
 * Bản đầu tôi cho tự nhập vì nghĩ "chốt kề nhau mà rời là sai ý người dựng" —
 * đoán sai: đặt hai chốt cạnh nhau mà chúng dính thành một khối cứng là hành vi
 * bất ngờ, và không có cách nào tách ra ngoài việc xoá đi làm lại. Muốn nối thì
 * bật công tắc, tức là một quyết định có chủ ý.
 */
export function paintPeg(
  level: Level,
  cell: Cell,
  color: Color,
  shape: Shape,
  join = false,
): Level {
  const at = occupantAt(level, cell);
  if (at?.kind === 'peg') {
    return {
      ...level,
      pieces: level.pieces.map((p) =>
        p.id !== at.pieceId
          ? p
          : {
              ...p,
              pegs: p.pegs.map((pg) =>
                pg.id === at.pegId ? { ...pg, layers: [...pg.layers, { color, shape }] } : pg,
              ),
            },
      ),
    };
  }
  if (at) return level;
  if (!playableCells(level).some((c) => eq(c, cell))) return level;

  const host = join
    ? level.pieces.find((p) => p.pegs.some((pg) => neighbors(pg.cell).some((nb) => eq(nb, cell))))
    : undefined;
  const pegId = nextId(
    level.pieces.flatMap((p) => p.pegs.map((pg) => pg.id)),
    'g',
  );
  const peg = { id: pegId, cell, layers: [{ color, shape }] };
  if (host) {
    return {
      ...level,
      pieces: level.pieces.map((p) => (p.id === host.id ? { ...p, pegs: [...p.pegs, peg] } : p)),
    };
  }
  const id = nextId(level.pieces.map((p) => p.id), 'p');
  return { ...level, pieces: [...level.pieces, { id, pegs: [peg] }] };
}

/** Gỡ lớp TRÊN CÙNG của chốt; hết lớp thì gỡ luôn chốt. */
export function peelPeg(level: Level, cell: Cell): Level {
  const at = occupantAt(level, cell);
  if (at?.kind !== 'peg') return level;
  if (at.layers <= 1) return eraseAt(level, cell);
  return {
    ...level,
    pieces: level.pieces.map((p) =>
      p.id !== at.pieceId
        ? p
        : {
            ...p,
            pegs: p.pegs.map((pg) => (pg.id === at.pegId ? { ...pg, layers: pg.layers.slice(0, -1) } : pg)),
          },
    ),
  };
}

// ---------- dời chỗ ----------

/**
 * Thứ dời được. KHAY và MẢNH đều là khối cứng — dời là dời cả cụm, không bao giờ
 * dời lẻ một ô khay hay một chốt, vì tách lẻ ra là phá luật §8.3 / §8.4.
 */
export type MoveTarget = { kind: 'holder' | 'piece'; id: string };

export function objectAt(level: Level, cell: Cell): MoveTarget | null {
  const at = occupantAt(level, cell);
  if (at?.kind === 'holder') return { kind: 'holder', id: at.id };
  if (at?.kind === 'peg') return { kind: 'piece', id: at.pieceId };
  return null;
}

export function objectCells(level: Level, t: MoveTarget): Cell[] {
  if (t.kind === 'holder') return level.holders.find((h) => h.id === t.id)?.cells ?? [];
  return level.pieces.find((p) => p.id === t.id)?.pegs.map((pg) => pg.cell) ?? [];
}

/** Chỗ đến phải nằm trong board và trống — trừ chính những ô của cụm đang dời. */
export function canMove(level: Level, t: MoveTarget, dr: number, dc: number): boolean {
  const cells = objectCells(level, t);
  if (cells.length === 0) return false;
  const play = new Set(playableCells(level).map(cellKey));
  const blocked = new Set<string>();
  for (const h of level.holders)
    if (!(t.kind === 'holder' && h.id === t.id)) for (const c of h.cells) blocked.add(cellKey(c));
  for (const p of level.pieces)
    if (!(t.kind === 'piece' && p.id === t.id)) for (const pg of p.pegs) blocked.add(cellKey(pg.cell));
  for (const ob of level.obstacles ?? []) for (const c of ob.cells) blocked.add(cellKey(c));

  return cells.every(([r, c]) => {
    const k = cellKey([r + dr, c + dc]);
    return play.has(k) && !blocked.has(k);
  });
}

export function moveObject(level: Level, t: MoveTarget, dr: number, dc: number): Level {
  if ((dr === 0 && dc === 0) || !canMove(level, t, dr, dc)) return level;
  const shift = ([r, c]: Cell): Cell => [r + dr, c + dc];
  if (t.kind === 'holder') {
    return {
      ...level,
      holders: level.holders.map((h) => (h.id === t.id ? { ...h, cells: h.cells.map(shift) } : h)),
    };
  }
  return {
    ...level,
    pieces: level.pieces.map((p) =>
      p.id === t.id ? { ...p, pegs: p.pegs.map((pg) => ({ ...pg, cell: shift(pg.cell) })) } : p,
    ),
  };
}

// ---------- xuất ----------

/**
 * JSON gọn để dán thẳng vào `levels.data.json`. Bỏ `playable` khi board là hình
 * chữ nhật đầy đủ — đó đúng là quy ước của trường này (§8), giữ lại chỉ tổ phình.
 */
export function exportLevel(level: Level): string {
  const cells = playableCells(level);
  const full = cells.length === level.rows * level.cols;
  const out: Level = { ...level };
  if (full) delete out.playable;
  else out.playable = [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if ((out.obstacles ?? []).length === 0) delete out.obstacles;
  return JSON.stringify(out, null, 2);
}

/** Khoá ô theo hàng/cột, dùng để so hai level trong test. */
export const cellsKey = (cells: Cell[]): string =>
  [...cells].map(cellKey).sort().join(' ');

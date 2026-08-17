// Bảng công cụ của trình sửa màn. Chỉ VẼ và trả về vùng chạm — không giữ trạng
// thái, không đụng tới `Level`. Mọi phép sửa dữ liệu nằm ở `editor/model.ts`.
//
// Bản đầu nhồi 7 nút vào một hàng với nhãn kiểu `− H 5`, ô màu và ô hình bé, dòng
// trạng thái tràn khỏi đáy màn. Bản này đổi ba thứ:
//   · mọi nút ≥ 44px chiều cao — ngưỡng vùng chạm của mobile
//   · hàng màu và hàng hình CHỈ hiện khi đang cầm công cụ cần tới chúng, nên bảng
//     tự thấp đi và board rộng ra khi vẽ hình board
//   · nút dùng cùng chất liệu nhựa với nút HUD: gờ dưới + đỉnh bắt sáng
import { Container, Graphics, Text } from 'pixi.js';
import { HUD, ITEM_PALETTE, THEME, darken, lighten } from './theme';
import { shapePath } from './shapes';
import type { Color, Shape } from '../types';

export type Tool = 'cell' | 'holder' | 'peg' | 'move' | 'erase';

export type EditAction =
  | { k: 'tool'; v: Tool }
  | { k: 'color'; v: Color }
  | { k: 'shape'; v: Shape }
  | { k: 'rows'; d: number }
  | { k: 'cols'; d: number }
  | { k: 'time'; d: number }
  | { k: 'link' }
  | { k: 'stack' }
  | { k: 'undo' }
  | { k: 'export' }
  | { k: 'done' };

export interface EditHit {
  x: number;
  y: number;
  w: number;
  h: number;
  action: EditAction;
}

export interface PaletteState {
  tool: Tool;
  color: Color;
  shape: Shape;
  rows: number;
  cols: number;
  timeMs: number;
  issues: number;
  canUndo: boolean;
  /** Đặt cạnh khay/mảnh sẵn có thì NHẬP vào nó, hay đứng rời. */
  link: boolean;
  /** Bấm lên khay/chốt sẵn có: sửa nó (bật) hay lấy mẫu màu+hình (tắt). */
  stack: boolean;
  note: string;
}

export const COLORS: Color[] = ['red', 'pink', 'blue', 'yellow', 'green', 'purple', 'orange', 'white'];
export const SHAPES: Shape[] = ['circle', 'heart', 'star', 'diamond', 'square', 'cross', 'pentagon', 'triangle'];

const TOOLS: { v: Tool; label: string }[] = [
  { v: 'cell', label: 'Ô' },
  { v: 'holder', label: 'Khay' },
  { v: 'peg', label: 'Chốt' },
  { v: 'move', label: '✥ Kéo' },
  { v: 'erase', label: 'Xoá' },
];

/** Công cụ có dùng tới màu + hình không. Không dùng thì giấu hai hàng đó đi. */
const usesBrush = (t: Tool): boolean => t === 'holder' || t === 'peg';

// Mọi số đo dưới đây tính bằng px danh nghĩa, nhân `uiScale` khi vẽ.
const PAD = 11;
const GAP = 7;
const H_TOOL = 46;
const H_COLOR = 34;
const H_SHAPE = 42;
const H_GRID = 38;
const H_LINK = 36;
const H_ACT = 46;
const H_NOTE = 17;

/** Bể Text dùng lại — bảng vẽ lại mỗi frame, không tạo/huỷ object. */
function makeTextPool(parent: Container) {
  const items: Text[] = [];
  let used = 0;
  return {
    next(text: string, size: number, fill: number, weight: '700' | '800' = '800'): Text {
      let t = items[used];
      if (!t) {
        t = new Text({ text: '', style: { fontFamily: 'system-ui, sans-serif', fontSize: 14 } });
        t.anchor.set(0.5);
        parent.addChild(t);
        items.push(t);
      }
      t.visible = true;
      t.text = text;
      t.style.fontSize = size;
      t.style.fill = fill;
      t.style.fontWeight = weight;
      used++;
      return t;
    },
    reset(): void {
      for (const t of items) t.visible = false;
      used = 0;
    },
  };
}

export type TextPool = ReturnType<typeof makeTextPool>;
export const createTextPool = makeTextPool;

/**
 * Chiều cao bảng — `layout()` phải chừa đúng chỗ này cho board. Thay đổi theo
 * công cụ đang cầm: vẽ hình board thì không cần màu với hình, bảng thấp hẳn.
 */
export function paletteHeight(uiScale: number, tool: Tool): number {
  let h = PAD + H_TOOL + GAP + H_ACT + GAP + H_NOTE + PAD;
  // Thuộc tính của cả MÀN (cỡ lưới, thời gian) gom vào công cụ Ô. Đang chọn
  // màu/hình để đặt khay hay chốt mà vẫn bày stepper ra là chật chỗ và dễ bấm nhầm.
  if (tool === 'cell') h += (H_GRID + GAP) * 2;
  if (usesBrush(tool)) h += H_COLOR + GAP + H_SHAPE + GAP;
  if (usesBrush(tool)) h += (H_LINK + GAP) * 2;
  return Math.round(h * uiScale);
}

const TOOL_NAME: Record<Tool, string> = {
  cell: 'Ô board',
  holder: 'Khay',
  peg: 'Chốt',
  move: 'Kéo dời',
  erase: 'Xoá',
};

/**
 * Nhãn trạng thái vẽ NGAY TRÊN BOARD. Bảng công cụ nằm dưới đáy màn, mà mắt thì
 * đang ở board lúc bấm ô — không có nhãn này thì phải liếc xuống dưới mỗi lần
 * muốn chắc mình đang cầm cọ gì và hai công tắc đang bật hay tắt.
 *
 * `boardTop` là mép trên của khung board; nhãn bám ngay phía trên, và tự kẹp lại
 * nếu board bị đẩy lên sát HUD.
 */
export function drawEditBadge(
  g: Graphics,
  txt: TextPool,
  W: number,
  boardTop: number,
  minY: number,
  uiScale: number,
  st: PaletteState,
): void {
  const s = (n: number) => Math.round(n * uiScale);
  const h = s(26);
  const y = Math.max(minY, boardTop - h - s(9));

  // Có thông báo mới thì nhãn nói THÔNG BÁO, không nói trạng thái. Người dùng vừa
  // chạm vào board xong, mắt đang ở đây — phản hồi phải xuất hiện đúng chỗ đó.
  const parts: string[] = [`✎ ${TOOL_NAME[st.tool]}`];
  if (usesBrush(st.tool)) {
    parts.push(st.link ? '⛓ nối' : '⛓ rời');
    parts.push(st.stack ? '⧉ sửa' : '⧉ lấy mẫu');
  }
  const text = st.note || parts.join('   ·   ');
  const label = txt.next(text, s(12), st.note ? 0x9ce8bd : 0xd6cffb, '700');

  const chip = usesBrush(st.tool) ? h * 0.72 : 0;
  const w = label.width + s(20) + (chip > 0 ? chip + s(8) : 0);
  const x = Math.round(W / 2 - w / 2);

  g.roundRect(x, y, w, h, h / 2).fill({ color: 0x120e2e, alpha: 0.92 });
  g.roundRect(x, y, w, h, h / 2).stroke({
    width: Math.max(1, s(st.note ? 2 : 1)),
    color: st.note ? 0x3fbd7d : 0x4a3f96,
  });

  let tx = x + s(10);
  if (chip > 0) {
    // cọ hiện tại: chính hình + màu sắp đặt, khỏi phải nhớ
    const c = ITEM_PALETTE[st.color];
    g.circle(tx + chip / 2, y + h / 2, chip / 2).fill(darken(c, 0.35));
    shapePath(g, st.shape, tx + chip / 2, y + h / 2, chip * 0.36).fill(c);
    tx += chip + s(8);
  }
  label.x = tx + label.width / 2;
  label.y = y + h / 2 - s(1);
}

/** Nút nhựa dẹt: gờ dưới tối + thân + đỉnh bắt sáng. Cùng chất liệu với nút HUD. */
function pill(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  face: number,
  on: boolean,
): void {
  const r = Math.min(h / 2, h * 0.34);
  const lip = Math.max(2, h * 0.14);
  g.roundRect(x, y + 2, w, h, r).fill({ color: HUD.shadow, alpha: 0.5 });
  g.roundRect(x, y, w, h, r).fill(darken(face, 0.4));
  g.roundRect(x, y, w, h - lip, r).fill(face);
  g.roundRect(x, y, w, Math.max(2, h * 0.3), r).fill({ color: lighten(face, 0.22), alpha: 0.85 });
  if (on) g.roundRect(x - 1.5, y - 1.5, w + 3, h + 3, r + 1.5).stroke({ width: 2.5, color: 0xffffff });
}

/**
 * Vẽ bảng công cụ bám đáy màn hình. Trả về danh sách vùng chạm để người gọi nhét
 * vào bộ điều phối chạm chung.
 */
export function drawPalette(
  g: Graphics,
  txt: TextPool,
  W: number,
  H: number,
  uiScale: number,
  safeBottom: number,
  st: PaletteState,
): EditHit[] {
  const hits: EditHit[] = [];
  const s = (n: number) => Math.round(n * uiScale);
  const h = paletteHeight(uiScale, st.tool);
  const top = H - h - safeBottom;
  const pad = s(PAD);
  const gap = s(GAP);
  const inner = W - pad * 2;
  const brush = ITEM_PALETTE[st.color];

  g.rect(0, top, W, h + safeBottom).fill(0x171233);
  g.rect(0, top, W, Math.max(2, s(2))).fill(0x6647f5);

  let y = top + pad;

  // ---- công cụ ----
  const tw = (inner - gap * (TOOLS.length - 1)) / TOOLS.length;
  const th = s(H_TOOL);
  TOOLS.forEach((t, i) => {
    const x = pad + i * (tw + gap);
    const on = st.tool === t.v;
    pill(g, x, y, tw, th, on ? HUD.btnFace : 0x322a63, on);
    const label = txt.next(t.label, s(TOOLS.length > 4 ? 13.5 : 15), on ? 0xffffff : 0xa79ada);
    label.x = x + tw / 2;
    label.y = y + th / 2 - s(2);
    hits.push({ x, y, w: tw, h: th, action: { k: 'tool', v: t.v } });
  });
  y += th + gap;

  // ---- màu + hình: chỉ khi công cụ dùng tới ----
  if (usesBrush(st.tool)) {
    const cw = (inner - gap * 7) / 8;
    const ch = s(H_COLOR);
    COLORS.forEach((c, i) => {
      const x = pad + i * (cw + gap);
      pill(g, x, y, cw, ch, ITEM_PALETTE[c], st.color === c);
      hits.push({ x, y, w: cw, h: ch, action: { k: 'color', v: c } });
    });
    y += ch + gap;

    const sh = s(H_SHAPE);
    SHAPES.forEach((sp, i) => {
      const x = pad + i * (cw + gap);
      const on = st.shape === sp;
      pill(g, x, y, cw, sh, on ? brush : 0x2b2450, on);
      // hình tô bằng ĐÚNG màu đang chọn, để nhìn ra ngay cặp (màu × hình) sắp đặt
      shapePath(g, sp, x + cw / 2, y + sh / 2, sh * 0.28).fill(on ? 0xffffff : brush);
      hits.push({ x, y, w: cw, h: sh, action: { k: 'shape', v: sp } });
    });
    y += sh + gap;
  }

  // ---- hai công tắc: chung cho Khay và Chốt, nhãn đổi theo công cụ ----
  if (usesBrush(st.tool)) {
    const lh = s(H_LINK);
    const peg = st.tool === 'peg';
    const toggles: { on: boolean; text: string; action: EditAction }[] = [
      {
        on: st.link,
        text: `⛓  Nối vào ${peg ? 'mảnh' : 'khay'} kề bên:  ${st.link ? 'BẬT' : 'TẮT'}`,
        action: { k: 'link' },
      },
      {
        on: st.stack,
        text: st.stack
          ? `⧉  Bấm ${peg ? 'chốt' : 'khay'} cũ:  ${peg ? 'ĐẮP THÊM LỚP' : 'ĐỔI HÌNH LỖ'}`
          : `⧉  Bấm ${peg ? 'chốt' : 'khay'} cũ:  LẤY MẪU màu + hình`,
        action: { k: 'stack' },
      },
    ];
    for (const t of toggles) {
      pill(g, pad, y, inner, lh, t.on ? 0x4a3f96 : 0x2b2450, false);
      const label = txt.next(t.text, s(13), t.on ? 0xffffff : 0x8f84cf, '700');
      label.x = pad + inner / 2;
      label.y = y + lh / 2 - s(2);
      hits.push({ x: pad, y, w: inner, h: lh, action: t.action });
      y += lh + gap;
    }
  }

  // ---- cỡ lưới: chỉ khi đang vẽ hình board ----
  const gh = s(H_GRID);
  const half = (inner - gap) / 2;
  const stepW = s(38);
  if (st.tool === 'cell') ([
    ['Hàng', st.rows, 'rows'],
    ['Cột', st.cols, 'cols'],
  ] as const).forEach(([name, val, k], gi) => {
    const gx = pad + gi * (half + gap);
    pill(g, gx, y, stepW, gh, 0x3a3170, false);
    txt.next('−', s(19), 0xd9d2ff).position.set(gx + stepW / 2, y + gh / 2 - s(2));
    hits.push({ x: gx, y, w: stepW, h: gh, action: { k, d: -1 } });

    const midX = gx + stepW + gap * 0.5;
    const midW = half - stepW * 2 - gap;
    g.roundRect(midX, y, midW, gh, gh * 0.3).fill(0x241d4c);
    txt.next(`${name} ${val}`, s(13.5), 0xb6abe8, '700').position.set(midX + midW / 2, y + gh / 2 - s(1));

    const px2 = gx + half - stepW;
    pill(g, px2, y, stepW, gh, 0x3a3170, false);
    txt.next('+', s(19), 0xd9d2ff).position.set(px2 + stepW / 2, y + gh / 2 - s(2));
    hits.push({ x: px2, y, w: stepW, h: gh, action: { k, d: 1 } });
  });
  if (st.tool === 'cell') {
    y += gh + gap;

    // ---- thời gian: một stepper rộng cả hàng, bước 5 giây ----
    const sec = Math.round(st.timeMs / 1000);
    const mm = Math.floor(sec / 60);
    const ss = String(sec % 60).padStart(2, '0');
    pill(g, pad, y, stepW, gh, 0x3a3170, false);
    txt.next('−', s(19), 0xd9d2ff).position.set(pad + stepW / 2, y + gh / 2 - s(2));
    hits.push({ x: pad, y, w: stepW, h: gh, action: { k: 'time', d: -1 } });

    const midX = pad + stepW + gap;
    const midW = inner - stepW * 2 - gap * 2;
    g.roundRect(midX, y, midW, gh, gh * 0.3).fill(0x241d4c);
    txt.next(`⏱  Thời gian  ${mm}:${ss}`, s(13.5), 0xb6abe8, '700')
      .position.set(midX + midW / 2, y + gh / 2 - s(1));

    const rx2 = pad + inner - stepW;
    pill(g, rx2, y, stepW, gh, 0x3a3170, false);
    txt.next('+', s(19), 0xd9d2ff).position.set(rx2 + stepW / 2, y + gh / 2 - s(2));
    hits.push({ x: rx2, y, w: stepW, h: gh, action: { k: 'time', d: 1 } });

    y += gh + gap;
  }

  // ---- hoàn tác / xuất / xong ----
  const ah = s(H_ACT);
  const aw = (inner - gap * 2) / 3;
  const acts: { label: string; face: number; on: boolean; action: EditAction }[] = [
    { label: '↶  Hoàn tác', face: st.canUndo ? 0x4a3f96 : 0x2a2450, on: false, action: { k: 'undo' } },
    { label: 'Chép JSON', face: 0x4a3f96, on: false, action: { k: 'export' } },
    // KHÔNG viền trắng: trong bảng này viền trắng nghĩa là "đang chọn". Nút này
    // nổi bằng màu xanh lá là đủ, thêm viền vào là lẫn hai ý nghĩa.
    { label: '✓  Lưu & xong', face: 0x2ea36a, on: false, action: { k: 'done' } },
  ];
  acts.forEach((a, i) => {
    const x = pad + i * (aw + gap);
    pill(g, x, y, aw, ah, a.face, a.on);
    const label = txt.next(a.label, s(14), a.face === 0x2a2450 ? 0x6c62a0 : 0xffffff);
    label.x = x + aw / 2;
    label.y = y + ah / 2 - s(3);
    hits.push({ x, y, w: aw, h: ah, action: a.action });
  });
  y += ah + gap;

  // ---- dòng trạng thái ----
  const ok = st.issues === 0;
  const note = txt.next(
    st.note || (ok ? '✓ dữ liệu hợp lệ' : `⚠ ${st.issues} lỗi dữ liệu — xem console`),
    s(12.5),
    st.note ? 0x9ce8bd : ok ? 0x7fd6a2 : THEME.timerWarn,
    '700',
  );
  note.x = W / 2;
  note.y = y + s(H_NOTE) / 2;

  return hits;
}

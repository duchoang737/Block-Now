// 8 hình vẽ bằng Graphics — dùng chung cho chốt (nổi) và lỗ (lõm). GDD §6/§7.
// Greybox: không cần một file asset nào.
import type { Graphics } from 'pixi.js';
import type { Shape } from '../types';

function polygon(cx: number, cy: number, radius: number, sides: number, rotation = -Math.PI / 2): number[] {
  const pts: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i * Math.PI * 2) / sides;
    pts.push(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
  }
  return pts;
}

function starPoints(cx: number, cy: number, outer: number, inner: number, points = 5): number[] {
  const pts: number[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return pts;
}

function crossPoints(cx: number, cy: number, s: number): number[] {
  const w = s * 0.4;
  return [
    cx - w, cy - s, cx + w, cy - s,
    cx + w, cy - w, cx + s, cy - w,
    cx + s, cy + w, cx + w, cy + w,
    cx + w, cy + s, cx - w, cy + s,
    cx - w, cy + w, cx - s, cy + w,
    cx - s, cy - w, cx - w, cy - w,
  ];
}

/**
 * Vẽ đường bao của `shape` vào Graphics `g`. Người gọi tự .fill()/.stroke() sau.
 * `size` = bán kính (nửa bề rộng) của hình.
 */
export function shapePath(g: Graphics, shape: Shape, cx: number, cy: number, size: number): Graphics {
  switch (shape) {
    case 'circle':
      return g.circle(cx, cy, size);

    case 'square':
      return g.roundRect(cx - size, cy - size, size * 2, size * 2, size * 0.3);

    case 'diamond':
      return g.poly([cx, cy - size, cx + size, cy, cx, cy + size, cx - size, cy]);

    case 'triangle':
      return g.poly(polygon(cx, cy + size * 0.12, size * 1.08, 3));

    case 'pentagon':
      return g.poly(polygon(cx, cy, size, 5));

    case 'star':
      return g.poly(starPoints(cx, cy, size, size * 0.45));

    case 'cross':
      return g.poly(crossPoints(cx, cy, size));

    case 'heart': {
      const s = size;
      g.moveTo(cx, cy + s * 0.78);
      g.bezierCurveTo(cx - s * 1.25, cy - s * 0.12, cx - s * 0.72, cy - s * 1.02, cx, cy - s * 0.36);
      g.bezierCurveTo(cx + s * 0.72, cy - s * 1.02, cx + s * 1.25, cy - s * 0.12, cx, cy + s * 0.78);
      g.closePath();
      return g;
    }

    default:
      return g.circle(cx, cy, size);
  }
}

/**
 * Núm "stud" trên mặt chốt — chi tiết định danh của theme khối nhựa lắp ghép.
 *
 * Ba núm đặt thành tam giác trong bán kính 0.30×size quanh tâm. Cố tình KHÔNG
 * bám theo đường bao: tâm của cả 8 hình đều dày, nên núm luôn nằm gọn bên trong,
 * kể cả sao và chữ thập (thứ có cánh mảnh ở rìa).
 */
/**
 * Bán kính quanh tâm mà cụm núm còn nằm GỌN trong từng hình (tính theo `size`).
 * Đây là thứ ép cỡ núm: ngôi sao có eo chỉ `0.45`, chữ thập có cánh rộng `0.4`,
 * còn tròn/vuông thì gần như trống cả mặt. Dùng MỘT con số chung cho cả 8 hình
 * thì hoặc núm bé tí trên hình tròn, hoặc núm thò ra ngoài ngôi sao.
 */
const SHAPE_ROOM: Record<Shape, number> = {
  circle: 0.98,
  square: 0.98,
  pentagon: 0.84,
  diamond: 0.7,
  heart: 0.6,
  triangle: 0.54,
  star: 0.48,
  cross: 0.4,
};

/**
 * Một núm = HÌNH TRỤ nhô lên khỏi mặt, không phải cái đĩa dẹt. Bốn lớp, và
 * thiếu lớp nào cũng làm nó xẹp về lại thành đĩa:
 *   1. bóng núm hắt xuống mặt khối (lệch xuống-phải theo nguồn sáng trên-trái)
 *   2. thân trụ  — bản sao lệch xuống, tối hơn
 *   3. mặt trên  — sáng hơn mặt khối
 *   4. bắt sáng ở mép trên-trái của mặt trên
 */
function stud(g: Graphics, x: number, y: number, r: number, top: number, side: number): void {
  g.circle(x + r * 0.1, y + r * 0.46, r * 1.02).fill({ color: 0x000000, alpha: 0.26 });
  g.circle(x, y + r * 0.36, r).fill(side);
  g.circle(x, y, r).fill(top);
  g.circle(x - r * 0.2, y - r * 0.22, r * 0.5).fill({ color: 0xffffff, alpha: 0.22 });
}

export function studs(
  g: Graphics,
  shape: Shape,
  cx: number,
  cy: number,
  size: number,
  top: number,
  side: number,
): void {
  // 3 núm cách tâm `s`, bán kính `r`. Không chồng nhau cần `s ≥ 1.155r`; không
  // thò ra ngoài cần `s + r ≤ room`. Lấy `s = 1.16r` ⇒ `r = room / 2.16` —
  // núm to nhất mà hình này còn chứa nổi, và ba núm vừa chạm nhau.
  const room = size * SHAPE_ROOM[shape];
  const r = room / 2.16;
  // Dưới ~1.5px thì núm không còn đọc ra là núm, chỉ thành hạt bẩn — thà bỏ.
  if (r < 1.5) return;
  const spread = r * 1.16;

  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
    stud(g, cx + Math.cos(a) * spread, cy + Math.sin(a) * spread, r, top, side);
  }
}

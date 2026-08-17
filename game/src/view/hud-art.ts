// HUD trên cùng — dựng lại từ ảnh mẫu `docs/ui/ui_only_top_hud.png`.
//
// Vẽ bằng Graphics chứ KHÔNG cắt sprite ra từ ảnh mẫu: ảnh mẫu chỉ 301×58, mỗi
// nút trong đó chưa tới 42px, phóng lên ngưỡng chạm 44px+ của mobile là nhoè.
// Mọi hình ở đây đều là cung tròn và đa giác đều nên dựng vector vừa nét ở mọi
// cỡ máy, vừa đổi được màu theo trạng thái (đồng hồ chuyển vàng/đỏ khi sắp hết giờ).
import { Graphics, Text } from 'pixi.js';
import { HUD } from './theme';

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Chỗ đặt biểu tượng: tâm và bán kính LÒNG nút, không phải cả nút. */
export interface Face {
  cx: number;
  cy: number;
  r: number;
}

/**
 * Nút nhựa vuông bo góc. Từ ngoài vào đúng như lát cắt trong ảnh mẫu:
 * viền tối → gờ đáy → vành (đỉnh bắt sáng) → lòng nút.
 */
export function chunkyButton(g: Graphics, x: number, y: number, s: number): Face {
  const r = s * 0.3;
  const lip = s * 0.09;

  g.roundRect(x, y + s * 0.075, s, s, r).fill({ color: HUD.shadow, alpha: 0.35 });
  g.roundRect(x, y, s, s, r).fill(HUD.btnOutline);

  const b = Math.max(1, s * 0.05);
  const iw = s - b * 2;
  const ir = r - b;
  // vẽ gờ tràn hết rồi mới đè vành lên: phần lộ ra ở đáy CHÍNH LÀ gờ
  g.roundRect(x + b, y + b, iw, iw, ir).fill(HUD.btnLip);
  g.roundRect(x + b, y + b, iw, iw - lip, ir).fill(HUD.btnBody);
  g.roundRect(x + b, y + b, iw, iw * 0.34, ir).fill(HUD.btnBodyTop);

  // lòng nút lệch lên một chút để chừa gờ đáy dày hơn mép trên
  const p = s * 0.155;
  const fw = s - p * 2;
  const fy = y + p * 0.88;
  g.roundRect(x + p, fy, fw, fw, r * 0.6).fill(HUD.btnFaceTop);
  g.roundRect(x + p, fy + fw * 0.36, fw, fw * 0.64, r * 0.6).fill(HUD.btnFace);

  return { cx: x + s / 2, cy: fy + fw / 2, r: fw / 2 };
}

/**
 * Mũi tên tròn "chơi lại": vòng hở ở đỉnh-trái, đầu mũi tên bám đúng tiếp tuyến
 * theo chiều NGƯỢC kim đồng hồ nên nó chỉ sang trái-xuống như trong mẫu.
 */
export function iconRestart(g: Graphics, cx: number, cy: number, R: number, color: number): void {
  const ring = R * 0.66;
  const w = R * 0.36;
  const a0 = rad(250);
  const px = cx + Math.cos(a0) * ring;
  const py = cy + Math.sin(a0) * ring;

  // `moveTo` BẮT BUỘC: `arc` nối một đoạn thẳng từ điểm hiện tại của path tới đầu
  // cung, mà điểm đó đang là góc của hình vẽ trước ⇒ vệt trắng phóng ra khỏi nút.
  g.moveTo(px, py).arc(cx, cy, ring, a0, a0 + rad(300)).stroke({ color, width: w, cap: 'round' });

  const fx = Math.cos(a0 - Math.PI / 2);
  const fy = Math.sin(a0 - Math.PI / 2);
  const head = w * 1.42;
  g.poly([
    px + fx * head * 1.3, py + fy * head * 1.3,
    px - fx * head * 0.25 - fy * head, py - fy * head * 0.25 + fx * head,
    px - fx * head * 0.25 + fy * head, py - fy * head * 0.25 - fx * head,
  ]).fill(color);
}

/** Bánh răng 8 răng. Stroke nối tròn để răng bo đầu như mẫu, không sắc cạnh. */
export function iconGear(
  g: Graphics,
  cx: number,
  cy: number,
  R: number,
  color: number,
  hole: number,
): void {
  const teeth = 8;
  const step = Math.PI / teeth;
  const pts: number[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const a = i * step - Math.PI / 2;
    const rr = i % 2 === 0 ? R * 0.8 : R * 0.56;
    // hai điểm mỗi bậc ⇒ cạnh răng gần như song song thay vì nhọn hoắt
    pts.push(cx + Math.cos(a - step * 0.32) * rr, cy + Math.sin(a - step * 0.32) * rr);
    pts.push(cx + Math.cos(a + step * 0.32) * rr, cy + Math.sin(a + step * 0.32) * rr);
  }
  g.poly(pts).fill(color).stroke({ color, width: R * 0.18, join: 'round', cap: 'round' });
  g.circle(cx, cy, R * 0.26).fill(hole);
}

/** Đồng hồ bấm giờ trong viên thuốc đếm giờ. Nền tối của viên lộ qua mặt đồng hồ. */
export function iconWatch(g: Graphics, cx: number, cy: number, R: number, color: number): void {
  const body = R * 0.72;
  const yc = cy + R * 0.14;
  const lw = R * 0.26;

  g.roundRect(cx - R * 0.22, cy - R * 0.98, R * 0.44, R * 0.34, R * 0.12).fill(color);
  g.circle(cx - body * 0.78, yc - body * 0.78, R * 0.15).fill(color);
  g.circle(cx, yc, body).stroke({ color, width: lw });

  // kim chỉ lên, hơi lệch trái đúng như mẫu
  const a = rad(-100);
  const len = body * 0.72;
  const t = R * 0.13;
  g.poly([
    cx + Math.cos(a) * len, yc + Math.sin(a) * len,
    cx - Math.sin(a) * t, yc + Math.cos(a) * t,
    cx + Math.sin(a) * t, yc - Math.cos(a) * t,
  ]).fill(color);
  g.circle(cx, yc, t * 0.9).fill(color);
}

/**
 * Bề dày nét đắp thêm, theo cỡ chữ. `FATTEN` đắp vào THÂN chữ để nó mập ra —
 * nhưng đắp mạnh tay thì nét dày đè vào ruột chữ và bít mất lỗ trong `e`, `0`, `4`,
 * chữ đọc ra loá và nhoè. Giữ nó nhỏ, để phần "mập" cho `OUTLINE` lo.
 * Hiệu số hai số này chính là bề dày viền nhìn thấy.
 */
const TEXT_FATTEN = 0.045;
const TEXT_OUTLINE = 0.17;

/**
 * Chữ "mập" có viền như mẫu, dựng từ HAI lớp Text thay vì một `stroke` dày.
 *
 * Một Text với stroke dày thì nét vẽ nằm đè LÊN thân chữ (nửa trong nửa ngoài),
 * ăn mất ruột chữ và chữ càng nhỏ càng bị bít. Hai lớp thì lớp sau là bóng chữ
 * đặc màu viền, lớp trước là thân chữ — hiệu số hai bề dày chính là bề dày viền.
 * Nối tròn còn làm chữ bo góc, nên không cần nhúng thêm font chữ nào vào bundle.
 */
export function setChunkyText(
  back: Text,
  front: Text,
  text: string,
  size: number,
  fill: number,
  outline: number,
): void {
  for (const t of [back, front]) {
    t.text = text;
    t.style.fontSize = size;
    t.anchor.set(0.5);
  }
  back.style.fill = outline;
  back.style.stroke = { color: outline, width: size * TEXT_OUTLINE, join: 'round' };
  front.style.fill = fill;
  front.style.stroke = { color: fill, width: size * TEXT_FATTEN, join: 'round' };
}

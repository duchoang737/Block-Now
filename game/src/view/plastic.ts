// Chốt và ổ cắm vẽ bằng Graphics — bản DỰ PHÒNG cho những cặp (màu × hình) chưa
// được gen ảnh.
//
// 50 màn gốc chỉ dùng 17 trong 64 cặp nên chỉ 17 cặp có sprite. Trình sửa màn cho
// chọn cả 64, và cặp thiếu ảnh trước đây vẽ ra một hình DẸT — nằm cạnh mấy viên
// nhựa 3D thì đọc ra như lỗi hiển thị. Ở đây dựng lại đúng ba dấu hiệu làm nên
// chất nhựa của sprite thật, theo GDD §6:
//   · chốt  = thành đứng tối lệch xuống + mặt trên + 3 núm
//   · ổ cắm = thành xa BẮT SÁNG lệch xuống-phải + đáy tối + 3 núm dưới đáy
// Hốc lõm ăn sáng NGƯỢC với khối nổi: nguồn sáng ở trên-trái thì thành sáng của
// hốc nằm ở dưới-phải. Vẽ cùng chiều với chốt là hốc lồi lên mất.
import type { Graphics } from 'pixi.js';
import { darken, lighten } from './theme';
import { shapePath, studs } from './shapes';
import type { Shape } from '../types';

/** 3 núm xếp tam giác, cùng bố cục với sprite thật. */
const STUDS: [number, number][] = [
  [-0.34, -0.18],
  [0.34, -0.18],
  [0, 0.32],
];

/** Viên chốt nổi. `r` là bán kính hình, `cy` là tâm. */
export function drawPlasticPeg(g: Graphics, shape: Shape, cx: number, cy: number, r: number, color: number): void {
  // Thành đứng mỏng lại còn 13%: 20% là bản sao tụt xuống quá sâu, ở hình nhiều
  // ngóc ngách như chữ thập nó ló ra ngang thân và cắt viên chốt làm đôi.
  shapePath(g, shape, cx, cy + r * 0.13, r).fill(darken(color, 0.45)); // thành đứng
  shapePath(g, shape, cx, cy, r).fill(color); // mặt trên
  shapePath(g, shape, cx, cy - r * 0.04, r * 0.92).fill({ color: lighten(color, 0.16), alpha: 0.45 });
  // Núm dùng CHUNG bản vẽ với chốt thật (`shapes.studs`): bốn lớp — bóng hắt,
  // thân trụ, mặt trên, bắt sáng — nên ra hình TRỤ. Bản cũ ở đây chỉ hai vòng
  // tròn lệch nhau, đọc ra mảnh trăng khuyết dán trên mặt viên.
  studs(g, shape, cx, cy, r, lighten(color, 0.12), darken(color, 0.32));
}

/**
 * Bóng TIẾP XÚC dưới viên chốt — thứ nói "viên này BẤM XUỐNG mặt board", chứ
 * không phải "hình dán treo lơ lửng bên trên ô".
 *
 * Bản cũ đổ MỘT bản sao đặc của hình, lệch xuống 0.07 ô, alpha .25. Hai chỗ sai:
 * mép bóng sắc lẻm như chính viên chốt, và nó ló ra thành một vành đen ĐỀU cách
 * chân viên hẳn một quãng — mắt đọc quãng đó ra khe hở giữa viên và mặt board.
 *
 * Bóng thật của vật CHẠM mặt phẳng thì đậm nhất ngay sát chân rồi tán rất nhanh
 * ra ngoài. Pixi không có blur rẻ nên tán bằng ba lớp đồng dạng: lớp to nhất và
 * nhạt nhất vẽ trước, lớp ôm sát chân vẽ sau — alpha chồng lên nhau thành dải
 * chuyển, và vì viên chốt che mất phần giữa nên cái còn nhìn thấy đúng là vành
 * tối ôm chân viên.
 *
 * `lift` = quãng viên được NHẤC khỏi mặt board (px). Nhấc càng cao thì bóng càng
 * rơi xa, càng loe và càng nhạt — đây là tín hiệu DUY NHẤT phân biệt "đang cắm
 * trên board" với "đang cầm trên tay", nên nó phải khác nhau rõ.
 *
 * `strength` hạ cả cụm bóng xuống khi đã có hốc lún ôm chân viên: hốc tự nó đã
 * tối sẵn ở mép trên-trái, cộng thêm bóng đủ đậm nữa là chân viên đóng bánh đen.
 */
export function drawSeatShadow(
  g: Graphics,
  shape: Shape,
  cx: number,
  cy: number,
  size: number,
  cell: number,
  lift = 0,
  strength = 1,
): void {
  const k = Math.min(1, lift / (cell * 0.18)); // 1 = nhấc hết cỡ lúc kéo
  const fade = (1 - 0.42 * k) * strength; // rời mặt board thì bóng nhạt đi
  // [phóng to, lệch xuống (× ô), alpha] — to/nhạt trước, sát chân/đậm sau
  const LAYERS: [number, number, number][] = [
    [1.15, 0.055, 0.10],
    [1.08, 0.038, 0.11],
    [1.03, 0.024, 0.13],
  ];
  for (const [s, dy, a] of LAYERS) {
    // lệch nhẹ sang phải theo nguồn sáng trên-trái, cùng chiều với bóng núm
    shapePath(g, shape, cx + cell * 0.008, cy + cell * dy + lift * 0.62, size * (s + 0.12 * k))
      .fill({ color: 0x000000, alpha: a * fade });
  }
}

/**
 * THÀNH ĐỨNG đắp thêm dưới sprite chốt — thứ làm viên DÀY lên.
 *
 * Sprite chốt là tấm nhựa mỏng: thành đứng vẽ sẵn trong ảnh chỉ ~4% chiều cao.
 * Đứng một mình trên mặt ô phẳng thì bề dày đó không đọc được, và bóng đổ kiểu
 * gì cũng chỉ ra "tấm decal có bóng" — vì bóng nói vật ở TRÊN nền, còn thành
 * đứng mới nói vật này DÀY. Cùng lý lẽ với khung board (`FRAME_LIFT`) và khay.
 *
 * Đắp bằng hai tầng tối dần xuống: một màu phẳng thì thành đọc ra tấm bìa dựng
 * đứng, hai tầng mới ra cạnh nhựa bo tròn.
 */
export function drawSeatSkirt(
  g: Graphics,
  shape: Shape,
  cx: number,
  cy: number,
  size: number,
  cell: number,
  color: number,
): void {
  // Thu nhỏ nhẹ: thành phải nằm GỌN trong bóng của mặt trên, thò ra ngoài mép
  // hình là viên chốt viền đen chứ không phải viên chốt dày.
  g.beginPath();
  shapePath(g, shape, cx, cy + cell * 0.062, size * 0.965).fill(darken(color, 0.52));
  shapePath(g, shape, cx, cy + cell * 0.034, size * 0.98).fill(darken(color, 0.34));
}

/**
 * HỐC ôm chân viên chốt — mặt board bị viên nhựa ấn lún xuống một bậc.
 *
 * Bóng tiếp xúc chỉ nói "viên nằm TRÊN mặt board". Muốn đọc ra "viên CẮM VÀO
 * board" thì phải thấy cái rãnh quanh chân nó, và rãnh chỉ ra rãnh khi hai thành
 * ăn sáng NGƯỢC nhau: nguồn sáng trên-trái ⇒ thành gần (trên-trái) tối, thành xa
 * (dưới-phải) bắt sáng. Vẽ cùng chiều là hốc lồi ngược lên thành cái gờ.
 *
 * Nhấc viên lên (đang kéo) thì hốc TAN theo `lift`: còn hốc mà viên đã bay là
 * board thủng một lỗ chạy theo ngón tay.
 */
export function drawSeatSocket(
  g: Graphics,
  shape: Shape,
  cx: number,
  cy: number,
  size: number,
  cell: number,
  lift = 0,
): void {
  const vis = 1 - Math.min(1, lift / (cell * 0.1));
  if (vis <= 0.02) return;
  const grow = size * 1.075;
  // thành xa bắt sáng — vẽ TRƯỚC, phần còn lộ ra là lưỡi liềm dưới-phải
  shapePath(g, shape, cx + cell * 0.014, cy + cell * 0.018, grow)
    .fill({ color: 0xffffff, alpha: 0.13 * vis });
  // thành gần chìm trong bóng, đè lên trên và chừa lại lưỡi liềm trên-trái
  shapePath(g, shape, cx - cell * 0.012, cy - cell * 0.014, grow)
    .fill({ color: 0x000000, alpha: 0.34 * vis });
}

/**
 * Thanh nối giữa hai chốt cùng mảnh — cũng là NHỰA, không phải nét kẻ.
 *
 * Trước đây thanh này là một roundRect bẹt tô màu gốc: đặt cạnh hai viên chốt có
 * thành đứng và núm thì nó tố cáo cả cụm là hình vẽ phẳng. Ở đây dựng đúng ba
 * lớp như viên chốt — bóng chạm mặt, thành đứng, mặt trên bắt sáng — nên cụm
 * đọc ra MỘT khối nhựa đúc liền đang nằm trên board.
 */
export function drawLinkBar(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  cell: number,
  lift = 0,
): void {
  const r = Math.min(w, h) / 2;
  const k = Math.min(1, lift / (cell * 0.18));
  const drop = cell * 0.03;

  g.roundRect(x + cell * 0.008, y + cell * 0.05 + lift * 0.62, w, h, r)
    .fill({ color: 0x000000, alpha: 0.16 * (1 - 0.42 * k) });
  g.roundRect(x, y + drop, w, h, r).fill(darken(color, 0.4)); // thành đứng
  g.roundRect(x, y, w, h, r).fill(color); // mặt trên
  // gờ bắt sáng chạy dọc mép trên — mảnh, nếu không thanh sẽ sáng hơn cả chốt
  const pad = Math.min(w, h) * 0.22;
  g.roundRect(x + pad, y + pad * 0.7, w - pad * 2, h - pad * 1.7, r * 0.6)
    .fill({ color: lighten(color, 0.22), alpha: 0.5 });
}

/** Hốc ổ cắm. Ăn sáng NGƯỢC chiều chốt, nếu không thì nó lồi lên chứ không lõm. */
export function drawPlasticSocket(g: Graphics, shape: Shape, cx: number, cy: number, r: number, color: number): void {
  shapePath(g, shape, cx + r * 0.09, cy + r * 0.11, r).fill(lighten(color, 0.3)); // thành xa bắt sáng
  shapePath(g, shape, cx, cy, r).fill(darken(color, 0.46)); // đáy hốc
  shapePath(g, shape, cx - r * 0.03, cy - r * 0.05, r * 0.93).fill(darken(color, 0.3));
  for (const [ox, oy] of STUDS) {
    g.circle(cx + ox * r, cy + oy * r, r * 0.14).fill(darken(color, 0.16));
  }
}

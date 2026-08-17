// Palette — GDD §6 (lấy từ screenshot bản gốc). Reskin thay giá trị, giữ cấu trúc.
import type { Color } from '../types';

export const THEME = {
  // Board bằng NHỰA XÁM ĐÁ, không phải nền chàm: khung ngoài sáng hơn lòng board,
  // ô trống là hốc lõm tối hơn nữa. Ba mức xám này là thứ làm khối màu nổi bật.
  background: 0x2b2440,
  boardFrame: 0x5c6b80,
  cellEmpty: 0x2f3a4a,
  cellInner: 0x27303e,
  hudText: 0xb9c6da,
  white: 0xf5f7fb,

  timerBg: 0x1e2634,
  timerWarn: 0xf5c518,
  timerDanger: 0xff4d4d,

  iceBlue: 0xcfeaf5,
  shutterBody: 0x6b5b46,
  shutterFrame: 0xe8a020,

  errorTint: 0xff4d4d,
  ghostPath: 0x8f83ff,
  glow: 0xffffff,
} as const;

/**
 * LẤY MẪU TỪ SPRITE, không đặt tay. Chốt/khay giờ là ảnh thật, nên mọi thứ vẽ
 * bằng Graphics quanh chúng — thanh nối, hiệu ứng cắm, hiệu ứng nổ — phải dùng
 * đúng màu của ảnh, nếu không sẽ lệch tông ngay cạnh viên chốt nó nối vào.
 */
export const ITEM_PALETTE: Record<Color, number> = {
  blue: 0x3dc5fc,
  green: 0x39a42d,
  orange: 0xfc7d01,
  pink: 0xf73f8d,
  purple: 0x9755cf,
  red: 0xe12620,
  white: 0xfbf3e1,
  yellow: 0xfdc002,
};

/**
 * HUD trên cùng — LẤY MẪU TỪ `docs/ui/ui_only_top_hud.png`, không đặt tay.
 * Thứ tự dưới đây đúng theo lát cắt dọc qua giữa nút trong ảnh mẫu: ngoài cùng là
 * viền tối, rồi vành nút tối dần xuống đáy (nguồn sáng từ trên), trong cùng là
 * lòng nút sáng nhất. Chính cái GỜ TỐI ở đáy làm nút trông dày, không phải bóng đổ.
 */
export const HUD = {
  btnOutline: 0x241a52,
  btnLip: 0x3b219c,
  btnBody: 0x5238c3,
  btnBodyTop: 0x6851d7,
  btnFace: 0x6647f5,
  btnFaceTop: 0x7d63ef,
  icon: 0xe7e2fe,

  titleFill: 0xa49cea,
  titleOutline: 0x473b9e,

  pill: 0x1a1641,
  pillEdge: 0x2e2566,
  timeFill: 0xffffff,
  timeOutline: 0x1a1440,
  watch: 0x9b8fe0,

  shadow: 0x0e0a26,
  sheet: 0x2a2160,
} as const;

const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

function shift(hex: number, factor: number): number {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  if (factor >= 0) {
    return (
      (clamp(r + (255 - r) * factor) << 16) |
      (clamp(g + (255 - g) * factor) << 8) |
      clamp(b + (255 - b) * factor)
    );
  }
  const f = 1 + factor;
  return (clamp(r * f) << 16) | (clamp(g * f) << 8) | clamp(b * f);
}

/** Lỗ trên khay = darken(color, 25%) — GDD §6 */
export const darken = (hex: number, amount = 0.25) => shift(hex, -amount);
export const lighten = (hex: number, amount = 0.2) => shift(hex, amount);

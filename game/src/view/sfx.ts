// TIẾNG ĐỘNG — GDD §6.
//
// Bốn file, tất cả lấy TỪ MỘT NGUỒN: bộ `Domino_sfx` trên Freesound, giấy phép CC0
// (dùng thương mại thoải mái, không cần ghi công). Nguồn từng file: `docs/theme/CREDITS-sfx.md`.
//
// VÌ SAO MỘT NGUỒN: mấy vòng duyệt đầu tôi ghép từng tiếng từ nhiều bản ghi khác
// nhau — Lego của người này, gỗ của người kia — và chủ dự án nghe ra ngay: "như các
// chất khác nhau". Mỗi bản ghi một phòng, một micro, một mức âm lượng. Lấy trọn bộ
// từ một buổi ghi thì chúng đồng nhất THEO CÁCH DỰNG, không phải nhờ chọn khéo.
// Thêm tiếng mới về sau cũng phải lấy từ đúng bộ đó.
import cam from './sfx/cam.mp3';
import move from './sfx/move.mp3';
import nhac from './sfx/nhac.mp3';
import thang from './sfx/thang.mp3';

/**
 * Âm lượng từng tiếng, cân BẰNG TAI chứ không đo máy.
 *
 * Bốn file cùng một buổi ghi nên đã gần bằng nhau, nhưng vai trò thì không: tiếng
 * CẮM nghe hàng trăm lần một ván nên phải nhỏ hơn tiếng THẮNG — thứ chỉ nghe một
 * lần. To bằng nhau là sau mươi nước người chơi thấy nhức.
 */
const VOL = { nhac: 0.35, cam: 0.5, move: 0.4, thang: 0.7 } as const;

type Key = keyof typeof VOL;
const URL_OF: Record<Key, string> = { nhac, cam, move, thang };

/**
 * Bể phát — mỗi tiếng vài bản sao dùng vòng.
 *
 * Một `Audio` đang phát mà gọi lại thì nó nhảy về đầu, tức là tiếng trước bị CẮT.
 * Với tiếng rã (ba quân chồng lên nhau trong 170ms) thì cắt như thế là hỏng hẳn.
 * Bốn bản sao là đủ cho mọi chồng lấn game này tạo ra.
 */
const POOL = 4;
const pool = new Map<Key, HTMLAudioElement[]>();
const turn = new Map<Key, number>();

let on = true;

export function setSoundOn(v: boolean): void {
  on = v;
}

export function isSoundOn(): boolean {
  return on;
}

/** Nạp trước. Không nạp thì tiếng đầu tiên của ván trễ mất một nhịp. */
export function loadSfx(): void {
  for (const key of Object.keys(URL_OF) as Key[]) {
    const list: HTMLAudioElement[] = [];
    for (let i = 0; i < POOL; i++) {
      const a = new Audio(URL_OF[key]);
      a.preload = 'auto';
      a.volume = VOL[key];
      list.push(a);
    }
    pool.set(key, list);
    turn.set(key, 0);
  }
}

function play(key: Key): void {
  if (!on) return;
  const list = pool.get(key);
  if (!list) return;
  const i = (turn.get(key) ?? 0) % list.length;
  turn.set(key, i + 1);
  const a = list[i];
  a.currentTime = 0;
  // Trình duyệt chặn phát khi chưa có tương tác của người dùng — nuốt lỗi, đừng để
  // nó làm chết cả frame.
  void a.play().catch(() => {});
}

export const sfxNhac = (): void => play('nhac');
export const sfxCam = (): void => play('cam');
export const sfxThang = (): void => play('thang');

/**
 * KHAY NỔ — không có file riêng, mà XÂU CHUỖI ba quân lệch nhau.
 *
 * Bộ domino không có tiếng "đổ vụn" nào, và bản `5points` sẵn có thì mang cao độ —
 * nghe ra "được điểm" chứ không ra "khay bung ra". Ba cú va lệch nhau vài chục
 * mili-giây mới đúng thứ tai nghe thấy khi một chồng khối rã ra, và vì cả ba đều
 * từ bộ đó nên vẫn đồng nhất với hai tiếng kia. Chủ dự án chốt mật độ THƯA (3 quân).
 */
export function sfxNo(): void {
  if (!on) return;
  play('cam');
  window.setTimeout(() => play('move'), 80);
  window.setTimeout(() => play('nhac'), 170);
}

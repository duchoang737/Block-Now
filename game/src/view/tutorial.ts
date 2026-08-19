// BÀI HƯỚNG DẪN — GDD §5 "1 cơ chế mới mỗi lần, 2–3 màn làm quen".
//
// Bài gắn vào CƠ CHẾ CÓ TRONG DỮ LIỆU MÀN, không gắn vào số màn. Ghi cứng "Lv31
// dạy băng" thì chỉ cần đổi thứ tự màn một lần là bài hiện sai chỗ — mà bộ màn này
// đã được dựng lại cả chục lượt. Ở đây mỗi bài tự soi level xem cơ chế của nó có
// mặt chưa; bài nào chưa dạy mà cơ chế vừa xuất hiện thì bài đó bật lên.
//
// Thứ tự trong mảng là thứ tự ƯU TIÊN: một màn có thể mang hai cơ chế mới cùng lúc
// (Lv37 vừa băng vừa khay đa hình), khi đó dạy cái ĐỨNG TRƯỚC và để cái kia cho màn
// sau — dạy hai thứ một lúc là không ai nhớ được thứ nào.
import type { Level } from '../types';

export interface Lesson {
  id: string;
  title: string;
  /** 1–3 dòng; mỗi dòng một ý, đọc trong lúc đang muốn chơi tiếp */
  body: string[];
  applies: (level: Level) => boolean;
}

const anyPeg = (lv: Level, f: (p: Level['pieces'][number]) => boolean) => lv.pieces.some(f);

export const LESSONS: Lesson[] = [
  {
    id: 'basic',
    title: 'Cách chơi',
    body: [
      'Kéo một khối tới sát khay có lỗ CÙNG MÀU và CÙNG HÌNH.',
      'Chốt tự nhảy vào lỗ. Khay đầy hết lỗ thì nổ, trả lại chỗ trống.',
      'Dọn sạch board trước khi hết giờ. Không có nút lùi lại.',
    ],
    applies: () => true,
  },
  {
    id: 'split',
    title: 'Khối nhiều màu',
    body: [
      'Một khối có thể mang nhiều chốt khác màu, và nó di chuyển NGUYÊN KHỐI.',
      'Cắm được chốt nào thì chốt đó rời ra, phần còn lại thành khối mới.',
    ],
    applies: (lv) =>
      anyPeg(lv, (p) => new Set(p.pegs.map((g) => g.layers[0].color)).size > 1),
  },
  {
    id: 'shapes',
    title: 'Một khay, nhiều hình',
    body: [
      'Khay cùng một màu nhưng mỗi lỗ có thể một HÌNH khác nhau.',
      'Phải gom đủ đúng bộ hình đó thì khay mới nổ.',
    ],
    applies: (lv) => lv.holders.some((h) => new Set(h.holes).size > 1),
  },
  {
    id: 'layers',
    title: 'Chốt nhiều lớp',
    body: [
      'Chốt này có lớp thứ hai nằm dưới, ló ra ở đáy.',
      'Cắm lớp trên xong, chốt Ở LẠI và lộ lớp mới — phải mang nó đi cắm tiếp chỗ khác.',
    ],
    applies: (lv) => anyPeg(lv, (p) => p.pegs.some((g) => g.layers.length > 1)),
  },
  {
    id: 'ice',
    title: 'Băng',
    body: [
      'Băng ĐÓNG BĂNG khối nằm bên trong — nhìn xuyên qua thấy nó, nhưng chưa lấy được.',
      'Con số là số khay phải NỔ trước. Đủ số thì băng vỡ và khối bên trong đi được.',
    ],
    applies: (lv) => (lv.obstacles ?? []).some((o) => o.kind === 'ice'),
  },
];

const KEY = 'ssj.taught';

function seen(): Set<string> {
  try {
    return new Set((localStorage.getItem(KEY) ?? '').split(',').filter(Boolean));
  } catch {
    return new Set(); // WebView chặn localStorage ⇒ dạy lại mỗi phiên, thà thế còn hơn tắt hẳn
  }
}

/** Bài cần dạy ở màn này, hoặc null nếu mọi cơ chế của nó đã dạy rồi. */
export function nextLesson(level: Level): Lesson | null {
  const done = seen();
  return LESSONS.find((l) => !done.has(l.id) && l.applies(level)) ?? null;
}

export function markTaught(id: string): void {
  const done = seen();
  done.add(id);
  try {
    localStorage.setItem(KEY, [...done].join(','));
  } catch {
    /* không lưu được thì thôi */
  }
}

/** Dùng cho nút "Xem lại hướng dẫn" trong Cài đặt. */
export function resetTaught(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* không xoá được thì thôi */
  }
}

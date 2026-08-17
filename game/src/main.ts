import { createGame } from './view/pixi-view';
import { LEVELS, nextLevel } from './levels';
import { deadPieces, validateLevel } from './core/validate';
import { clearEdits, loadEdits } from './editor/store';
import type { Level } from './types';

const stage = document.getElementById('stage')!;

/**
 * Bản sửa từ trình sửa màn ĐÈ LÊN dữ liệu gốc. Nhờ vậy sửa xong tải lại trang là
 * vẫn ra bản đã sửa — không thì mỗi lần F5 lại mất công dựng từ đầu.
 * Xoá bằng `__ssjEdits.clear()` trong console.
 */
const edits = loadEdits();
const byId = new Map<string, Level>(LEVELS.map((l) => [l.id, edits[l.id] ?? l]));
const pick = (id: string): Level | undefined => byId.get(id);

/** Màn chơi gần nhất — mở lại app là vào đúng chỗ đang dở. */
const LAST_KEY = 'ssj.level';
const remember = (id: string): void => {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    /* WebView chặn thì thôi, chỉ mất phần nhớ qua phiên */
  }
};

// Không dùng top-level await: bản APK chạy trong WebView có thể không hỗ trợ (GDD §10).
async function boot(): Promise<void> {
  const catalog = [...byId.values()];

  // Cổng chất lượng chạy ngay ở dev — GDD §8
  for (const level of catalog) {
    const issues = validateLevel(level);
    const dead = deadPieces(level);
    if (issues.length) console.error(`[${level.id}] data issues`, issues);
    if (dead.length) console.warn(`[${level.id}] mảnh chết:`, dead);
  }

  // Thứ tự ưu tiên: ?level= (chia sẻ / QA) → màn chơi dở lần trước → màn 1.
  const params = new URLSearchParams(location.search);
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(LAST_KEY);
  } catch {
    /* kệ */
  }
  const startLevel = pick(params.get('level') ?? '') ?? pick(saved ?? '') ?? catalog[0];

  const game = await createGame(stage, startLevel, {
    // TOÀN BỘ danh mục đưa vào game: bộ chọn màn nay nằm trong khay Cài đặt của
    // chính game chứ không phải thẻ <select> của trang. Trang không còn giao diện
    // nào ngoài canvas.
    catalog,
    edited: new Set(Object.keys(edits)),
    onLevelRequest: () => pick(nextLevel(game.session().level.id)?.id ?? '') ?? catalog[0],
    onLevelChange: (lv) => remember(lv.id),
    onLevelEdit: (lv) => {
      byId.set(lv.id, lv); // bản vừa sửa dùng ngay, không phải tải lại trang
      const i = catalog.findIndex((l) => l.id === lv.id);
      if (i >= 0) catalog[i] = lv;
    },
  });

  // `?edit=1` mở thẳng trình sửa màn; trong game thì vào bằng nút bánh răng.
  if (params.has('edit')) game.edit();
  remember(startLevel.id);

  (window as unknown as Record<string, unknown>).__ssjEdits = {
    list: () => Object.keys(loadEdits()),
    clear: () => {
      clearEdits();
      location.reload();
    },
  };
}

void boot();

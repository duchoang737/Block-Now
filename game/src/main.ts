import { createGame } from './view/pixi-view';
import { LEVELS, nextLevel } from './levels';
import { deadPieces, validateLevel } from './core/validate';
import { clearEdits, loadEdits } from './editor/store';
import type { Level } from './types';

const stage = document.getElementById('stage')!;
const select = document.getElementById('levelSelect') as HTMLSelectElement;
const status = document.getElementById('status')!;

/**
 * Bản sửa từ trình sửa màn ĐÈ LÊN dữ liệu gốc. Nhờ vậy sửa xong tải lại trang là
 * vẫn ra bản đã sửa — không thì mỗi lần F5 lại mất công dựng từ đầu.
 * Xoá bằng `__ssj.clearEdits()` trong console.
 */
const edits = loadEdits();
const byId = new Map<string, Level>(LEVELS.map((l) => [l.id, edits[l.id] ?? l]));
const pick = (id: string): Level | undefined => byId.get(id);

// Không dùng top-level await: bản APK chạy trong WebView có thể không hỗ trợ (GDD §10).
async function boot(): Promise<void> {
  const catalog = [...byId.values()];
  for (const level of catalog) {
    const opt = document.createElement('option');
    opt.value = level.id;
    const mark = edits[level.id] ? '✎ ' : '';
    opt.textContent = `${mark}${level.name ?? level.id}  ·  ${level.rows}×${level.cols}  ·  ⏱ ${Math.round(level.timeLimitMs / 1000)}s`;
    select.appendChild(opt);
  }
  if (Object.keys(edits).length > 0) {
    status.textContent = `${Object.keys(edits).length} màn đang dùng bản đã sửa (✎)`;
  }

  // Cổng chất lượng chạy ngay ở dev — GDD §8
  for (const level of catalog) {
    const issues = validateLevel(level);
    const dead = deadPieces(level);
    if (issues.length) console.error(`[${level.id}] data issues`, issues);
    if (dead.length) console.warn(`[${level.id}] mảnh chết:`, dead);
  }

  const params = new URLSearchParams(location.search);
  const startLevel = pick(params.get('level') ?? '') ?? catalog[0];
  select.value = startLevel.id;

  const game = await createGame(stage, startLevel, {
    onComplete: (r) => {
      status.textContent = `${r.reason} · ${r.moves} moves · time left ${(r.remainingMs / 1000).toFixed(1)}s`;
    },
    onLevelRequest: () => pick(nextLevel(select.value)?.id ?? '') ?? catalog[0],
    onLevelEdit: (lv) => {
      byId.set(lv.id, lv); // bản vừa sửa dùng ngay, không phải tải lại trang
      const issues = validateLevel(lv);
      status.textContent = issues.length
        ? `đã lưu ${lv.id}.json · ⚠ ${issues.length} lỗi dữ liệu`
        : `đã lưu ${lv.id}.json · dữ liệu hợp lệ`;
    },
  });

  // `?edit=1` mở thẳng trình sửa màn; trong game thì vào bằng nút bánh răng.
  if (params.has('edit')) game.edit();

  select.addEventListener('change', () => {
    const level = pick(select.value);
    if (level) {
      game.loadLevel(level);
      status.textContent = '';
    }
  });

  (window as unknown as Record<string, unknown>).__ssjEdits = {
    list: () => Object.keys(loadEdits()),
    clear: () => {
      clearEdits();
      location.reload();
    },
  };

  // giữ dropdown khớp với màn đang chơi khi bấm Next
  setInterval(() => {
    const id = game.session().level.id;
    if (select.value !== id) select.value = id;
  }, 400);

  if (params.has('debug')) {
    const dbg = (window as unknown as Record<string, any>).__ssj;
    status.textContent =
      `win ${window.innerWidth}×${window.innerHeight} · doc ${document.documentElement.scrollWidth}` +
      ` · stage ${stage.clientWidth} · screen ${dbg.app.screen.width}×${dbg.app.screen.height}` +
      ` · dpr ${window.devicePixelRatio} · ${JSON.stringify(dbg.layout())}`;
  }
}

void boot();

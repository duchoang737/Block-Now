// Nơi cất các màn đã sửa bằng trình sửa màn.
//
// Hai đích ĐỘC LẬP nhau, cố ý:
//   · `localStorage` — để bản sửa không mất khi tải lại trang, và lần sau mở màn
//     đó ra là ra bản đã sửa. Đây là bộ nhớ tạm của người dựng màn.
//   · file `.json` tải về máy — mới là bản CHÍNH THỨC để dán vào
//     `levels.data.json`. localStorage nằm trong trình duyệt, xoá cache là bay.
//
// WebView của bản APK có thể chặn `localStorage`, nên mọi lối vào đều bọc try.
import type { Level } from '../types';

const KEY = 'ssj.levels';

export function loadEdits(): Record<string, Level> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, Level>) : {};
  } catch {
    return {};
  }
}

export function saveEdit(level: Level): boolean {
  try {
    const all = loadEdits();
    all[level.id] = level;
    localStorage.setItem(KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

export function clearEdits(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* chặn thì thôi */
  }
}

/**
 * Tải một chuỗi về máy thành file. Trả về `false` nếu trình duyệt chặn — người
 * gọi phải có đường lui (in ra console), không được im lặng nuốt mất dữ liệu.
 */
export function download(name: string, text: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}

// Gộp bundle.js vào một file HTML tự chứa (không có <html>/<head>/<body>)
// để publish làm trang xem online.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] ?? resolve(root, 'dist-single/shape-sort-jam.html');

const js = readFileSync(resolve(root, 'dist-single/bundle.js'), 'utf8')
  // tránh đóng sớm thẻ script nếu chuỗi trong bundle có chứa </script
  .replace(/<\/script/gi, '<\\/script');

// Trang cố ý CHỈ có một theme: đây là một màn hình arcade nền chàm, không phải tài liệu.
// Toàn bộ màu lấy thẳng từ palette của game (view/theme.ts) để khung trang và canvas
// đọc như MỘT mặt phẳng duy nhất — không dựng "hero", vì hero chính là cái board.
const html = `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Shape Sort Jam — prototype</title>
<style>
  :root {
    color-scheme: dark;
    /* safe-area cho tai thỏ / thanh home — renderer đọc lại 4 biến này */
    --sat: env(safe-area-inset-top, 0px);
    --sar: env(safe-area-inset-right, 0px);
    --sab: env(safe-area-inset-bottom, 0px);
    --sal: env(safe-area-inset-left, 0px);
    --ground:  #221c36;   /* nền ngoài board */
    --rail:    #191527;   /* thanh điều khiển */
    --field:   #2b2440;   /* nền canvas của game */
    --frame:   #5c6b80;   /* khung board — nhựa xám đá */
    --ink:     #f5f7fb;
    --muted:   #b9c6da;
    --accent:  #f5c518;   /* vàng đồng hồ của game */
  }
  * { box-sizing: border-box; }

  #ssj-wrap {
    height: 100vh; height: 100dvh; display: flex; flex-direction: column;
    background: var(--ground); color: var(--muted); overflow: hidden;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    overscroll-behavior: none; touch-action: manipulation;
    user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }

  #bar {
    display: grid; gap: 4px 14px; align-items: center;
    grid-template-columns: auto 1fr auto;
    padding: calc(10px + var(--sat)) calc(16px + var(--sar)) 11px calc(16px + var(--sal));
    background: var(--rail); border-bottom: 1px solid #2a2270;
  }
  #brand { display: flex; align-items: baseline; gap: 9px; min-width: 0; }
  #brand b { color: var(--ink); font-size: 14px; font-weight: 700; letter-spacing: .01em; }
  #brand span {
    font-size: 9.5px; letter-spacing: .16em; text-transform: uppercase;
    color: var(--accent); opacity: .85; white-space: nowrap;
  }
  #levelSelect {
    grid-column: 2; justify-self: start; max-width: 100%; min-width: 0;
    background: var(--field); color: var(--ink); border: 1px solid var(--frame);
    border-radius: 9px; padding: 5px 9px; font: inherit; font-size: 12.5px;
  }
  #levelSelect:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  #status {
    grid-column: 3; font-size: 12px; font-variant-numeric: tabular-nums;
    color: var(--muted); opacity: .85; white-space: nowrap;
  }
  #rule {
    grid-column: 1 / -1; font-size: 12px; line-height: 1.5; opacity: .72;
    display: flex; flex-wrap: wrap; align-items: center; gap: 5px 8px;
  }
  /* gói cả câu thành MỘT flex item, nếu không thì gap sẽ giãn từng chữ ra */
  #rule .sentence { flex: 0 1 auto; }
  #rule b { color: var(--ink); font-weight: 600; opacity: .95; }
  #rule i {
    font-style: normal; font-size: 10.5px; padding: 2px 7px; border-radius: 999px;
    background: #2a2270; color: var(--muted); white-space: nowrap;
  }

  #stage {
    flex: 1; width: 100%; min-width: 0; min-height: 0; position: relative;
    touch-action: none;   /* mọi cử chỉ trên board là của game, không phải trình duyệt */
  }
  #stage canvas { display: block; }

  /* Điện thoại: giấu dòng luật để board ăn trọn chiều cao.
     PHẢI đặt CUỐI stylesheet — cùng specificity (#rule) nên thứ tự nguồn quyết định;
     nếu để trên, khai báo display:flex phía dưới sẽ đè mất display:none. */
  @media (max-width: 560px) {
    #bar { padding-bottom: 9px; }
    #rule { display: none; }
    #brand b { font-size: 13px; }
    #levelSelect { font-size: 12px; padding: 7px 9px; }
  }
</style>

<div id="ssj-wrap">
  <div id="bar">
    <span id="brand"><b>Shape Sort Jam</b> <span>prototype M0</span></span>
    <select id="levelSelect"></select>
    <span id="status"></span>
    <span id="rule"><span class="sentence">Nhấc <b>mảnh chốt</b> thả xuống <b>ô trống kề khay</b> — chốt nhảy vào lỗ nếu khớp cả <b>màu × hình</b>.</span><i>khay là khối đặc</i><i>chốt nối nhau đi cùng nhau</i><i>khay đầy lỗ thì nổ</i><i>không có Undo</i></span>
  </div>
  <div id="stage"></div>
</div>

<script type="module">
${js}
</script>
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html, 'utf8');
console.log(`${out}  ${(Buffer.byteLength(html) / 1024).toFixed(0)} kB`);

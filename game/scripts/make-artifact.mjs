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
// `<meta charset>` PHẢI đứng đầu và không được thiếu.
//
// File này được chia sẻ bằng cách gửi thẳng cho người khác mở, tức là qua `file://`
// — không có header `Content-Type` nào để nói bảng mã. Thiếu khai báo thì trình
// duyệt đoán windows-1252 và MỌI chuỗi tiếng Việt trong bundle vỡ thành "CÃ i Ä'áº·t".
// Qua dev server thì không thấy lỗi vì server tự gửi charset trong header, nên bug
// này chỉ lộ ra ở đúng bản đem cho người chơi.
const html = `<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
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

  #phone { flex: 1; width: 100%; min-width: 0; min-height: 0; display: flex; }
  #stage {
    flex: 1; width: 100%; min-width: 0; min-height: 0; position: relative;
    touch-action: none;   /* mọi cử chỉ trên board là của game, không phải trình duyệt */
  }
  #stage canvas { display: block; }

  /* MÁY TÍNH: dựng khung điện thoại giả.
     Ngưỡng đặt theo CẢ hai chiều: máy để bàn rộng ≥760 và cao ≥620. Điện thoại
     xoay ngang có thể rộng 800 nhưng chỉ cao ~400, nên điều kiện chiều cao là thứ
     giữ cho máy thật luôn chơi toàn màn hình.
     Cỡ khung suy từ CHIỀU CAO cửa sổ theo tỉ lệ 9:19.5 của máy đời mới, nên khung
     luôn vừa màn hình chứ không bao giờ tràn. */
  @media (min-width: 760px) and (min-height: 620px) {
    /* mặt bàn: sáng ở giữa, tối dần ra rìa — có nguồn sáng thì vật mới nổi khối */
    #ssj-wrap {
      display: grid; place-items: center; padding: 22px;
      background: radial-gradient(120% 90% at 50% 30%, #2e2760, #140f2b 62%, #0a0718);
    }
    #phone {
      --screen-h: min(calc(100dvh - 44px), 880px);
      flex: 0 0 auto;
      height: var(--screen-h);
      width: min(calc(var(--screen-h) * 9 / 19.5), calc(100vw - 44px));
      padding: 13px;
      border-radius: 50px;
      /* Thân máy TỐI HƠN mặt bàn. Bản trước để thân sáng hơn nền nên cả cái khung
         chìm nghỉm, đọc ra một hình bo góc chứ không ra cái điện thoại. */
      background: linear-gradient(155deg, #4b447e, #16112c 22%, #0b0819 78%, #241d47);
      box-shadow:
        0 0 0 1.5px rgba(255, 255, 255, 0.16) inset,   /* vành kim loại bắt sáng */
        0 0 0 2px rgba(0, 0, 0, 0.7),                  /* mép ngoài */
        0 26px 60px rgba(0, 0, 0, 0.6),                /* bóng đổ xuống bàn */
        0 6px 20px rgba(0, 0, 0, 0.45);
    }
    #stage { border-radius: 38px; overflow: hidden; }
  }

/* KHÔNG có thanh HTML nào phía trên board.
     Đây là game điện thoại: chọn màn nằm trong khay Cài đặt của chính game (nút
     bánh răng), nên trang chỉ còn đúng canvas ăn trọn màn hình. Thanh cũ vừa ăn
     mất chiều cao board, vừa lộ ra là "trang web có nhúng game" chứ không phải
     một cái game. */
</style>

<div id="ssj-wrap">
  <div id="phone"><div id="stage"></div></div>
</div>

<script type="module">
${js}
</script>
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html, 'utf8');
console.log(`${out}  ${(Buffer.byteLength(html) / 1024).toFixed(0)} kB`);

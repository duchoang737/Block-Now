# Block Now!

Prototype game **Shape Sort / Shape-in-Shape** (dựng lại từ *Shape in Shape* của Popcore).
Người chơi **nhấc mảnh chốt** thả xuống ô trống **kề khay** → chốt **nhảy vào lỗ** nếu khớp cả
**màu × hình** → khay đầy lỗ thì **nổ**, trả lại chỗ trống. Có đồng hồ đếm ngược, **không có Undo**.

## Chơi thử ngay (không cần cài gì)

Mở file **`Block-Now_playable.html`** bằng trình duyệt bất kỳ — chơi được luôn trên cả điện thoại.
Đây là bản build gộp một file, tự chứa.

## Cấu trúc thư mục

```
Block Now!/
  Block-Now_playable.html      ← bản chơi ngay, một file tự chứa (mở là chạy)
  docs/
    Block-Now_GDD.md           ← Game Design Document (v2.5, luật + kỹ thuật + level mẫu)
    Block-Now_GameAnalysis.md  ← phân tích game gốc + thị trường
  game/                        ← mã nguồn (TypeScript + Vite + PixiJS v8)
    src/
      core/      # THUẦN, tất định, không thời gian, KHÔNG undo
        board.ts       silhouette đa-panel · holeMap · checkDrop · validAnchors
        items.ts       layers · matching 2 chiều · peel
        rules.ts       R-SEAT · R-UNLINK · R-POP · R-ICE · R-SHUTTER · R-WIN · R-DEAD
        engine.ts      applyMove(pieceId, anchor) · cloneState · hashState
        validate.ts    ràng buộc data §8 · deadPieces · initialFreeSeats
      session/   # đồng hồ tách khỏi core → core vẫn tất định
        clock.ts       countdown, clamp maxStep, pause/resume, addTime
        session.ts     ghép core + clock → cleared / timeout / deadlock
      view/      # Pixi v8 — không asset, mọi hình vẽ bằng code
        pixi-view.ts   board + khay + mảnh + drag nam châm + anim + HUD mobile
        shapes.ts      8 hình (nổi & lõm) bằng Graphics
        theme.ts       palette lấy từ screenshot bản gốc
      levels.data.json · levels.ts · types.ts · main.ts
    scripts/
      make-artifact.mjs   gộp thành một file HTML tự chứa
      shot.mjs            chụp ở đúng cỡ thiết bị qua DevTools Protocol
    index.html
```

## Chạy mã nguồn (để sửa / build lại)

```bash
cd game
npm install
npm run dev          # http://127.0.0.1:5188
```

| Lệnh | Việc |
|---|---|
| `npm run dev` | dev server (thêm `?level=lv_03` mở thẳng một màn) |
| `npm test` | 345 unit test — luật, đồng hồ, cổng chất lượng 50 màn |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | bundle production vào `dist-app/` |
| `npm run build:single` | gộp thành một file HTML → `dist-single/shape-sort-jam.html` (chính là `Block-Now_playable.html`) |

## Trạng thái

Đây là **M0 (greybox)** — kiểm chứng luật lõi, chưa có art thật (8 hình vẽ bằng `Graphics`).
**Đủ 50 màn, Lv1–50**, xếp theo 5 chương của trục độ khó (GDD §5):

| Chương | Màn | Cơ chế |
|---|---|---|
| Ch.1 Tập đi | 1–8 | khay 1–2 lỗ · mảnh 2 chốt cùng loại · khớp (màu × hình) |
| Ch.2 Khối cứng | 9–20 | mảnh đa-loại · unlink · khay 3 lỗ · board nhiều panel |
| Ch.3 Shape-in-shape | 21–32 | `layers` = 2 · khay 5 lỗ đa-hình |
| Ch.4 Băng | 33–44 | `ice` badge 1–4 (giảm 1 mỗi **khay nổ**) |
| Ch.5 Cao thủ | 45–50 | `shutter` (giảm 1 mỗi **lớp cắm**) · `layers` = 3 |

6 màn trong đó dựng lại từ video + screenshot bản gốc; 44 màn còn lại tự dựng và **mọi màn đều qua
solver gate**. 345 test xanh.

**Còn treo cho M1:** level editor · âm thanh. Chi tiết ở cuối `docs/Block-Now_GDD.md`.

### Solver gate (GDD §5)

`src/core/solver.ts` là cổng chất lượng, không phải tiện ích:

- `solve(level)` — BFS theo tầng ⇒ lời giải **ngắn nhất**. `minMoves` trong data là output của nó,
  và `src/levels.solutions.json` là lời giải sinh ra, được `npm test` **replay qua đúng engine**.
- `winnable(state)` — "người chơi thật còn thắng được không". Khác `solve` ở chỗ: engine kết thúc
  màn **ngay** khi `isDead`, nên đường đi qua state như thế không tính là lời giải.
- `fairnessIssues(level)` — vét cạn mọi state đạt được sau ≤3 nước, báo đường nào đã thua.
- `lonelyHoles(level)` — cảnh báo rẻ tiền lúc đang dựng màn: lỗ chỉ có <2 ô trống kề nó.

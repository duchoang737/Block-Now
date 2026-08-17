# Shape Sort Jam — M0 greybox

Prototype kiểm chứng luật lõi của GDD [`../ShapeInShape_GDD.md`](../ShapeInShape_GDD.md).
**Không có một file asset nào** — 8 hình chốt/lỗ vẽ bằng `Pixi.Graphics`.

```bash
npm install
npm run dev        # http://127.0.0.1:5188
```

| Lệnh | Việc |
|---|---|
| `npm run dev` | dev server (`?level=lv_c3_25` mở thẳng một màn, `&debug=1` hiện số đo layout) |
| `npm test` | 55 unit test — luật §3, đồng hồ R-TIME, **cổng chất lượng level §8** |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | bundle production vào `dist-app/` (~96 kB gzip) |
| `npm run build:single` | gộp thành **một file HTML tự chứa** `dist-single/shape-sort-jam.html` để share/xem online |
| `node scripts/shot.mjs <url> <out.png> [w] [h] [dsf] [mobile]` | chụp ở **đúng cỡ thiết bị** qua DevTools Protocol |

> ⚠️ Đừng đo layout bằng `chrome --headless --window-size=W,H --screenshot`: nó render ở
> viewport **rộng hơn** cỡ yêu cầu rồi crop ảnh về cỡ đó, nên bố cục ăn trọn bề ngang
> **trông như bị cắt** dù thực tế vừa khít. Dùng `scripts/shot.mjs`.

## Mobile (GDD §6.1)

Safe-area (`--sat/--sar/--sab/--sal`) · `uiScale = clamp(.78, W/430, 1.3)` · board ăn trọn
phần còn lại, khoảng dư chia 38% trên / 62% dưới · **kéo bằng ngón tay thì mảnh nhấc lên 1 ô**
để ngón không che · vùng chạm ≥44px và rộng hơn phần vẽ · rung ở 3 mốc (nhấc / cắm / nổ) ·
chặn cuộn, kéo-để-tải-lại, zoom double-tap, menu giữ-lâu · `100dvh` + `<meta viewport>`.

## Luật — đã xác minh bằng VIDEO GAMEPLAY bản gốc (2026-08-10)

| | Mô tả |
|---|---|
| **Mảnh (piece)** | Thứ người chơi kéo. Gồm 1..n **chốt** nối nhau, di chuyển như **khối cứng** — tutorial bản gốc: *"Linked shapes move together"* |
| **Kéo (R-FREE)** | Nhấc lên rồi **nhảy thẳng tới ô bất kỳ**, kể cả sang panel rời khác. **Không trượt theo lưới, không tìm đường** |
| **Nam châm (R-MAGNET)** | Trong lúc kéo, mảnh **chỉ bám vào ô thả hợp lệ gần con trỏ nhất** ⇒ **không bao giờ đè lên khối khác**, kể cả giữa chừng. Không có "thả hụt": mọi cú nhả tay đều hợp lệ |
| **Khối đặc (R-BLOCK)** | **Khay, mảnh khác, băng, cửa cuốn đều đặc.** Chốt không bao giờ nằm đè lên khay |
| **Thả (R-DROP)** | Mọi chốt phải rơi vào một **ô trống chơi được**. Sai một ô là **hỏng cả cú thả** |
| **Cắm (R-SEAT)** | Chốt đứng **kề cạnh** một lỗ còn trống khớp cả màu lẫn hình → **nhảy vào lỗ đó**. Duyệt hướng: lên · trái · phải · xuống |
| **Tách (R-UNLINK)** | Chốt bị cắm làm chuỗi đứt → phần còn lại tách thành mảnh rời theo thành phần liên thông — *"Complete goals to unlink"* |
| **Nổ (R-POP)** | Khay đầy hết lỗ → nổ, trả lại ô trống |
| **Shape-in-shape** | Chốt nhiều lớp: cắm lớp ngoài xong, chốt **ở lại đúng ô đó** với lớp trong lộ ra |
| **Board** | Có thể gồm **nhiều panel rời nhau** (thấy ở Level 3 bản gốc) — kéo tự do nên vẫn sang được |
| **Đồng hồ** | Đếm ngược mỗi màn, hết giờ = thua. **Không có Undo**, chỉ ↺ Restart |

Tài nguyên của game là **CHỖ ĐỨNG CẠNH KHAY** — không phải đường đi, cũng không phải chỗ trống
nói chung. Khay chiếm chỗ tới khi nổ, nên **khay này nổ mới mở ra bệ đứng cho khay kia**.
Đó là lý do bố cục bản gốc luôn chừa **một hàng trống** giữa cột khay và cụm chốt.

## Kiến trúc (GDD §7)

```
src/core/      # THUẦN, tất định, không thời gian, KHÔNG undo stack
  board.ts     #   silhouette (đa panel) · holeMap · checkDrop (R-DROP) · validAnchors
  items.ts     #   layers · matching 2 chiều · peel
  rules.ts     #   R-SEAT · R-UNLINK · R-POP · R-ICE · R-SHUTTER · R-WIN · R-DEAD
  engine.ts    #   applyMove(pieceId, anchor) · cloneState · hashState
  validate.ts  #   ràng buộc data §8 + deadPieces()
src/session/   # thời gian tách khỏi core → core vẫn tất định, solver chạy được
src/view/      # Pixi v8 — không asset. Kéo nam châm + ghost mờ. KHÔNG tô đậm/tô đỏ khối nào
               #   Anim cắm đo từ video: 130ms đứng yên → 420ms bay cung → lún vào lỗ → +130ms nổ khay
               #   View trễ theo anim: lỗ vẽ rỗng tới khi chốt chạm; khay đã popped vẫn vẽ tới nhịp nổ
```

Một **nước đi = `(pieceId, ô đích)`**. Kéo tự do nên không có đường đi để phụ thuộc
⇒ luật **path-independent** ⇒ M1 cắm solver BFS/IDA\* vào là chạy.

## Lịch sử sửa luật

**v1 (sai)** — người chơi kéo *khay*, thu chốt bằng *kề cạnh*, di chuyển *trượt theo lưới*.
Suy ra từ bài phân tích thể loại Sort & Jam. Chủ tài liệu bác bỏ, **video xác nhận sai cả ba**.

**v2 (hiện tại)** — kéo *mảnh chốt*, thả *đè lên lỗ*, di chuyển *tự do*. Khớp video.

## Lỗi M0 phát hiện (đã sửa, đã ghi ngược vào GDD)

1. **Đồng hồ chạy khi tab ẩn.** Trang mở lúc tab đang ẩn thì `visibilitychange` không bao giờ bắn.
   → kiểm `document.hidden` ngay lúc khởi tạo.
2. **Một tick nuốt 24 giây.** Sau khi tab bị đóng băng, delta thực bị trừ thẳng vào đồng hồ.
   → clamp `maxStepMs = 250ms`. Không có Undo nên lỗi kiểu này là mất trắng cả màn.
3. **Level ice cũ vô nghĩa.** Với luật kéo tự do, băng ở rìa board không chặn được gì.
   → thiết kế lại để băng nằm **đúng ô mà mảnh cứng buộc phải chiếm**.

## Chưa có (để M1)

- **Solver BFS/IDA\*** — `minMoves` hiện là lời giải đặt tay, chưa phải ngắn nhất (GDD §5)
- **Level editor** — vẫn phải viết `levels.data.json` bằng tay
- `shutter` đã implement trong engine + validate nhưng **chưa có màn nào dùng**
- Âm thanh, haptic, module `park`

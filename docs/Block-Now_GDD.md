# Game Design Document — Shape Sort Jam (Shape-in-Shape Drop Puzzle)

> **Tài liệu tự-chứa (standalone).** Tải folder này về là đủ để build ra game **shape-drop puzzle** kiểu **Shape in Shape** chơi được — không cần file nào khác.
>
> **Shape Sort Jam = nhấc mảnh, thả đúng lỗ, trước khi hết giờ.** Board là một hoặc **nhiều panel lưới rời nhau**, hình bất quy tắc. Trên đó có **KHAY (holder)** — khối màu **đứng yên**, mặt trên khoét **lỗ hình lõm**; và **MẢNH (piece)** — cụm **chốt (peg)** nối nhau. Người chơi **kéo một mảnh TRƯỢT qua các ô trống** (vật cản chặn lại — muốn qua phải kéo vòng, kiểu Parking Jam), rồi **thả xuống ô trống**. **Khay cũng là khối đặc** — không thả đè lên được. Chốt nào **đứng kề cạnh một lỗ còn trống khớp cả màu lẫn hình** thì **NHẢY vào lỗ đó**; **khay đầy hết lỗ → nổ → trả lại ô trống**. Chốt bị cắm làm **chuỗi đứt**, phần còn lại **tách ra thành mảnh rời** ("Complete goals to unlink"). **USP: CHỐT NHIỀU LỚP (shape-in-shape)** — tim đỏ bóc ra là tim vàng, tròn xanh bóc ra là tròn hồng. **Sạch board trước khi hết giờ → thắng.** **KHÔNG có Undo** — sai thì Restart. Theme chỉ là lớp art + text phủ lên.
>
> **Cách dùng:** mở folder này trong VSCode → mở Claude Code → làm theo **§0**. Build bằng **GameBakery**.

**Version:** 2.6 · Base gameplay: **Slide piece through empty cells (blocked by obstacles, drag around) → adjacent peg jumps into matching hole (màu × hình) → unlink → holder pop · countdown timer · no-undo · zero highlight** · Tham chiếu: *Shape in Shape* (**Popcore GmbH**, App Store `id6791993036`, phát hành **2026-07-20**, v1.1.2, 191.9 MB, 12+, EN-only; tên nội bộ từ filename screenshot: **`Shape_Sort_Jam`**).
**Nền tảng:** HTML5 canvas dọc (mobile-first) → đóng gói **APK Android**. Mọi text in-game = **English**.

> 🎥 **v2.0 — luật đã được VIDEO GAMEPLAY xác minh** (bản ghi màn hình 2:06, Level 3→9, chủ tài liệu cung cấp 2026-08-10). Ba điểm cốt lõi của v1.1 đều **SAI** và đã sửa: thứ người chơi kéo là **mảnh chốt** (không phải khay), cách di chuyển là **kéo tự do** (không phải trượt theo lưới), cách cắm là **thả đè lên lỗ** (không phải kề cạnh). Chi tiết đối chiếu ở **Phụ lục B**.
>
> 🎯 **Chỉ thị của chủ tài liệu:** **bám sát bản gốc, không "cải tiến"**. Giữ **countdown timer** (hết giờ = thua) và **KHÔNG có Undo**.
>
> 🧪 **Prototype M0 (greybox): `shape_sort_jam/`** — `npm install && npm run dev`. Core + renderer + 3 màn, **55 unit test xanh**, không một file asset nào. Doc và code lệch nhau thì **code là bản đã chạy thật**.

---

## 0. TL;DR — quy trình build (2 pha)

**Cơ chế là gì:** board = tập ô chơi được (có thể **nhiều panel rời nhau**, silhouette bất quy tắc). Ba loại vật thể:

1. **KHAY (holder)** — **ĐỨNG YÊN**, chiếm 1..5 ô liền nhau, một **màu duy nhất**, mỗi ô là một **lỗ** có **hình** riêng (cùng khay có thể nhiều hình khác nhau). Vẽ như khối nhô lên có chiều cao 3D.
2. **MẢNH (piece)** — **thứ duy nhất người chơi kéo**. Gồm 1..n **chốt (peg)** nối nhau bằng thanh; **di chuyển như một khối cứng**. Mỗi chốt có `layers` — nhiều lớp thì đó là **shape-in-shape**.
3. **CHƯỚNG NGẠI** — băng (`ice`, badge số), cửa cuốn (`shutter`, badge số), ô chết (`wall`).

**Một nước đi:** nhấc mảnh lên (nó bay theo ngón tay, **được vẽ tràn cả ra ngoài khung board**), thả xuống. Cú thả **hợp lệ** khi **mọi chốt** rơi vào một **ô trống chơi được** — **khay, mảnh khác, băng, cửa cuốn đều là khối đặc**. Sai một ô là **hỏng cả cú thả** (mảnh là khối cứng). Thả xong: chốt nào **đứng kề cạnh** một **lỗ còn trống khớp cả màu lẫn hình** thì **nhảy vào lỗ đó**; chuỗi đứt thì phần còn lại **tách thành mảnh rời**; **khay đầy hết lỗ → nổ → trả lại ô trống**.

**Tài nguyên của game là CHỖ ĐỨNG CẠNH KHAY.** Không có tìm đường, nhưng cũng không thả bừa được: muốn cắm thì phải có **ô trống ngay sát lỗ**. Khay chiếm chỗ tới khi nổ ⇒ **khay này nổ mới mở ra chỗ đứng cho khay kia** — đây là toàn bộ thứ tự của game (thấy rõ ở Level 3 và Level 25: luôn có đúng **một hàng trống** làm bệ đứng).

**Thắng/thua:** sạch mảnh + sạch khay → thắng. `timeLimitMs` đếm ngược về 0 → thua → `[Retry]` + `[+30s ▶]`. **KHÔNG có Undo, không có giới hạn lượt, không có Hearts.**

**Stack:** TypeScript + Vite + PixiJS v8 + Vitest. Core **thuần discrete state-machine**, tách hẳn renderer; đồng hồ nằm ở lớp `session` ngoài core để core vẫn tất định.

**Pha 1 — Build base gameplay.** Dán prompt này vào Claude Code:
```
Đọc toàn bộ doc trong folder này và build game theo đúng logic doc mô tả:
1. Scaffold Vite + TypeScript + PixiJS v8 + Vitest (§7).
2. Implement core state-machine thuần theo §3 (rules) + §4 (kéo tự do, thả đè lên lỗ)
   + §8 (data schema), tất định, KHÔNG có undo stack, kèm unit test.
3. Implement solver theo §5 (BFS/IDA* trên state tất định) + fairness harness
   (giải được · minMoves · ngân sách thời gian · dead-branch).
4. Implement Pixi renderer theo §6 (board đa panel + khay tĩnh + mảnh kéo được
   + HUD countdown) + §4 (nhấc/kéo/ghost xanh-đỏ/thả, anim cắm-tách-nổ, win/timeout).
5. Seed ladder bằng level ở Phụ lục A; thêm level thì verify bằng solver (§5).
6. Build app demo (index.html hub) + tự QA theo checklist §9.
Mọi text trong game viết bằng English. Gặp quyết định thiết kế mơ hồ thì hỏi tôi.
```

**Pha 2 — Reskin theme.** Sau khi base chạy: chọn theme, sinh asset + áp palette theo §11. **KHÔNG đổi luật (§3) hay data (§8).**

---

## 1. Concept

- **Thể loại:** casual drop-puzzle **có áp lực thời gian**, mobile-first (HTML5 canvas dọc) → APK Android.
- **Concept:** một **bảng xếp hình đồ chơi** chật chỗ. Những hộp có lỗ nằm sẵn; những cụm chốt nối nhau nằm rải rác. Việc của bạn: **nhấc đúng cụm, thả đúng lỗ, theo đúng thứ tự — trước khi hết giờ**. Hộp đầy thì **nổ tung và biến mất**, trả lại chỗ trống cho nước tiếp theo.
- **Cảm giác cốt lõi:** **triple satisfaction** — (a) *fit*: cú thả mà **cả cụm 3–4 chốt cùng khớp một lượt**; (b) *unlink*: chuỗi đứt ra, những chốt còn lại bỗng **tự do di chuyển**; (c) *pop*: khay đầy nổ, cả một mảng board mở toang. Cộng thêm *reveal* (chốt bóc lớp lộ màu mới) và **nhịp tim cuối màn** khi đồng hồ về dưới 10 giây.
- **Vì sao cơ chế này hay:** nó dạy **không một chữ nào**. Lỗ = lõm tối, chốt = nổi sáng — nhìn là biết cắm cái nào vào đâu. Nhưng chiều sâu đến từ **ràng buộc khối cứng**: một cụm `[vàng][tim][tim][vàng]` chỉ có **đúng một** cách đặt để hai tim vào đúng hai lỗ, và cách đó buộc hai chốt vàng phải rơi vào hai ô cụ thể — có thể đang bị chiếm, có thể đang là băng. Ràng buộc "tất cả cùng khớp một lượt" là toàn bộ bài toán.
- **USP so với đối thủ:** (1) **shape-in-shape** — một chốt phục vụ **hai khay theo thứ tự cứng**, nhân đôi chiều sâu mà không thêm luật; (2) **khớp 2 chiều (màu × hình)** thay vì chỉ-màu như Bus Jam/Block Jam; (3) **linked shapes** — khối cứng đa-loại, thứ tạo ra bài toán xếp chỗ thật sự.
- **Ta GIỮ NGUYÊN từ bản gốc:** countdown timer · không Undo · HUD 3 phần tử · badge độ khó 🔥/💀 · panel `LEVEL COMPLETED!` + "Tap to continue" · board đa panel.
- **Chỗ ta làm TỐT HƠN (chất lượng sản xuất, KHÔNG đụng luật chơi):**
  1. **Solver gate bắt buộc** (§5). Không có Undo ⇒ một màn có nhánh chết sớm là án tử cho retention.
  2. **Nam châm** (§4). Mảnh chỉ bám được vào ô hợp lệ ⇒ **không có "thả hụt"**. Trong game có đồng hồ và không có Undo, một cú thả hỏng là mất thời gian thật. Lưu ý: đây là thay đổi ở **cơ chế bám**, không phải thêm chỉ dẫn thị giác — bản gốc **không tô đậm/tô đỏ khối nào** và ta giữ đúng vậy (§6).
  3. **Không đọc vị (no-gotcha)** (§5).
- **Phiên chơi:** 1 level ≈ 30 giây – 3 phút, đúng bằng `timeLimitMs`. Ladder mục tiêu 60 màn cho Pha 1.

> ⚠️ Prototype nội bộ / game-jam. Chỉ học **cơ chế + taxonomy vật thể**, không sao chép nguyên văn asset/level game khác.

---

## 2. Core gameplay loop

1. Vào level → board hiện (một hoặc nhiều panel). HUD: `[↺]` · `Level x` (+ badge 🔥/💀) · **`⏱ mm:ss` đếm ngược** · `[⚙]`.
2. Đồng hồ chạy ngay sau anim vào màn. Đọc board: khay nào **còn lỗ hình gì**, mảnh nào **có hình dạng gì**, ô trống ở đâu.
3. **Chạm & giữ một mảnh** → mảnh **nhấc lên** (bóng đổ sâu hơn, hơi phóng to) và **bay tự do theo ngón tay**, kể cả ra ngoài khung board.
4. Trong lúc kéo, engine hiện **ghost tại ô sẽ thả**: ô hợp lệ tô **xanh**, ô sai tô **đỏ**; lỗ sẽ nhận chốt được **viền sáng**.
5. **Thả**: nếu mọi chốt hợp lệ → mảnh đặt xuống, chốt nào đè lên lỗ khớp thì **cắm vào**. Nếu có ô sai → mảnh **bật về chỗ cũ**, không mất nước đi.
6. Chốt hết lớp → biến mất; còn lớp → **ở lại đúng ô đó**, lộ hình/màu mới. Chuỗi đứt → phần còn lại **tách thành mảnh rời**.
7. **Khay đầy hết lỗ** → khựng 1 nhịp → **NỔ**, trả lại ô trống. Mỗi lần nổ → **badge băng giảm 1**. Mỗi lớp chốt cắm được → **badge cửa cuốn giảm 1**.
8. **Sạch board trước khi hết giờ** → **thắng**. Nhưng panel **KHÔNG hiện ngay**: người chơi được xem trọn cú cắm + nổ cuối cùng và nhìn board sạch một nhịp, **~2 giây** sau mới hiện `LEVEL COMPLETED!` → màn sau.
9. **Đồng hồ về 00:00** → **thua** → `[Retry]` + `[+30s ▶]` (rewarded, §12).
10. Sai lầm **không lùi lại được** — chỉ `↺ Restart` (reset màn **và** đồng hồ).

---

## 3. Rules (BASE — engine phải đúng từng điểm, KHÔNG đổi khi reskin)

Mọi luật board là **state machine rời rạc tất định**. **Đồng hồ là lớp phủ bên ngoài** (§7): nó không ảnh hưởng luật nào, chỉ quyết định khi nào session kết thúc.

**Từ vựng:**
- `Shape` ∈ `circle | heart | star | diamond | square | cross | pentagon | triangle` (8 hình).
- `Color` ∈ `red | pink | blue | yellow | green | purple | orange | white` (8 màu).
- **Khay (Holder)** — **tĩnh**, chiếm 1..5 ô liền nhau theo 1 trục, một **màu**, mỗi ô 1 **lỗ** (`empty | filled`).
- **Chốt (Peg)** — chiếm 1 ô, có `layers: {shape, color}[]`; `layers[0]` là lớp trên cùng.
- **Mảnh (Piece)** — tập chốt **liên thông**, di chuyển như **khối cứng**. Vị trí = `anchor` + `offset` từng chốt.

**Bất biến nền:**

- **R-DRAG** — hành động **duy nhất** của người chơi là **nhấc một mảnh và thả**. Không chạm được vào khay, băng, cửa cuốn.
- **R-MOVE** — mảnh **TRƯỢT qua ô trống, KHÔNG nhảy thẳng tới ô đích**. Nó là khối cứng đi **từng bước một ô** theo 4 hướng, và **mọi vị trí trung gian** đều phải hợp lệ (mọi chốt nằm trên ô trống chơi được). Hệ quả:
  - **Vật cản CHẶN mảnh.** Muốn qua bên kia một khay/băng/mảnh khác thì phải **kéo VÒNG** — ngón tay dẫn đường qua khoảng trống quanh vật cản, mảnh trượt theo trail. Đâm thẳng vào vật cản thì mảnh **đứng lại**, không xuyên qua.
  - **Cần đủ diện tích để lách.** Mảnh ngang 4 ô **không chui lọt** khe rộng 3 ô, dù ô đích có trống — giống Parking Jam.
  - **Panel rời nhau thì KHÔNG qua lại được** (không có đường trượt). Mỗi màn thiết kế để mọi mảnh giải quyết được **trong panel của nó**.
  - Trong lúc kéo, mảnh **bám ô trượt gần con trỏ nhất theo trail** — không bao giờ hiển thị chồng lên khối khác. Ngón tay chỉ vào ô cấm → mảnh **lặng lẽ dừng** ở ô trượt được gần nhất. **Không tô đỏ, không tô đậm khối nào.**
  - Một nước đi = `(pieceId, ô đích)` với ô đích phải **tới được bằng trượt** (`canReach`). Cài đặt: `reachableAnchors` = BFS trên tập vị trí neo, xuất phát từ chỗ mảnh đang đứng (`core/board.ts`); drag trong view trượt greedy từng ô về phía con trỏ (`view/pixi-view.ts`).
- **R-BLOCK** — **mọi thứ trên board đều là khối đặc**: khay, mảnh khác, băng, cửa cuốn. Chốt **không bao giờ** nằm đè lên khay — nó **đứng cạnh** rồi nhảy vào.
- **R-DROP** — cú thả tại `anchor` **hợp lệ** khi **MỌI chốt còn sống** của mảnh rơi vào một **ô chơi được và đang trống**.
  - **Chỉ cần MỘT ô sai là cả cú thả bị từ chối** — mảnh bật về chỗ cũ, `moves` **không tăng**, state **không đổi**. Đây là ràng buộc trung tâm của game ("Linked shapes move together").
- **R-SEAT** — ngay sau khi mảnh đứng yên: mỗi chốt nhìn **4 ô kề cạnh**; nếu ô đó là một **lỗ còn trống** khớp **cả `color` của khay lẫn `shape` của lỗ** với `layers[0]` của chốt → chốt **NHẢY vào lỗ đó**, lỗ thành `filled`, chốt `layers.shift()`.
  - Duyệt chốt theo **reading order**, mỗi chốt duyệt 4 hướng theo thứ tự **lên · trái · phải · xuống** (tất định).
  - Chốt hết lớp → **biến mất**, ô thành trống. Chốt còn lớp → **Ở LẠI ĐÚNG Ô NÓ ĐANG ĐỨNG** với lớp mới lộ ra (cơ chế **shape-in-shape**).
  - Lặp tới khi **không nhảy thêm được**: lớp trong vừa lộ ra **có thể nhảy tiếp ngay** nếu cũng đang kề một lỗ khớp khác (combo).
  - Một chốt kề **nhiều** lỗ khớp thì vào lỗ đầu tiên theo thứ tự hướng ở trên.
- **R-UNLINK** — sau khi cắm, các chốt còn lại của mảnh được chia theo **thành phần liên thông** (4 hướng): mỗi thành phần thành **một mảnh độc lập**. Tutorial bản gốc gọi đúng tên: *"Complete goals to unlink"*.
- **R-POP** — khay có **mọi lỗ `filled`** → **nổ**: biến mất, mọi ô của nó thành trống ngay. Khay chưa đầy thì **ở lì** — đó là cách người chơi tự bóp chỗ trống của mình.
- **R-ICE** — mỗi khối `ice` có `count`. **Mỗi lần một khay nổ → mọi `ice` giảm `count` đi 1.** Về 0 → vỡ, ô thành trống. Băng là **ô không thả chốt lên được**.
- **R-SHUTTER** — `shutter` phủ một vùng ô: ô bị phủ **không thả lên được** và **nội dung bên dưới bị khoá**. **Mỗi LỚP chốt cắm được → mọi `shutter` giảm `count` đi 1.** Về 0 → cuốn lên.
- **R-TIME** — mỗi màn có `timeLimitMs` **đếm ngược**. Bắt đầu khi board hiện xong, **chạy liên tục**, không dừng khi đang kéo hay đang chạy animation. Chỉ tạm dừng khi mở `⚙ Settings` hoặc app vào background. **`remainingMs ≤ 0` → THUA ngay** (cắt cả animation dở).
  - **Không có cơ chế cộng giờ trong gameplay.** Cắm chốt / nổ khay **không** cộng giây. Nguồn thời gian duy nhất là rewarded `+30s` **sau khi đã thua** (§12).
  - **Trần một bước thời gian: `maxStepMs = 250ms`.** Một tick không bao giờ trừ quá 250ms, kể cả khi delta thực lớn hơn (tab treo, máy ngủ, GC dài). *Phát hiện khi dựng M0: một tick sau khi tab bị đóng băng đã trừ thẳng **24 giây**.*
  - **Kiểm tra `document.hidden` NGAY LÚC KHỞI TẠO**, không chỉ nghe `visibilitychange` — trang có thể mở ra khi tab đang ẩn, khi đó sự kiện không bao giờ bắn.
- **R-NO-UNDO** — **engine KHÔNG có undo stack.** Không API `undo()`, không nút, không lịch sử. Cách duy nhất quay lại là **`↺ Restart`** (reset board **và** đồng hồ).
- **R-WIN** — **0 mảnh và 0 khay** còn trên board, và `remainingMs > 0`.
- **R-DEAD** — **không còn cách nào cắm được chốt NỮA** → thua ngay, panel `No moves left` + `[Retry]`. Không có Undo nên ngồi chờ hết giờ là vô nghĩa.
  - **KHÔNG phải phép cắt một nước.** Bản đầu chỉ hỏi "ngay lúc này có cú thả nào cắm được không", nên màn cần một **nước dọn chỗ** trước rồi mới cắm được sẽ bị **báo thua oan** — lỗi này chỉ lộ ra khi chủ dự án dựng màn bằng trình sửa.
  - Chỗ cứu là một tính chất của chính luật chơi: **chừng nào chưa cắm được chốt nào thì thứ duy nhất thay đổi là vị trí các mảnh** (khay, băng, cửa cuốn đều đứng yên). Nên `isDead` duyệt BFS toàn bộ **không gian vị trí các mảnh**; gặp bất kỳ cú thả nào cắm được thì còn sống, duyệt hết mà không gặp thì chết thật. Đây là kết luận ĐẦY ĐỦ, không phải phỏng đoán theo độ sâu.
  - Trần `DEAD_SCAN_CAP = 3000` cấu hình. Vượt trần thì coi như **còn sống** — báo thua oan một màn giải được hỏng nặng hơn nhiều so với bắt người chơi chờ thêm ở một màn thật sự kẹt.
- **R-DETERMINISTIC** — không random. Một nước đi = `(pieceId, anchor)`; kéo tự do nên **không có đường đi để phụ thuộc** ⇒ state sau chỉ phụ thuộc cặp đó ⇒ solver §5 + replay chạy đúng.

**Điều kiện thắng (`isCleared`):** `pieces.every(gone) && holders.every(popped)`.
**Điều kiện thua:** `remainingMs ≤ 0` **hoặc** `isDead`.

**4 mô-đun nền:**

| Mã | Tên | Định nghĩa | Vai trò thiết kế |
|---|---|---|---|
| **M-GRID** | Board đa panel, bất quy tắc | Có thể gồm nhiều vùng rời nhau | Điều tiết **tổng chỗ trống** — tài nguyên thật của game |
| **M-HOLDER** | Khay có lỗ | Tĩnh; 1 màu, nhiều hình | Mục tiêu **và** vật cản chiếm chỗ |
| **M-PIECE** | Mảnh khối cứng | 1..n chốt liên thông, đa-loại | Ràng buộc trung tâm: **tất cả cùng khớp một lượt** |
| **M-LAYER** | **Shape-in-shape** | `layers.length ≥ 2` | **USP.** 1 chốt → 2 khay, **thứ tự cứng** |

**Chướng ngại (per-level, default off):**

| Mã | Hiệu ứng | Quan sát |
|---|---|---|
| `ice` | Chiếm ô, không thả lên được; badge giảm 1 mỗi **khay nổ**; 0 → vỡ | ✅ screenshot Lv19 (badge 3, 4) · ❌ chưa thấy trong video |
| `shutter` | Phủ vùng, khoá nội dung; badge giảm 1 mỗi **lớp chốt cắm được**; 0 → cuốn lên | ✅ screenshot Lv41 (badge 12) · ❌ chưa thấy trong video |
| `wall` | Ô không bao giờ dùng được (tạo silhouette) | ✅ ngầm định |
| `park` | Ô đỗ riêng cho mảnh chưa cắm được | ⭕ **không cần** — với kéo tự do, mọi ô trống đã là chỗ đỗ. Giữ chỗ schema, Pha 1 không implement |

**Lỗi/biên (luôn phản hồi, quan trọng gấp đôi vì có đồng hồ và không có Undo):**
- Ghost **đỏ** ngay tại ô sai **trước khi** nhả tay; thả sai → mảnh bật về chỗ cũ + lắc nhẹ, **không mất nước đi, không mất thời gian ngoài thời gian thật đã trôi**.
- Chốt đứng cạnh lỗ nhưng không khớp → **không có gì xảy ra**, không báo lỗi. Người chơi tự đọc màu/hình. **KHÔNG tô đỏ, KHÔNG tô đậm, KHÔNG viền sáng khối nào** — đây là chỉ thị rõ ràng của chủ tài liệu sau khi đối chiếu bản gốc.
- `remainingMs ≤ 10s` → đồng hồ đỏ, đập nhịp 1Hz, tick âm thanh.

---

## 4. Input model — nhấc & thả (quyết định "feel")

Toàn bộ tương tác là **1 ngón: chạm-giữ → kéo → thả**. Không tap-to-place, không xoay, không lật.

| Thao tác | Hành vi |
|---|---|
| **Chạm & giữ trên mảnh** | Mảnh **nhấc lên**: dịch lên ~0.18 ô (ngón tay không che), bóng đổ sâu hơn, vẽ ở **layer trên cùng** |
| **Kéo** | Mảnh **TRƯỢT theo ngón tay từng ô một, qua ô trống** (R-MOVE). Đâm vào vật cản thì **dừng lại** — muốn qua phải **kéo vòng**. Mảnh không bao giờ chồng lên khối khác, và không nhảy thẳng tới ô đích xa |
| **Ghost** | **KHÔNG có ghost/highlight nào.** Trong lúc kéo chỉ có mảnh đi theo ngón tay; không mảng sáng dưới ô đích, không viền lỗ, không đường nối, không nháy đỏ. Phản hồi "đúng chỗ" nằm hoàn toàn ở animation chốt nhảy vào lỗ lúc thả |
| **Ngón tay chỉ vào ô cấm** | Mảnh **lặng lẽ** đứng lại ở ô hợp lệ gần nhất. Không phản hồi thêm |
| **Thả** | Luôn hợp lệ → **R-SEAT** → **R-UNLINK** → **R-POP** |
| **Chạm rồi nhả tại chỗ (tap)** | **Không làm gì.** (Bản gốc không có cơ chế gợi ý nào; ta cũng không thêm) |
| **↺ Restart** (HUD trái) | Reset board **và** đồng hồ. Confirm nếu `remainingMs > 50%` |
| **⚙ Settings** (HUD phải) | **Đồng hồ tạm dừng**. Sound / Haptics / Restart |
| ~~Undo~~ | **KHÔNG CÓ.** Không nút, không API, không phím tắt |

**Chi tiết "feel":**
- **Grab offset giữ nguyên**: điểm ngón tay chạm vào mảnh là điểm nó bám — không "nhảy tâm".
- **Haptic**: rung nhẹ mỗi lần ghost đổi ô · rung vừa khi cắm chốt · **rung mạnh + freeze-frame 60ms** khi khay nổ · rung cảnh báo mỗi giây khi `remainingMs ≤ 5s`.
**Anim cắm — nhịp ĐO TRỰC TIẾP từ video bản gốc** (trích 30fps, Level 6, t≈90.87→91.60s):

| Pha | Thời lượng | Hình ảnh |
|---|---|---|
| **1. Đứng yên** | **130ms** | Chốt nằm im ở đúng ô vừa thả, có **viền trắng** "đã đặt xong". Lỗ vẫn vẽ **rỗng** |
| **2. Bay cung** | **420ms** | Chốt **bật lên**, bay cung **cao hơn hẳn mặt khay** (đỉnh ≈ **0.85 ô**), phóng to nhẹ ~12% ở đỉnh, ease-in-out |
| **3. Lún vào lỗ** | 15% cuối của pha 2 | Thu nhỏ ~10% + **vòng sáng loe ra** tại lỗ |
| **4. Khay nổ** | **+130ms** sau khi chốt **cuối cùng** chạm lỗ, kéo **320ms** | Squash rồi nổ thành mảnh |

- **Nhiều chốt cắm cùng lúc thì lệch pha `70ms`/chốt** — bản gốc cho thấy hai lỗ không sáng cùng một frame.
- **Lỗ chỉ được vẽ là ĐÃ ĐẦY sau khi chốt thật sự chạm vào nó.** Model cắm ngay lập tức (để tất định), nhưng **view phải trễ theo animation** — nếu không, lỗ đầy trong khi chốt còn đang bay. Tương tự, **khay đã `popped` trong model vẫn phải tiếp tục được vẽ** cho tới nhịp nổ.
- Tổng một cú cắm-và-nổ ≈ **1.0 giây**. Dài hơn hẳn ước lượng cũ (650ms) — nhưng đây là số đo thật, và **cú "nhảy" chính là khoảnh khắc bán game**: chốt rời tay người chơi rồi **tự** chui vào lỗ. Cảm giác "đặt gần đúng là nó tự khớp" mạnh hơn nhiều so với bắt người chơi đặt chính xác.
- Toàn bộ anim **không chặn input và không dừng đồng hồ**.
- **KHÔNG vẽ đường nối** từ chốt tới lỗ trong lúc kéo — bản gốc chỉ sáng viền lỗ đích.
- **Không auto-play, không gợi ý ép buộc.** Kẹt thì Restart.

---

## 5. Levels & Difficulty

### 5.0 Bộ màn hiện tại (Lv5–50 dựng bằng máy)

Lv1–4 giữ tay. **Lv5–50 sinh bằng `src/tools/gen-levels.test.ts`** rồi lọc bằng chính engine và
solver thật — chạy có chủ đích: `$env:VITE_GEN='1'; npx vitest run src/tools/gen-levels.test.ts`,
sau đó `gen-solutions.test.ts`. Không có cổng env thì mỗi `npm test` là dựng lại toàn bộ dữ liệu game.

**Thước đo độ khó là NGƯỜI CHƠI THAM** (`greedySolves`): hễ có nước cắm được thì cắm ngay, ưu tiên
cắm nhiều lớp nhất. Đó là cách chơi mặc định của người mới. **Màn nào tham mà xong thì màn đó không
bắt ai phải tính** — chỉ số này mới đo đúng thứ ta cần, chứ không phải số nước đi.

**Núm vặn độ khó THẬT là SỐ Ô CÒN TRỐNG** (`Recipe.free`), không phải kích thước board. Board bị
khoét cho tới **đúng** `số ô khay + số ô chốt + free`. Còn 8 ô trống thì mảnh nào cũng đi vòng
được; còn 4–5 ô thì mỗi nước phải tính trước hai ba bước — cùng một cơ chế, khác hẳn về chất.

Kết quả: **42/46 màn làm người chơi tham thất bại**, số nước **5–9, trung bình 6.5**.

Năm điều học được khi dựng, đều trái trực giác và đều phải trả giá bằng một vòng chạy hỏng:
- **Số nước đi phải tính theo SỐ LỚP CHỐT, không đặt tuỳ ý.** Hai mảnh một lớp thì lời giải ngắn
  nhất luôn đúng hai nước; đòi ba là đòi điều không tồn tại (800/800 ứng viên bị loại "quá ngắn").
  Mỗi nước đòi thêm chính là một **nước dọn chỗ bắt buộc**.
- **Board TO làm màn DỄ đi**, và làm cổng kiểm đắt gấp bội: `analyze` tốn 78ms ở 4×4/2 mảnh nhưng
  **21 giây** ở 5×5/3.
- **Mảnh NHIỀU CHỐT là đòn bẩy mạnh nhất.** Một chốt lẻ luôn lách qua ngõ hẹp; khối cứng hai ô thì
  không quay đầu nổi.
- **Chật quá thì BẾ TẮC chứ không phải khó.** `free = 3` cộng mảnh nhiều chốt làm ~480/500 ứng viên
  không giải được. Độ khó dâng bằng **số chốt trên màn**, không bằng bóp thêm chỗ trống.
- **Cỡ board phải suy ra TỪ số ô cần.** Cố định 5×6 rồi khoét xuống 15 ô là khoét mất nửa board:
  nó vỡ thành hành lang cụt và gần như màn nào cũng bế tắc. Lấy lưới vừa khít, chỉ dư 1–4 ô để
  khoét, thì board chật mà vẫn liền khối.

`lonelyHoles` **không còn là cổng chặn** — nó là phép thử thay thế rẻ tiền cho bẫy "hai chốt phải
đổi chỗ", ra đời hồi `isDead` còn cắt màn theo một nước. Giờ `analyze` dựng trọn đồ thị state và
bắt mọi nhánh tự thua, chặt chẽ hơn hẳn. Giữ nó làm cổng thì nó chặn mất đúng thứ ta cần là màn
chật (đo được: 1217/1250 ứng viên bị loại vì lý do này).

### 5.0a BĂNG — đóng băng một khối, KHÔNG phải tường tự tan

Sửa lại cơ chế (2026-08-17, chỉ thị chủ dự án). Bản đầu băng chỉ là mảng chắn đường rồi biến mất
sau `count` lần khay nổ. Bản đúng: **băng phủ lên một khối và khoá nó lại**; vỡ ra thì lộ khối bên
trong và khối đó mới bắt đầu đi được.

Khác nhau một trời về chất lượng câu đố:

| | tường tự tan | đóng băng khối |
|---|---|---|
| người chơi phải làm gì | chờ đủ `count` | **chọn** nổ khay nào trước, bằng quân nào |
| con số trên tảng băng | đồng hồ đếm ngược | **bài toán thứ tự** |
| quân bị ảnh hưởng | không | quân bạn CẦN đang bị nhốt |

Cài đặt: băng dùng chung đường khoá với cửa cuốn — `isCovered()` trong `core/board.ts`. Ô bị phủ
thì thứ nằm dưới **không nhúc nhích, không cắm được**. Mảnh bị đóng băng tự khắc bất động vì
`checkDrop` loại mọi chỗ đặt chồng lên ô băng; không cần chặn thêm ở đâu. `validateLevel` **cho
phép** chốt nằm dưới băng (cấm là cấm luôn cả cơ chế) nhưng vẫn cấm băng đè lên **khay**.

Ba ràng buộc dựng màn, cả ba đều do engine bắt được chứ không phải suy ra:
- **`count` phải nổ được bằng quân TỰ DO.** Nhốt quân của quá nhiều khay là màn tự khoá.
- **Băng không được bịt trọn lối vào một khay.** Lv38 bản đầu phủ bốn ô kề hai khay đáy ⇒ từ nước
  đầu board chỉ còn **đúng một** nước đi hợp lệ, 1831/1831 ứng viên chết.
- **Ô băng phải là ô trống hoặc ô có chốt, không bao giờ là ô khay.** Lv39 bản đầu đặt băng trúng
  hàng khay ⇒ 4000 lần rải ra **đúng 0** chỗ đặt lọt.

**Vẽ băng** (`pixi-view.ts`): một **khối liền** dựng bằng `iceMass()` — cùng thủ thuật với
`frameSilhouette`, mỗi ô một rounded-rect cộng thanh cầu nối, nên cạnh chung giữa hai ô biến mất.
Vẽ ở tầng `gShutter` (**trên** mảnh) để nhìn xuyên xuống khối bị nhốt; badge số phải ở
`shutterLabels`, không thì chính tảng băng phủ mất con số.

`ICE_ALPHA` là núm khó nhất: nó phải làm hai việc ngược nhau — đủ đậm để đọc ra "ô bị đóng băng",
đủ trong để thấy khối bên dưới. Bản `.82` cộng bốn lớp alpha ra ~85% độ đục và giấu sạch khối bên
trong. Bản dùng được giữ **một** lớp phủ lòng ở `.34`, mọi lớp còn lại chỉ chạy ở mép.

### 5.0b Khúc Lv10–20 — board 6×6 đông block (`gen-hard.test.ts`)

Chỉ thị của chủ dự án: *"board rộng hơn, thật nhiều chốt và khay để người chơi bí đi"*. Khúc này
dựng riêng, mỗi màn một tiến trình (`$env:VITE_ONLY='15'`), gộp bằng `merge-hard.test.ts`.

**BFS ngắn nhất KHÔNG dùng được ở cỡ 6×6.** Đo được: `solve` tìm ra lời giải cho **0/12** ứng viên,
mỗi lần bỏ cuộc tốn tới **150 giây** — nó đốt sạch 150k state mà mới tới độ sâu 4–5, trong khi lời
giải dài 12–18 nước. Đây không phải chậm mà là bất khả thi về nguyên tắc: BFS theo tầng phải duyệt
trọn độ sâu *d* trước khi chạm *d+1*, và số state ở độ sâu 12 lớn hơn mọi trần ta dám đặt.

Thay bằng **`findSolution`** — DFS ngẫu nhiên có định hướng, thử lại nhiều lần (`JudgeOptions.dense`).
Cùng lô ứng viên ấy: **10/15 tìm ra lời giải, ~2 giây một lần**. Ba hệ quả phải nói thẳng:
- `minMoves` ở khúc này là **độ dài lời giải tìm được**, tức **chặn TRÊN**, không phải nước ngắn
  nhất. Với ngân sách thời gian thì chặn trên là phía an toàn (cho dư giờ, không cho thiếu).
- Kiểm công bằng đổi từ `analyze` (dựng trọn đồ thị — bất khả thi ở cỡ này) sang `fatalFirstMoves`:
  mọi nước đi ĐẦU phải còn tìm được đường thắng. **Bảo thủ một chiều** — tìm không thấy bị tính là
  hỏng và loại màn. Thà loại oan màn tốt còn hơn ship màn mà nước đầu đã thua, vì game không có Undo.
- Lời giải được **ghi kèm lúc dựng** (`hard-<n>.json`) và `gen-solutions` giữ lại lời giải cũ còn
  replay được. Để nó tự tìm lại bằng BFS là màn vừa dựng xong đã làm đỏ bộ test.

**Thứ giết màn không phải số lỗ mà là KHAY BA Ô.** Đo trên 20 ứng viên mỗi cấu hình:

| Cấu hình 6×6 | Giải được | Nước |
|---|---|---|
| 4 khay **ba ô** · 12 lỗ | 0/5 | — |
| 5 khay **ba ô** · 13 lỗ | 0/7 | — |
| 6 khay **hai ô** · 12 lỗ · trống 10 | **10/15** | 10–18 |
| 7 khay **hai ô** · 14 lỗ · trống 8 | **5/9** | 9–17 |

Khay ba ô bắt gom đủ ba chốt mới nổ; tới lúc board đông thì chuỗi phụ thuộc dài quá và không lối
nào đi lọt. Khay **hai ô** thì thêm khay = thêm màu + thêm khối mà chuỗi vẫn ngắn — đó chính là
"nhiều khay nhiều chốt" mà vẫn chơi được. Mảnh **một chốt** giữ board không đông cứng.

Ô trống rất nhạy: cùng 6 khay/12 lỗ, **trống 10 → 10/15** giải được, **trống 8 → 2/13**. Dưới 8 ô
trống là bế tắc chứ không phải khó.

**Bộ màn dựng ra (2026-08-14)** — toàn bộ 6×6, người chơi tham thất bại ở cả 11 màn:

| | Lv10 | Lv11 | Lv12 | Lv13 | Lv14 | Lv15 | Lv16 | Lv17 | Lv18 | Lv19 | Lv20 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| khay | 5 | 5 | 6 | 6 | 6 | 6 | 6 | 7 | 7 | 7 | 7 |
| chốt | 10 | 10 | 12 | 12 | 11 | 12 | 13 | 14 | 14 | 13 | 14 |
| mảnh | 7 | 6 | 8 | 9 | 7 | 7 | 8 | 8 | 9 | 8 | 10 |
| ô trống | 12 | 11 | 10 | 10 | 11 | 9 | 9 | 8 | 8 | 9 | 8 |
| nước | 12 | 12 | 15 | 13 | 14 | 14 | 17 | 17 | 16 | 16 | 22 |
| giờ | 2:20 | 2:20 | 2:40 | 2:25 | 2:35 | 2:35 | 3:00 | 3:00 | 2:50 | 2:50 | 3:40 |

`VITE_CEIL` là núm làm phẳng đường cong: bộ tìm giữ bản DÀI NHẤT nên độ dài tuỳ may rủi của lô ứng
viên — lượt đầu ra Lv10 **17 nước** trong khi Lv11 chỉ 12, tức màn mở khúc lại nặng hơn ba màn sau
nó. Đặt trần rồi dựng lại Lv10/14/17/19 là hết gợn.

**Trục độ khó** = (1) **tỉ lệ ô trống** (tài nguyên thật), (2) **kích thước & hình dạng mảnh** (mảnh càng dài càng khó tìm chỗ khớp), (3) **mảnh đa-loại** (`[Y][R][R][Y]`), (4) số cặp (màu × hình), (5) **độ sâu `layers`**, (6) chướng ngại, (7) `timeLimitMs`.

| Chương | Board | Cơ chế giới thiệu | `timeLimitMs` |
|---|---|---|---|
| **Ch.1 Tập đi (Lv1–8)** | 4×5 – 5×6, thưa | Khay 1–2 lỗ, mảnh 2 chốt **cùng loại** | **60s** |
| **Ch.2 Khối cứng (Lv9–20)** | **Lv10–20: 6×6 đặc** (5–7 khay, 10–14 chốt, 8–12 ô trống) | **Mảnh đa-loại** + unlink · nhiều màu cùng lúc | **140–220s** (§5.0b) |
| **Ch.3 Shape-in-shape (Lv21–32)** | 2×7 cột & 7×7 | **`layers` = 2** | **300s** (màn dạy) → 120s |
| **Ch.4 Băng (Lv33–44)** | 7×8, dày | **`ice`** badge 2–4 | 90–120s |
| **Ch.5 Cao thủ (Lv45–60)** | 8×9 + **panel phụ rời** | **`shutter`** + khay 5 lỗ đa-hình + `layers` = 3 | 120–180s |

> 📌 **Quy tắc timer khi dạy cơ chế mới:** màn đầu giới thiệu một cơ chế **luôn** được timer rộng gấp 2–3 lần (quan sát trực tiếp: Lv25 bản gốc — board chỉ 2×7 — nhưng có **5 phút**).

**Nguyên tắc curve:** 1 cơ chế mới mỗi lần, 2–3 màn làm quen · giữa 2 màn liền kề chỉ tăng **một** trục · mọi màn **curated** · **không đọc vị** (mọi thông tin cần để giải phải thấy từ đầu, trừ vùng dưới `shutter` — và vùng đó không chứa lời giải bắt buộc cho nửa đầu màn).

**Fairness — BẮT BUỘC (solver gate):**
1. **Giải được** — tồn tại chuỗi nước đi tới `isCleared`.
2. **Biết `minMoves`**.
3. **NGÂN SÁCH THỜI GIAN** — `timeLimitMs ≥ minMoves × 4000 + 20000` (×2.5 với màn dạy cơ chế mới). Ràng buộc **cứng**, test fail nếu vi phạm.
4. **Không bẫy chết sớm** — không state đạt được sau **≤3 nước** mà đã `isDead` **hoặc** không còn giải được. ⚠️ Với luật khối cứng, **cắm sai một nửa mảnh có thể khoá vĩnh viễn nửa còn lại** (vd mảnh `[G][R]` mà lỗ G nằm bên phải lỗ R thì không bao giờ đặt được) — đây là **nguồn bẫy số 1**, solver phải quét.
5. **Tỉ lệ nước-chết thấp** — trong 3 nước đầu, ≤20% nước hợp lệ dẫn tới nhánh không thắng được.
6. **Không thừa/thiếu** — pass bất biến data §8.

> ⚠️ **Nguồn bẫy số 2 — "đổi chỗ" giữa hai chốt lẻ.** *(Phần ràng buộc về nước đỗ tạm dưới đây đã
> KHÔNG CÒN ĐÚNG kể từ khi `isDead` duyệt đủ không gian vị trí — xem §3 R-DEAD. Giữ lại vì kết
> luận thiết kế "mỗi lỗ nên có ≥2 ô trống kề" vẫn đúng và vẫn là cổng `lonelyHoles`.)*
> `Session.move` kết thúc màn **ngay** khi
> `isDead`, mà `isDead` = *không cú thả nào cắm được gì*. Nên **nước đỗ tạm chỉ dùng được khi
> vẫn còn một nước cắm ở chỗ khác**. Hệ quả cho thiết kế: nếu một lỗ chỉ có **đúng một** ô trống
> kề nó, hai chốt lẻ có thể rơi vào thế phải đổi chỗ cho nhau — không chốt nào cắm được, không
> ai dọn được đường, màn chết dù về lý thuyết vẫn "giải được". **Cách chặn: đặt khay sao cho mỗi
> lỗ có ≥2 ô trống kề** (ví dụ khay nằm giữa board thay vì sát mép ⇒ có chỗ đứng cả trên lẫn
> dưới). Đã dính đúng lỗi này khi dựng Lv9 — bản đầu để khay sát hàng 0, solver gate bắt được.

**Solver (`core/solver.ts`) — ĐÃ DỰNG.** `solve()` (BFS theo tầng) sinh `minMoves` + lời giải cho cả
50 màn (`levels.solutions.json`, được `npm test` replay qua đúng engine); `fairnessIssues()` vét cạn
mọi state sau ≤3 nước. Thiết kế gốc bên dưới vẫn là đích cho màn lớn hơn:
- **State** = `(vị trí + layers mọi mảnh, filled mọi khay, count mọi obstacle)` → hash. Không gồm thời gian.
- **Move generation**: với mỗi mảnh, quét mọi `anchor` trong bounding box mở rộng, lọc `checkDrop().ok`. **Pruning chính**: ưu tiên nước có `seats.length > 0`; nước "đỗ tạm" chỉ mở khi nhánh chính tắc.
- **Search**: BFS + `visited` cho màn nhỏ; **IDA\*** với `h = số lớp chốt còn lại` cho màn lớn.
- **Budget**: > 2M state chưa giải → **loại level**.

> Solver là **cổng chất lượng**. Với luật **không-Undo + có-đồng-hồ + khối cứng**, ship màn chưa qua solver không phải rủi ro — đó là chắc chắn hỏng.

---

## 6. Visual / UI spec (BASE — reskin thay giá trị, giữ cấu trúc)

**Layout — HUD 3 phần tử, KHÔNG có nút nào dưới board (đúng bản gốc):**
```
┌─────────────────────────────┐
│ [↺]   💀 Level 29      [⚙] │  ← restart · tên màn + badge · settings
│         ⏱ 01:31             │  ← ĐỒNG HỒ ĐẾM NGƯỢC (pill nền tối)
│                             │
│   ┌───────────────────┐     │
│   │   BOARD (Pixi)    │     │  ← 1..n panel, silhouette bất quy tắc
│   │   có thể nhiều    │     │     căn giữa; cell 56–72px
│   │   panel rời nhau  │     │
│   └───────────────────┘     │
│                             │  ← KHÔNG có tray, KHÔNG có nút Undo
└─────────────────────────────┘
```
**Tỉ lệ dọc:** HUD ~8% · đồng hồ ~6% · đệm ~12% · **Board ~58%** · đệm dưới ~16% (vùng ngón cái để trống, có chủ đích).

**Đồng hồ:** pill `timerBg`, `⏱ mm:ss` đậm. `>30s` trắng · `≤30s` vàng · **`≤10s` đỏ + đập nhịp + tick + viền board ửng đỏ**.

**Khay (tĩnh) — cũng là MỘT VIÊN NHỰA (v3):** thành đứng `darken(color, 42%)` dày `0.16 ô`, mặt trên là **gờ nổi** `lighten(color, 28%)`, rồi **lòng khay thụt xuống một bậc** (inset `0.07 ô`) ở màu gốc — lỗ khoét trong lòng đó. Gờ + lòng thụt là thứ tách khay khỏi mảnh: **mảnh có núm, khay có lỗ**. Lỗ = hình **lõm** `darken(color, 34%)` + bóng trong `darken(color, 60%)`, và **đáy lỗ có NÚM** — cùng chi tiết với núm trên mặt chốt, để mắt đọc ngay ra "cái này cắm vừa cái kia". Núm ở đáy lỗ to và xoè rộng hơn theo tỉ lệ (r `0.20×`, xoè `0.34×`) vì đáy lỗ nhỏ hơn mặt chốt nhiều; dưới **1.5px** thì tự bỏ, nhỏ hơn thế nó chỉ còn là hạt bẩn.

**Mảnh (kéo được):** chốt **nổi**, sáng hơn khay ~15%; thanh nối dày **24% ô** cùng màu chốt. Khi nhấc: dịch lên `0.18 ô`, bóng đổ to hơn, vẽ ở layer trên cùng.

**Shape-in-shape — XẾP CHỒNG, không lồng vào trong (v3):** nhiều lớp = nhiều viên **đè lên nhau**, `layers[0]` nằm trên cùng. Viên dưới **ló ra ở đáy** một đoạn `0.55×size` nên vẫn đọc được màu/hình sắp lộ. Chồng càng cao thì viên càng nhỏ (`size × (1 − 0.11×(n−1))`) để cả chồng lọt trong ô. ⚠️ Ló ít quá thì viên GIỮA của chồng 3 lớp bị che sạch — vi phạm luật "không đọc vị" (§5).

**Ghost:** **không có.** Trong lúc kéo chỉ có mảnh đang bám ô đi theo ngón tay — không mảng sáng dưới ô đích, không viền lỗ, không màu lỗi.

> 🚫 **Nguyên tắc thị giác của bản gốc: KHÔNG tô đậm, KHÔNG tô đỏ, KHÔNG highlight gì khi kéo.** Toàn bộ phản hồi nằm ở **chuyển động** (mảnh bám ô, **chốt nhảy vào lỗ**, khay nổ) chứ không ở màu nhấn. Mọi highlight thêm vào đều làm màn hình rối và lệch bản gốc.

**Chướng ngại:** `ice` khối trong mờ `iceBlue` α.78 + viền sáng + badge số + hạt tuyết · `shutter` panel sọc `shutterBody` + viền vàng `shutterFrame` + badge to, anim cuốn lên.

**Text in-game (English):** `Level {n}` · `🔥 Hard` / `💀 Expert` · win `LEVEL COMPLETED!` + `Tap to continue` · timeout `⏱ Time's up!` + `[Retry] [+30s ▶]` · deadlock `No moves left` + `[Retry]`. **Không có** text Undo, **không có** move counter, **không có** hệ thống sao.

**Nhịp hiện panel kết màn — đừng cướp mất khoảnh khắc thắng:**

| Kết cục | Khi nào hiện panel |
|---|---|
| **Thắng** | `max(nước thắng + 2000ms, animation cuối + 500ms)`. Model chuyển `cleared` **ngay lập tức** nhưng panel phải chờ: cú cắm cuối (~1s) + khay nổ + một nhịp nhìn board sạch. Khớp bản gốc (~2s) |
| **Kẹt (deadlock)** | animation cuối + 500ms — không có gì để ngắm, nhưng vẫn đừng cắt ngang anim |
| **Hết giờ** | **ngay lập tức** — không có animation nào đang chạy đáng giữ |

> Đây là lỗi rất dễ mắc: model kết thúc màn ở đúng frame nước đi cuối, nên nếu view đọc thẳng `status` thì **panel đè lên chính cú animation mà người chơi vừa làm ra**. Thứ người chơi muốn xem nhất lại bị che.

**Palette (hex Pixi `0xRRGGBB`):**
```
background 0x2b2440  boardFrame 0x5c6b80  cellEmpty 0x2f3a4a  cellInner 0x27303e
hudText    0xb9c6da  white      0xf5f7fb  timerBg   0x1e2634
timerWarn  0xf5c518  timerDanger 0xff4d4d ghostOk   0x4de1a2  errorTint 0xff4d4d
iceBlue    0xcfeaf5  shutterBody 0x6b5b46 shutterFrame 0xe8a020

itemPalette
  red 0xe8444e  pink 0xf05fa8  blue 0x3aa9e8  yellow 0xf5c518
  green 0x6ec32b purple 0x9a5cd6 orange 0xf08a2a white 0xe9ecf5
```
**Board Ô NỔI DÍNH LIỀN + CARO (v6).** Bản duyệt: `docs/theme/t6_C_flush.png`. Board là **một tấm
nhựa chàm liền được chia ô**, ô lát **caro** (ô lẻ `(r+c)` tối hơn **25%**).

| Lớp | Cỡ | Màu |
|---|---|---|
| nền (lộ ra ở 4 góc ô giao nhau) | cả ô, hình VUÔNG | `#22234d` |
| nếp vát sáng, mép trên-trái | `4.7%` ô | `#555691` |
| nếp vát tối, mép dưới-phải | `3.1%` ô | `#22234d` |
| mặt ô (phẳng), bo góc `8%` | phần còn lại | `#43447a` |

Ba điều bắt buộc, sai là hỏng ngay:
- **KHÔNG có khe giữa các ô.** Ô ăn trọn ô board và chạm ô bên cạnh; ranh giới chỉ là nếp vát.
  Đây là bài học đắt nhất của cả 6 vòng duyệt: bốn vòng đầu đi tìm "khối nổi đẹp hơn", mà khối
  càng nổi rõ thì board càng đọc ra **các viên rời ghép lại** thay vì một mặt board.
- **Nếp vát bất đối xứng**: sáng ở trên-trái, tối ở dưới-phải. Thụt đều bốn phía thì thành nét
  outline, đọc ra ô kẻ. Ở cỡ thật (64px một ô) đây là thứ DUY NHẤT tạo cảm giác nổi, vì mặt ô phẳng lì.
- **Nền vuông KHÔNG áp caro.** Bốn góc ô bo tròn gặp nhau để hở một khoảng nhỏ; áp caro vào đó thì
  các chấm giao điểm loang lổ hai màu. Hệ số caro áp cho mặt ô và nếp vát, không áp cho nền.

**Màu luôn đo ở CỠ THẬT (64px một ô), không đo trên bản gen 1024px** — máy gen đẩy sáng lên một bậc.

**Khung ngoài board — BO MỀM (v6).** Bản duyệt: `docs/theme/fr_A_soft.png`, chủ dự án chốt **mỏng
đi một nửa** so với bản duyệt. Khung cũ `#5C6B80` xám đá là di sản đời board xám; đặt cạnh gạch
chàm thì vừa cứng vừa lệch tông, nên kéo hết về cùng họ nhựa chàm với lòng board.

Khung phải đọc ra **NỔI LÊN** khỏi nền. Năm lớp, cùng MỘT hình `frameSilhouette`, chỉ khác màu và
độ lệch dọc — xếp từ dưới lên:

| Lớp | Cỡ (theo bề rộng ô) | Màu |
|---|---|---|
| bóng đổ | dịch xuống `lift + 5%` | `#1e192d` **đặc**, không alpha |
| thành đứng — chân | dịch xuống `lift = 26%` | `#2e3059` |
| thành đứng — nửa trên | dịch xuống `lift × 0.45` | `#484c85` |
| gờ sáng mép trên | dịch LÊN `4.5%` | `#8a8cba` |
| mặt khung | dày `23.5%` mỗi bên, bo góc ngoài `42%` | `#585a8f` |
| rãnh tối nơi khung gặp lòng board | `3.7%` | `#11142c` |

Bốn điều bắt buộc:
- **Thành đứng mới là thứ làm khung nổi**, không phải bóng đổ. Bóng chỉ nói "có vật nằm trên nền";
  thành đứng nói "vật này DÀY". Bỏ nó đi thì khung chỉ là một mảng màu dán lên nền.
- **Màu thành đứng phải rõ là VẬT LIỆU khung**, không được sát màu nền. Bản đầu tôi để `#2f3157`,
  gần như trùng nền `#2b2440`, thế là nó đọc ra bóng chứ không ra thành.
- **Thành chia HAI tầng, chân tối hơn.** Một màu phẳng thì đọc ra tấm bìa dựng đứng; hai tầng mới
  ra cạnh nhựa bo tròn tối dần xuống.
- **Bóng đổ tô ĐẶC, không dùng alpha.** `frameSilhouette` vẽ từng ô rồi cộng thanh cầu nối, các
  hình chồng lên nhau; tô alpha thì chỗ chồng cộng dồn thành vệt đen gắt, đậm hơn cả nền.
- **Gờ sáng dựng bằng cách dịch cả hình khung LÊN**, không phải vẽ to hơn một vành. Vẽ to hơn thì
  ra viền đều bốn phía, đọc thành nét kẻ chứ không phải khối bo.

**Ô khoét phải THÔNG RA MÉP — không ô bỏ nào được bị vây kín.** Đây là ràng buộc **dữ liệu**, chặn
ở `enclosedHoles()` (`editor/model.ts`), chứ không phải việc của người vẽ.

Lý do là hình học, không phải thẩm mỹ. `frameSilhouette` phình vùng chơi được ra rồi bo góc, nên
khung ngoài chính là **đường bao** của vùng đó. Một ô bỏ bị các ô chơi được vây kín bốn phía sinh
thêm **một đường bao THỨ HAI** nằm lọt giữa board, tách rời đường bao ngoài — mắt đọc ra ngay thành
"một hình dán vào giữa" chứ không phải tường. **Không cách vẽ nào chữa được**: đã thử khoét tròn,
khoét vuông, bo mượt, mirror đủ bộ lớp sáng-tối của khung ngoài, và chủ dự án bác cả năm vòng với
đúng một câu — *"tôi muốn nó là 1 nét liền mạch từ ngoài vào trong"*. Hai đường bao rời nhau là sự
thật của **hình**, không phải của **nét**.

Chỗ khoét thông ra mép thì đường bao ngoài chỉ việc lượn vào rồi lượn ra: vẫn đúng một nét, và
tường trong lòng board dùng chung từng lớp vật liệu với khung ngoài vì **nó chính là khung ngoài**.

Ràng buộc được giữ ở ba chỗ, để không quay lại được:
- `toggleCell()` từ chối cả hai chiều — tắt một ô có thể tạo ô kín, mà **bật** một ô cũng có thể
  bịt nốt lối thông cuối cùng của một chỗ khoét đang hở.
- Bộ sinh màn **khoét từ ngoài vào**: chỉ bỏ được ô ở mép lưới hoặc ô kề một ô đã bỏ. Không mất
  hình dạng nào — mọi board có vùng bỏ thông ra mép đều dựng được theo thứ tự đó.
- `judge()` (bậc 1) và `levels.test.ts` chặn lần cuối trên dữ liệu đã ship.

Năm màn cũ dính lỗi này đã chữa (2026-08-14): Lv8/33/36/38 **khoét thông thành vịnh**, Lv13 lấp lại
thì người chơi THAM thắng luôn nên **dựng lại hẳn** (5 → 8 nước). Ảnh duyệt: `docs/theme/bay.html`.

**`layout()` phải cộng khung vào mẫu số**:
`cell = min(availW/(cols + 2·FRAME_W), availH/(rows + 2·FRAME_W + FRAME_LIFT))`.
Khung ăn thêm `FRAME_W × cell` mỗi bên và thành đứng thò thêm xuống dưới; không trừ trước thì màn
nào board rộng gần bằng máy sẽ bị cắt mất khung ở rìa.

**Theme khối nhựa lắp ghép (v3).** Board = nhựa **xám đá** ba mức (khung sáng > lòng board > ô lõm),
khối màu = kẹo bão hoà. Chốt vẽ thành **KHỐI**: thành đứng `darken(màu, 34%)` lệch xuống `0.26×size`,
rồi mặt trên, rồi **3 núm stud** xếp tam giác trong bán kính `0.30×size` — núm và vệt sáng chỉ vẽ trên
mặt TRÊN CÙNG của chồng. Ảnh art-direction: `docs/theme/`.

**Điểm chèn art reskin:** `holderTextures`, `pegSprites` (8 hình), `boardTexture`, `obstacleSprites`.

**Khay khít đúng ô (bắt buộc):** khay dùng **cùng inset (6% ô) và cùng bo góc (20% ô)** với ô board bên dưới, và **chân 3D nằm GỌN BÊN TRONG khối** (một dải tối ~16% ô ở đáy), **không đổ tràn xuống hàng dưới**. Lỗ ăn theo **mặt trên** (đã bị chân ăn mất một dải) nên tâm lỗ dịch lên nửa chiều cao chân.

**HUD trên cùng (v4).** Mẫu duyệt: `docs/ui/ui_only_top_hud.png`. Bốn cụm, tất cả vẽ bằng
Graphics trong `view/hud-art.ts` — **không cắt sprite từ ảnh mẫu**, vì mẫu chỉ 301×58 nên nút
trong đó chưa tới 42px, phóng lên ngưỡng chạm 44px là nhoè.

| Cụm | Vị trí | Nội dung |
|---|---|---|
| Nút **Chơi lại** | trái, cùng đường padding với board | mũi tên tròn hở đỉnh-trái |
| **Tên màn** | giữa, HÀNG TRÊN (cao hơn tâm nút) | `Level N` + 2 huy hiệu đồng hồ hai bên |
| **Đồng hồ** | giữa, HÀNG DƯỚI | viên thuốc tối + đồng hồ bấm giờ + `MM:SS` |
| Nút **Cài đặt** | phải, đối xứng nút trái | bánh răng 8 răng |

- **Nút nhựa** dựng bằng 5 lớp roundRect chồng nhau, từ ngoài vào: viền tối → **gờ đáy** →
  vành (đỉnh bắt sáng) → lòng nút. Chính gờ đáy làm nút dày, không phải bóng đổ.
- **Chữ mập có viền** = HAI lớp `Text` chứ không phải một `stroke` dày: lớp sau là bóng chữ đặc
  màu viền, lớp trước là thân chữ, hiệu số hai bề dày chính là bề dày viền. Nối tròn (`join: 'round'`)
  làm chữ bo góc ⇒ **không cần nhúng font** nào vào bundle.
- Tên hiển thị lấy phần **trước dấu `·`** (`Level 33 · Ice + Unlink` → `Level 33`) và **tự co**
  nếu cụm tên chạm vào hai nút.
- Đồng hồ **đệm 0 cho phút** (`01:30`) để viên thuốc không co giãn mỗi lần rơi qua mốc 10 phút;
  vẫn giữ chuyển **vàng ≤30s / đỏ ≤10s + đập nhẹ**.
- Bảng màu HUD nằm ở `THEME.HUD`, **lấy mẫu từ chính ảnh duyệt**.

**Khay Cài đặt** sau nút bánh răng: rung phản hồi bật/tắt (nhớ qua `localStorage`), chơi lại màn,
đóng. Khay mở thì **nuốt toàn bộ input** phía sau — chạm ngoài khay là đóng.

### 6.1 Mobile (mobile-first — đây là game điện thoại)

**Layout co giãn theo máy, không khoá cứng tỉ lệ:**
- Đọc **safe-area** qua 4 biến CSS `--sat/--sar/--sab/--sal` (`env(safe-area-inset-*)`) — tai thỏ và thanh home không được che HUD hay board.
- `uiScale = clamp(0.78, W/430, 1.3)`; HUD cao `84 × uiScale`; padding ngang `12 × uiScale + safe`.
- **Board ăn TRỌN phần còn lại**: `cell = min(availW/cols, availH/rows)`, kẹp `[20, 104]px`. *Không* khoá 60% chiều cao như bản đầu — trên máy dọc cách đó bỏ phí gần một phần ba màn hình.
- Khoảng trống dư chia **38% trên / 62% dưới** — chừa vùng dưới cho ngón cái, và board không bị treo lơ lửng giữa hai mảng trống bằng nhau.
- Mọi cỡ chữ HUD, nút và panel đều nhân `uiScale`.

**Chạm:**
- **Nhấc mảnh lên 1 ô khi kéo bằng NGÓN TAY** (`pointerType === 'touch'`) — ngón cái che mất chính thứ đang kéo là lỗi số 1 của puzzle mobile. Chuột thì không nhấc.
- Vùng chạm nút ≥ **44px** và **nới rộng hơn phần vẽ** (thêm `8 × uiScale` mỗi phía).
- **Rung** ở đúng 3 mốc: nhấc mảnh `8ms` · chốt nhảy vào lỗ `14ms` · khay nổ `[0,18,45,30]`. **Không** rung theo từng ô khi kéo.

**Trang/WebView:**
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` — **thiếu cái này là mobile dựng ở 980px rồi thu nhỏ**, chữ li ti và media query không khớp.
- `height: 100dvh` (không phải `100vh` — thanh URL trên mobile).
- `overscroll-behavior: none` (chặn kéo-để-tải-lại) · `touch-action: none` trên board · `touch-action: manipulation` ở ngoài (bỏ delay 300ms + zoom double-tap).
- `user-select: none` · `-webkit-touch-callout: none` · `-webkit-tap-highlight-color: transparent`.
- Chặn `touchstart`/`touchmove`/`contextmenu` ngay trên canvas.
- Dưới **560px**: giấu dòng chữ hướng dẫn, thu gọn thanh trên. ⚠️ Đặt media query **CUỐI stylesheet** — cùng specificity thì thứ tự nguồn quyết định, để trên là bị khai báo phía dưới đè mất.

> 🛠 **Đo layout mobile phải dùng emulation thật.** `chrome --headless --window-size=W,H --screenshot` render ở viewport **rộng hơn** cỡ yêu cầu rồi crop ảnh về đúng cỡ đó ⇒ mọi bố cục ăn trọn bề ngang đều **trông như bị cắt** dù thực tế vừa khít. Dùng `Emulation.setDeviceMetricsOverride` qua DevTools Protocol (`shape_sort_jam/scripts/shot.mjs`).

---

## 7. Technical architecture

**Stack:** `typescript ^5.7` · `vite ^6` · `pixi.js ^8` · `vitest ^3`. ESM.
**Nguyên tắc:** core logic thuần, tách hẳn render; **đồng hồ nằm ở `session/`, ngoài core** ⇒ core tất định, solver không phải mô hình hoá thời gian, test logic không cần fake timer.

```
src/
  core/                # THUẦN, tất định, không thời gian, KHÔNG undo stack
    board.ts           #   playableSet (đa panel) · holeMap · checkDrop (R-DROP) · validAnchors
    items.ts           #   topLayer · matches (2 chiều) · peel · layersLeft
    rules.ts           #   R-SEAT · R-UNLINK · R-POP · R-ICE · R-SHUTTER · R-WIN · R-DEAD
    engine.ts          #   createState · applyMove(pieceId, anchor) · cloneState · hashState
    validate.ts        #   ràng buộc data §8 · deadPieces()
    solver.ts          #   BFS + fairness harness (§5) — solve/winnable/fairnessIssues
  session/
    clock.ts           #   countdown, clamp maxStep, pause/resume, addTime
    session.ts         #   ghép core + clock → cleared / timeout / deadlock
  view/
    shapes.ts          #   8 hình (nổi & lõm) bằng Graphics
    pixi-view.ts       #   board + khay + mảnh + ghost + HUD + drag tự do + anim
    theme.ts
  levels.ts · levels.data.json · types.ts · main.ts
index.html             # demo hub (dropdown Level + board)
```

**Public API:**
```ts
function createGame(host: HTMLElement, level: Level, options?: GameOptions): Promise<GameHandle>;

interface GameOptions {
  onComplete?: (r: GameResult) => void;
  onLevelRequest?: (dir: 1) => Level | undefined;
}
interface GameHandle {
  destroy(): void;              // dọn Pixi + listener + clock
  loadLevel(level: Level): void;
  restart(): void;              // reset board VÀ đồng hồ
  session(): Session;
  // KHÔNG có undo() — xem R-NO-UNDO (§3)
}
interface GameResult { levelId; solved; reason: 'cleared'|'timeout'|'deadlock';
                       remainingMs; timeLimitMs; moves; restarts; elapsedMs; }
```
> `moves` chỉ dùng cho analytics/tuning, **không hiển thị in-game**.

---

## 8. Data format — `Level`, `HolderSpec`, `PieceSpec`

```ts
type Shape = 'circle'|'heart'|'star'|'diamond'|'square'|'cross'|'pentagon'|'triangle';
type Color = 'red'|'pink'|'blue'|'yellow'|'green'|'purple'|'orange'|'white';
type Cell  = [number, number];   // [row, col]

interface Level {
  id: string; chapter: number; rows: number; cols: number;
  playable?: Cell[];            // bỏ trống = full rect. LIỆT KÊ để tạo nhiều panel rời nhau
  holders: HolderSpec[];        // TĨNH
  pieces: PieceSpec[];          // KÉO ĐƯỢC
  obstacles?: ObstacleSpec[];
  timeLimitMs: number;          // BẮT BUỘC — countdown (R-TIME)
  minMoves?: number;            // solver §5 điền; KHÔNG hiện in-game
  difficulty?: 'normal' | 'hard' | 'expert';
  name?: string;
}

interface HolderSpec {
  id: string; color: Color;
  cells: Cell[];                // 1..5 ô liền nhau theo 1 trục
  holes: Shape[];               // holes[i] ứng với cells[i]; CÙNG MÀU, KHÁC HÌNH được
  filled?: boolean[];
}

interface PieceSpec {
  id: string;
  pegs: { id: string; cell: Cell; layers: { shape: Shape; color: Color }[] }[];
}

interface ObstacleSpec { kind: 'ice'|'shutter'|'wall'|'park'; cells: Cell[]; count?: number }
```

**Ràng buộc data (verify trước solver — `validate.ts`):**
1. **Cân bằng:** với mọi cặp `(color, shape)`, `số lỗ == số lớp chốt`.
2. Mọi ô nằm trong `playable`; **không vật thể nào chồng nhau**. *(Hệ quả: chốt không thể nằm sẵn trên lỗ.)*
3. Khay: `cells` liền nhau, thẳng hàng, `cells.length === holes.length`, `1..5` ô.
4. **Mảnh phải LIÊN THÔNG** (4 hướng) — nó di chuyển như khối cứng; mọi chốt `layers.length ≥ 1`.
5. `ice.count ∈ [1, số khay]`.
6. `shutter.count ∈ [1, số lớp chốt NGOÀI vùng shutter]`.
7. `timeLimitMs > 0` và thoả ngân sách §5.3.
8. **Không có "mảnh chết"** — mọi mảnh phải có ít nhất một lớp khớp được một lỗ nào đó trên board.
9. Pass **solver gate §5**.

### 8.1 Trình sửa màn (in-game)

Vào bằng **bánh răng → ✎ Sửa màn này**, hoặc mở thẳng bằng `?edit=1`. Code: `editor/model.ts`
(phép sửa, thuần dữ liệu) + `view/editor-ui.ts` (bảng công cụ) + phần nối trong `pixi-view.ts`.

| Công cụ | Chạm vào ô trống | Chạm vào ô đã có |
|---|---|---|
| **Ô** | bật ô vào board | tắt ô, **xoá luôn thứ đứng trên đó** |
| **Khay** | khay mới 1 ô, **ĐỨNG RỜI** | **LẤY MẪU** màu + hình vào cọ |
| **Chốt** | chốt mới, **ĐỨNG RỜI** | **LẤY MẪU** màu + hình vào cọ |
| **✥ Kéo** | — | **kéo chuột để dời cả cụm** |
| **Xoá** | — | gỡ sạch ô |

**Kéo dời:** bấm vào một ô của khay/mảnh rồi kéo. Khay và mảnh đều là **khối cứng** nên dời là dời
cả cụm — không bao giờ dời lẻ một ô khay hay một chốt, vì tách lẻ là phá `§8.3` / `§8.4`. Trong lúc
kéo, bóng cụm hiện ở chỗ sẽ đặt: **xanh lá = đặt được, đỏ = không**. Chỗ đến phải nằm trong board
và trống, trừ chính những ô của cụm đang dời.

Thuộc tính của cả màn gom vào **công cụ Ô**: stepper `− Hàng n +` / `− Cột n +` đổi cỡ lưới
(1..12, nội dung rơi ra ngoài bị cắt) và `− ⏱ Thời gian +` (bước 5 giây, kẹp **10s..15 phút** vì
`§8.7` đòi `timeLimitMs > 0`).

Hàng cuối, luôn hiện: `↶ Hoàn tác` (60 bước), **Chép JSON** vào clipboard, **✓ Lưu & xong**. Dòng
dưới cùng chạy `validateLevel` **sống** theo từng thao tác.

**Lưu — hai đích ĐỘC LẬP, cố ý (`editor/store.ts`):**
1. **File `<id>.json` tải về máy** — bản CHÍNH THỨC, để dán vào `levels.data.json`.
2. **`localStorage['ssj.levels']`** — bộ nhớ tạm của người dựng màn: tải lại trang vẫn ra bản đã
   sửa, dropdown đánh dấu `✎`. Đây KHÔNG phải nơi lưu bền — xoá cache trình duyệt là bay, nên
   phải luôn tải file về. Xoá bằng `__ssjEdits.clear()` trong console.

WebView bản APK có thể chặn cả hai; mọi lối đều bọc `try` và có đường lui in JSON ra console — im
lặng nuốt mất công dựng màn là hỏng nặng nhất.

Quy ước bảng công cụ: mọi nút **≥ 44px** chiều cao; **viền trắng = đang chọn** (nên nút Xong nổi
bằng màu chứ không viền); hàng **màu** và hàng **hình** chỉ hiện khi công cụ dùng tới chúng (Khay,
Chốt) — cầm công cụ Ô thì bảng tự thấp đi và board rộng ra. Hình trong hàng hình tô bằng **đúng
màu đang chọn**, để nhìn ra ngay cặp `(màu × hình)` sắp đặt mà không phải nhẩm.

Bốn điều bắt buộc của phần này:
- **Mọi phép sửa TRẢ VỀ `Level` MỚI, không sửa tại chỗ.** `playableSet` nhớ kết quả theo `WeakMap`
  khoá bằng chính object level; sửa tại chỗ thì cache không đổi ⇒ board đổi hình mà **khung ngoài
  vẫn bám hình cũ**. Object mới thì cache tự tính lại và khung tự bám theo — đây chính là cơ chế
  làm "tường tự bám board".
- **Tắt ô phải xoá thứ đứng trên nó**, không thì thành khay/chốt nằm ngoài board (`§8.2 bounds`).
- **Bỏ chốt giữa làm mảnh đứt đôi ⇒ TÁCH thành các mảnh liên thông** (`§8.4`), không để dữ liệu sai.
- **Mọi thao tác SỬA THỨ SẴN CÓ đều nằm sau công tắc**, mặc định TẮT. Hai công tắc dùng chung cho
  cả Khay lẫn Chốt, nhãn đổi theo công cụ, và chỉ hiện khi cầm một trong hai:
  - `⛓ Nối vào khay / mảnh kề bên` — bản đầu tôi cho tự nhập vì nghĩ "kề nhau mà rời là sai ý
    người dựng". Đoán sai: hai thứ tự dính vào nhau là hành vi bất ngờ, và không tách ra được
    ngoài việc xoá đi làm lại. Với khay còn quan trọng hơn: khay 1 ô và khay 2 ô khác nhau hẳn về
    luật, vì khay chỉ nổ khi ĐẦY mọi lỗ.
  - `⧉ Bấm khay / chốt cũ: đổi hình lỗ · đắp thêm lớp` — tắt thì bấm lên thứ sẵn có là **lấy mẫu**
    màu+hình vào cọ, không đụng dữ liệu. Đắp lớp là thao tác giấu nhất: lớp mới chui xuống dưới,
    nhìn board không thấy gì đổi, chỉ có `validateLevel` kêu lệch cân bằng lỗ↔lớp.
- **Nhãn trạng thái vẽ NGAY TRÊN BOARD** (`drawEditBadge`): cọ hiện tại (màu + hình), tên công cụ,
  và trạng thái hai công tắc. Bảng công cụ nằm dưới đáy màn mà mắt thì đang ở board lúc bấm ô;
  không có nhãn này thì phải liếc xuống dưới mỗi lần muốn chắc mình đang cầm gì.
- **Lấy mẫu PHẢI để lại dấu vết trên board**: vòng trắng nhấp nháy quanh ô vừa chọn, nhãn đổi sang
  xanh lá báo `Đã chọn: <màu> · <hình>`, kèm một nhịp rung. Bản đầu lấy mẫu chỉ đổi cọ ở đáy màn —
  chủ dự án báo "sao tôi không chọn được khay", mà thật ra nó chạy đúng, chỉ là **không có phản hồi
  nào ở chỗ đang nhìn** nên không phân biệt được với bấm hụt.
- **Đổi cỡ lưới chỉ hiện với công cụ Ô.** Đang chọn màu/hình để đặt khay hay chốt mà vẫn bày hai
  stepper ra là chật chỗ và dễ bấm nhầm sang cỡ board.
- **Đồng hồ dừng khi đang sửa.** Người dựng màn ngồi lâu là chuyện thường; để nó đếm thì đang sửa
  dở tự nhiên hiện panel hết giờ.

**Sprite:** hiện có **18 trong 64** cặp `(màu × hình)`. Thêm cặp mới:
`scratchpad/gen_pair.py <màu> <hình>` → gen trên nền magenta, tách nền bằng `chroma.py`, ghi vào
`view/sprites/` (bản gốc 1024px cất ở `raw3/`); rồi `gen_sprites_ts.py` **sinh lại `sprites.ts`**
từ chính thư mục ảnh. Trước đây danh sách import viết tay, thêm một cặp phải sửa 4 chỗ và quên một
chỗ thì cặp đó im lặng không hiện. Giá mỗi cặp: **~76 kB** vào bundle.

Cặp chưa có ảnh vẽ bằng `Graphics` ở `view/plastic.ts`, dựng lại đúng ba dấu hiệu làm nên
chất nhựa của sprite thật (§6): **chốt** = thành đứng tối lệch xuống + mặt trên + 3 núm; **ổ cắm**
= thành xa bắt sáng lệch xuống-phải + đáy tối + 3 núm dưới đáy. Lưu ý hốc lõm ăn sáng **ngược
chiều** khối nổi — nguồn sáng ở trên-trái thì thành sáng của hốc nằm ở dưới-phải; vẽ cùng chiều
với chốt là hốc lồi lên mất. Màn xuất ra vẫn hợp lệ, nhưng muốn đúng theme thì phải gen ảnh cho
cặp đó.

---

## 9. Acceptance criteria / QA checklist

**Kéo & thả**
- [ ] Nhấc mảnh → vẽ ở layer trên cùng; grab offset giữ nguyên.
- [ ] **R-MOVE chặn:** kéo con trỏ THẲNG vào một khay/vật cản → mảnh **trượt tới sát rồi DỪNG**, KHÔNG nhảy vọt sang bên kia. Muốn qua phải kéo vòng.
- [ ] **R-MOVE trượt:** kéo trong ô trống → mảnh theo ngón tay mượt, đổi hướng được, chạm mép thì dừng.
- [ ] **Lách khe:** mảnh ngang N ô không chui lọt khe rộng < N ô.
- [ ] Khi kéo **KHÔNG có ghost/highlight nào** — không mảng sáng dưới ô đích, không viền lỗ, không đường nối, không nháy đỏ, không highlight khay.
- [ ] Panel rời nhau: mảnh **không** trượt sang panel khác.
- [ ] **Board đa panel:** thả từ panel này sang panel kia được.
- [ ] **R-DROP khối cứng:** chỉ 1 ô sai → **cả cú thả bị từ chối**, `moves` không tăng, state không đổi.
- [ ] **R-BLOCK:** không thả chồng lên **KHAY** / mảnh khác / băng / cửa cuốn / ngoài silhouette.
- [ ] Thả lên ô trống nhưng không kề lỗ nào = đỗ tạm, hợp lệ, không nhảy gì.
- [ ] Khớp 2 chiều: đứng kề lỗ nhưng cùng màu khác hình → **không nhảy** (cú thả vẫn hợp lệ); cùng hình khác màu → không nhảy.
- [ ] Đứng cách lỗ 2 ô → không nhảy (chỉ kề cạnh mới tính).

**Cắm / tách / nổ**
- [ ] **R-SEAT:** mảnh đứng kề n lỗ khớp → nhảy cả n trong một cú thả.
- [ ] Một chốt kề **hai** lỗ khớp → vào lỗ đầu theo thứ tự **lên · trái · phải · xuống**.
- [ ] Combo: lớp trong vừa lộ ra nhảy tiếp ngay nếu cũng đang kề một lỗ khớp khác.
- [ ] **M-LAYER:** cắm lớp ngoài → chốt **ở lại đúng ô đó**, lộ lớp trong; lớp trong cắm được vào khay khác.
- [ ] **R-UNLINK:** `[Y][R][R][Y]` cắm 2 R → tách thành **2 mảnh 1 chốt độc lập**; nếu phần còn lại vẫn liền nhau thì **không** tách.
- [ ] **R-POP:** khay đầy → nổ, ô thành trống ngay.
- [ ] **R-ICE:** badge giảm 1 mỗi **khay nổ**; 0 → vỡ. **R-SHUTTER:** giảm 1 mỗi **lớp cắm được**.
- [ ] **Nhịp anim đúng số đo §4:** 130ms đứng yên → 420ms bay cung (đỉnh ≈0.85 ô) → lún vào lỗ; nhiều chốt lệch pha 70ms.
- [ ] **Lỗ vẫn vẽ RỖNG** cho tới khi chốt chạm; **khay đã `popped` vẫn được vẽ** cho tới nhịp nổ (+130ms sau chốt cuối).
- [ ] Trong lúc kéo **không có đường nối** chốt→lỗ, chỉ viền sáng ở lỗ đích.
- [ ] Animation **không chặn input, không dừng đồng hồ**.

**Đồng hồ**
- [ ] Bắt đầu sau anim vào màn; **không dừng** khi kéo/animation; pause đúng khi mở Settings và khi app background; resume không nhảy giây.
- [ ] `≤30s` vàng · `≤10s` đỏ + đập nhịp + tick + haptic.
- [ ] `00:00` → thua ngay, cắt animation dở.
- [ ] `addTime(30000)` **chỉ** chạy được sau khi thua.
- [ ] Cắm chốt / nổ khay **KHÔNG** cộng giây (test âm tính).
- [ ] **CLAMP:** một tick sau khi tab treo 24s chỉ trừ 250ms.
- [ ] Trang mở khi tab **đang ẩn** → đồng hồ **không** chạy.

**Mobile (§6.1)**
- [ ] Khay **khít đúng ô**: cùng inset + bo góc với ô board; chân 3D không tràn xuống hàng dưới.
- [ ] iPhone 13 (390×844) / SE (375×667) / tablet dọc: board **vừa khít, không cắt mép**, lề hai bên bằng nhau. Đo bằng `scripts/shot.mjs`, **không** dùng `--window-size --screenshot`.
- [ ] Safe-area: tai thỏ/thanh home không che HUD hay board.
- [ ] Kéo bằng ngón tay → mảnh **nhấc lên 1 ô**, không bị ngón che.
- [ ] Vùng chạm nút ≥44px và rộng hơn phần vẽ.
- [ ] Rung đúng 3 mốc (nhấc / cắm / nổ), không rung theo từng ô.
- [ ] Không cuộn, không kéo-để-tải-lại, không zoom double-tap, không menu giữ-lâu trên board.
- [ ] Có `<meta viewport>`; dùng `100dvh`; dưới 560px thanh trên rút gọn.

**Kết màn**
- [ ] **Panel thắng KHÔNG đè lên animation:** sau nước thắng, `status` là `cleared` ngay nhưng panel chỉ hiện ở **~2s**; giữa khoảng đó chốt vẫn bay, khay vẫn nổ, board sạch được nhìn thấy.
- [ ] Hết giờ → panel hiện **ngay**; kẹt → hiện sau khi anim cuối chạy xong.
- [ ] `Retry` / `+30s` / `Next` reset lại hẹn giờ panel (không hiện lại panel cũ) và dọn sạch FX đang chạy.

**Không-Undo**
- [ ] **Không tồn tại** `undo()` trong public API (test compile-time + runtime); không nút Undo ở mọi độ phân giải; engine không giữ lịch sử.
- [ ] `↺ Restart` reset **cả board lẫn đồng hồ**; confirm khi `remainingMs > 50%`.

**Level & build**
- [ ] Mọi level pass 9 ràng buộc §8 + solver gate §5 (gồm ngân sách thời gian và bẫy khối-cứng §5.4).
- [ ] `destroy()` không leak (gồm clock); `typecheck` + `test` + `vite build` xanh; APK cài & chạy.
- [ ] Reskin: art + palette + text khớp theme; **gameplay không đổi**.

---

## 10. Build & APK với GameBakery

0. **Init** — skill `gamebakery-init` (playforge, game-eye, codeb).
1. **Scaffold** — Vite + TS + PixiJS v8 + Vitest theo §7.
2. **Core + test (TDD)** — `board.ts` (checkDrop) → `items.ts` → `rules.ts` (§3) → `engine.ts`. **Không undo.**
3. **Session + clock** — countdown, clamp, pause/resume. Test bằng fake timer.
4. ~~**Solver**~~ — ĐÃ DỰNG. Còn lại: cho `fairnessIssues` chạy trong CI (hiện là cổng chạy tay, ~8 phút cho 50 màn).
5. **View** — `shapes.ts` → `pixi-view.ts`: board đa panel + khay tĩnh + mảnh kéo tự do + ghost + HUD countdown + anim.
6. **Levels** — seed bằng Phụ lục A; thêm level → verify solver.
7. **Hub + build web** — `index.html`. Verify bằng `playforge` / `game-eye`.
8. **Reskin** — §11. **QA** — `game-eye` theo §9.
9. **Build APK** — GameBakery đóng gói HTML5 → APK. ⚠️ **Không dùng top-level await** — WebView có thể không hỗ trợ (đã vấp khi dựng M0).

---

## 11. Reskin theme (art + màu + text — KHÔNG đụng luật)

**Nguyên tắc vàng:** reskin chỉ đổi **art + màu + text**. **TUYỆT ĐỐI không đổi** rules (§3, gồm timer & no-undo), input (§4), data (§8).

| Phần tử base | "Toy Plastic" (default) | "Candy Shop" | "Wood Workshop" |
|---|---|---|---|
| Khay | hộp nhựa bevel, lỗ lõm | khuôn kẹo | hộp gỗ, lỗ đục |
| Chốt | chốt nhựa bóng | viên kẹo dẻo | chốt gỗ sơn |
| Thanh nối | khớp nhựa | chỉ kẹo kéo | bản lề gỗ |
| Shape-in-shape | chốt lồng chốt | kẹo có nhân | chốt ghép 2 màu |
| `ice` / `shutter` | băng / cửa cuốn | kẹo đông / giấy gói | nhựa thông / nắp trượt |
| Anim nổ | mảnh nhựa văng | vụn đường lấp lánh | mùn cưa bay |
| Tiêu đề | `Shape Sort Jam` | `Candy Fit Jam` | `Wood Peg Jam` |

---

## 12. Monetization (tham chiếu — bản thương mại)

Bản gốc **chưa niêm yết IAP nào** (soft launch) ⇒ không có số liệu thật. Luật chơi tạo sẵn điểm đau rất rõ:

| Kênh | Hình thái | Điểm chạm |
|---|---|---|
| **Rewarded** | **`+30s`** hồi sinh ngay tại state đang dở | Panel `Time's up!` — **điểm đau số 1** |
| Rewarded | `+60s` (1 lần/màn) | Lần thua thứ 2 cùng màn |
| IAP | **Extra Time Pack** — tự động +30s mỗi màn trong 24h | Sau 3 lần timeout liên tiếp |
| Booster | **Magnet** — hút 1 chốt vào lỗ khớp bất kể vị trí | `remainingMs ≤ 20s` mà còn ≥3 chốt |
| Booster | **Hammer** — phá 1 `ice` / mở 1 `shutter` | Ch.4–5 |
| IAP | **No-Ads** $5.99–6.99 · Starter/Piggy/coin tiers | Funnel chuẩn |

**Nguyên tắc:** **KHÔNG bán Undo** (nó là luật chơi, bán là phá cơ chế) · **bán thời gian, không bán mạng** (không có Hearts ⇒ luôn Retry được miễn phí) · **`Retry` ≤1s**, retry nhanh là thứ giữ chân người chơi trong game có đồng hồ.

---

## Phụ lục A — Level mẫu (đã được prototype M0 chạy thật xác nhận)

Ladder seed 6 màn — **3 màn đầu dựng lại y đúc từ video** (frame 12, 21, 29), 3 màn sau dựng từ screenshot App Store. Toàn bộ nằm ở `shape_sort_jam/src/levels.data.json` và được test tự động xác nhận.

| # | id | Nguồn | Board | ⏱ | Nước | Dạy gì |
|---|---|---|---|---|---|---|
| 1 | `lv_01` | video `f_012` | **4×1** cột hẹp | 5:00 | 1 | Nhấc → thả xuống ô **ngay dưới khay** → chốt nhảy vào |
| 2 | `lv_02` | video `f_021` | silhouette lệch `2/3/3/2` | 4:10 | 1 | Mảnh 2 chốt, board méo |
| 3 | `lv_03` | video `f_029` | **hai panel 2×5 RỜI NHAU** | 3:20 | 4 | Kéo tự do qua panel · **thứ tự bị ép bởi chỗ đứng** |
| 4 | `lv_c1_04` | screenshot Lv4 + video `f_050` | 5×6 | 1:00 | 5 | Unlink · một cú thả cho **2 chốt nhảy sang 2 khay hai bên** |
| 5 | `lv_c3_25` | screenshot Lv25 | 7×2 cột | 5:00 | 4 | **Shape-in-shape** |
| 6 | `lv_c4_ice` | thiết kế của ta | 4×5 | 1:30 | 3 | **`ice` + unlink** |

**#3 `lv_03` là màn chứng minh luật.** Mỗi panel xếp: khay A (hàng 0) · khay B (hàng 1) · **hàng 2 trống** · mảnh cho B (hàng 3) · mảnh cho A (hàng 4). Mảnh cho B đứng ở hàng 2 → nhảy vào B → B nổ → **hàng 1 mới trống ra** → mảnh cho A mới có chỗ đứng. **Thứ tự bị ép hoàn toàn bởi chỗ đứng**, không phải bởi đường đi. Panel phải đảo ngược thứ tự màu ⇒ hai nửa không sao chép nhau.

**#5 `lv_c3_25` — shape-in-shape.** Cột 4 khay chồng nhau (●hồng · ●xanh · ♥vàng · ♥đỏ) + 2 hàng trống. Mảnh tim đứng hàng 4 → lớp **đỏ nhảy** vào khay đỏ → khay đỏ nổ → **chốt vẫn đứng nguyên hàng 4** nhưng giờ là tim **vàng** → dời lên hàng 3 (vừa trống) → nhảy vào khay vàng. Chuỗi nhân quả 4 nước, không cần thêm luật nào.

**#6 `lv_c4_ice`.** Mảnh cứng `[■vàng][■vàng][♥đỏ]`: chỉ có **đúng một** cách đặt để hai ■ đứng dưới hai lỗ vàng — và cách đó buộc ♥ rơi vào ô đang là **băng**. Phải nổ một khay khác cho băng vỡ. Cắm xong, ♥ **tách ra** thành mảnh độc lập rồi mới đi tiếp.

> ⚠️ **Hai bản trước của màn ice đã bị loại.** v1.1 đặt băng ở rìa để "chặn đường" (vô nghĩa với kéo tự do). v2.0 đặt băng ở ô mà chốt phải **đè lên** — cũng sai khi luật đổi sang **đứng cạnh**. Bản hiện tại đặt băng đúng **ô mà mảnh cứng buộc phải ĐỨNG**. Mỗi lần luật lõi đổi, level thiết kế quanh chướng ngại phải kiểm lại — đây là lý do §5 bắt buộc solver gate.

**JSON 3 màn đầu (y đúc video):**

```json
[
  {
    "id": "lv_01", "name": "Level 1 · Drop it", "chapter": 1,
    "rows": 4, "cols": 1, "timeLimitMs": 300000, "minMoves": 1,
    "holders": [{ "id": "k_red", "color": "red", "cells": [[0,0]], "holes": ["heart"] }],
    "pieces": [{ "id": "p_heart", "pegs": [
      { "id": "g_h0", "cell": [3,0], "layers": [{ "shape": "heart", "color": "red" }] } ] }]
  },
  {
    "id": "lv_02", "name": "Level 2 · Odd shapes", "chapter": 1,
    "rows": 4, "cols": 3, "timeLimitMs": 250000, "minMoves": 1,
    "playable": [[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2],[3,0],[3,1]],
    "holders": [
      { "id": "k_blue", "color": "blue", "cells": [[0,1],[0,2]], "holes": ["circle","circle"] }],
    "pieces": [{ "id": "p_circle", "pegs": [
      { "id": "g_c0", "cell": [3,0], "layers": [{ "shape": "circle", "color": "blue" }] },
      { "id": "g_c1", "cell": [3,1], "layers": [{ "shape": "circle", "color": "blue" }] } ] }]
  },
  {
    "id": "lv_03", "name": "Level 3 · Two boards", "chapter": 1,
    "rows": 5, "cols": 5, "timeLimitMs": 200000, "minMoves": 4,
    "playable": [
      [0,0],[0,1],[0,3],[0,4], [1,0],[1,1],[1,3],[1,4], [2,0],[2,1],[2,3],[2,4],
      [3,0],[3,1],[3,3],[3,4], [4,0],[4,1],[4,3],[4,4]],
    "holders": [
      { "id": "kL_red",  "color": "red",  "cells": [[0,0],[0,1]], "holes": ["heart","heart"] },
      { "id": "kL_blue", "color": "blue", "cells": [[1,0],[1,1]], "holes": ["circle","circle"] },
      { "id": "kR_blue", "color": "blue", "cells": [[0,3],[0,4]], "holes": ["circle","circle"] },
      { "id": "kR_red",  "color": "red",  "cells": [[1,3],[1,4]], "holes": ["heart","heart"] }],
    "pieces": [
      { "id": "pL_circle", "pegs": [
        { "id": "gL_c0", "cell": [3,0], "layers": [{ "shape": "circle", "color": "blue" }] },
        { "id": "gL_c1", "cell": [3,1], "layers": [{ "shape": "circle", "color": "blue" }] } ] },
      { "id": "pL_heart", "pegs": [
        { "id": "gL_h0", "cell": [4,0], "layers": [{ "shape": "heart", "color": "red" }] },
        { "id": "gL_h1", "cell": [4,1], "layers": [{ "shape": "heart", "color": "red" }] } ] },
      { "id": "pR_heart", "pegs": [
        { "id": "gR_h0", "cell": [3,3], "layers": [{ "shape": "heart", "color": "red" }] },
        { "id": "gR_h1", "cell": [3,4], "layers": [{ "shape": "heart", "color": "red" }] } ] },
      { "id": "pR_circle", "pegs": [
        { "id": "gR_c0", "cell": [4,3], "layers": [{ "shape": "circle", "color": "blue" }] },
        { "id": "gR_c1", "cell": [4,4], "layers": [{ "shape": "circle", "color": "blue" }] } ] }]
  }
]
```

**JSON 3 màn sau:**

```json
[
  {
    "id": "lv_c1_04", "name": "Level 4 · Basics", "chapter": 1,
    "rows": 5, "cols": 6, "difficulty": "normal",
    "timeLimitMs": 60000, "minMoves": 5,
    "holders": [
      { "id": "k_r1", "color": "red",    "cells": [[0,0]], "holes": ["heart"] },
      { "id": "k_r2", "color": "red",    "cells": [[0,5]], "holes": ["heart"] },
      { "id": "k_b1", "color": "blue",   "cells": [[1,1]], "holes": ["circle"] },
      { "id": "k_b2", "color": "blue",   "cells": [[1,4]], "holes": ["circle"] },
      { "id": "k_y1", "color": "yellow", "cells": [[2,0]], "holes": ["square"] },
      { "id": "k_y2", "color": "yellow", "cells": [[2,5]], "holes": ["square"] }
    ],
    "pieces": [
      { "id": "p_red", "pegs": [
        { "id": "g_r0", "cell": [2,2], "layers": [{ "shape": "heart", "color": "red" }] },
        { "id": "g_r1", "cell": [2,3], "layers": [{ "shape": "heart", "color": "red" }] } ] },
      { "id": "p_blue", "pegs": [
        { "id": "g_b0", "cell": [3,2], "layers": [{ "shape": "circle", "color": "blue" }] },
        { "id": "g_b1", "cell": [3,3], "layers": [{ "shape": "circle", "color": "blue" }] } ] },
      { "id": "p_yellow", "pegs": [
        { "id": "g_y0", "cell": [4,2], "layers": [{ "shape": "square", "color": "yellow" }] },
        { "id": "g_y1", "cell": [4,3], "layers": [{ "shape": "square", "color": "yellow" }] } ] }
    ]
  },

  {
    "id": "lv_c3_25", "name": "Level 25 · Shape-in-shape", "chapter": 3,
    "rows": 7, "cols": 2, "difficulty": "normal",
    "timeLimitMs": 300000, "minMoves": 4,
    "holders": [
      { "id": "k_pink", "color": "pink",   "cells": [[0,0],[0,1]], "holes": ["circle","circle"] },
      { "id": "k_blue", "color": "blue",   "cells": [[1,0],[1,1]], "holes": ["circle","circle"] },
      { "id": "k_yel",  "color": "yellow", "cells": [[2,0],[2,1]], "holes": ["heart","heart"] },
      { "id": "k_red",  "color": "red",    "cells": [[3,0],[3,1]], "holes": ["heart","heart"] }
    ],
    "pieces": [
      { "id": "p_heart", "pegs": [
        { "id": "g_h0", "cell": [5,0], "layers": [
          { "shape": "heart", "color": "red" }, { "shape": "heart", "color": "yellow" } ] },
        { "id": "g_h1", "cell": [5,1], "layers": [
          { "shape": "heart", "color": "red" }, { "shape": "heart", "color": "yellow" } ] } ] },
      { "id": "p_circle", "pegs": [
        { "id": "g_c0", "cell": [6,0], "layers": [
          { "shape": "circle", "color": "blue" }, { "shape": "circle", "color": "pink" } ] },
        { "id": "g_c1", "cell": [6,1], "layers": [
          { "shape": "circle", "color": "blue" }, { "shape": "circle", "color": "pink" } ] } ] }
    ]
  },

  {
    "id": "lv_c4_ice", "name": "Level 19 · Ice + Unlink", "chapter": 4,
    "rows": 4, "cols": 5, "difficulty": "hard",
    "timeLimitMs": 90000, "minMoves": 3,
    "obstacles": [{ "kind": "ice", "cells": [[1,4]], "count": 1 }],
    "holders": [
      { "id": "k_y",  "color": "yellow", "cells": [[0,2],[0,3]], "holes": ["square","square"] },
      { "id": "k_r1", "color": "red",    "cells": [[3,0]], "holes": ["heart"] },
      { "id": "k_r2", "color": "red",    "cells": [[3,4]], "holes": ["heart"] }
    ],
    "pieces": [
      { "id": "p_main", "pegs": [
        { "id": "g_y0", "cell": [2,1], "layers": [{ "shape": "square", "color": "yellow" }] },
        { "id": "g_y1", "cell": [2,2], "layers": [{ "shape": "square", "color": "yellow" }] },
        { "id": "g_r0", "cell": [2,3], "layers": [{ "shape": "heart",  "color": "red"    }] } ] },
      { "id": "p_solo", "pegs": [
        { "id": "g_r1", "cell": [1,0], "layers": [{ "shape": "heart", "color": "red" }] } ] }
    ]
  }
]
```

**Lời giải (test tự động chạy đúng chuỗi này) — ô đích luôn là ô TRỐNG kề khay:**
- **#1** `p_heart→(1,0)` — **1 nước**.
- **#2** `p_circle→(1,1)` — **1 nước** (2 chốt đứng ngay dưới 2 lỗ).
- **#3** `pL_circle→(2,0)` · `pL_heart→(1,0)` · `pR_heart→(2,3)` · `pR_circle→(1,3)` — **4 nước**. Thả `pL_heart→(1,0)` **trước** khi khay xanh nổ → **bị từ chối** (hàng 1 vẫn là khay). Test khẳng định cả hai chiều.
- **#4** `p_red→(0,1)` · `p_red→(0,3)` · `p_blue→(1,2)` · `p_yellow→(2,1)` · `p_yellow→(2,3)` — **5 nước**. Cú `p_blue→(1,2)` là điểm sáng: **một cú thả, hai chốt nhảy sang hai khay hai bên** (chốt trái vào `k_b1`, chốt phải vào `k_b2`).
- **#5** `p_heart→(4,0)` · `p_heart→(3,0)` · `p_circle→(2,0)` · `p_circle→(1,0)` — **4 nước**. Mỗi bước lên một hàng, đúng bằng chỗ mà khay vừa nổ để lại.
- **#6** `p_solo→(2,0)` (nổ `k_r1` → băng vỡ) · `p_main→(1,2)` (2 ■ nhảy, `k_y` nổ, ♥ tách ra) · `p_main→(2,2)` — **3 nước**.

*(Chốt cuối cùng của một mảnh giữ nguyên `id` vì chỉ còn 1 thành phần liên thông; anchor phải bù offset của chốt đó.)*

> ⚠️ `minMoves` là **lời giải đặt tay**, chưa phải **ngắn nhất**. Phải thay bằng số solver §5 trả về rồi kiểm lại ngân sách §5.3 và bẫy khối-cứng §5.4 trước khi ship.

---

## Phụ lục B — Nguồn & mức tin cậy của thông tin

### B.1 — Video gameplay (nguồn mạnh nhất)

Bản ghi màn hình **2:06, 1920×1080, Level 3→9**, chủ tài liệu cung cấp 2026-08-10. Trích frame bằng ffmpeg (1 fps toàn bộ + 6 fps tại các cú kéo).

| Kết luận | Bằng chứng | Độ tin |
|---|---|---|
| **Người chơi kéo MẢNH CHỐT**, khay đứng yên | frame 35 (Lv3): mảnh 2 chốt xanh có **viền sáng trắng** (đang kéo); frame 36: nó đã nằm **trên khay xanh** | ✅ chắc |
| **Kéo TỰ DO, không trượt theo lưới, không tìm đường** | frame `d_019` (Lv6): chốt vàng được vẽ **tràn hẳn ra ngoài khung board**, lơ lửng phía trên | ✅ chắc |
| **Cắm bằng ĐỨNG KỀ rồi NHẢY vào lỗ** (chủ tài liệu chốt ở v2.1) | frame 36 + `d_021` chỉ cho thấy **trạng thái sau khi cắm** (chốt đã nằm trong lỗ) — không phân biệt được đè hay kề. Bằng chứng quyết định là **bố cục level**: Level 3 và Level 25 đều chừa **đúng một hàng trống** ngay dưới cột khay; với luật thả-đè thì hàng đó vô nghĩa, với luật kề cạnh thì đó là **bệ đứng bắt buộc** | ✅ chắc |
| **"Linked shapes move together. Complete goals to unlink"** | **tutorial text hiện nguyên văn** ở Lv5 (frame 62) | ✅ chắc |
| **Chuỗi tách ra sau khi cắm** | Lv6: chuỗi `[■][♥][♥][■]` (frame 90) → sau khi 2 ♥ cắm vào khay đỏ, còn **2 chốt ■ rời nhau** (frame `d_014`) | ✅ chắc |
| **Mảnh đa-loại tồn tại** | Lv6 `[■vàng][♥đỏ][♥đỏ][■vàng]`; Lv5 chuỗi dọc `[■][■][♥]` | ✅ chắc |
| **Board có thể gồm NHIỀU PANEL RỜI NHAU** | Lv3: hai panel 2×5 tách hẳn nhau, panel phải hoàn toàn trống | ✅ chắc |
| **Đồng hồ ĐẾM NGƯỢC** | Lv6: `01:23` (f_090) → `01:22` (t=88s) → `01:21`; Lv5: `02:00` → `01:53` | ✅ chắc — **giải quyết dứt điểm câu hỏi treo của v1.1** |
| **Khay vẽ như khối có chiều cao 3D**, lỗ nằm ở mặt trên | Lv6 f_090: thân khay vàng đổ xuống dưới hàng lỗ | ✅ chắc |
| HUD đúng 3 phần tử · **không có nút Undo** | mọi frame gameplay | ✅ chắc |
| Panel thắng: `LEVEL COMPLETED!` + `Tap to continue` + `Next Feature n/4` | frame 20, 40, 105 | ✅ chắc |
| Level 4 / Level 9 trong video **trùng khớp** screenshot App Store | frame 50, frame 126 | ✅ chắc |

### B.2 — Screenshot App Store + mô tả store

| Thông tin | Nguồn | Độ tin |
|---|---|---|
| Popcore GmbH · 2026-07-20 · v1.1.2 · 191.9 MB · 12+ · EN-only · 0★ · chưa có IAP | [App Store `id6791993036`](https://apps.apple.com/us/app/shape-in-shape/id6791993036) + [iTunes Lookup](https://itunes.apple.com/lookup?id=6791993036) | ✅ chắc |
| Tên nội bộ **`Shape_Sort_Jam`** | filename 12 screenshot trong payload API | ✅ chắc |
| *"match shapes into their correct spots"* · *"best order to play **your shapes**"* · *"ice blocks"* · *"locked shutters"* · *"shape-in-shape mechanics"* | mô tả store (nguyên văn) — **"your shapes" là manh mối đã bị v1.1 bỏ qua** | ✅ chắc |
| **Khay 1 màu nhiều hình** (`[●,●,★]`, `[●,●,★,★,★]` ở Lv29) ⇒ khớp phải là **(màu × hình)** | screenshot Lv29 | ✅ chắc |
| **Chốt nhiều lớp**: ♥đỏ lồng ♥vàng, ●xanh lồng ●hồng; Lv25 có đúng bộ khay khớp cả 2 lớp (8 lỗ ↔ 8 lớp) | screenshot Lv25 | ✅ chắc |
| `ice` badge 3/4 · `shutter` badge 12, viền vàng | screenshot Lv19 & Lv41 | ✅ chắc |
| Badge độ khó 🔥🔥 / 💀💀 | screenshot Lv19 & Lv29 | ✅ chắc |

### B.3 — Còn suy luận / chưa có bằng chứng

| Thông tin | Trạng thái |
|---|---|
| **Chốt nhiều lớp Ở LẠI đúng ô sau khi cắm lớp ngoài** | 🟡 **suy luận.** Video (Lv3–9) chưa có màn nào dùng layers. Đây là cách duy nhất nhất quán với luật thả-đè + với bố cục Lv25. |
| **`ice.count` giảm 1 mỗi KHAY NỔ** · **`shutter.count` giảm 1 mỗi LỚP cắm được** | 🟡 **suy luận** từ độ lớn badge (3–4 vs 12). Video chưa có màn nào có ice/shutter. |
| **Ice/shutter chỉ có tác dụng qua việc CHIẾM CHỖ** | 🟡 **suy luận bắt buộc.** Với kéo tự do thì không có "đường" để chặn ⇒ chướng ngại chỉ còn nghĩa là ô không thả được. Ảnh hưởng trực tiếp tới thiết kế màn — xem cảnh báo ở Phụ lục A #3. |
| Panel hết giờ có `+30s` rewarded không | ❓ chưa thấy (video không có màn nào thua). §12 dùng quy ước thể loại. |
| Có cộng giây trong lúc chơi không | ❓ ta chọn **KHÔNG** (R-TIME) — đơn giản, dễ balance. |
| Số level thật · IAP · ads placement · `Next Feature n/4` mở ra cái gì | ❌ không có dữ liệu. |
| Module `park` | ⭕ genre có, bản gốc **không cần** — mọi ô trống đã là chỗ đỗ. Giữ chỗ schema. |

---

*Hết GDD v2.0.*

**Đổi ở v2.6 (chủ tài liệu chỉnh — SỬA "tele"):**
- 🔄 **Di chuyển đổi từ "kéo tự do/nam châm" → TRƯỢT (R-MOVE).** Chủ tài liệu quay video thấy mảnh **nhảy vọt xuyên qua khay** (nam châm bám ô hợp lệ *xa nhất* tới được bằng đường vòng). Yêu cầu: **vật cản phải CHẶN mảnh, muốn qua phải kéo vòng.**
- Core đã đúng từ trước (`reachableAnchors` + `canReach` = luật trượt); lỗi chỉ ở **drag trong view** vẫn bám ô-hợp-lệ-gần-con-trỏ-nhất trên *toàn* tập tới-được ⇒ tele. Sửa: drag **trượt greedy từng ô** về phía con trỏ, chỉ qua ô kề hợp lệ (`view/pixi-view.ts`).
- ⚠️ **Hệ quả chưa dọn xong:** `levels.solutions.json` sinh dưới luật cũ ⇒ một số lời giải ghi sẵn nay không replay được, và có màn có thể **không giải được dưới luật trượt**. Cần **regenerate solutions + solver gate lại toàn bộ 50 màn** (đang treo — xem cuối README).
- Bỏ **R-FREE** và **R-MAGNET** (§3) — thay bằng **R-MOVE**.

**Đổi ở v2.2 (chủ tài liệu chỉnh):**
- ➕ **R-MAGNET** — mảnh đang kéo **bám vào ô hợp lệ gần nhất**, không cho người chơi kéo đè khối lên nhau dù chỉ trong lúc kéo.
- 🔄 Hệ quả: **bỏ hẳn "thả không hợp lệ"**. Không còn trạng thái mảnh bật về chỗ cũ; mọi cú nhả tay đều là một nước hợp lệ. Với luật không-Undo, đây là điều kiện công bằng tối thiểu.

**Đổi ở v2.5 (chủ tài liệu chỉnh):**
- ➖ **Bỏ nốt ghost khi kéo** — không còn mảng sáng dưới ô đích. Khi kéo chỉ có mảnh đi theo ngón tay; phản hồi "đúng chỗ" dồn hết vào animation chốt nhảy vào lỗ.
- 🔄 **Panel thắng: 3s → 2s** (§6) — khớp bản gốc.

**Đổi ở v2.4 (mobile pass):**
- ➕ **§6.1 Mobile** — safe-area, `uiScale`, board ăn trọn màn hình, nhấc mảnh khi kéo bằng ngón tay, rung, chặn cử chỉ trình duyệt.
- 🔄 **Khay khít đúng ô** — cùng inset/bo góc với ô board, chân 3D nằm trong khối.
- ➕ **Lỗ lõm giả-3D 4 lớp** (§6) — đáy lỗ là bản sao nhỏ hơn của chính hình đó.
- 🛠 `scripts/shot.mjs` — chụp qua DevTools Protocol vì `--window-size --screenshot` cho kết quả sai lệch.

**Đổi ở v2.3 (chủ tài liệu chỉnh — bám thị giác bản gốc):**
- ➖ **Bỏ đường nối** chốt→lỗ trong ghost.
- ➖ **Bỏ mọi highlight trên khối:** viền trắng ở lỗ đích, nháy đỏ ô bị chắn, viền vàng khi tap. **Bản gốc không tô đậm hay tô đỏ khối nào.** Ghost rút về **một mảng sáng mờ** dưới ô sẽ thả.
- ➖ **Bỏ Peek** (tap để sáng khay khớp) — cơ chế do ta tự thêm, không có ở bản gốc.
- ➕ **Nhịp anim cắm đo từ video** (§4): 130ms đứng yên → 420ms bay cung cao → lún vào lỗ → +130ms mới nổ khay; nhiều chốt lệch pha 70ms.
- ➕ **View phải trễ theo anim:** lỗ vẫn vẽ rỗng cho tới khi chốt chạm; khay đã `popped` trong model vẫn được vẽ cho tới nhịp nổ.
- ➕ **Panel thắng giữ ~2s** (§6) — model `cleared` ngay, nhưng panel chờ để không đè lên cú animation cuối. Hết giờ thì vẫn hiện ngay.

**Đổi ở v2.1 (chủ tài liệu chỉnh):**
- 🔄 **Cắm bằng KỀ CẠNH, không phải thả đè.** Chốt đứng cạnh lỗ khớp thì **nhảy** vào. Khay là **khối đặc** như mọi thứ khác.
- ➕ **R-BLOCK** — mọi vật thể đều đặc; tài nguyên của game là **chỗ đứng cạnh khay**, không phải chỗ trống nói chung.
- 🔄 Hệ quả thiết kế: mọi màn phải chừa **ô trống sát lỗ** làm bệ đứng. Đây chính là lý do bố cục bản gốc luôn có **một hàng trống** giữa cột khay và cụm chốt (Level 3, Level 25) — chi tiết mà hai bản trước không giải thích được.
- ➕ Ladder thêm **`lv_01` / `lv_02` / `lv_03`** dựng y đúc từ video.
- ➕ `initialFreeSeats()` — cảnh báo chốt đứng sẵn cạnh lỗ khớp (bẫy với luật không-Undo).

**Đổi ở v2.0 (do video bác bỏ v1.1):**
- ❌→✅ **Thứ người chơi kéo**: khay → **mảnh chốt**.
- ❌→✅ **Di chuyển**: trượt theo lưới + BFS đường đi → **nhấc lên kéo tự do**, không tìm đường.
- ❌→✅ **Cắm**: kề cạnh → **thả đè lên lỗ**.
- ➕ **R-DROP khối cứng** (sai 1 ô hỏng cả cú thả) — ràng buộc trung tâm mới của game.
- ➕ **R-UNLINK** (tách theo thành phần liên thông) — cơ chế bản gốc dạy bằng tutorial text.
- ➕ **Board đa panel**.
- ➕ Timer **đếm ngược** (trước là ❓ không rõ) — video chốt.
- 🔄 Chuỗi nối từ "trang trí, không có luật" → **khối cứng, là luật trung tâm**.
- 🔄 §5 fairness: bẫy nguy hiểm nhất giờ là **thứ tự cắm khoá vĩnh viễn phần còn lại của mảnh cứng**.

**Việc còn treo:**
1. 🟡 **Hành vi chốt nhiều lớp sau khi cắm** — cần video một màn Ch.3 (Lv21+).
2. 🟡 **Ice / shutter** — cần video một màn có băng hoặc cửa cuốn (Lv19, Lv41).
3. ❓ **Panel hết giờ** và có `+30s` hay không.
4. ⏳ **Solver §5** — `minMoves` hiện là lời giải đặt tay.

*Điểm mơ hồ khi build → hỏi chủ tài liệu.*

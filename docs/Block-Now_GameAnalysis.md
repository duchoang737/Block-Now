# Phân tích Game: Shape in Shape (Sort & Jam × Shape-in-Shape)

> App Store: `id6791993036` · Tên niêm yết **Shape in Shape** · **Tên nội bộ (từ filename screenshot): `Shape_Sort_Jam`**
> Nhà phát hành: **Popcore GmbH** (Berlin — cha đẻ *Parking Jam 3D*, 215M+ download)
> Thể loại: Puzzle / Casual · Ngày phân tích: 2026-08-10

---

## 1. Tóm tắt nhanh (TL;DR)

Shape in Shape là một **"Sort & Jam" puzzle** — thể loại lai đang nóng, ghép **Parking Jam** (kẹt không gian, gỡ đúng thứ tự) với **Block/Bus Jam** (gom vật phẩm theo màu vào khay chứa). Người chơi **kéo các khay có lỗ (container)** đi trong một lưới chật, áp sát các **chốt hình (item)** đứng cố định; chốt **khớp màu + khớp hình** sẽ nhảy vào lỗ; khay **đầy lỗ → nổ biến mất → giải phóng ô** cho các khay khác đi qua.

Điểm khác biệt riêng của game này — và cũng là cái tên: **shape-in-shape**, tức **chốt có nhiều lớp**. Một chốt "tim đỏ" bóc ra bên trong lại là "tim vàng", "tròn xanh" bóc ra là "tròn hồng". Một vật phẩm phải được **hai khay khác nhau thu theo đúng thứ tự**.

| Chỉ số | Giá trị |
|---|---|
| App ID / Bundle | `6791993036` |
| Publisher | Popcore GmbH |
| Ngày phát hành | **2026-07-20** (mới ~3 tuần) |
| Version hiện tại | 1.1.2 (2026-07-21) — *"Bug Fixes & Performance Improvements"* |
| Rating | **0★ / 0 review** — chưa có (soft-launch) |
| Giá / IAP | Free · **chưa niêm yết IAP nào** |
| Dung lượng | 191.9 MB |
| Age rating | 12+ |
| Ngôn ngữ | **Chỉ EN** |
| Nền tảng | iOS 15+, iPadOS 15+, macOS 12+ (M1), visionOS 1+ · 118 thiết bị |
| Genre | Games > Puzzle > Casual |

**Điểm mấu chốt:** đây là một bản **soft-launch đang test thị trường** (0 review, 1 ngôn ngữ, chưa gắn IAP, version 1.1.2 chỉ sau 1 ngày). Nghĩa là: cơ chế còn **đang bị chốt lại**, và ta có cơ hội **học cơ chế lõi trước khi nó được đánh bóng và scale** — chính là thời điểm tốt nhất để prototype.

---

## 2. Định vị thị trường

- **Trend "Sort & Jam Puzzle"** là công thức nóng 2024–2026: lai **Parking Jam 3D** (Popcore, 215M+ download) với **Block Jam 3D** (Voodoo, $30M+ IAP). Bộ ba yếu tố kinh điển của thể loại: **Items** (không chạm được, phải khớp màu với khay) · **Containers** (người chơi kéo được, mỗi khay gom đủ số vật phẩm cùng màu) · **Slots** (chỗ "đỗ" tạm cho khay chưa đầy).
- Đối thủ trực hệ: *Block Jam 3D* (Voodoo), *Bus Jam* (Rollic, 14.6M+ dl), *Park Match!* (Supersonic), *Stack Match Jam* (chính Popcore).
- **Chiến lược của Popcore ở tựa này:** họ **tự cạnh tranh với chính mình**. Parking Jam là 3D-xe-cộ; Shape in Shape kéo cùng cơ chế "kẹt" sang **ngôn ngữ hình học thuần** (tim / sao / thoi / tròn / vuông / ngũ giác / tam giác / hoa). Lợi ích: (a) **không rào cản văn hoá & ngôn ngữ** — creative quay 5 giây ai cũng hiểu; (b) **chi phí art rẻ hơn 3D xe** rất nhiều; (c) không gian shape gần như vô hạn để mở rộng content.
- **Tệp người chơi:** casual 25–55, nữ chiếm tỉ trọng cao (palette pastel-rực, tim/sao/hoa), thói quen chơi 1–3 phút/phiên. Age 12+ (nhiều khả năng chỉ vì ads/data chứ nội dung 4+).

---

## 3. Core Gameplay Loop

```
Vào màn → Đọc board: khay nào ở đâu, chốt nào ở đâu, đường nào tắc
        → Kéo khay len qua ô trống, áp sát chốt cùng màu+hình
        → Chốt nhảy vào lỗ (juice: pop + haptic)
        → Khay ĐẦY LỖ → nổ → GIẢI PHÓNG Ô → mở đường cho khay khác
        → (shape-in-shape) chốt bóc lớp, lộ hình/màu mới bên trong
        → Sạch board → thắng
```

**Ba hành động/khái niệm cốt lõi:**

1. **Move** — kéo khay đi trong lưới. Khay **chỉ đi qua ô trống**; chốt, khay khác, chướng ngại đều chặn. Đây là toàn bộ lớp "jam".
2. **Collect** — khay áp sát chốt khớp **màu + hình** → thu chốt vào lỗ.
3. **Clear** — khay đầy → biến mất → **trả lại không gian**. "Clear space on the board" trong mô tả store chính là câu này.

**Vòng phản hồi tạo độ khó:** không gian là **tài nguyên**. Mỗi khay vừa là *công cụ* vừa là *vật cản*. Gỡ sai thứ tự → khay to nằm chình ình giữa board, chặn đường mọi khay khác. Đây đúng là DNA Parking Jam, chỉ đổi "xe" thành "khay".

---

## 4. Taxonomy vật thể — trái tim của game

Quan sát trực tiếp từ 6 screenshot chính thức:

| Vật thể | Mô tả quan sát được | Vai trò thiết kế |
|---|---|---|
| **Container (khay có lỗ)** | Khối màu đặc, dài **1–5 ô**, ngang hoặc dọc, mặt trên khoét **lỗ hình lõm**. Kéo được. | Công cụ + vật cản. Khay càng dài càng khó luồn |
| **Item (chốt hình)** | Hình nổi đứng trên ô, nối nhau bằng thanh nhỏ thành **chuỗi**. Không kéo được. | Mục tiêu + vật cản tĩnh |
| **Shape-in-shape (chốt nhiều lớp)** | Tim đỏ **lồng** tim vàng; tròn xanh **lồng** tròn hồng | USP. Ép **2 khay khác nhau, đúng thứ tự** cho cùng 1 chốt |
| **Ice block** | Khối băng trong, badge số (thấy **3** và **4**), toả khói lạnh, chiếm 1×2 ô | Khoá **không gian** theo thời gian — mở đường muộn |
| **Shutter (cửa cuốn)** | Panel viền vàng phủ cả một vùng lớn, sọc dọc, badge số (thấy **12**) | Khoá **nội dung** — nửa board chỉ mở ở cuối màn |
| **Board silhouette** | Lưới **không vuông** — có mấu lồi/thụt, hành lang hẹp 1 ô | Điều khiển pathing: chỗ thắt cổ chai = độ khó |

**Hệ hình đã thấy (8):** ● tròn · ♥ tim · ★ sao · ◆ thoi · ■ vuông · ✚ hoa/chữ thập · ⬟ ngũ giác · ▲ tam giác.
**Hệ màu đã thấy (8):** đỏ · hồng · xanh dương · vàng · xanh lá · tím · cam · trắng.

**Chi tiết đắt giá nhất — khay MỘT MÀU nhưng NHIỀU HÌNH.** Ở Level 29 có khay hồng gồm `[tròn, tròn, sao]` và khay xanh gồm `[tròn, tròn, sao, sao, sao]`. Nghĩa là điều kiện khớp là **(màu, hình)** chứ không phải chỉ màu như Bus Jam / Block Jam. Đây là **cách tăng chiều sâu rẻ nhất** mà vẫn giữ luật đọc-hiểu-trong-3-giây: cùng một khay đòi hai loại chốt khác nhau.

---

## 5. Progression & Content

- **"Hundreds of amazing levels"** (mô tả store). Screenshot marketing cố tình lấy **Level 4 / 9 / 19 / 25 / 29 / 41** → cho thấy curve họ muốn khoe: Lv4 dạy luật (board thưa, 6 khay 1 lỗ), Lv9 thêm chuỗi lẫn hình, Lv19 ice, Lv25 shape-in-shape thuần, Lv29 khay đa-hình, Lv41 shutter + board siêu dày.
- **Badge độ khó gắn cạnh tên màn:** thấy **🔥🔥 (Lv19)** và **💀💀 (Lv29)** — hệ nhãn Hard / Super Hard quen thuộc, dùng để (a) set kỳ vọng trước khi thua, (b) **làm điểm chạm bán booster**.
- **Timer đếm ở HUD** mọi màn (`04:57`, `01:31`, `01:30`, `00:49`). Đây là điểm **khác biệt lớn so với Parking Jam** (vốn không giới hạn). Áp lực thời gian trên một puzzle không gian là con dao hai lưỡi — xem §8.
- Không thấy HUD số lượt / số mạng / hearts trong bất kỳ screenshot nào.

---

## 6. Monetization

**Hiện trạng: CHƯA có IAP nào niêm yết trên App Store.** Đây là bằng chứng mạnh cho soft-launch đo retention trước, gắn tiền sau.

**Dự phóng theo playbook Popcore + thể loại** (để tham chiếu khi thiết kế bản thương mại):

| Kênh | Hình thái dự kiến | Điểm chạm |
|---|---|---|
| Rewarded | **+30s / +60s** khi hết giờ | Cuối màn 🔥/💀 — điểm đau rõ nhất |
| Rewarded | **Mở thêm 1 "slot đỗ"** cho khay chưa đầy | Khi board tắc |
| Booster | **Magnet/Vacuum** — hút 1 chốt bất kỳ vào khay khớp | Màn dày |
| Booster | **Undo / Hammer** — phá 1 ice, mở 1 shutter | Chướng ngại |
| IAP | **No-Ads** ($5.99–$6.99) | Doanh thu chính của puzzle F2P |
| IAP | Starter Pack → Piggy Bank → Coin tiers | Funnel chuẩn |
| Ads | Interstitial giữa màn | ⚠️ Rủi ro — xem §8 |

---

## 7. UX / Feel / "Juice"

- **HUD tối giản 3 nút:** ↺ (restart) trái · `Level N` + timer giữa · ⚙ (settings) phải. Không có tray, không có nút chức năng dưới — **toàn bộ tương tác diễn ra trên board**. Rất sạch, rất "one-hand".
- **Art direction:** nền indigo đậm phẳng, vật thể **soft-3D nhựa bóng** (đổ bóng mềm, bevel dày, highlight top-left). Nhìn như đồ chơi xếp hình trẻ em — chạm vào là muốn kéo. Chi phí sản xuất thấp, scale vô hạn.
- **Đọc board trong 1 giây:** lỗ = **lõm tối**, chốt = **nổi sáng**. Không cần chữ, không cần tutorial text. Đây là thứ đáng học nhất về mặt visual language.
- **Juice quan sát được:** khay đang thao tác có **viền sáng trắng** bao quanh; ice toả khói + hạt tuyết; chốt vừa được thu có tia lấp lánh; khay nổ có mảnh vụn.
- **Cảm giác cốt lõi = "double satisfaction":** (a) *unjam* — cú luồn được khay qua khe cuối cùng; (b) *pop* — khay đầy nổ, cả mảng board mở ra. Vòng b) tự tạo ra cơ hội cho vòng a) — đây là lý do loop này gây nghiện.

---

## 8. Điểm mạnh & Điểm yếu

### ✅ Điểm mạnh
- **Cơ chế lai đúng trend, có tiền lệ chứng minh:** Parking Jam 215M dl + Block Jam $30M IAP. Không phải cược mù.
- **Shape-in-shape là USP thật, không phải reskin.** Nó nhân đôi chiều sâu mà **không thêm một luật nào cần giải thích** — người chơi bóc lớp một lần là hiểu.
- **Điều kiện khớp (màu × hình)** cho không gian content lớn hơn hẳn đối thủ chỉ-màu, gần như miễn phí về mặt art.
- **Zero-text design** → localization gần như bằng 0, creative UA quay 5 giây cực ngọt (board tắc → tan dần).
- **Board silhouette bất quy tắc** = cần điều khiển độ khó rất mịn mà không cần thêm cơ chế.

### ⚠️ Điểm yếu / Rủi ro
- **Timer trên puzzle không gian là con dao hai lưỡi.** Parking Jam thành công *vì* không có đồng hồ — người chơi được ngồi nghĩ. Gắn countdown vào bài toán suy luận sẽ (a) biến "suy nghĩ" thành áp lực, (b) đẩy người chơi sang thử-sai, (c) là nguồn review 1 sao nếu balance sai. **→ Quyết định: GIỮ NGUYÊN timer** (bám bản gốc). Bù lại bằng **ngân sách thời gian có solver kiểm chứng** (`timeLimitMs ≥ minMoves × 4s + 20s`) và **timer rộng gấp 2.5× ở màn dạy cơ chế mới** — chính là thứ bản gốc đã làm ở Lv25 (board 2×7, 4 nước, nhưng cho 5 phút).
- **Chưa có review nào (0★)** — không có tín hiệu thị trường. Mọi kết luận về retention đều là suy đoán.
- **Chỉ EN, chưa IAP, 1.1.2 sau 1 ngày** → sản phẩm chưa ổn định, có thể bị Popcore kill nếu CPI không đạt.
- **Vấn đề nguyên bản trong nội bộ Popcore:** rất gần *Stack Match Jam* và *Parking Jam* của chính họ → nguy cơ ăn thịt lẫn nhau (cannibalization) trong cùng portfolio.
- **Dung lượng 192MB** cho một game hình học phẳng là **rất nặng** → tụt install rate trên mạng yếu. Nhiều khả năng do Unity + asset 3D chưa nén.
- **Deadlock + không có Undo:** với luật kéo tự do, người chơi hoàn toàn có thể tự khoá mình mà HUD **chỉ có Restart**. **→ Quyết định: GIỮ NGUYÊN không-Undo** (bám bản gốc) — nhưng phải bù bằng 3 hàng rào ở khâu level design: (1) solver xác nhận **không có deadlock trong ≤3 nước đầu**, (2) **≤20% nước đi ở 3 nước đầu dẫn tới nhánh chết**, (3) engine **phát hiện deadlock và cắt màn ngay**, không bắt ngồi chờ hết giờ. Không-Undo chỉ tàn nhẫn khi level làm ẩu.

---

## 9. Bài học rút ra cho thiết kế (Takeaways)

1. **Không gian là tài nguyên đắt hơn thời gian.** Loop "công cụ tự biến mất để trả lại chỗ trống" (khay đầy → nổ → mở đường) là động cơ chính. Thiết kế màn phải xoay quanh *thứ tự nổ*, không phải *tốc độ tay*.
2. **Timer biến puzzle thành arcade-puzzle — giữ, nhưng phải có ngân sách.** Đồng hồ nén session xuống 30s–3 phút, tạo nhịp retry cao và một điểm bán rất sạch (`+30s` rewarded ngay tại panel thua). Điều kiện để nó không thành hình phạt: **mỗi màn phải có ngân sách thời gian do solver kiểm chứng**, và **màn dạy cơ chế mới luôn được timer rộng gấp 2–3 lần**.
3. **Không-Undo là luật chơi, không phải thiếu sót — nhưng nó chuyển gánh nặng sang level design.** Bỏ Undo giữ được sức căng "mỗi nước là vĩnh viễn" và bảo vệ giá trị của booster. Cái giá: mọi màn phải **không có bẫy chết sớm**, mọi cú thả phải có **preview hậu quả trước khi nhả tay**, và deadlock phải được engine **cắt ngay** thay vì bắt ngồi chờ. Không bao giờ bán Undo — bán nó là phá chính cơ chế.
4. **Đa-hình-cùng-màu là đòn tăng chiều sâu rẻ nhất.** Một khay `[tròn, tròn, sao]` khó gấp đôi khay `[tròn ×3]` mà không tốn thêm một dòng tutorial nào.
5. **Chốt nhiều lớp = "combo bắt buộc".** Một vật phẩm phục vụ 2 khay theo thứ tự cứng → tự sinh ra chuỗi nhân quả trong màn, thay cho việc phải bịa thêm luật.
6. **Solver là cổng chất lượng, bắt buộc.** Board bất quy tắc + kéo tự do ⇒ state space rất lớn ⇒ **phải có BFS/IDA\* verify từng màn** là giải được, biết min-move, và không có bẫy deadlock oan. Không có solver thì đừng ship level.
7. **Ngôn ngữ thị giác lõm/nổi thắng mọi tutorial.** Lỗ tối lõm vs chốt sáng nổi — người chơi hiểu mà không cần một chữ nào.

---

## Nguồn tham khảo

- [Shape in Shape — App Store](https://apps.apple.com/us/app/shape-in-shape/id6791993036) (đọc trực tiếp)
- [iTunes Lookup API `id=6791993036`](https://itunes.apple.com/lookup?id=6791993036) — metadata + 6 screenshot iPhone + 6 screenshot iPad (đọc trực tiếp; filename gốc `Shape_Sort_Jam_*`)
- [Sort & Jam Competitor Analysis — Cost Center](https://www.costcenter.net/post/sort-jam-competitor-analysis) — định nghĩa Items / Containers / Slots + số liệu đối thủ
- [Parking Jam 3D — App Store](https://apps.apple.com/us/app/parking-jam-3d/id1498229533) (Popcore, thể loại gốc)
- [Popcore GmbH — App Store developer page](https://apps.apple.com/ao/developer/popcore-gmbh/id1375461777)
- [Popcore — trang chủ](https://www.popcore.com/)

> ⚠️ Game phát hành 2026-07-20, chưa có review/wiki/walkthrough công khai. Toàn bộ mô tả cơ chế ở §3–§4 được suy ra từ **6 screenshot chính thức + mô tả store + đặc trưng thể loại**. Mức tin cậy từng khoản xem **Phụ lục B của GDD**.

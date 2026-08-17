// Renderer + input — GDD §4 (nhấc mảnh, kéo TỰ DO, thả đè lên lỗ) và §6.
// Cơ chế xác minh bằng video gameplay bản gốc 2026-08-10.
import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import { cellKey, checkDrop, pieceCells, playableSet } from '../core/board';
import type { DropCheck } from '../core/board';
import { Session } from '../session/session';
import { HUD, ITEM_PALETTE, THEME, darken } from './theme';
import { chunkyButton, iconGear, iconRestart, iconWatch, setChunkyText } from './hud-art';
import { createTextPool, drawEditBadge, drawPalette, paletteHeight } from './editor-ui';
import type { EditHit, Tool } from './editor-ui';
import * as ed from '../editor/model';
import { download, saveEdit } from '../editor/store';
import { validateLevel } from '../core/validate';
import { shapePath } from './shapes';
import {
  drawLinkBar, drawPlasticPeg, drawPlasticSocket, drawSeatShadow, drawSeatSkirt, drawSeatSocket,
} from './plastic';
import { hasSprite, loadPegTextures, pegTexture, socketTexture } from './sprites';
import type { Cell, Color, GameResult, Level, PieceState, Shape } from '../types';

// Nhịp animation đo trực tiếp từ video bản gốc (30fps, t≈90.9–91.6s):
//   chốt đứng yên ~130ms → bật lên bay cung cao ~420ms → lún vào lỗ → khay nổ.
const SEAT_DELAY = 130;
const SEAT_STAGGER = 70;
const SEAT_DUR = 420;
const POP_DELAY = 130;
const POP_DUR = 320;
/**
 * Thắng xong KHÔNG hiện panel ngay: để người chơi xem trọn cú cắm + nổ cuối cùng
 * và nhìn board sạch một nhịp. Bản gốc cách khoảng ~2s giữa lúc board sạch và
 * panel `LEVEL COMPLETED!`; chủ tài liệu chốt ~3s.
 */
/** Ô board và khay dùng CHUNG inset + bo góc, để khay khít đúng vào ô vuông. */
const CELL_INSET = 0.06;
const CELL_RADIUS = 0.2;

/**
 * Board kiểu Ô NỔI DÍNH LIỀN + CARO — bản duyệt `docs/theme/t6_C_flush.png` (vòng 6).
 *
 * Điểm mấu chốt, và cũng là thứ bốn vòng trước làm sai: **các ô CHẠM nhau, không có
 * khe**. Trước đó tôi cứ đi tìm "khối nổi đẹp hơn", nhưng khối càng nổi rõ thì board
 * càng đọc ra các viên rời ghép lại. Ở bản này ranh giới giữa hai ô chỉ là một NẾP
 * VÁT — sáng ở trên-trái, tối ở dưới-phải — nên board là một tấm liền được chia ô.
 *
 * Màu ĐO TỪ BẢN DUYỆT Ở ĐÚNG CỠ THẬT (64px một ô), không đo trên bản 1024px: máy
 * gen đẩy sáng lên một bậc.
 */
const PAD_FACE = 0x43447a; // mặt ô
const PAD_LIT = 0x555691; // nếp vát bắt sáng, mép trên-trái (~4.7% ô)
const PAD_SHADE = 0x22234d; // nếp vát tối, mép dưới-phải (~3.1% ô)
/** Bo góc ô — chủ dự án chốt 8% (vòng 4), giữ nguyên qua bản mới. */
const TILE_RADIUS = 0.08;
/**
 * Lát CARO: ô lẻ `(r+c)` tối hơn ô chẵn. Hệ số áp cho CẢ mặt lẫn nếp vát chứ không
 * riêng mặt ô — chỉ tối mỗi mặt thì nếp vát của hai loại ô bằng nhau và bàn cờ đọc
 * ra như ô bị bẩn, không ra hai tông.
 */
const TILE_CHECKER = 0.25;

/**
 * KHUNG NGOÀI board — bản duyệt `docs/theme/fr_A_soft.png` (phương án A · bo mềm),
 * chủ dự án chốt mỏng đi một nửa so với bản duyệt.
 *
 * Khung cũ là xám đá `#5C6B80`, còn sót từ đời board xám. Đặt cạnh gạch chàm thì
 * vừa cứng vừa lệch tông, nên kéo hết về cùng họ nhựa chàm với lòng board.
 */
/**
 * BĂNG — xanh ĐẬM, không phải xanh nhạt.
 *
 * `THEME.iceBlue` (#cfeaf5) là xanh gần trắng; phủ lên nền chàm nó ra một mảng xám
 * bợt nhạt hơn cả ô board trống, nên mắt đọc thành “ô bị mờ” chứ không đọc thành
 * “ô bị đóng băng”. Ba tông dưới đây giữ đúng chất băng mà vẫn tách hẳn khỏi nền.
 */
const ICE_BODY = 0x2a86c8; // thân tảng
const ICE_DEEP = 0x11477e; // đáy tảng, tối dần xuống
const ICE_LIT = 0xe6f9ff; // gờ sáng đỉnh và nét nứt
/**
 * ĐỘ ĐỤC CỦA THÂN BĂNG — núm chỉnh khó nhất của cả cơ chế, vì nó phải làm HAI việc
 * ngược nhau cùng lúc: băng đủ đậm để đọc ra “ô bị đóng băng”, mà vẫn đủ trong để
 * nhìn thấy KHỐI đang bị nhốt bên dưới. Bản .82 đọc rất ra băng nhưng che sạch khối
 * bên trong, tức là giấu mất đúng thứ người chơi cần để tính đường.
 */
const ICE_ALPHA = 0.34;

const FRAME_FACE = 0x585a8f; // mặt khung
const FRAME_LIT = 0x8a8cba; // gờ sáng mép trên
const FRAME_SKIRT = 0x484c85; // thành đứng, nửa trên
const FRAME_SKIRT_LOW = 0x2e3059; // thành đứng, chân — tối dần xuống như nhựa bo cạnh
const FRAME_GROOVE = 0x11142c; // rãnh tối nơi khung gặp lòng board
/**
 * Bóng đổ tô ĐẶC chứ không dùng alpha. `frameSilhouette` vẽ từng ô một rồi cộng
 * thêm thanh cầu nối, nên các hình chồng lên nhau; tô alpha thì chỗ chồng cộng dồn
 * và bóng ra thành vệt đen gắt, đậm hơn cả nền. Đây là màu đen .3 trộn sẵn với nền.
 */
const FRAME_SHADOW = 0x1e192d;
/**
 * Chiều cao THÀNH ĐỨNG của khung, theo bề rộng ô. Đây là thứ làm khung NỔI LÊN:
 * bóng đổ chỉ nói "có vật ở trên nền", còn thành đứng mới nói "vật này DÀY".
 */
const FRAME_LIFT = 0.26;
/** Bề dày khung theo bề rộng ô. Bản duyệt là 0.47; chủ dự án chốt một nửa. */
const FRAME_W = 0.235;
/** Bo góc NGOÀI của khung, theo bề rộng ô — thứ làm nên chữ "mềm". */
const FRAME_R = 0.42;

/**
 * Viên chốt nằm TRÊN mặt ô hay LÚN VÀO mặt ô?
 *
 * `true` = board bị viên nhựa ấn lún, quanh chân có rãnh (tối trên-trái, sáng
 * dưới-phải) ⇒ đọc ra "cắm vào board". `false` = chỉ bóng tiếp xúc, viên đặt lên
 * mặt phẳng. Cả hai đều bỏ hẳn bóng-bản-sao lệch xuống của bản cũ, thứ làm viên
 * treo lơ lửng cách mặt board một quãng.
 */
const SEAT_SOCKET = false;
/** Đắp thêm thành đứng dưới sprite chốt cho viên DÀY ra — xem `drawSeatSkirt`. */
const SEAT_SKIRT = true;

const WIN_HOLD = 2000;
/** …nhưng luôn phải chờ animation cuối chạy xong đã. */
const WIN_HOLD_AFTER_FX = 500;

type Fx =
  | { kind: 'seat'; from: Cell; to: Cell; shape: Shape; color: Color; t0: number; delay: number; dur: number }
  | { kind: 'pop'; cells: Cell[]; color: number; t0: number; dur: number };

interface HolderView {
  id: string;
  color: Color;
  cells: Cell[];
  holes: Shape[];
  filled: boolean[];
}

interface Button {
  x: number; y: number; w: number; h: number;
  action:
    | 'restart' | 'next' | 'addTime' | 'retry'
    | 'settings' | 'closeSettings' | 'toggleVibrate' | 'edit' | 'none';
}

export interface GameHandle {
  destroy(): void;
  loadLevel(level: Level): void;
  restart(): void;
  session(): Session;
  /** Mở trình sửa màn cho màn đang chơi. */
  edit(): void;
}

export interface GameOptions {
  onComplete?: (r: GameResult) => void;
  onLevelRequest?: (dir: 1) => Level | undefined;
  /** Gọi khi thoát trình sửa màn, kèm bản đã sửa. */
  onLevelEdit?: (level: Level) => void;
}

const fmtTime = (ms: number): string => {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export async function createGame(
  host: HTMLElement,
  level: Level,
  options: GameOptions = {},
): Promise<GameHandle> {
  const app = new Application();
  await app.init({
    background: THEME.background,
    antialias: true,
    resizeTo: host,
    resolution: Math.min(2, window.devicePixelRatio || 1),
    autoDensity: true,
    preserveDrawingBuffer: true, // cho phép chụp canvas khi QA tự động
  });
  host.appendChild(app.canvas);

  const gBoard = new Graphics();
  const gObstacle = new Graphics();
  const obstacleLabels = new Container();
  const gHolders = new Graphics();
  const holderSprites = new Container();
  const gGhost = new Graphics();
  const gPieces = new Graphics();
  // `shutter` PHỦ LÊN khay/mảnh (nó khoá nội dung bên dưới — GDD §3 R-SHUTTER) nên
  // phải nằm TRÊN gHolders/gPieces. `ice` thì ngược lại: nó chỉ chiếm ô trống, vẽ
  // cùng tầng board là đúng. Dưới gDrag để mảnh đang nhấc vẫn nổi trên tất cả.
  const gShutter = new Graphics();
  const shutterLabels = new Container();
  const pieceSprites = new Container();
  const gDrag = new Graphics();
  const dragSprites = new Container();
  const gFx = new Graphics();
  const fxSprites = new Container();
  const hud = new Container();
  const overlay = new Container();
  const settings = new Container();
  const editor = new Container();
  app.stage.addChild(
    gBoard, gObstacle, obstacleLabels, gHolders, holderSprites, gGhost, gPieces, pieceSprites,
    gShutter, shutterLabels, gDrag, dragSprites, gFx, fxSprites, hud, editor, overlay, settings,
  );

  await loadPegTextures();

  /** Bể sprite dùng lại — mỗi frame vẽ lại toàn bộ, không tạo/huỷ object. */
  function makePool(parent: Container) {
    const items: Sprite[] = [];
    let used = 0;
    return {
      next(): Sprite {
        let sp = items[used];
        if (!sp) {
          sp = new Sprite();
          sp.anchor.set(0.5);
          parent.addChild(sp);
          items.push(sp);
        }
        sp.visible = true;
        used++;
        return sp;
      },
      reset(): void {
        for (const sp of items) sp.visible = false;
        used = 0;
      },
    };
  }
  /**
   * Bể Graphics dùng lại, đổ vào ĐÚNG container của sprite chốt.
   *
   * Cặp (màu × hình) chưa có ảnh phải vẽ bằng Graphics. Trước đây bản vẽ đó đi
   * thẳng vào `gPieces` — một Graphics nằm DƯỚI cả container sprite — nên trong
   * một chồng khối, lớp DƯỚI có ảnh lại đè lên che mất lớp TRÊN không có ảnh:
   * viên lớp trên biến mất sạch thay vì nằm đè lên như luật §5. Cho nó dùng
   * chung container với sprite rồi xếp bằng `zIndex` thì thứ tự đúng theo thứ tự
   * VẼ, không phụ thuộc thứ tự tạo object.
   */
  function makeGfxPool(parent: Container) {
    const items: Graphics[] = [];
    let used = 0;
    return {
      next(): Graphics {
        let g = items[used];
        if (!g) {
          g = new Graphics();
          parent.addChild(g);
          items.push(g);
        }
        g.clear();
        g.visible = true;
        used++;
        return g;
      },
      reset(): void {
        for (const g of items) g.visible = false;
        used = 0;
      },
    };
  }

  // Xếp chồng theo zIndex chứ không theo thứ tự tạo object: bể dùng lại nên thứ
  // tự tạo cố định từ frame đầu, còn thứ tự VẼ thì đổi theo trạng thái màn.
  pieceSprites.sortableChildren = true;
  dragSprites.sortableChildren = true;

  const holderPool = makePool(holderSprites);
  const fxPool = makePool(fxSprites);
  const piecePool = makePool(pieceSprites);
  const dragPool = makePool(dragSprites);
  const pieceGfx = makeGfxPool(pieceSprites);
  const dragGfx = makeGfxPool(dragSprites);
  /** Bậc chồng, tăng dần theo thứ tự vẽ trong một frame. */
  let zTop = 0;

  const font = 'system-ui, sans-serif';
  /** Font chữ HUD: ưu tiên font bo tròn nếu máy có, không thì lớp viền tự lo phần "mập". */
  const hudFont = '"Baloo 2", "Fredoka", Nunito, "Varela Round", system-ui, sans-serif';
  const mkHud = () =>
    new Text({ text: '', style: { fontFamily: hudFont, fontSize: 24, fill: 0xffffff, fontWeight: '900' } });
  // mỗi nhãn HAI lớp: lớp sau là bóng chữ đặc màu viền, lớp trước là thân chữ
  const titleBack = mkHud();
  const titleFront = mkHud();
  const timeBack = mkHud();
  const timeFront = mkHud();
  const gHud = new Graphics();
  hud.addChild(gHud, titleBack, titleFront, timeBack, timeFront);

  const gOverlay = new Graphics();
  const overTitle = new Text({ text: '', style: { fontFamily: font, fontSize: 40, fill: THEME.white, fontWeight: '800' } });
  const overSub = new Text({ text: '', style: { fontFamily: font, fontSize: 22, fill: THEME.hudText } });
  const overBtnA = new Text({ text: '', style: { fontFamily: font, fontSize: 24, fill: THEME.white, fontWeight: '700' } });
  const overBtnB = new Text({ text: '', style: { fontFamily: font, fontSize: 24, fill: 0x1e1a4a, fontWeight: '700' } });
  overlay.addChild(gOverlay, overTitle, overSub, overBtnA, overBtnB);

  const gSettings = new Graphics();
  const setTitle = new Text({ text: 'Cài đặt', style: { fontFamily: hudFont, fontSize: 30, fill: THEME.white, fontWeight: '900' } });
  const setRows = [0, 1, 2, 3].map(
    () => new Text({ text: '', style: { fontFamily: font, fontSize: 21, fill: THEME.white, fontWeight: '700' } }),
  );
  settings.addChild(gSettings, setTitle, ...setRows);

  let session = new Session(level);
  let obstacleTexts: Text[] = [];
  let fx: Fx[] = [];
  let buttons: Button[] = [];
  /** `holderId#holeIndex` → thời điểm chốt thực sự CHẠM lỗ. Trước đó lỗ vẫn vẽ rỗng. */
  const pendingSeats = new Map<string, number>();
  /** khay đã nổ trong model nhưng anim chưa tới lượt → vẫn phải vẽ (đầy lỗ). */
  let poppingHolders: { view: HolderView; popAt: number }[] = [];
  /** thời điểm được phép hiện panel kết màn. `Infinity` = chưa kết thúc. */
  let overlayAt = Infinity;

  let cell = 48;
  let originX = 0;
  let originY = 0;
  let uiScale = 1;
  let hudH = 84;
  /** Kéo bằng NGÓN TAY thì nhấc mảnh lên 1 ô để ngón không che mất nó. */
  let liftCells = 0;

  const gEditor = new Graphics();
  const editorText = createTextPool(editor);
  editor.addChildAt(gEditor, 0);

  /**
   * TRÌNH SỬA MÀN. `draft` là bản đang sửa; mỗi phép sửa sinh ra một `Level` MỚI
   * rồi nạp lại qua `loadLevel`, nhờ vậy khung ngoài tự bám hình board mới —
   * `playableSet` nhớ theo WeakMap khoá bằng object level, sửa tại chỗ thì cache
   * không đổi và khung sẽ bám hình cũ.
   */
  let editing = false;
  let draft: Level = level;
  let history: Level[] = [];
  let tool: Tool = 'cell';
  let brushColor: Color = 'red';
  let brushShape: Shape = 'heart';
  /** Chốt mới có nhập vào mảnh kề bên không. TẮT mặc định — nối là quyết định có chủ ý. */
  let linkPegs = false;
  /**
   * Bấm lên chốt SẴN CÓ thì làm gì. TẮT = lấy mẫu màu+hình của nó vào cọ, không
   * đụng dữ liệu. Bật = đắp thêm một lớp.
   *
   * Mặc định lấy mẫu vì đắp lớp là thao tác GIẤU: lớp mới chui xuống dưới, nhìn
   * board không thấy gì đổi, chỉ có `validateLevel` kêu lệch cân bằng lỗ↔lớp.
   */
  let stackLayers = false;
  let editHits: EditHit[] = [];
  let editNote = '';
  let editNoteAt = 0;
  /** Ô vừa lấy mẫu — vẽ vòng chọn quanh nó để "chọn" là thứ NHÌN THẤY ĐƯỢC. */
  let picked: Cell | null = null;
  /** Cụm đang kéo dời (công cụ Kéo). `d` là độ lệch tính bằng Ô, đã bám lưới. */
  let editDrag: { t: ed.MoveTarget; grab: Cell; d: Cell; ok: boolean } | null = null;

  let settingsOpen = false;
  /** Bật/tắt rung — nhớ qua các phiên. WebView có thể chặn localStorage nên phải bọc. */
  let vibrate = true;
  try {
    vibrate = localStorage.getItem('ssj.vibrate') !== '0';
  } catch {
    /* không đọc được thì cứ mặc định bật */
  }

  /** Rung phản hồi — chỉ ở những mốc đáng rung, không rung theo từng ô. */
  const buzz = (pattern: number | number[]): void => {
    if (!vibrate) return;
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      /* máy không hỗ trợ thì bỏ qua */
    }
  };

  let drag:
    | null
    | {
        id: string;
        grabR: number;
        grabC: number;
        /** ô mà mảnh đang bám vào; LUÔN hợp lệ ⇒ không bao giờ chồng lên khối khác */
        snap: Cell;
        check: DropCheck;
        moved: boolean;
      } = null;

  const now = () => performance.now();
  const cx = (c: number) => originX + c * cell + cell / 2;
  const cy = (r: number) => originY + r * cell + cell / 2;

  function rebuildObstacleTexts(): void {
    obstacleLabels.removeChildren().forEach((child) => child.destroy());
    shutterLabels.removeChildren().forEach((child) => child.destroy());
    obstacleTexts = session.state.obstacles.map((ob) => {
      // Băng và cửa cuốn đều vẽ ở tầng `gShutter` (TRÊN mảnh), nên badge của chúng
      // phải nằm ở `shutterLabels` — tầng nằm trên `gShutter`. Để badge băng ở
      // `obstacleLabels` như bản trước là bị chính tảng băng phủ kín, mất luôn con số.
      const covered = ob.kind === 'shutter' || ob.kind === 'ice';
      const t = new Text({
        text: '',
        style: {
          fontFamily: font,
          fontSize: 28,
          fill: ob.kind === 'shutter' ? THEME.white : 0xf4feff,
          stroke: { color: 0x0d3550, width: 6 },
          fontWeight: '800',
        },
      });
      (covered ? shutterLabels : obstacleLabels).addChild(t);
      return t;
    });
  }

  function loadLevel(next: Level): void {
    session = new Session(next);
    fx = [];
    drag = null;
    pendingSeats.clear();
    poppingHolders = [];
    overlayAt = Infinity;
    rebuildObstacleTexts();
    session.begin(now());
    if (document.hidden) session.pause(now());
  }

  /** Safe-area của máy (tai thỏ, thanh home). CSS đặt sẵn --sat/--sar/--sab/--sal. */
  function safeInsets(): { top: number; right: number; bottom: number; left: number } {
    const s = getComputedStyle(document.documentElement);
    const n = (v: string) => Number.parseFloat(v) || 0;
    return {
      top: n(s.getPropertyValue('--sat')),
      right: n(s.getPropertyValue('--sar')),
      bottom: n(s.getPropertyValue('--sab')),
      left: n(s.getPropertyValue('--sal')),
    };
  }

  /**
   * Layout mobile-first: HUD và padding co giãn theo bề rộng máy, board ăn TRỌN
   * phần còn lại (không khoá cứng 60% chiều cao như trước — trên điện thoại dọc
   * cách đó bỏ phí gần một phần ba màn hình).
   */
  function layout(): void {
    const W = app.screen.width;
    const H = app.screen.height;
    const lv = session.level;
    const safe = safeInsets();

    uiScale = Math.max(0.78, Math.min(1.3, W / 430));
    hudH = Math.round(84 * uiScale);

    const padX = Math.round(12 * uiScale) + Math.max(safe.left, safe.right);
    // đang sửa màn thì bảng công cụ chiếm đáy màn hình, board phải lùi lên
    const padBottom =
      Math.round(14 * uiScale) + safe.bottom + (editing ? paletteHeight(uiScale, tool) : 0);
    const availW = W - padX * 2;
    const availH = H - safe.top - hudH - padBottom;

    // Khung ăn thêm `FRAME_W × cell` MỖI BÊN nên phải cộng vào mẫu số, không thì
    // màn nào board rộng gần bằng máy sẽ bị cắt mất khung ở hai rìa. Chiều dọc còn
    // phải cộng thêm thành đứng, vì nó thò xuống dưới đáy khung.
    const frame = FRAME_W * 2;
    cell = Math.floor(
      Math.min(availW / (lv.cols + frame), availH / (lv.rows + frame + FRAME_LIFT)),
    );
    cell = Math.max(20, Math.min(cell, 104));
    originX = Math.round((W - cell * lv.cols) / 2);
    // board hơi lệch LÊN (38% khoảng trống ở trên): chừa vùng dưới cho ngón cái,
    // và trên máy dọc thì board không bị treo lơ lửng giữa hai mảng trống bằng nhau
    const free = Math.max(0, availH - cell * lv.rows);
    originY = Math.round(safe.top + hudH + free * 0.38);
  }

  // ---------- vẽ ----------

  /**
   * Vẽ SILHOUETTE của board như MỘT khay liền mạch (bản gốc là một khối bo tròn
   * duy nhất, không phải các miếng chồng lên nhau). Bí quyết khử "gợn sóng" ở rìa:
   * mỗi ô là một rounded-rect, CỘNG các thanh cầu nối giữa ô kề nhau để lấp chỗ
   * thắt — nhờ vậy cạnh chung giữa hai ô thẳng, chỉ 4 góc ngoài mới bo tròn.
   */
  function frameSilhouette(
    g: Graphics,
    playable: Set<string>,
    expand: number,
    radius: number,
    color: number,
    alpha = 1,
    dy = 0,
  ): void {
    const has = (r: number, c: number) => playable.has(`${r},${c}`);
    for (const k of playable) {
      const [r, c] = k.split(',').map(Number);
      const x = originX + c * cell;
      const y = originY + r * cell + dy;
      g.roundRect(x - expand, y - expand, cell + expand * 2, cell + expand * 2, radius).fill({ color, alpha });
      if (has(r, c + 1)) g.rect(x + cell / 2, y - expand, cell, cell + expand * 2).fill({ color, alpha });
      if (has(r + 1, c)) g.rect(x - expand, y + cell / 2, cell + expand * 2, cell).fill({ color, alpha });
    }
  }

  function drawBoard(): void {
    gBoard.clear();
    const playable = playableSet(session.level);
    const expand = Math.round(cell * FRAME_W);
    const radius = cell * FRAME_R;
    const rim = Math.max(1, Math.round(cell * 0.045));
    const lift = Math.max(2, Math.round(cell * FRAME_LIFT));

    // Bốn lớp CÙNG một hình, chỉ khác màu và độ lệch dọc. Xếp từ dưới lên:
    // 1) bóng đổ mềm, rơi xa nhất
    frameSilhouette(gBoard, playable, expand, radius, FRAME_SHADOW, 1, lift + Math.round(cell * 0.05));
    // 2) THÀNH ĐỨNG: cùng hình nhưng dịch XUỐNG, phần lộ ra dưới đáy chính là bề
    //    dày của khung. Không có lớp này thì khung chỉ là một mảng màu dán lên nền.
    //    Vẽ HAI tầng, tầng chân tối hơn — thành một màu phẳng thì đọc ra tấm bìa
    //    dựng đứng, hai tầng mới ra cạnh nhựa bo tròn tối dần xuống.
    frameSilhouette(gBoard, playable, expand, radius, FRAME_SKIRT_LOW, 1, lift);
    frameSilhouette(gBoard, playable, expand, radius, FRAME_SKIRT, 1, Math.round(lift * 0.45));
    // 3) gờ sáng: cùng hình, dịch LÊN, nên chỉ ló ra ở mép trên — phía nguồn sáng.
    //    Vẽ to hơn một vành thì thành viền đều bốn phía, đọc ra nét kẻ.
    frameSilhouette(gBoard, playable, expand, radius, FRAME_LIT, 1, -rim);
    // 4) mặt khung
    frameSilhouette(gBoard, playable, expand, radius, FRAME_FACE);
    // 4) rãnh tối nơi khung gặp lòng board — vòng lặp ô vẽ sau sẽ phủ phần giữa,
    //    chỉ chừa lại đúng cái rãnh
    frameSilhouette(gBoard, playable, Math.max(1, Math.round(cell * 0.037)), radius * 0.4, FRAME_GROOVE);

    // KHÔNG có bước "khoét lại ô bỏ bị khung trùm kín" — và không được thêm vào.
    //
    // Ô bỏ bị các ô chơi được vây kín bốn phía thì đường bao của nó BẮT BUỘC là một
    // đường thứ hai, tách rời đường bao ngoài: đó là hình học, không phải cách vẽ.
    // Đã thử khoét tròn / khoét vuông / bo mượt đủ kiểu, cái nào cũng đọc ra "một
    // hình dán vào giữa board" chứ không phải tường. Lời giải nằm ở HÌNH BOARD:
    // chỗ khoét phải THÔNG RA MÉP (thành vịnh) hoặc đừng khoét. Khi mọi ô bỏ đều
    // thông ra ngoài thì `frameSilhouette` tự cho ra đúng một nét liền chạy từ
    // ngoài, lượn vào trong, rồi lượn ra — không cần vẽ thêm gì.
    //
    // Ràng buộc đó được giữ ở GỐC, xem `enclosedHoles` trong `editor/model.ts`:
    // editor không cho tạo ô kín, và bộ sinh màn cũng loại ứng viên có ô kín.
    //
    // 3) từng ô = Ô NỔI DÍNH LIỀN, lát caro — bản duyệt t6_C_flush.
    //    KHÔNG có khe: ô ăn trọn ô board và chạm ô bên cạnh. Ranh giới chỉ là nếp
    //    vát, sáng ở trên-trái và tối ở dưới-phải, nên board đọc ra MỘT TẤM LIỀN
    //    được chia ô chứ không phải các viên rời thả cạnh nhau.
    const brad = cell * TILE_RADIUS;
    const lit = Math.max(1, Math.round(cell * 0.047)); // nếp vát sáng, trên-trái
    const shd = Math.max(1, Math.round(cell * 0.031)); // nếp vát tối, dưới-phải
    for (const k of playable) {
      const [r, c] = k.split(',').map(Number);
      const x0 = originX + c * cell;
      const y0 = originY + r * cell;
      const tone = (r + c) % 2 === 1 ? (hex: number) => darken(hex, TILE_CHECKER) : (hex: number) => hex;
      // nền VUÔNG, KHÔNG áp caro: bốn góc ô bo tròn gặp nhau để hở một khoảng nhỏ,
      // chỗ đó phải đồng một màu — áp caro vào thì mấy chấm giao điểm loang lổ.
      gBoard.rect(x0, y0, cell, cell).fill(PAD_SHADE);
      // đắp nếp sáng, chừa lại vệt tối ở dưới và phải
      gBoard.roundRect(x0, y0, cell - shd, cell - shd, brad).fill(tone(PAD_LIT));
      // mặt ô thụt vào từ trên-trái đúng bề dày nếp sáng
      gBoard
        .roundRect(x0 + lit, y0 + lit, cell - shd - lit, cell - shd - lit, brad * 0.8)
        .fill(tone(PAD_FACE));
    }

    // Đang kéo dời: vẽ bóng cụm ở chỗ SẼ ĐẶT, xanh lá nếu đặt được, đỏ nếu không.
    if (editing && editDrag) {
      const [dr, dc] = editDrag.d;
      const col = editDrag.ok ? 0x3fbd7d : 0xe4484d;
      for (const [r, c] of ed.objectCells(draft, editDrag.t)) {
        const x = originX + (c + dc) * cell;
        const y = originY + (r + dr) * cell;
        gBoard.roundRect(x, y, cell, cell, cell * TILE_RADIUS).fill({ color: col, alpha: 0.22 });
        gBoard
          .roundRect(x + 1, y + 1, cell - 2, cell - 2, cell * TILE_RADIUS)
          .stroke({ width: Math.max(2, cell * 0.05), color: col, alpha: 0.95 });
      }
    }

    // Ô vừa CHỌN: vòng sáng nhấp nháy nhẹ. Không có nó thì cú lấy mẫu không để
    // lại dấu vết nào trên board và người dùng tưởng mình bấm hụt.
    if (editing && picked) {
      const pulse = 0.55 + Math.sin(now() / 260) * 0.3;
      const x = originX + picked[1] * cell;
      const y = originY + picked[0] * cell;
      const inset = cell * 0.04;
      gBoard
        .roundRect(x + inset, y + inset, cell - inset * 2, cell - inset * 2, cell * TILE_RADIUS)
        .stroke({ width: Math.max(2, cell * 0.055), color: 0xffffff, alpha: pulse });
    }

    // Đang sửa màn: ô đã TẮT vẫn phải nhìn thấy được, không thì bấm vào đâu để
    // bật lại. Vẽ khung nét đứt mờ trong phạm vi lưới `rows × cols`.
    if (editing) {
      const lw = Math.max(1, Math.round(cell * 0.035));
      for (let r = 0; r < session.level.rows; r++) {
        for (let c = 0; c < session.level.cols; c++) {
          if (playable.has(cellKey([r, c]))) continue;
          const x = originX + c * cell;
          const y = originY + r * cell;
          gBoard
            .roundRect(x + cell * 0.16, y + cell * 0.16, cell * 0.68, cell * 0.68, cell * 0.12)
            .stroke({ width: lw, color: 0x6b5fb8, alpha: 0.5 });
        }
      }
    }
  }

  /**
   * TẢNG BĂNG LIỀN — hợp mọi ô của một chướng ngại thành MỘT khối, y như cách
   * `frameSilhouette` dựng khung ngoài: mỗi ô một rounded-rect cộng thanh cầu nối
   * sang ô kề, nên cạnh chung giữa hai ô biến mất và chỉ còn viền ngoài bo tròn.
   *
   * Vẽ từng ô rời như bản cũ thì ba ô băng đọc ra ba viên đá xếp cạnh nhau; chủ dự
   * án chốt là phải LIỀN.
   */
  function iceMass(
    g: Graphics,
    cells: Cell[],
    inset: number,
    radius: number,
    color: number,
    alpha: number,
    dy = 0,
  ): void {
    const has = new Set(cells.map(cellKey));
    for (const [r, c] of cells) {
      const x = originX + c * cell + inset;
      const y = originY + r * cell + inset + dy;
      const w = cell - inset * 2;
      g.roundRect(x, y, w, w, radius).fill({ color, alpha });
      if (has.has(cellKey([r, c + 1])))
        g.rect(x + w / 2, y, cell, w).fill({ color, alpha });
      if (has.has(cellKey([r + 1, c])))
        g.rect(x, y + w / 2, w, cell).fill({ color, alpha });
    }
  }

  /** Vết nứt — nét trắng gãy khúc chạy xuyên tảng, tất định theo vị trí ô. */
  function iceCracks(g: Graphics, cells: Cell[]): void {
    const w = Math.max(1.5, cell * 0.035);
    for (const [r, c] of cells) {
      const x = originX + c * cell;
      const y = originY + r * cell;
      // Hình nứt suy ra TỪ TOẠ ĐỘ ô, không random: cùng một màn phải vẽ ra y hệt
      // mỗi khung hình, không thì tảng băng nhấp nháy.
      const v = ((r * 7 + c * 13) % 4) / 4;
      g.moveTo(x + cell * (0.18 + v * 0.2), y + cell * 0.06)
        .lineTo(x + cell * (0.46 - v * 0.12), y + cell * 0.42)
        .lineTo(x + cell * (0.3 + v * 0.3), y + cell * 0.62)
        .lineTo(x + cell * (0.62 + v * 0.2), y + cell * 0.94)
        .stroke({ width: w, color: ICE_LIT, alpha: 0.9 });
      g.moveTo(x + cell * (0.46 - v * 0.12), y + cell * 0.42)
        .lineTo(x + cell * (0.86 - v * 0.15), y + cell * 0.3)
        .stroke({ width: w * 0.7, color: ICE_LIT, alpha: 0.7 });
    }
  }

  function drawObstacles(): void {
    gObstacle.clear();
    gShutter.clear();

    // BĂNG VẼ ĐÈ LÊN MẢNH, không vẽ dưới.
    //
    // Đổi từ bản cũ, và đổi vì cơ chế đổi: băng giờ ĐÓNG BĂNG khối nằm dưới nó. Vẽ
    // dưới mảnh thì khối bị kẹt che mất tảng băng, người chơi không biết nó đang bị
    // khoá. Vẽ đè, thân băng để trong mờ, thì nhìn xuyên qua thấy đúng khối gì đang
    // nằm trong — giữ được luật "không đọc vị" (§5) mà vẫn nói rõ nó đang bị khoá.
    // `gShutter` nằm trên `pieceSprites` nên dùng chung tầng đó.
    for (const ob of session.state.obstacles) {
      if (ob.cleared || ob.kind !== 'ice') continue;
      const cells = ob.cells as Cell[];
      const rad = cell * 0.26;
      const lip = Math.max(2, Math.round(cell * 0.07));
      // bóng đổ → thân trong mờ → gờ sáng đỉnh → nứt → viền ngoài
      //
      // Thân dùng ICE_BODY chứ không dùng `THEME.iceBlue`: màu theme là xanh rất
      // nhạt (#cfeaf5), phủ lên nền chàm ra một mảng xám bợt, đúng thứ chủ dự án
      // chê. Xanh đậm hơn thì tảng băng tự nó có màu, mà alpha vẫn đủ để nhìn xuyên
      // xuống khối đang bị đóng băng.
      // CHỈ MỘT lớp phủ kín lòng tảng. Bản trước xếp bốn lớp alpha chồng lên nhau
      // (.42 + .50 + .30 + .26) và chúng CỘNG DỒN thành ~85% độ đục — băng đọc rất
      // ra băng nhưng khối bị nhốt bên dưới biến mất sạch. Mọi lớp còn lại giờ chỉ
      // chạy ở MÉP: thành đứng ló ra dưới đáy, gờ sáng ló ra trên đỉnh, nên chúng
      // tạo khối mà không ăn vào phần lòng.
      iceMass(gShutter, cells, 3, rad, ICE_DEEP, 0.5, lip);
      iceMass(gShutter, cells, 3, rad, ICE_LIT, 0.34, -lip * 0.6);
      iceMass(gShutter, cells, 3, rad, ICE_BODY, ICE_ALPHA);
      iceCracks(gShutter, cells);
      iceMass(gShutter, cells, 3, rad, 0, 0);
      gShutter.stroke({ width: Math.max(2, cell * 0.05), color: ICE_LIT, alpha: 0.95 });
    }

    session.state.obstacles.forEach((ob, i) => {
      const label = obstacleTexts[i];
      if (!label) return;
      if (ob.cleared || ob.kind === 'park') {
        label.visible = false;
        return;
      }
      // Vẽ theo TỪNG Ô, không theo khung bao: một chướng ngại hoàn toàn có thể
      // gồm nhiều mảng RỜI NHAU (vd băng bịt cả dải trên lẫn dải dưới một khay).
      // Vẽ khung bao thì tô lem cả những ô KHÔNG bị chặn — người chơi đọc sai board.
      for (const [r, c] of ob.cells) {
        const x = originX + c * cell;
        const y = originY + r * cell;
        if (ob.kind === 'ice') {
          // vẽ ở vòng riêng bên dưới — băng là MỘT KHỐI LIỀN, không phải từng ô rời
        } else {
          // ĐỤC: cửa cuốn giấu hẳn nội dung bên dưới (GDD §5 — "không đọc vị, trừ vùng dưới shutter")
          gShutter.rect(x, y, cell, cell).fill(THEME.shutterBody);
          for (let sy = y + cell * 0.18; sy < y + cell * 0.95; sy += cell * 0.3)
            gShutter.rect(x + 3, sy, cell - 6, cell * 0.1).fill({ color: 0x000000, alpha: 0.16 });
          gShutter.rect(x + 2, y + 2, cell - 4, cell - 4)
            .stroke({ width: 4, color: THEME.shutterFrame });
        }
      }

      // Badge đặt trên ô GIỮA của nhóm (theo reading order) — luôn là ô thật sự
      // bị chặn, kể cả khi nhóm không phải hình chữ nhật.
      const mid = [...ob.cells].sort((a, b) => a[0] - b[0] || a[1] - b[1])[
        Math.floor(ob.cells.length / 2)
      ];
      label.visible = true;
      label.text = String(Math.max(0, ob.count));
      label.style.fontSize = Math.round(cell * 0.55);
      label.anchor.set(0.5);
      label.x = originX + mid[1] * cell + cell / 2;
      label.y = originY + mid[0] * cell + cell / 2;
    });
  }

  function drawHolder(g: Graphics, holder: HolderView): void {
    const rs = holder.cells.map((c) => c[0]);
    const cs = holder.cells.map((c) => c[1]);
    const r0 = Math.min(...rs);
    const c0 = Math.min(...cs);
    const w = (Math.max(...cs) - c0 + 1) * cell;
    const h = (Math.max(...rs) - r0 + 1) * cell;
    // Ổ cắm nay là thứ RỜI, mặt khay hoàn toàn do Graphics tô ⇒ một mảng phẳng
    // tuyệt đối, không gradient, không mối nối. Dùng CHUNG bảng màu với chốt.
    const base = ITEM_PALETTE[holder.color]; // đúng màu chốt, không làm sáng thêm
    // KHÍT ĐÚNG Ô: dùng y hệt inset và bo góc của ô board bên dưới, và chân 3D
    // nằm GỌN BÊN TRONG khối chứ không đổ tràn xuống hàng dưới.
    const inset = Math.round(cell * CELL_INSET);
    const x = originX + c0 * cell + inset;
    const y = originY + r0 * cell + inset;
    const bw = w - inset * 2;
    const bh = h - inset * 2;
    // Khay cũng là MỘT VIÊN NHỰA, cùng ngôn ngữ với mảnh: thành đứng dày, mặt
    // trên có GỜ NỔI quanh mép, lòng khay thụt xuống một bậc và lỗ khoét ở đó.
    // Gờ + lòng thụt là thứ tách khay khỏi mảnh — mảnh có núm, khay có lỗ.
    // Chân khay mỏng lại (0.16 → 0.10): chân ăn vào chiều cao MẶT khay, mà ổ cắm
    // bị chặn bởi cạnh nhỏ hơn của mặt. Chân dày thì ổ không thể to.
    const skirt = Math.round(cell * 0.10);

    // CHỈ HAI mảng: thành đứng tối, rồi mặt khay PHẲNG. Không gờ sáng, không lòng
    // thụt — bản demo chỉ là một tấm nhựa phẳng tràn sát mép, chấm hết.
    // Bản trước tôi tự thêm gờ + lòng thụt, cộng tấm sprite nhỏ hơn ô, thành BỐN
    // vòng đồng tâm bao quanh cái lỗ; ở cỡ ô ~90px chúng nuốt hết hình.
    g.roundRect(x, y, bw, bh, cell * CELL_RADIUS).fill(darken(base, 0.42)); // thành

    // Mặt khay tô PHẲNG bằng đúng màu của chốt. Đã thử chuyển sắc dọc cho giống
    // chất nhựa của sprite, nhưng `FillGradient` đặt sai vùng nên sinh ra mảng
    // nhạt ở góc — lệch còn tệ hơn là phẳng. Ổ cắm phủ 97% ô nên phần mặt ló ra
    // rất mỏng, phẳng là đủ và chắc chắn không lệch màu.
    g.roundRect(x, y, bw, bh - skirt, cell * CELL_RADIUS).fill(base);

    // Tấm ổ cắm phải VUÔNG (giãn lệch là bẹp ổ) và phủ gần kín ô. Chừa `pad` để
    // góc vuông của tấm không thò khỏi góc BO TRÒN của khay; khe giữa các tấm
    // không nhìn thấy vì nền tấm sau khi tint trùng đúng màu mặt khay.
    // Ổ cắm phải nằm GỌN TRONG MẶT KHAY, không phải trong ô board. Hai thứ đó
    // khác nhau: thân khay đã thụt vào `inset` mỗi bên, và chân khay còn ăn mất
    // một dải `skirt` ở đáy — nên mặt khay chỉ cao ~0.72 ô dù ô rộng 1.0.
    // Lấy 0.97 ô như trước là ổ tràn ra ngoài chính cái khay.
    const nRows = Math.max(...rs) - r0 + 1;
    const nCols = Math.max(...cs) - c0 + 1;
    const faceW = bw / nCols;
    const faceH = (bh - skirt) / nRows;
    const tile = Math.min(faceW, faceH) * 0.98;

    holder.cells.forEach((pos, i) => {
      const px = x + (pos[1] - c0 + 0.5) * faceW;
      const py = y + (pos[0] - r0 + 0.5) * faceH;

      // Cặp (màu × hình) chưa được gen ảnh — chỉ gặp khi dựng màn bằng trình sửa.
      if (!hasSprite(holder.color, holder.holes[i])) {
        drawPlasticSocket(gHolders, holder.holes[i], px, py, tile * 0.31, base);
        return;
      }

      // Vẽ NGUYÊN tấm ảnh, KHÔNG tint — đây mới là bản giống hệt art-direction.
      const sp = holderPool.next();
      sp.texture = socketTexture(holder.color, holder.holes[i]);
      sp.width = tile;
      sp.height = tile;
      sp.x = px;
      sp.y = py;

      // Lỗ ĐÃ ĐẦY: chính viên chốt NGỒI KHÍT trong ổ. 0.6 như trước là viên bé
      // hơn miệng ổ hẳn một vành, nhìn ra lỏng lẻo chứ không phải "khớp vào".
      // 0.80 là vừa lọt lòng ổ — sprite ổ cắm có vành lip chiếm ~10% mỗi bên.
      if (!holder.filled[i]) return;
      const plug = holderPool.next();
      plug.texture = pegTexture(holder.color, holder.holes[i]);
      plug.width = tile * 0.8;
      plug.height = tile * 0.8;
      plug.x = px;
      plug.y = py;
    });
  }

  // `drawHole` cũ (5 lớp Graphics) đã bỏ: lỗ khay giờ là SPRITE ổ cắm được tint.
  // Vẽ tay không dựng lại nổi vách lõm + bóng mềm; đó chính là chỗ nó luôn trông
  // dẹt so với art-direction.

  /** Lỗ chỉ được vẽ là ĐÃ ĐẦY sau khi chốt thật sự chạm vào nó. */
  function visualFilled(holder: HolderView): boolean[] {
    const t = now();
    return holder.filled.map((f, i) => {
      if (!f) return false;
      const landAt = pendingSeats.get(`${holder.id}#${i}`);
      return landAt === undefined || t >= landAt;
    });
  }

  function drawHolders(): void {
    gHolders.clear();
    holderPool.reset();
    const t = now();

    for (const holder of session.state.holders) {
      if (holder.popped) continue;
      drawHolder(gHolders, { ...holder, filled: visualFilled(holder) });
    }

    // khay đã nổ trong model nhưng chưa tới nhịp nổ trên màn hình
    poppingHolders = poppingHolders.filter((p) => t < p.popAt);
    for (const p of poppingHolders) {
      drawHolder(gHolders, { ...p.view, filled: visualFilled(p.view) });
    }
  }

  /** Vẽ một mảnh ở toạ độ pixel bất kỳ (dùng cho cả trạng thái tĩnh lẫn đang kéo). */
  function drawPiece(
    g: Graphics,
    pool: { next(): Sprite },
    gpool: { next(): Graphics },
    piece: PieceState,
    px: number,
    py: number,
    lift = 0,
  ): void {
    const live = piece.pegs.map((peg, i) => ({ peg, i })).filter((e) => !e.peg.removed);
    const at = (peg: { offset: Cell }) => ({
      x: px + peg.offset[1] * cell + cell / 2,
      y: py + peg.offset[0] * cell + cell / 2 - lift,
    });
    const cells = new Set(live.map((e) => cellKey(e.peg.offset)));

    // thanh nối — "Linked shapes move together"
    for (const { peg } of live) {
      for (const [dr, dc] of [[0, 1], [1, 0]] as Cell[]) {
        if (!cells.has(cellKey([peg.offset[0] + dr, peg.offset[1] + dc]))) continue;
        const a = at(peg);
        const b = { x: a.x + dc * cell, y: a.y + dr * cell };
        const bar = cell * 0.24;
        drawLinkBar(
          g,
          Math.min(a.x, b.x) - bar / 2, Math.min(a.y, b.y) - bar / 2,
          Math.abs(b.x - a.x) + bar, Math.abs(b.y - a.y) + bar,
          ITEM_PALETTE[peg.layers[0].color], cell, lift,
        );
      }
    }

    for (const { peg } of live) {
      const { x, y } = at(peg);
      // CHỒNG KHỐI, không lồng vào trong: nhiều lớp = nhiều viên xếp đè lên nhau,
      // `layers[0]` nằm TRÊN CÙNG và che bớt viên kế tiếp. Lớp dưới vẫn ló ra ở
      // đáy nên vẫn "không đọc vị" (§5) — nhìn là biết bóc ra sẽ ra màu/hình gì.
      const n = peg.layers.length;
      // Chồng càng cao thì viên càng nhỏ, để tổng chiều cao chồng vẫn lọt trong ô.
      // `step` phải đủ lớn: ló ít quá thì viên GIỮA của chồng 3 lớp bị che sạch,
      // mà lớp giữa không đọc được là vi phạm luật "không đọc vị" (§5).
      const size = cell * 0.38 * (1 - 0.11 * (n - 1));
      const step = size * 0.55; // độ ló của mỗi viên bên dưới
      const topY = y - (step * (n - 1)) / 2; // canh giữa cả chồng trong ô

      // Bóng đổ + hốc + thành đứng theo viên ĐÁY của chồng — đó mới là viên
      // chạm mặt board. Thứ tự bắt buộc: hốc (lún trong mặt ô) → bóng chạm →
      // thành đứng (đã là thân viên rồi) → sprite mặt trên đè lên cùng.
      const footY = topY + step * (n - 1);
      const foot = peg.layers[n - 1].shape;
      if (SEAT_SOCKET) drawSeatSocket(g, foot, x, footY, size, cell, lift);
      drawSeatShadow(g, foot, x, footY, size, cell, lift, SEAT_SOCKET ? 0.55 : 1);
      if (SEAT_SKIRT) {
        drawSeatSkirt(g, foot, x, footY, size, cell, ITEM_PALETTE[peg.layers[n - 1].color]);
      }

      // vẽ từ viên ĐÁY lên, để viên trên đè lên viên dưới.
      // Mỗi viên là MỘT SPRITE nhựa trắng được `tint` sang màu của lớp đó —
      // núm, thành đứng, bóng đổ đều nằm sẵn trong ảnh.
      for (let i = n - 1; i >= 0; i--) {
        const layer = peg.layers[i];
        const cy2 = topY + step * i;
        // Cặp (màu × hình) chưa gen ảnh. Vẽ vào Graphics RIÊNG cùng container với
        // sprite — vào chung `g` là nó tụt xuống dưới mọi sprite và bị lớp dưới
        // của chính chồng này che mất.
        if (!hasSprite(layer.color, layer.shape)) {
          const gp = gpool.next();
          gp.zIndex = ++zTop;
          drawPlasticPeg(gp, layer.shape, x, cy2, size, ITEM_PALETTE[layer.color]);
          continue;
        }
        const sp = pool.next();
        sp.zIndex = ++zTop;
        sp.texture = pegTexture(layer.color, layer.shape);
        // 2.30 ⇒ chốt vẽ ở ~0.87 ô, tức lấp gần kín LÒNG Ô board (0.88 ô).
        sp.width = size * 2.3;
        sp.height = size * 2.3;
        sp.x = x;
        sp.y = cy2;
      }
    }
  }

  function drawPieces(): void {
    gPieces.clear();
    gDrag.clear();
    piecePool.reset();
    dragPool.reset();
    pieceGfx.reset();
    dragGfx.reset();
    zTop = 0;
    for (const piece of session.state.pieces) {
      if (piece.gone) continue;
      if (drag && drag.id === piece.id) {
        // vẽ tại ô ĐANG BÁM (luôn hợp lệ), nhấc lên khỏi mặt board
        drawPiece(
          gDrag, dragPool, dragGfx, piece,
          originX + drag.snap[1] * cell,
          originY + drag.snap[0] * cell,
          cell * 0.18,
        );
      } else {
        drawPiece(
          gPieces, piecePool, pieceGfx, piece,
          originX + piece.anchor[1] * cell, originY + piece.anchor[0] * cell,
        );
      }
    }
  }

  function drawGhost(): void {
    // KHÔNG có ghost/highlight nào khi kéo — chỉ mảnh đi theo ngón tay.
    // Toàn bộ phản hồi "đúng chỗ" nằm ở animation chốt nhảy vào lỗ lúc thả.
    gGhost.clear();
  }

  function drawFx(): void {
    gFx.clear();
    fxPool.reset();
    const t = now();
    fx = fx.filter((f) => (f.kind === 'seat' ? t - f.t0 < f.delay + f.dur : t - f.t0 < f.dur));
    for (const f of fx) {
      if (f.kind === 'seat') {
        const x0 = cx(f.from[1]);
        const y0 = cy(f.from[0]);
        const x1 = cx(f.to[1]);
        const y1 = cy(f.to[0]);
        const base = cell * 0.38;

        // Chốt đang bay phải là ĐÚNG SPRITE của nó. Trước đây pha này vẽ lại bằng
        // Graphics, nên giữa chừng viên nhựa 3D biến thành mảng màu phẳng rồi mới
        // chui vào lỗ — chỗ chướng mắt nhất của cả animation.
        const fly = fxPool.next();
        fly.texture = pegTexture(f.color, f.shape);

        // pha 1 — chốt ĐỨNG YÊN ở ô vừa thả
        if (t - f.t0 < f.delay) {
          fly.width = base * 2.3;
          fly.height = base * 2.3;
          fly.x = x0;
          fly.y = y0;
          // vẫn ĐANG NẰM trên board ⇒ bóng ôm sát chân, y hệt lúc tĩnh
          drawSeatShadow(gFx, f.shape, x0, y0, base, cell);
          continue;
        }

        // pha 2 — bật lên, bay cung CAO hơn mặt khay, rồi lún vào lỗ
        const p = Math.max(0, Math.min(1, (t - f.t0 - f.delay) / f.dur));
        const ease = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
        const sink = p > 0.85 ? (p - 0.85) / 0.15 : 0;
        const arc = Math.sin(p * Math.PI) * cell * 0.85;
        const x = x0 + (x1 - x0) * ease;
        const ground = y0 + (y1 - y0) * ease; // chỗ MẶT BOARD ngay dưới chốt
        const y = ground - arc;
        const size = base * (1 + 0.12 * Math.sin(p * Math.PI)) * (1 - sink * 0.1);

        // Bóng nằm lại trên MẶT BOARD, không bay theo chốt: bóng bay cùng vật thì
        // vật không bao giờ đọc ra là đã rời mặt. `arc` truyền vào làm bóng loe và
        // nhạt dần lúc chốt lên cao, rồi siết lại đúng lúc nó lún vào lỗ.
        drawSeatShadow(gFx, f.shape, x, ground, size, cell, arc * (1 - p * 0.35));
        fly.width = size * 2.3;
        fly.height = size * 2.3;
        fly.x = x;
        fly.y = y;

        // chạm lỗ → vòng sáng loe ra
        if (p > 0.88) {
          const k = (p - 0.88) / 0.12;
          shapePath(gFx, f.shape, x1, y1, base * (1 + k * 0.6)).stroke({
            width: 3 * (1 - k),
            color: THEME.glow,
            alpha: 0.9 * (1 - k),
          });
        }
      }
      // `pop` KHÔNG vẽ gì. Trước đây nó phủ một mảng màu đặc (alpha .85) lên trọn
      // khay — che mất chính những cái lỗ vừa lấp đầy — rồi viền trắng bao quanh.
      // Bản thân việc khay BIẾN MẤT đã là phản hồi rồi; mảng phủ chỉ che mất nó.
      // Mục fx vẫn được đẩy vào `fx` vì nhịp hiện panel kết màn đo theo nó.
    }
  }

  /**
   * Tên hiển thị trên HUD lấy phần TRƯỚC dấu `·` — "Level 33 · Ice + Unlink" thành
   * "Level 33". Mẫu chỉ có tên ngắn, mà chữ mập có viền thì tên dài tràn qua cả hai
   * nút hai bên. Tên đầy đủ vẫn còn ở dropdown chọn màn.
   */
  function hudLabel(lv: Level): string {
    const full = lv.name ?? lv.id;
    return full.split('·')[0].trim() || full;
  }

  /** HUD trên cùng — bám ảnh mẫu `docs/ui/ui_only_top_hud.png`. */
  function drawHud(): void {
    const W = app.screen.width;
    const safe = safeInsets();
    gHud.clear();
    buttons = [];

    const btn = Math.round(57 * uiScale); // ≥44px: ngưỡng vùng chạm của mobile
    const top = safe.top + Math.round(7 * uiScale);
    const padX = Math.round(12 * uiScale) + Math.max(safe.left, safe.right);
    // vùng chạm nới rộng hơn phần vẽ để ngón tay dễ trúng
    const grow = Math.round(8 * uiScale);

    // ---- hai nút hai bên ----
    const bL = chunkyButton(gHud, padX, top, btn);
    iconRestart(gHud, bL.cx, bL.cy, bL.r * 0.8, HUD.icon);
    buttons.push({ x: padX - grow, y: top - grow, w: btn + grow * 2, h: btn + grow * 2, action: 'restart' });

    const rx = W - padX - btn;
    const bR = chunkyButton(gHud, rx, top, btn);
    iconGear(gHud, bR.cx, bR.cy, bR.r * 0.9, HUD.icon, HUD.btnFace);
    buttons.push({ x: rx - grow, y: top - grow, w: btn + grow * 2, h: btn + grow * 2, action: 'settings' });

    // ---- tên màn ----
    // Tên phải lọt GIỮA hai nút: tên dài hoặc máy hẹp thì co chữ lại chứ không để
    // chữ trườn lên nút.
    const label = hudLabel(session.level);
    const room = rx - (padX + btn) - Math.round(18 * uiScale);
    let titleSize = Math.round(28 * uiScale);
    setChunkyText(titleBack, titleFront, label, titleSize, HUD.titleFill, HUD.titleOutline);
    if (titleFront.width > room) {
      titleSize = Math.max(11, Math.floor((titleSize * room) / titleFront.width));
      setChunkyText(titleBack, titleFront, label, titleSize, HUD.titleFill, HUD.titleOutline);
    }

    // Tên nằm CAO hơn tâm nút, viên thuốc nằm thấp hơn — hai nút bắc qua cả hai
    // hàng, đúng như mẫu.
    const ty = top + Math.round(11 * uiScale);
    for (const t of [titleBack, titleFront]) {
      t.x = W / 2;
      t.y = ty;
    }

    // ---- viên thuốc đếm giờ ----
    const remaining = session.clock.remainingMs;
    const danger = remaining <= 10_000;
    const warn = !danger && remaining <= 30_000;
    const timeSize = Math.round(27 * uiScale);
    const timeFill = danger ? THEME.timerDanger : warn ? THEME.timerWarn : HUD.timeFill;
    // đệm 0 cho phút: mẫu là `01:30`, và bề rộng cố định thì viên thuốc không co
    // giãn mỗi khi đồng hồ rơi từ 10:00 xuống 9:59
    setChunkyText(timeBack, timeFront, fmtTime(remaining).padStart(5, '0'), timeSize, timeFill, HUD.timeOutline);

    const pillH = Math.round(timeSize + 14 * uiScale);
    const pillY = ty + Math.round(39 * uiScale);
    const wd = pillH * 0.6;
    const gapW = pillH * 0.2;
    const padIn = pillH * 0.4;
    const pillW = padIn * 2 + wd + gapW + timeFront.width;
    const px = Math.round(W / 2 - pillW / 2);
    const py = pillY - pillH / 2;

    gHud.roundRect(px, py + pillH * 0.08, pillW, pillH, pillH / 2).fill({ color: HUD.shadow, alpha: 0.3 });
    gHud.roundRect(px, py, pillW, pillH, pillH / 2).fill(HUD.pillEdge);
    const e = Math.max(1, pillH * 0.05);
    gHud.roundRect(px + e, py + e, pillW - e * 2, pillH - e * 2, pillH / 2).fill(HUD.pill);
    iconWatch(gHud, px + padIn + wd / 2, pillY, wd / 2, HUD.watch);

    for (const t of [timeBack, timeFront]) {
      t.x = px + padIn + wd + gapW + timeFront.width / 2;
      t.y = pillY;
      // sắp hết giờ thì cả cụm chữ đập nhẹ — phản hồi này có từ trước, giữ nguyên
      t.scale.set(danger ? 1 + Math.sin(now() / 120) * 0.06 : 1);
    }
  }

  /**
   * Khay Cài đặt sau nút bánh răng. Chỉ chứa thứ game THẬT SỰ có hôm nay — nút
   * hiện ra mà bấm không làm gì thì thà đừng vẽ.
   */
  function drawSettings(): void {
    settings.visible = settingsOpen;
    gSettings.clear();
    if (!settingsOpen) return;

    // đè lên mọi nút phía sau: khay đang mở thì bấm ra ngoài chỉ để đóng
    buttons = [];
    const W = app.screen.width;
    const H = app.screen.height;
    gSettings.rect(0, 0, W, H).fill({ color: 0x120e3a, alpha: 0.78 });

    const pw = Math.min(W - 48 * uiScale, 340 * uiScale);
    const rowH = Math.round(52 * uiScale);
    const ph = Math.round(46 * uiScale) + rowH * 4 + Math.round(20 * uiScale);
    const pxs = Math.round(W / 2 - pw / 2);
    const pys = Math.round(H / 2 - ph / 2);
    gSettings.roundRect(pxs, pys + 6, pw, ph, 22 * uiScale).fill({ color: HUD.shadow, alpha: 0.4 });
    gSettings.roundRect(pxs, pys, pw, ph, 22 * uiScale).fill(HUD.sheet);

    setTitle.style.fontSize = Math.round(26 * uiScale);
    setTitle.anchor.set(0.5);
    setTitle.x = W / 2;
    setTitle.y = pys + Math.round(30 * uiScale);

    const rows: { text: string; action: Button['action'] }[] = [
      { text: `Rung phản hồi:  ${vibrate ? 'Bật' : 'Tắt'}`, action: 'toggleVibrate' },
      { text: '✎  Sửa màn này', action: 'edit' },
      { text: 'Chơi lại màn', action: 'restart' },
      { text: 'Đóng', action: 'closeSettings' },
    ];
    rows.forEach((row, i) => {
      const y = pys + Math.round(50 * uiScale) + i * rowH;
      const h = rowH - Math.round(9 * uiScale);
      const inset = Math.round(16 * uiScale);
      gSettings
        .roundRect(pxs + inset, y, pw - inset * 2, h, h / 2)
        .fill(i === rows.length - 1 ? HUD.btnBody : HUD.btnFace);
      const t = setRows[i];
      t.text = row.text;
      t.style.fontSize = Math.round(19 * uiScale);
      t.anchor.set(0.5);
      t.x = W / 2;
      t.y = y + h / 2;
      buttons.push({ x: pxs + inset, y, w: pw - inset * 2, h, action: row.action });
    });

    // `hitButton` lấy vùng KHỚP ĐẦU TIÊN ⇒ hai vùng bao này phải xếp sau các hàng:
    // thân khay nuốt cú chạm để khỏi đóng nhầm, ngoài khay mới là đóng.
    buttons.push({ x: pxs, y: pys, w: pw, h: ph, action: 'none' });
    buttons.push({ x: 0, y: 0, w: W, h: H, action: 'closeSettings' });
  }

  // ---------- trình sửa màn ----------

  /** Nạp bản sửa mới và ghi lại bản cũ để hoàn tác. */
  function applyDraft(next: Level): void {
    if (next === draft) return;
    history.push(draft);
    if (history.length > 60) history.shift();
    draft = next;
    loadLevel(next);
  }

  function say(note: string): void {
    editNote = note;
    editNoteAt = now();
  }

  function startEditing(): void {
    editing = true;
    settingsOpen = false;
    history = [];
    picked = null;
    draft = session.level;
    loadLevel(draft);
    say('Chạm vào ô để sửa');
  }

  /** Chạm lên một ô board khi đang sửa. */
  function editCell(r: number, c: number): void {
    if (r < 0 || c < 0 || r >= draft.rows || c >= draft.cols) return;
    const cell: Cell = [r, c];
    if (tool === 'cell') return applyDraft(ed.toggleCell(draft, cell));
    if (tool === 'erase') return applyDraft(ed.eraseAt(draft, cell));

    // Bấm lên thứ SẴN CÓ mà không bật công tắc sửa thì đây là cú LẤY MẪU — chỉ
    // đổi cọ, không đụng dữ liệu. Áp cho cả khay lẫn chốt.
    const at = ed.occupantAt(draft, cell);
    const want = tool === 'peg' ? 'peg' : 'holder';
    if (!stackLayers && (at?.kind === 'peg' || at?.kind === 'holder') && at.kind === want) {
      brushColor = at.color;
      brushShape = at.shape;
      picked = cell;
      buzz(8);
      say(`Đã chọn: ${at.color} · ${at.shape}`);
      return;
    }
    picked = null;
    if (tool === 'holder') {
      return applyDraft(ed.paintHolder(draft, cell, brushColor, brushShape, linkPegs));
    }
    applyDraft(ed.paintPeg(draft, cell, brushColor, brushShape, linkPegs));
  }

  function doExport(): void {
    const json = ed.exportLevel(draft);
    // eslint-disable-next-line no-console -- kênh lấy dữ liệu ra khi clipboard bị chặn
    console.log(json);
    navigator.clipboard?.writeText(json).then(
      () => say('Đã chép JSON vào clipboard'),
      () => say('Clipboard bị chặn — JSON đã in ra console'),
    );
    say('Đang chép JSON…');
  }

  /**
   * LƯU bản sửa. Hai đích độc lập nhau:
   *   · `localStorage` — bản sửa không mất khi tải lại trang, lần sau mở màn đó ra
   *     là ra bản đã sửa.
   *   · file `.json` tải về máy — bản CHÍNH THỨC để dán vào `levels.data.json`.
   *     localStorage nằm trong trình duyệt, xoá cache là bay.
   */
  function saveDraft(): void {
    const json = ed.exportLevel(draft);
    const remembered = saveEdit(JSON.parse(json) as Level);
    const filed = download(`${draft.id}.json`, json);
    if (!filed) {
      // eslint-disable-next-line no-console -- đường lui khi trình duyệt chặn tải file
      console.log(json);
      say('Trình duyệt chặn tải file — JSON đã in ra console');
      return;
    }
    say(remembered ? `Đã lưu ${draft.id}.json về máy` : `Đã tải ${draft.id}.json (không nhớ được trong trình duyệt)`);
  }

  function onEditAction(a: EditHit['action']): void {
    if (a.k === 'tool') tool = a.v;
    else if (a.k === 'color') brushColor = a.v;
    else if (a.k === 'shape') brushShape = a.v;
    else if (a.k === 'link') {
      linkPegs = !linkPegs;
      say(linkPegs ? 'Chốt mới sẽ NỐI vào mảnh kề bên' : 'Chốt mới đứng RỜI');
    } else if (a.k === 'stack') {
      stackLayers = !stackLayers;
      say(stackLayers ? 'Bấm chốt cũ sẽ ĐẮP THÊM LỚP' : 'Bấm chốt cũ để LẤY MẪU');
    }
    else if (a.k === 'rows') applyDraft(ed.resize(draft, draft.rows + a.d, draft.cols));
    else if (a.k === 'cols') applyDraft(ed.resize(draft, draft.rows, draft.cols + a.d));
    else if (a.k === 'time') applyDraft(ed.setTime(draft, draft.timeLimitMs + a.d * 5_000));
    else if (a.k === 'undo') {
      const prev = history.pop();
      if (!prev) return say('Không còn gì để hoàn tác');
      draft = prev;
      loadLevel(prev);
      say('Đã hoàn tác');
    } else if (a.k === 'export') doExport();
    else if (a.k === 'done') {
      saveDraft();
      editing = false;
      const issues = validateLevel(draft);
      options.onLevelEdit?.(draft);
      loadLevel(draft);
      if (issues.length > 0) console.warn('[editor] còn lỗi dữ liệu:', issues);
    }
  }

  function drawEditor(): void {
    editor.visible = editing;
    gEditor.clear();
    editorText.reset();
    editHits = [];
    if (!editing) return;

    if (editNote && now() - editNoteAt > 2600) editNote = '';
    const st = {
      tool,
      color: brushColor,
      shape: brushShape,
      rows: draft.rows,
      cols: draft.cols,
      timeMs: draft.timeLimitMs,
      issues: validateLevel(draft).length,
      canUndo: history.length > 0,
      link: linkPegs,
      stack: stackLayers,
      note: editNote,
    };
    // nhãn bám mép trên KHUNG board, không phải mép trên ô đầu tiên
    drawEditBadge(
      gEditor,
      editorText,
      app.screen.width,
      originY - Math.round(cell * FRAME_W) - Math.round(cell * 0.045),
      safeInsets().top + hudH - Math.round(18 * uiScale),
      uiScale,
      st,
    );
    editHits = drawPalette(
      gEditor,
      editorText,
      app.screen.width,
      app.screen.height,
      uiScale,
      safeInsets().bottom,
      st,
    );
  }

  function drawOverlay(): void {
    const W = app.screen.width;
    const H = app.screen.height;
    const visible =
      session.status !== 'playing' && session.status !== 'idle' && now() >= overlayAt;
    overlay.visible = visible;
    gOverlay.clear();
    if (!visible) return;

    gOverlay.rect(0, 0, W, H).fill({ color: 0x120e3a, alpha: 0.78 });
    overTitle.style.fontSize = Math.round(35 * uiScale);
    overSub.style.fontSize = Math.round(19 * uiScale);
    overBtnA.style.fontSize = Math.round(22 * uiScale);
    overBtnB.style.fontSize = Math.round(22 * uiScale);
    const cleared = session.status === 'cleared';
    overTitle.text = cleared ? '✓ Cleared!' : session.status === 'timeout' ? "⏱ Time's up!" : 'No moves left';
    overTitle.anchor.set(0.5);
    overTitle.x = W / 2;
    overTitle.y = H * 0.38;

    overSub.text = cleared
      ? `Time left ${fmtTime(session.clock.remainingMs)}  ·  ${session.state.moves} moves`
      : session.status === 'deadlock'
        ? 'Không còn cú thả nào cắm được chốt'
        : `${session.layersLeft} layers left`;
    overSub.anchor.set(0.5);
    overSub.x = W / 2;
    overSub.y = H * 0.38 + 44;

    const bw = Math.round(Math.min(190 * uiScale, (W - 48) / 2));
    const bh = Math.round(54 * uiScale);
    const y = H * 0.53;

    if (cleared) {
      gOverlay.roundRect(W / 2 - bw / 2, y, bw, bh, 18).fill(THEME.boardFrame);
      overBtnA.text = 'Next';
      overBtnB.visible = false;
      overBtnA.anchor.set(0.5);
      overBtnA.x = W / 2;
      overBtnA.y = y + bh / 2;
      buttons.push({ x: W / 2 - bw / 2, y, w: bw, h: bh, action: 'next' });
    } else if (session.status === 'timeout') {
      gOverlay.roundRect(W / 2 - bw - 8, y, bw, bh, 18).fill(THEME.boardFrame);
      overBtnA.text = 'Retry';
      overBtnA.anchor.set(0.5);
      overBtnA.x = W / 2 - bw / 2 - 8;
      overBtnA.y = y + bh / 2;
      buttons.push({ x: W / 2 - bw - 8, y, w: bw, h: bh, action: 'retry' });

      gOverlay.roundRect(W / 2 + 8, y, bw, bh, 18).fill(THEME.timerWarn);
      overBtnB.visible = true;
      overBtnB.text = '+30s ▶';
      overBtnB.anchor.set(0.5);
      overBtnB.x = W / 2 + 8 + bw / 2;
      overBtnB.y = y + bh / 2;
      buttons.push({ x: W / 2 + 8, y, w: bw, h: bh, action: 'addTime' });
    } else {
      gOverlay.roundRect(W / 2 - bw / 2, y, bw, bh, 18).fill(THEME.boardFrame);
      overBtnA.text = 'Retry';
      overBtnB.visible = false;
      overBtnA.anchor.set(0.5);
      overBtnA.x = W / 2;
      overBtnA.y = y + bh / 2;
      buttons.push({ x: W / 2 - bw / 2, y, w: bw, h: bh, action: 'retry' });
    }
  }

  // ---------- input ----------

  function toGrid(ev: PointerEvent): { rf: number; cf: number; x: number; y: number } {
    const rect = app.canvas.getBoundingClientRect();
    const x = (ev.clientX - rect.left) * (app.screen.width / rect.width);
    const y = (ev.clientY - rect.top) * (app.screen.height / rect.height);
    return { rf: (y - originY) / cell, cf: (x - originX) / cell, x, y };
  }

  function hitButton(ev: PointerEvent): Button | undefined {
    const { x, y } = toGrid(ev);
    return buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  }

  function onPointerDown(ev: PointerEvent): void {
    const btn = hitButton(ev);
    if (btn) {
      if (btn.action === 'restart' || btn.action === 'retry') {
        session.restart(now());
        fx = [];
        pendingSeats.clear();
        poppingHolders = [];
        overlayAt = Infinity;
        settingsOpen = false;
      }
      if (btn.action === 'settings') settingsOpen = true;
      if (btn.action === 'closeSettings') settingsOpen = false;
      if (btn.action === 'edit') startEditing();
      if (btn.action === 'toggleVibrate') {
        vibrate = !vibrate;
        try {
          localStorage.setItem('ssj.vibrate', vibrate ? '1' : '0');
        } catch {
          /* WebView chặn thì thôi, chỉ mất phần nhớ qua phiên */
        }
        if (vibrate) buzz(12);
      }
      if (btn.action === 'addTime') {
        if (session.addTime(30_000, now())) overlayAt = Infinity;
      }
      if (btn.action === 'next') {
        const nxt = options.onLevelRequest?.(1);
        if (nxt) loadLevel(nxt);
        else session.restart(now());
      }
      return;
    }

    // Đang sửa màn: chạm chỉ có hai đích — bảng công cụ, hoặc một ô board.
    // Không kéo mảnh, không chơi.
    if (editing) {
      const g0 = toGrid(ev);
      const hit = editHits.find(
        (e) => g0.x >= e.x && g0.x <= e.x + e.w && g0.y >= e.y && g0.y <= e.y + e.h,
      );
      if (hit) return onEditAction(hit.action);

      const r = Math.floor(g0.rf);
      const c = Math.floor(g0.cf);
      if (tool === 'move') {
        const t = ed.objectAt(draft, [r, c]);
        if (!t) return;
        editDrag = { t, grab: [r, c], d: [0, 0], ok: true };
        picked = null;
        buzz(8);
        return;
      }
      editCell(r, c);
      return;
    }

    if (settingsOpen || session.status !== 'playing') return;

    const { rf, cf } = toGrid(ev);
    const r = Math.floor(rf);
    const c = Math.floor(cf);
    const hit = session.state.pieces.find(
      (p) => !p.gone && pieceCells(p).some(([pr, pc]) => pr === r && pc === c),
    );
    if (!hit) return;

    // ngón tay che mất mảnh → nhấc lên 1 ô; chuột thì không cần
    liftCells = ev.pointerType === 'touch' ? 1 : 0;
    buzz(8);

    drag = {
      id: hit.id,
      grabR: rf - hit.anchor[0],
      grabC: cf - hit.anchor[1],
      snap: [hit.anchor[0], hit.anchor[1]],
      check: checkDrop(session.state, hit, hit.anchor),
      moved: false,
    };
  }

  function onPointerMove(ev: PointerEvent): void {
    if (editDrag) {
      const { rf, cf } = toGrid(ev);
      const dr = Math.round(rf - 0.5) - editDrag.grab[0];
      const dc = Math.round(cf - 0.5) - editDrag.grab[1];
      editDrag.d = [dr, dc];
      editDrag.ok = ed.canMove(draft, editDrag.t, dr, dc);
      return;
    }
    if (!drag || session.status !== 'playing') return;
    const piece = session.state.pieces.find((p) => p.id === drag!.id);
    if (!piece) return;

    const { rf, cf } = toGrid(ev);
    const wantR = rf - drag.grabR - liftCells;
    const wantC = cf - drag.grabC;

    // TRƯỢT từng ô về phía con trỏ, chỉ qua ô hợp lệ KỀ CẠNH — KHÔNG nhảy thẳng
    // tới ô đích. Mảnh bị vật cản CHẶN: nếu không bước nào tiến gần con trỏ hơn thì
    // nó đứng lại, người chơi phải KÉO VÒNG (ngón tay dẫn đường quanh vật cản).
    let r = drag.snap[0];
    let c = drag.snap[1];
    const dist = (rr: number, cc: number) => (rr - wantR) ** 2 + (cc - wantC) ** 2;
    for (let step = 0; step < 40; step++) {
      let nr = r;
      let nc = c;
      let bestD = dist(r, c);
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as Cell[]) {
        const d = dist(r + dr, c + dc);
        if (d >= bestD) continue; // bước phải TIẾN GẦN con trỏ hơn
        if (!checkDrop(session.state, piece, [r + dr, c + dc]).ok) continue; // ô kề phải trống
        nr = r + dr;
        nc = c + dc;
        bestD = d;
      }
      if (nr === r && nc === c) break; // không lối nào gần hơn → bị chặn, dừng
      r = nr;
      c = nc;
    }

    if (r !== drag.snap[0] || c !== drag.snap[1]) {
      drag.snap = [r, c];
      drag.moved = true;
      drag.check = checkDrop(session.state, piece, drag.snap);
    }
  }

  function onPointerUp(): void {
    if (editDrag) {
      const e = editDrag;
      editDrag = null;
      const [dr, dc] = e.d;
      if (dr === 0 && dc === 0) return;
      if (!ed.canMove(draft, e.t, dr, dc)) return say('Chỗ đó không đặt được');
      applyDraft(ed.moveObject(draft, e.t, dr, dc));
      buzz(10);
      say(`Đã dời ${e.t.kind === 'holder' ? 'khay' : 'mảnh'}`);
      return;
    }
    if (!drag) return;
    const d = drag;
    drag = null;
    if (session.status !== 'playing') return;

    const piece = session.state.pieces.find((p) => p.id === d.id);
    if (!piece) return;

    // chạm rồi nhả tại chỗ = không làm gì (bản gốc không có highlight gợi ý)
    if (!d.moved || !d.check.ok) return;

    const result = session.move(d.id, d.snap, now());
    if (!result) return;

    if (result.poppedHolders.length > 0) buzz([0, 18, 45, 30]);
    else if (result.pluggedLayers > 0) buzz(14);

    const t = now();
    const landBy = new Map<string, number>();

    result.transfers.forEach((tr, i) => {
      const holder = session.state.holders.find((h) => h.id === tr.holderId);
      if (!holder) return;
      const delay = SEAT_DELAY + i * SEAT_STAGGER;
      const landAt = t + delay + SEAT_DUR;
      pendingSeats.set(`${tr.holderId}#${tr.holeIndex}`, landAt);
      landBy.set(tr.holderId, Math.max(landBy.get(tr.holderId) ?? 0, landAt));
      fx.push({
        kind: 'seat',
        from: tr.from,
        to: holder.cells[tr.holeIndex],
        shape: tr.layer.shape,
        color: tr.layer.color,
        t0: t,
        delay,
        dur: SEAT_DUR,
      });
    });

    // khay chỉ nổ SAU khi chốt cuối cùng đã lún vào lỗ
    for (const id of result.poppedHolders) {
      const holder = session.state.holders.find((h) => h.id === id);
      if (!holder) continue;
      const popAt = (landBy.get(id) ?? t) + POP_DELAY;
      poppingHolders.push({
        view: {
          id: holder.id,
          color: holder.color,
          cells: holder.cells,
          holes: holder.holes,
          filled: [...holder.filled],
        },
        popAt,
      });
      fx.push({ kind: 'pop', cells: holder.cells, color: ITEM_PALETTE[holder.color], t0: popAt, dur: POP_DUR });
    }
    if (session.status !== 'playing') {
      // panel phải chờ animation cuối chạy xong; nếu THẮNG thì giữ thêm một nhịp
      const fxEnd = fx.reduce(
        (m, f) => Math.max(m, f.t0 + (f.kind === 'seat' ? f.delay : 0) + f.dur),
        t,
      );
      overlayAt =
        session.status === 'cleared'
          ? Math.max(t + WIN_HOLD, fxEnd + WIN_HOLD_AFTER_FX)
          : fxEnd + WIN_HOLD_AFTER_FX;
      options.onComplete?.(session.result());
    }
  }

  // mobile: chặn cuộn/kéo-để-tải-lại và menu giữ-lâu ngay trên canvas
  const swallow = (ev: Event) => ev.preventDefault();
  app.canvas.addEventListener('pointerdown', onPointerDown);
  app.canvas.addEventListener('touchstart', swallow, { passive: false });
  app.canvas.addEventListener('touchmove', swallow, { passive: false });
  app.canvas.addEventListener('contextmenu', swallow);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  const onVisibility = () => {
    if (document.hidden) session.pause(now());
    else session.resume(now());
  };
  document.addEventListener('visibilitychange', onVisibility);

  const tick = () => {
    const t = now();
    // Đang sửa màn thì KHÔNG chạy đồng hồ: người dựng màn ngồi lâu là chuyện
    // thường, để nó đếm thì đang sửa dở board tự nhiên hiện panel hết giờ.
    if (!editing && session.tick(t)) {
      overlayAt = t; // hết giờ → hiện ngay, không có gì để xem thêm
      options.onComplete?.(session.result());
    }
    for (const [k, landAt] of pendingSeats) if (t >= landAt) pendingSeats.delete(k);
    layout();
    drawBoard();
    drawObstacles();
    drawHolders();
    drawGhost();
    drawPieces();
    drawFx();
    drawHud();
    drawOverlay();
    drawSettings();
    drawEditor();
  };
  app.ticker.add(tick);

  rebuildObstacleTexts();
  session.begin(now());
  if (document.hidden) session.pause(now());

  (window as unknown as Record<string, unknown>).__ssj = {
    app,
    layout: () => ({ cell, originX, originY }),
    // hook QA + tiện tay: mở trình sửa và lấy JSON ra ngoài console
    edit: () => startEditing(),
    editing: () => editing,
    // vùng chạm của bảng công cụ — để QA bấm đúng nút thay vì tự tính lại toạ độ
    editHits: () => editHits.map((e) => ({ ...e, action: { ...e.action } })),
    draft: () => draft,
    exportLevel: () => ed.exportLevel(draft),
    // hook QA: soi số đo HUD để đối chiếu với ảnh mẫu docs/ui/
    hud: () => ({
      W: app.screen.width,
      uiScale,
      titleW: titleFront.width,
      titleSize: titleFront.style.fontSize,
      timeW: timeFront.width,
      timeSize: timeFront.style.fontSize,
      titleXY: [titleFront.x, titleFront.y],
      timeXY: [timeFront.x, timeFront.y],
    }),
    session: () => session,
    loadLevel,
    // hook QA: soi ô mảnh đang bám khi kéo (kiểm luật trượt/chặn)
    dragSnap: () => (drag ? { id: drag.id, snap: drag.snap, moved: drag.moved } : null),
    // hook QA: soi nhịp animation cắm/nổ
    anim: () => ({
      now: now(),
      fx: fx.map((f) => ({ kind: f.kind, t0: Math.round(f.t0), dur: f.dur })),
      pendingSeats: [...pendingSeats.entries()].map(([k, v]) => ({ hole: k, landAt: Math.round(v) })),
      popping: poppingHolders.map((p) => ({ id: p.view.id, popAt: Math.round(p.popAt) })),
      visualFilled: session.state.holders.map((h) => ({ id: h.id, popped: h.popped, shown: visualFilled(h) })),
    }),
  };

  return {
    destroy(): void {
      app.ticker.remove(tick);
      app.canvas.removeEventListener('pointerdown', onPointerDown);
      app.canvas.removeEventListener('touchstart', swallow);
      app.canvas.removeEventListener('touchmove', swallow);
      app.canvas.removeEventListener('contextmenu', swallow);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      document.removeEventListener('visibilitychange', onVisibility);
      app.destroy(true, { children: true });
    },
    loadLevel,
    restart: () => session.restart(now()),
    session: () => session,
    edit: startEditing,
  };
}

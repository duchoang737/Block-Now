// Sprite ĐÚNG MÀU — không dùng `tint`.
//
// `tint` chỉ là phép NHÂN (nhựa trắng × màu = màu phẳng), nên nó không tái tạo
// nổi ảnh art-direction: mất màu tràn, mất bắt sáng vượt quá màu nền. Vì vậy mỗi
// cặp (màu × hình) là một ảnh riêng.
//
// FILE NÀY SINH TỰ ĐỘNG — đừng sửa tay. Thêm ảnh vào `view/sprites/` rồi chạy
// `scratchpad/gen_sprites_ts.py`. Cặp nào thiếu ảnh sẽ rơi về bản vẽ bằng
// Graphics ở `view/plastic.ts`, xem `hasSprite`.
import { Assets, Texture } from 'pixi.js';
import type { Color, Shape } from '../types';

import pegBlueCircle from './sprites/peg_blue_circle.png';
import pegBlueHeart from './sprites/peg_blue_heart.png';
import pegBlueStar from './sprites/peg_blue_star.png';
import pegGreenDiamond from './sprites/peg_green_diamond.png';
import pegGreenTriangle from './sprites/peg_green_triangle.png';
import pegOrangeCross from './sprites/peg_orange_cross.png';
import pegOrangeDiamond from './sprites/peg_orange_diamond.png';
import pegPinkCircle from './sprites/peg_pink_circle.png';
import pegPinkStar from './sprites/peg_pink_star.png';
import pegPurpleCircle from './sprites/peg_purple_circle.png';
import pegPurpleCross from './sprites/peg_purple_cross.png';
import pegPurpleDiamond from './sprites/peg_purple_diamond.png';
import pegPurpleStar from './sprites/peg_purple_star.png';
import pegRedHeart from './sprites/peg_red_heart.png';
import pegRedStar from './sprites/peg_red_star.png';
import pegWhitePentagon from './sprites/peg_white_pentagon.png';
import pegYellowHeart from './sprites/peg_yellow_heart.png';
import pegYellowSquare from './sprites/peg_yellow_square.png';
import pegYellowStar from './sprites/peg_yellow_star.png';
import socketBlueCircle from './sprites/socket_blue_circle.png';
import socketBlueHeart from './sprites/socket_blue_heart.png';
import socketBlueStar from './sprites/socket_blue_star.png';
import socketGreenDiamond from './sprites/socket_green_diamond.png';
import socketGreenTriangle from './sprites/socket_green_triangle.png';
import socketOrangeCross from './sprites/socket_orange_cross.png';
import socketOrangeDiamond from './sprites/socket_orange_diamond.png';
import socketPinkCircle from './sprites/socket_pink_circle.png';
import socketPinkStar from './sprites/socket_pink_star.png';
import socketPurpleCircle from './sprites/socket_purple_circle.png';
import socketPurpleCross from './sprites/socket_purple_cross.png';
import socketPurpleDiamond from './sprites/socket_purple_diamond.png';
import socketPurpleStar from './sprites/socket_purple_star.png';
import socketRedHeart from './sprites/socket_red_heart.png';
import socketRedStar from './sprites/socket_red_star.png';
import socketWhitePentagon from './sprites/socket_white_pentagon.png';
import socketYellowHeart from './sprites/socket_yellow_heart.png';
import socketYellowSquare from './sprites/socket_yellow_square.png';
import socketYellowStar from './sprites/socket_yellow_star.png';

const key = (c: Color, s: Shape) => `${c}/${s}`;

const PEG_URLS: Record<string, string> = {
  'blue/circle': pegBlueCircle,
  'blue/heart': pegBlueHeart,
  'blue/star': pegBlueStar,
  'green/diamond': pegGreenDiamond,
  'green/triangle': pegGreenTriangle,
  'orange/cross': pegOrangeCross,
  'orange/diamond': pegOrangeDiamond,
  'pink/circle': pegPinkCircle,
  'pink/star': pegPinkStar,
  'purple/circle': pegPurpleCircle,
  'purple/cross': pegPurpleCross,
  'purple/diamond': pegPurpleDiamond,
  'purple/star': pegPurpleStar,
  'red/heart': pegRedHeart,
  'red/star': pegRedStar,
  'white/pentagon': pegWhitePentagon,
  'yellow/heart': pegYellowHeart,
  'yellow/square': pegYellowSquare,
  'yellow/star': pegYellowStar,
};

const SOCKET_URLS: Record<string, string> = {
  'blue/circle': socketBlueCircle,
  'blue/heart': socketBlueHeart,
  'blue/star': socketBlueStar,
  'green/diamond': socketGreenDiamond,
  'green/triangle': socketGreenTriangle,
  'orange/cross': socketOrangeCross,
  'orange/diamond': socketOrangeDiamond,
  'pink/circle': socketPinkCircle,
  'pink/star': socketPinkStar,
  'purple/circle': socketPurpleCircle,
  'purple/cross': socketPurpleCross,
  'purple/diamond': socketPurpleDiamond,
  'purple/star': socketPurpleStar,
  'red/heart': socketRedHeart,
  'red/star': socketRedStar,
  'white/pentagon': socketWhitePentagon,
  'yellow/heart': socketYellowHeart,
  'yellow/square': socketYellowSquare,
  'yellow/star': socketYellowStar,
};

const pegs = new Map<string, Texture>();
const sockets = new Map<string, Texture>();

export async function loadPegTextures(): Promise<void> {
  const load = async (urls: Record<string, string>, into: Map<string, Texture>) => {
    await Promise.all(
      Object.entries(urls).map(async ([k, url]) => into.set(k, await Assets.load(url))),
    );
  };
  await Promise.all([load(PEG_URLS, pegs), load(SOCKET_URLS, sockets)]);
}

/** `Texture.EMPTY` nếu chưa nạp xong — frame đầu có thể vẽ trước khi ảnh về. */
export const pegTexture = (c: Color, s: Shape): Texture =>
  pegs.get(key(c, s)) ?? Texture.EMPTY;
export const socketTexture = (c: Color, s: Shape): Texture =>
  sockets.get(key(c, s)) ?? Texture.EMPTY;

/**
 * Cặp (màu × hình) này có ảnh chưa?
 *
 * 64 cặp có thể có, hiện mới gen 19. Trình sửa màn cho chọn cả 64 — cặp chưa
 * có ảnh phải vẽ bằng Graphics thay thế, không thì khay/chốt hiện ra trống trơn
 * và người dựng màn tưởng mình bấm hụt.
 */
export const hasSprite = (c: Color, s: Shape): boolean => pegs.has(key(c, s));

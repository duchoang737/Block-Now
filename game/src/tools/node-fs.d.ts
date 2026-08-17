// Khai báo tối thiểu cho `node:fs`.
//
// Dự án CỐ Ý không cài `@types/node`: bundle chạy trong trình duyệt, kéo cả bộ
// kiểu của Node vào chỉ tổ mở cửa cho việc lỡ import API Node vào code game.
// Thư mục `tools/` là công cụ chạy dưới vitest, không nằm trong bundle — nó cần
// đúng hai hàm này và không cần gì hơn.
declare module 'node:fs' {
  export function readFileSync(path: unknown, encoding: 'utf8'): string;
  export function writeFileSync(path: unknown, data: string, encoding: 'utf8'): void;
  export function existsSync(path: unknown): boolean;
}

/** `import.meta.env` do Vite/vitest bơm vào — cổng bật/tắt các công cụ trong `tools/`. */
interface ImportMeta {
  readonly env: Record<string, string | undefined>;
}

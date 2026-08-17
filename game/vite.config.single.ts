// Build gộp TẤT CẢ vào một chunk JS duy nhất → để nhúng thành 1 file HTML tự chứa.
// Dùng cho bản share/xem online; bản dev/APK vẫn dùng vite.config.ts.
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist-single',
    assetsDir: '.',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: {
      output: { inlineDynamicImports: true, entryFileNames: 'bundle.js' },
    },
  },
});

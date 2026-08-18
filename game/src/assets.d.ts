// Vite biến `import x from './a.png'` thành một URL (data: URI ở bản build gộp
// một file, vì `assetsInlineLimit` được đặt rất cao). TS cần biết điều đó.
declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.mp3' {
  const src: string;
  export default src;
}

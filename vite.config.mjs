import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // 1. 必须是相对路径，否则黑屏
      base: './', 
      
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      
      plugins: [react()],
  
      
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },

      // 2. 构建配置：不再手动分包，让 Vite 自己决定
      build: {
        // 调高警告阈值到 2000KB，这样它就不会因为文件大而烦你了
        chunkSizeWarningLimit: 2000, 
        outDir: 'dist',
        assetsDir: 'assets',
        emptyOutDir: true,
      },
    };
});
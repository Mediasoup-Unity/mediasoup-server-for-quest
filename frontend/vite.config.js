import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths(), basicSsl()],
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "./src/styles/_mantine";`,
      },
    },
  },
  define: {
    APP_VERSION: JSON.stringify(process.env['npm_package_version']),
  },
  resolve: {
    alias: {
      '@styles': resolve(__dirname, 'src/styles'),
    },
  },
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3333',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'ws://localhost:3333',
        ws: true,
        secure: false,
      },
    },
  },
  build: {
    commonjsOptions: {
      include: [/packages\/common/, /node_modules/],
    },
  },
});

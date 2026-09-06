import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()], server:{port:5178,proxy:{'/api':'http://127.0.0.1:18082'}}, build:{rollupOptions:{output:{manualChunks:{react:['react','react-dom'],data:['xlsx'],graphics:['d3','d3-sankey']}}}}});

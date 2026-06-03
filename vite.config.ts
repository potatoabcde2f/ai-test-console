import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/ai-test-console/",
  server: {
    port: 5173,
    open: true,
    proxy: {
      // 代理图片上传请求
      "/api/open/upload": {
        target: "http://161.117.182.222:6605",
        changeOrigin: true,
      },
      // 代理 AI Stylist 请求
      "/api/ai-stylist": {
        target: "http://192.168.15.62:8082",
        changeOrigin: true,
      },
      // 代理追问 API 请求
      "/v1/messages": {
        target: "http://47.236.3.167:8080",
        changeOrigin: true,
      },
    },
  },
});

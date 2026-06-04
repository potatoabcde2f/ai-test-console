// 在浏览器控制台运行此脚本导出 localStorage 数据
// 然后将输出复制到 src/lib/defaultData.ts

const KEY = "ai-console-persist-v2";
const data = localStorage.getItem(KEY);

if (data) {
  console.log("/* eslint-disable */");
  console.log("export const DEFAULT_LOCAL_STORAGE_DATA = " + data + ";");
} else {
  console.log("No data found in localStorage");
}

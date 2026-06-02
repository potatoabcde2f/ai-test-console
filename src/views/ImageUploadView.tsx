import { useRef, useState } from "react";

interface UploadedImage {
  id: string;
  file: File;
  url: string | null;
  status: "pending" | "uploading" | "success" | "error";
  errorMsg?: string;
}

const UPLOAD_API_URL = "/api/open/upload";
const UPLOAD_TOKEN = "7f4c2d91b8e64a3f9c2e7d15a6b84f03";

export function ImageUploadView() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // 上传单张图片
  const uploadSingleImage = async (uploadedImage: UploadedImage): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("file", uploadedImage.file);

      console.log("开始上传:", uploadedImage.file.name);

      const response = await fetch(UPLOAD_API_URL, {
        method: "POST",
        mode: "cors",
        headers: {
          "x-external-token": UPLOAD_TOKEN,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("上传响应:", data);

      if (data.isSuccess && data.data?.path) {
        return data.data.path;
      }
      throw new Error(data.msg || "上传失败");
    } catch (err) {
      console.error("上传失败:", err);
      throw err;
    }
  };

  // 处理文件选择
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newImages: UploadedImage[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        console.warn("跳过非图片文件:", file.name);
        continue;
      }
      newImages.push({
        id: generateId(),
        file,
        url: null,
        status: "pending",
      });
    }

    if (newImages.length === 0) return;

    setImages((prev) => [...prev, ...newImages]);

    // 逐个上传
    for (const img of newImages) {
      setImages((prev) =>
        prev.map((i) => (i.id === img.id ? { ...i, status: "uploading" } : i))
      );

      try {
        const url = await uploadSingleImage(img);
        setImages((prev) =>
          prev.map((i) => (i.id === img.id ? { ...i, status: "success", url } : i))
        );
      } catch (err) {
        setImages((prev) =>
          prev.map((i) =>
            i.id === img.id
              ? { ...i, status: "error", errorMsg: err instanceof Error ? err.message : "未知错误" }
              : i
          )
        );
      }
    }
  };

  // 拖拽处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  // 移除图片
  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((i) => i.id !== id));
  };

  // 复制 URL
  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      alert("已复制到剪贴板");
    } catch {
      alert("复制失败，请手动复制");
    }
  };

  // 清空全部
  const clearAll = () => {
    setImages([]);
  };

  // 重试上传
  const retryUpload = async (image: UploadedImage) => {
    setImages((prev) =>
      prev.map((i) => (i.id === image.id ? { ...i, status: "uploading", errorMsg: undefined } : i))
    );

    try {
      const url = await uploadSingleImage(image);
      setImages((prev) =>
        prev.map((i) => (i.id === image.id ? { ...i, status: "success", url } : i))
      );
    } catch (err) {
      setImages((prev) =>
        prev.map((i) =>
          i.id === image.id
            ? { ...i, status: "error", errorMsg: err instanceof Error ? err.message : "未知错误" }
            : i
        )
      );
    }
  };

  const successCount = images.filter((i) => i.status === "success").length;
  const uploadingCount = images.filter((i) => i.status === "uploading").length;

  return (
    <div className="image-upload-view">
      {/* 头部 */}
      <div className="image-upload-header">
        <div>
          <h2>图床测试</h2>
          <p className="image-upload-subtitle">上传图片到 OSS 图床</p>
        </div>
        <div className="image-upload-stats">
          <span className="stat-item">
            <span className="stat-label">总图片:</span>
            <span className="stat-value">{images.length}</span>
          </span>
          <span className="stat-item">
            <span className="stat-label">成功:</span>
            <span className="stat-value success">{successCount}</span>
          </span>
          {uploadingCount > 0 && (
            <span className="stat-item">
              <span className="stat-label">上传中:</span>
              <span className="stat-value uploading">{uploadingCount}</span>
            </span>
          )}
          {images.length > 0 && (
            <button type="button" className="btn btn-danger" onClick={clearAll}>
              清空全部
            </button>
          )}
        </div>
      </div>

      {/* 上传区域 */}
      <div
        className={`upload-drop-zone ${isDragging ? "dragging" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        <div className="upload-icon">📤</div>
        <div className="upload-text">
          <p>点击或拖拽图片到此处上传</p>
          <p className="upload-hint">支持 PNG、JPG、JPEG 格式</p>
        </div>
      </div>

      {/* API 信息 */}
      <div className="api-info-panel">
        <h4>📋 接口信息</h4>
        <div className="api-info-row">
          <span className="api-info-label">Endpoint:</span>
          <code className="api-info-value">POST /api/open/upload</code>
        </div>
        <div className="api-info-row">
          <span className="api-info-label">Token:</span>
          <code className="api-info-value">{UPLOAD_TOKEN}</code>
        </div>
        <div className="api-info-row">
          <span className="api-info-label">响应格式:</span>
          <code className="api-info-value">{"{ data: { path: 'oss-url' }, isSuccess: true }"}</code>
        </div>
      </div>

      {/* 图片列表 */}
      {images.length > 0 && (
        <div className="image-list">
          <h4>📷 上传结果</h4>
          <div className="image-grid">
            {images.map((img) => (
              <div key={img.id} className={`image-card ${img.status}`}>
                {/* 预览图 */}
                <div className="image-preview">
                  {img.status === "success" && img.url ? (
                    <img src={img.url} alt={img.file.name} />
                  ) : (
                    <div className="image-placeholder">
                      <span className="file-icon">🖼️</span>
                      <span className="file-name">{img.file.name}</span>
                    </div>
                  )}

                  {/* 状态标签 */}
                  <div className={`status-badge ${img.status}`}>
                    {img.status === "pending" && "待上传"}
                    {img.status === "uploading" && (
                      <>
                        <span className="spinner-small"></span>
                        上传中
                      </>
                    )}
                    {img.status === "success" && "✓ 成功"}
                    {img.status === "error" && "✗ 失败"}
                  </div>
                </div>

                {/* 信息区 */}
                <div className="image-info">
                  <div className="image-meta">
                    <span className="image-size">{(img.file.size / 1024).toFixed(1)} KB</span>
                  </div>

                  {img.status === "success" && img.url && (
                    <div className="image-url-section">
                      <input
                        type="text"
                        className="image-url-input"
                        value={img.url}
                        readOnly
                        onClick={(e) => e.currentTarget.select()}
                      />
                      <button
                        type="button"
                        className="btn btn-primary copy-btn"
                        onClick={() => copyUrl(img.url!)}
                      >
                        复制
                      </button>
                    </div>
                  )}

                  {img.status === "error" && (
                    <div className="image-error">
                      <span className="error-text">{img.errorMsg || "上传失败"}</span>
                      <button
                        type="button"
                        className="btn btn-secondary retry-btn"
                        onClick={() => retryUpload(img)}
                      >
                        重试
                      </button>
                    </div>
                  )}
                </div>

                {/* 删除按钮 */}
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => removeImage(img.id)}
                  title="删除"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

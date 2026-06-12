import { useRef, useState } from "react";

export default function UploadPanel({ onFiles, busy }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (fileList) => {
    const images = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (images.length) onFiles(images);
  };

  return (
    <section className="card" aria-labelledby="upload-title">
      <div className="card-head">
        <h2 id="upload-title">2 · Label images</h2>
      </div>
      <p className="hint">
        Add one label, or drop a whole batch — every image is checked against the
        application data on the left.
      </p>
      <div
        className={`dropzone ${dragOver ? "dropzone-active" : ""} ${busy ? "dropzone-busy" : ""}`}
        role="button"
        tabIndex={0}
        aria-label="Upload label images"
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) inputRef.current?.click();
        }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!busy) handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="dropzone-icon" aria-hidden="true">⇪</div>
        <strong>{busy ? "Processing…" : "Click to choose label images"}</strong>
        <span>or drag and drop · JPG, PNG, WEBP · multiple files allowed</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </section>
  );
}

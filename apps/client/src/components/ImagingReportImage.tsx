import { useEffect, useRef, useState } from "react";
import { Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";

export function ImagingReportImage({ src, name }: { src: string; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => () => dialog.current?.close(), []);
  return <>
    <button type="button" className="inline-flex flex-col items-start gap-1" aria-label={`Enlarge ${name} image`} onClick={() => { setZoom(1); dialog.current?.showModal(); }}>
      <img src={src} alt={name} style={{ width: 240, height: 180, maxWidth: "100%", objectFit: "contain", background: "#fff" }} />
      <Maximize2 size={16} />
    </button>
    <dialog ref={dialog} aria-label={`${name} image`} style={{ margin: "auto", width: "min(1000px, 95vw)", maxHeight: "90vh", padding: 16, border: "1px solid #9eabb3" }}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <strong>{name}</strong>
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Zoom out" title="Zoom out" disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - 0.5))}><ZoomOut size={20} /></button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" aria-label="Zoom in" title="Zoom in" disabled={zoom >= 4} onClick={() => setZoom(value => Math.min(4, value + 0.5))}><ZoomIn size={20} /></button>
          <button type="button" aria-label="Close image" title="Close image" onClick={() => dialog.current?.close()}><X size={20} /></button>
        </div>
      </header>
      <div style={{ overflow: "auto", height: "65vh", background: "#111" }}>
        <img src={src} alt={name} style={{ width: `${zoom * 100}%`, maxWidth: "none", height: `${zoom * 100}%`, objectFit: "contain" }} />
      </div>
    </dialog>
  </>;
}

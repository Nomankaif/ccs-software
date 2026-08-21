import { X } from "lucide-react";
export function Modal({
  title,
  children,
  onClose,
  width = 610,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  width?: number;
}) {
  return (
    <div className="modal-backdrop">
      <section
        className="modal-window"
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="modal-titlebar">
          <strong>{title}</strong>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </header>
        <div className="modal-content">{children}</div>
      </section>
    </div>
  );
}

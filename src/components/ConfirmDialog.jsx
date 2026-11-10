import { useLayoutEffect, useRef } from "preact/hooks";

const ConfirmDialog = ({
  open,
  title = "Confirm",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}) => {
  const dialog = useRef(null);
  useLayoutEffect(() => {
    const node = dialog.current;
    if (!node) return;
    node.showModal();
    return () => node.close();
  }, [open]);
  if (!open) return null;

  return (
    <dialog
      ref={dialog}
      className="dialog-card"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-desc"
      onCancel={(event) => { event.preventDefault(); onCancel(); }}
      onClick={(event) => { if (event.target === dialog.current) onCancel(); }}
    >
      <div className="dialog-body">
        <h3 id="confirm-title">{title}</h3>
        <p id="confirm-desc">{description ?? "Are you sure you want to continue?"}</p>
      </div>
      <div className="dialog-actions">
        <button className="btn ghost" type="button" autoFocus onClick={onCancel}>
          {cancelLabel}
        </button>
        <button className="btn danger" type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
};

export default ConfirmDialog;

import './ConfirmModal.css';

const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Confirm", 
  cancelText = "Cancel",
  showCancel = true,
  isDanger = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          {showCancel && (
            <button className="btn-cancel" onClick={onClose}>
              {cancelText}
            </button>
          )}
          <button className={`btn-confirm ${isDanger ? 'btn-danger' : ''}`} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;

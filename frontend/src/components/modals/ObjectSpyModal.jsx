import { Crosshair, X } from 'lucide-react';

const ObjectSpyModal = ({
  show,
  onClose,
  spyUrl,
  setSpyUrl,
  handleStartSpy,
  isStartingSpy
}) => {
  if (!show) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3><Crosshair size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} /> Object Spy</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="modal-desc">
            Object Spy sẽ mở trình duyệt Chrome và inject công cụ spy vào trang web.
            Di chuột qua các phần tử để preview, <strong>Ctrl+Click</strong> để capture phần tử vào Object Repository.
            Nhấn <strong>ESC</strong> trên trình duyệt để thoát.
          </p>
          <div className="input-group">
            <label>URL trang web cần Spy</label>
            <input
              type="text"
              className="input-field"
              value={spyUrl}
              onChange={(event) => setSpyUrl(event.target.value)}
              placeholder="https://example.com"
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="toolbar-btn" onClick={onClose}>Hủy</button>
          <button
            className="toolbar-btn run"
            onClick={handleStartSpy}
            disabled={isStartingSpy || !spyUrl}
          >
            <Crosshair size={16} /> {isStartingSpy ? 'Đang mở...' : 'Bắt đầu Spy'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ObjectSpyModal;

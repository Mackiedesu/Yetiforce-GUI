import { Folder, X } from 'lucide-react';

const CreateSuiteModal = ({
  show,
  onClose,
  newSuiteName,
  setNewSuiteName,
  newSuiteDesc,
  setNewSuiteDesc,
  handleCreateSuite
}) => {
  if (!show) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3><Folder size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 6 }} /> Tạo Test Suite</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="modal-desc">
            Test Suite là bộ tổng hợp nhiều Test Case. Sau khi tạo, bạn có thể thêm script vào suite và chạy toàn bộ để xem tỷ lệ % thành công.
          </p>
          <div className="input-group">
            <label>Tên Suite</label>
            <input
              type="text"
              className="input-field"
              value={newSuiteName}
              onChange={(event) => setNewSuiteName(event.target.value)}
              placeholder="VD: Login Flow Tests"
            />
          </div>
          <div className="input-group">
            <label>Mô tả (tùy chọn)</label>
            <textarea
              className="input-field"
              value={newSuiteDesc}
              onChange={(event) => setNewSuiteDesc(event.target.value)}
              placeholder="Mô tả bộ test..."
              rows={3}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="toolbar-btn" onClick={onClose}>Hủy</button>
          <button className="toolbar-btn run" onClick={handleCreateSuite} disabled={!newSuiteName.trim()}>
            Tạo Suite
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateSuiteModal;

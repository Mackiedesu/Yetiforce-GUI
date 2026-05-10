import {
  Activity,
  Crosshair,
  Database,
  Eye,
  FileText,
  Pencil,
  RefreshCw,
  Shield,
  Trash2,
  X,
  Check
} from 'lucide-react';

const ObjectRepositoryTab = ({
  objects,
  selectedObject,
  setSelectedObject,
  setIsEditingObject,
  selectedObjectDetail,
  fetchObjectDetail,
  isEditingObject,
  editName,
  setEditName,
  editDescription,
  setEditDescription,
  handleStartEdit,
  handleSaveEdit,
  handleCancelEdit,
  handleDeleteObject,
  fetchObjects,
  spyActive,
  handleStopSpy,
  openSpyModal,
  healingReport,
  locatorTypeLabel,
  locatorTypeBadgeClass
}) => {
  return (
    <div className="object-repo-container">
      <div className="object-repo-header">
        <div className="object-repo-title">
          <Database size={20} />
          <h2>Object Repository</h2>
          <span className="obj-count-label">{objects.length} objects</span>
        </div>
        <div className="object-repo-actions">
          <button className="toolbar-btn" onClick={fetchObjects}>
            <RefreshCw size={14} /> Làm mới
          </button>
          <button
            className={`toolbar-btn ${spyActive ? 'spy-active' : ''}`}
            onClick={() => (spyActive ? handleStopSpy() : openSpyModal())}
          >
            <Crosshair size={14} className={spyActive ? 'pulse-icon' : ''} />
            {spyActive ? 'Dừng Spy' : 'Bắt đầu Spy'}
          </button>
        </div>
      </div>

      {healingReport && healingReport.totalHealed > 0 && (
        <div className="healing-banner">
          <Shield size={16} />
          <span>
            Self-Healing: <strong>{healingReport.totalHealed}</strong> phần tử đã được tự chữa lành trong lần chạy gần nhất.
            {healingReport.totalFailed > 0 && (
              <span className="healing-failed"> | {healingReport.totalFailed} phần tử thất bại hoàn toàn.</span>
            )}
          </span>
        </div>
      )}

      <div className="object-repo-body">
        <div className="object-list">
          <div className="object-list-header">
            <span>Danh sách Objects</span>
          </div>
          {objects.length === 0 ? (
            <div className="empty-state">
              <Crosshair size={40} />
              <p>Chưa có object nào</p>
              <span>Sử dụng Object Spy để capture phần tử từ trang web</span>
            </div>
          ) : (
            <div className="object-items">
              {objects.map((obj) => (
                <div
                  key={obj.objectId}
                  className={`object-item ${selectedObject === obj.objectId ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedObject(obj.objectId);
                    setIsEditingObject(false);
                    fetchObjectDetail(obj.objectId);
                  }}
                >
                  <div className="object-item-icon">
                    <FileText size={16} />
                  </div>
                  <div className="object-item-info">
                    <div className="object-item-name">{obj.objectId}</div>
                    <div className="object-item-meta">
                      <span className="obj-tag-badge">&lt;{obj.tagName}&gt;</span>
                      <span className="obj-locator-count">{obj.locatorCount} locators</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="object-detail">
          {!selectedObjectDetail ? (
            <div className="empty-state">
              <Eye size={40} />
              <p>Chọn một object để xem chi tiết</p>
            </div>
          ) : (
            <div className="object-detail-content">
              <div className="object-detail-header">
                {isEditingObject ? (
                  <input
                    type="text"
                    className="input-field edit-name-input editable"
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                  />
                ) : (
                  <h3>{selectedObjectDetail.objectId}</h3>
                )}
                <div className="detail-header-actions">
                  {isEditingObject ? (
                    <>
                      <button className="toolbar-btn" onClick={handleSaveEdit}>
                        <Check size={14} /> Lưu
                      </button>
                      <button className="toolbar-btn" onClick={handleCancelEdit}>
                        <X size={14} /> Hủy
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="toolbar-btn" onClick={handleStartEdit}>
                        <Pencil size={14} /> Sửa
                      </button>
                      <button className="toolbar-btn delete-btn" onClick={() => handleDeleteObject(selectedObjectDetail.objectId)}>
                        <Trash2 size={14} /> Xóa
                      </button>
                    </>
                  )}
                </div>
              </div>

              {selectedObjectDetail.healingStatus?.needsUpdate && (
                <div className="healing-warning">
                  <Shield size={14} />
                  <span>
                    Locator chính đã hỏng! Đã tự chữa bằng: <strong>{selectedObjectDetail.healingStatus.usedFallback?.type}</strong>
                  </span>
                </div>
              )}

              <div className="detail-section">
                <div className="detail-row">
                  <span className="detail-label">Tag</span>
                  <span className="detail-value">&lt;{selectedObjectDetail.tagName}&gt;</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Text</span>
                  <span className="detail-value">{selectedObjectDetail.textContent || '—'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Source URL</span>
                  <span className="detail-value url-value">{selectedObjectDetail.sourceUrl || '—'}</span>
                </div>
                {selectedObjectDetail.parentFrame && (
                  <div className="detail-row">
                    <span className="detail-label">Parent Frame</span>
                    <span className="detail-value">
                      {selectedObjectDetail.parentFrame.id || selectedObjectDetail.parentFrame.name || `Frame #${selectedObjectDetail.parentFrame.index}`}
                    </span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="detail-label">Description</span>
                  {isEditingObject ? (
                    <textarea
                      className="input-field edit-desc-input"
                      value={editDescription}
                      onChange={(event) => setEditDescription(event.target.value)}
                      placeholder="Nhập mô tả cho phần tử này..."
                      rows={3}
                    />
                  ) : (
                    <span className="detail-value">{selectedObjectDetail.description || 'Chưa có mô tả'}</span>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <h4>
                  <Activity size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />
                  Locators ({selectedObjectDetail.locators?.length || 0})
                </h4>
                <div className="locators-list">
                  {(selectedObjectDetail.locators || []).map((loc, idx) => (
                    <div key={idx} className={`locator-item ${loc.status === 'active' ? '' : 'inactive'}`}>
                      <div className="locator-priority">#{loc.priority}</div>
                      <span className={`locator-type-badge ${locatorTypeBadgeClass(loc.type)}`}>
                        {locatorTypeLabel(loc.type)}
                      </span>
                      <code className="locator-value">{loc.value}</code>
                      <span className={`locator-status ${loc.status}`}>
                        {loc.status === 'active' ? '✓' : '✗'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedObjectDetail.screenshot && (
                <div className="detail-section">
                  <h4>Screenshot</h4>
                  <div className="screenshot-container">
                    <img
                      src={selectedObjectDetail.screenshot}
                      alt={`Screenshot of ${selectedObjectDetail.objectId}`}
                      className="screenshot-img"
                    />
                  </div>
                </div>
              )}

              <div className="detail-section timestamps">
                <span>Tạo: {new Date(selectedObjectDetail.createdAt).toLocaleString()}</span>
                <span>Cập nhật: {new Date(selectedObjectDetail.updatedAt).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ObjectRepositoryTab;

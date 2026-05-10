import { ChevronDown, ChevronRight, Database, FileText, X } from 'lucide-react';

const ExplorerPanel = ({
  explorerOpen,
  setExplorerOpen,
  activeNav,
  openFolders,
  handleSidebarClick,
  objects,
  selectedObject
}) => {
  if (!explorerOpen) {
    return null;
  }

  return (
    <div className="explorer-panel">
      <div className="explorer-header">
        <span className="explorer-title">Explorer</span>
        <button className="explorer-toggle" onClick={() => setExplorerOpen(false)}>
          <X size={16} />
        </button>
      </div>

      <div className="tree-view">
        {activeNav === 'objects' && (
          <>
            <div className="tree-item" onClick={() => handleSidebarClick('Object Repository')}>
              {openFolders.objectRepo ? <ChevronDown className="tree-icon" size={14} /> : <ChevronRight className="tree-icon" size={14} />}
              <Database className="tree-icon" /> Object Repository
              {objects.length > 0 && <span className="badge-count">{objects.length}</span>}
            </div>
            {openFolders.objectRepo && (
              <div style={{ paddingLeft: 16 }}>
                {objects.length === 0 ? (
                  <div className="tree-item empty-hint">
                    Chưa có object nào. Dùng Object Spy để capture.
                  </div>
                ) : (
                  objects.map((obj) => (
                    <div
                      key={obj.objectId}
                      className={`tree-item ${selectedObject === obj.objectId ? 'active' : ''}`}
                      onClick={() => handleSidebarClick(`OBJ_${obj.objectId}`)}
                      title={obj.description || obj.objectId}
                    >
                      <FileText className="tree-icon" />
                      <span className="tree-obj-name">{obj.objectId}</span>
                      <span className="tree-obj-tag">&lt;{obj.tagName}&gt;</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ExplorerPanel;

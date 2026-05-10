import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FolderOpen,
  HardDrive,
  Loader2,
  Monitor,
  X,
} from 'lucide-react';
import { browseDirectory, listDrives, validatePath } from '../features/fs-browser/fsBrowser.api';

/**
 * PathPickerInput
 * ───────────────
 * A reusable input + "Browse" button that opens a server-side file/folder
 * picker modal.  Replaces raw text inputs for all path fields.
 *
 * Props
 * ─────
 * value         {string}   Controlled value
 * onChange      {fn}       Called with the new path string
 * label         {string}   Field label text
 * required      {boolean}  Show asterisk and validate non-empty
 * type          {'directory'|'file'}  What to pick
 * fileExtension {string}   Filter files by ext, e.g. ".exe"
 * placeholder   {string}   Input placeholder
 * hint          {string}   Small helper text below the input
 * error         {string}   External validation error to display
 * readOnly      {boolean}  Make the text field read-only (default true)
 * disabled      {boolean}
 * id            {string}   HTML id for the input
 */
export default function PathPickerInput({
  value = '',
  onChange,
  label,
  required = false,
  type = 'directory',
  fileExtension = '',
  placeholder,
  hint,
  error: externalError,
  readOnly = true,
  disabled = false,
  id,
}) {
  const [modalOpen, setModalOpen]         = useState(false);
  const [validating, setValidating]       = useState(false);
  const [validationState, setValidation]  = useState(null); // null | {valid,error}

  const defaultPlaceholder =
    placeholder ||
    (type === 'file'
      ? 'Nhấn "Chọn file" để duyệt...'
      : 'Nhấn "Chọn thư mục" để duyệt...');

  // Validate the path whenever the value changes (debounced 500 ms)
  const debounceRef = useRef(null);
  useEffect(() => {
    clearTimeout(debounceRef.current);

    if (!value || !value.trim()) {
      debounceRef.current = setTimeout(() => setValidation(null), 0);
      return () => clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setValidating(true);
      try {
        const result = await validatePath(value.trim(), type);
        setValidation(result);
      } catch {
        setValidation(null);
      } finally {
        setValidating(false);
      }
    }, 500);

    return () => clearTimeout(debounceRef.current);
  }, [value, type]);

  function handleSelected(selectedPath) {
    onChange(selectedPath);
    setModalOpen(false);
  }

  const hasError = externalError || (validationState && !validationState.valid);
  const errorMsg  = externalError || (validationState && !validationState.valid ? validationState.error : '');
  const isValid   = !externalError && validationState?.valid;

  return (
    <div className="path-picker-group">
      {label && (
        <label className="path-picker-label" htmlFor={id}>
          {label}
          {required && <span className="kat-required"> *</span>}
        </label>
      )}

      <div className={`path-picker-row ${hasError ? 'path-picker-row--error' : ''} ${isValid ? 'path-picker-row--valid' : ''}`}>
        <input
          id={id}
          className="path-picker-input"
          value={value}
          onChange={readOnly ? undefined : (e) => onChange(e.target.value)}
          readOnly={readOnly}
          disabled={disabled}
          placeholder={defaultPlaceholder}
          spellCheck={false}
        />

        {/* Inline status icon */}
        <span className="path-picker-status">
          {validating && <Loader2 size={14} className="spin" style={{ color: 'var(--text-secondary)' }} />}
          {!validating && isValid && <CheckCircle2 size={14} style={{ color: 'var(--success-color)' }} />}
          {!validating && hasError && value && <AlertCircle size={14} style={{ color: 'var(--error-color)' }} />}
        </span>

        <button
          type="button"
          className="path-picker-browse-btn"
          onClick={() => setModalOpen(true)}
          disabled={disabled}
          title={type === 'file' ? 'Chọn file' : 'Chọn thư mục'}
        >
          <FolderOpen size={13} />
          {type === 'file' ? 'Chọn file' : 'Chọn thư mục'}
        </button>
      </div>

      {hint && !hasError && (
        <span className="path-picker-hint">{hint}</span>
      )}
      {errorMsg && (
        <span className="path-picker-error">
          <AlertCircle size={12} /> {errorMsg}
        </span>
      )}

      {modalOpen && (
        <FsBrowserModal
          initialPath={value}
          pickType={type}
          fileExtension={fileExtension}
          onSelect={handleSelected}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* FsBrowserModal                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

function FsBrowserModal({ initialPath, pickType, fileExtension, onSelect, onClose }) {
  const [currentPath, setCurrentPath]   = useState('');
  const [items, setItems]               = useState([]);
  const [breadcrumb, setBreadcrumb]     = useState([]);
  const [drives, setDrives]             = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [selected, setSelected]         = useState('');
  const [manualInput, setManualInput]   = useState(initialPath || '');
  const [showDrives, setShowDrives]     = useState(false);

  // Load drives on mount
  useEffect(() => {
    listDrives()
      .then((d) => setDrives(d.drives || []))
      .catch(() => {});
  }, []);

  // Navigate to initialPath or root on mount
  useEffect(() => {
    if (initialPath) {
      // Try to navigate to the parent folder of the initial path
      browse(initialPath);
    } else {
      // Start from Windows C:\  or /
      browse('C:\\');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function browse(targetPath) {
    setLoading(true);
    setError('');
    try {
      const showFiles = pickType === 'file';
      const data = await browseDirectory(targetPath, {
        showFiles,
        ext: pickType === 'file' ? fileExtension : '',
      });
      setCurrentPath(data.currentPath);
      setItems(data.items || []);
      setBreadcrumb(data.breadcrumb || []);
      // If browsing a folder picker, pre-select the current directory
      if (pickType === 'directory') {
        setSelected(data.currentPath);
        setManualInput(data.currentPath);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Không thể duyệt thư mục.');
    } finally {
      setLoading(false);
    }
  }

  function handleItemClick(item) {
    if (item.isDir) {
      browse(item.path);
    } else {
      // File selected
      setSelected(item.path);
      setManualInput(item.path);
    }
  }

  function handleConfirm() {
    const pathToUse = manualInput.trim() || selected || currentPath;
    if (!pathToUse) return;
    onSelect(pathToUse);
  }

  function handleManualNavigate(e) {
    if (e.key === 'Enter') {
      browse(manualInput);
    }
  }

  return (
    <div className="fs-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fs-modal">
        {/* Header */}
        <div className="fs-modal-header">
          <div className="fs-modal-title">
            <Monitor size={16} />
            <span>
              {pickType === 'file' ? 'Chọn file' : 'Chọn thư mục'}
              {fileExtension && ` (${fileExtension})`}
            </span>
          </div>
          <button className="toolbar-btn" onClick={onClose}><X size={14} /></button>
        </div>

        {/* Address bar */}
        <div className="fs-modal-address">
          <button
            className="toolbar-btn fs-drives-btn"
            onClick={() => setShowDrives((v) => !v)}
            title="Chọn ổ đĩa"
          >
            <HardDrive size={13} />
          </button>

          <input
            className="fs-address-input"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={handleManualNavigate}
            placeholder="Nhập hoặc dán đường dẫn, nhấn Enter để điều hướng..."
            spellCheck={false}
          />

          <button
            className="toolbar-btn"
            onClick={() => browse(manualInput)}
            title="Đi đến"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Drive selector */}
        {showDrives && drives.length > 0 && (
          <div className="fs-drives-bar">
            {drives.map((d) => (
              <button
                key={d.path}
                className="fs-drive-btn"
                onClick={() => { browse(d.path); setShowDrives(false); }}
              >
                <HardDrive size={12} /> {d.name}
              </button>
            ))}
          </div>
        )}

        {/* Breadcrumb */}
        {breadcrumb.length > 0 && (
          <div className="fs-breadcrumb">
            {breadcrumb.map((crumb, i) => (
              <span key={crumb.path} className="fs-crumb">
                {i > 0 && <ChevronRight size={12} className="fs-crumb-sep" />}
                <button
                  className="fs-crumb-btn"
                  onClick={() => browse(crumb.path)}
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>
        )}

        {/* File list */}
        <div className="fs-modal-body">
          {loading && (
            <div className="fs-loading">
              <Loader2 size={18} className="spin" /> Đang tải...
            </div>
          )}

          {!loading && error && (
            <div className="fs-error">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="fs-empty">
              <FolderOpen size={28} />
              <span>Thư mục trống</span>
            </div>
          )}

          {!loading && !error && items.map((item) => (
            <div
              key={item.path}
              className={`fs-item ${selected === item.path ? 'fs-item--selected' : ''}`}
              onClick={() => handleItemClick(item)}
              onDoubleClick={() => item.isDir && browse(item.path)}
            >
              <span className="fs-item-icon">
                {item.isDir ? <FolderOpen size={15} /> : <span style={{ fontSize: '0.8rem' }}>📄</span>}
              </span>
              <span className="fs-item-name">{item.name}</span>
              {item.isDir && <ChevronRight size={12} className="fs-item-chevron" />}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="fs-modal-footer">
          <div className="fs-selected-path">
            <span className="fs-selected-label">Đã chọn:</span>
            <code className="fs-selected-value">
              {manualInput || selected || currentPath || '—'}
            </code>
          </div>
          <div className="fs-footer-actions">
            <button className="toolbar-btn" onClick={onClose}>Hủy</button>
            <button
              className="toolbar-btn run"
              onClick={handleConfirm}
              disabled={!manualInput.trim() && !selected && !currentPath}
            >
              Chọn
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

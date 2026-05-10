import { CheckCircle } from 'lucide-react';

const ScriptTab = ({ generatedScript, setGeneratedScript }) => {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          <CheckCircle size={16} color="var(--success-color)" style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 4 }} />
          Mã nguồn đã được tạo sẵn bởi Gemini AI
        </div>
      </div>
      <textarea
        className="input-field"
        style={{ height: 'calc(100vh - 400px)', fontFamily: 'monospace', whiteSpace: 'pre' }}
        value={generatedScript}
        onChange={(event) => setGeneratedScript(event.target.value)}
      />
    </div>
  );
};

export default ScriptTab;

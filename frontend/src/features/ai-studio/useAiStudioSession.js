const SESSION_KEY = 'ai_studio_session';

export function readSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return { ...s, selected: new Set(Array.isArray(s.selected) ? s.selected : []) };
  } catch {
    return null;
  }
}

export function writeSession(state) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      phase: state.phase === 'generating'
        ? (state.inputMode === 'url' ? 'scanned' : 'idle')
        : state.phase,
      inputMode:         state.inputMode,
      url:               state.url,
      scanResult:        state.scanResult,
      textRequirement:   state.textRequirement,
      testCases:         state.testCases,
      selected:          [...(state.selected || [])],
      selectedProjectId: state.selectedProjectId,
      selectedSuiteId:   state.selectedSuiteId,
      projectMode:       state.projectMode,
      newProjectName:    state.newProjectName,
      newProjectDesc:    state.newProjectDesc,
      newProjectDir:     state.newProjectDir,
    }));
  } catch { /* storage quota exceeded, ignore */ }
}

export function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

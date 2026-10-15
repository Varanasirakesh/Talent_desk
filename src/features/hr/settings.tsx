"use client";
import { useState, type ChangeEvent } from 'react';
import { defaultPreferences, parsePreferences, type HrPreferences } from './preferences';

function saveSettings(value: HrPreferences) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'my-hiring-details.local.json';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function HrSettings({ onApply, jobId, jobTitle, initialValue }: { onApply: (preferences: HrPreferences) => void; jobId: string; jobTitle: string; initialValue: HrPreferences }) {
  const [value, setValue] = useState<HrPreferences>({ ...initialValue });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  function apply(next: HrPreferences) {
    setValue(next);
    onApply(next);
    setError('');
    setMessage(`Preferences applied to ${jobId} for this session. Export a copy to keep your changes.`);
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setMessage('');
    try {
      if (file.size > 65536) throw new Error('Settings file must be smaller than 64 KB.');
      apply(parsePreferences(await file.text()));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not read this settings file.'); }
  }
  return (
    <details className="kit-settings">
      <summary>Hiring settings <strong>{jobId}</strong><span>{jobTitle} · Import / edit / export</span></summary>
      <div className="kit-settings-body">
        <p>These role preferences apply to <strong>{jobId}</strong>. Recruiter profile details carry across jobs. Keep a copy in <code>my-hiring-details.local.json</code> and import it after editing. Your details and resumes stay in this browser session; refreshing clears them.</p>
        <div className="kit-settings-grid">
          {(['recruiterName', 'company', 'defaultRole', 'defaultLocation', 'linkedinProfileUrl'] as const).map((key) => <label key={key}>{({ recruiterName: 'Your name', company: 'Company', defaultRole: 'Default role', defaultLocation: 'Preferred location', linkedinProfileUrl: 'Your public LinkedIn profile (optional)' })[key]}<input type={key === 'linkedinProfileUrl' ? 'url' : 'text'} value={value[key]} maxLength={500} onChange={e => setValue({ ...value, [key]: e.target.value })} /></label>)}
          <label>Required skills (comma separated)<input value={value.defaultSkills.join(', ')} onChange={e => setValue({ ...value, defaultSkills: e.target.value.split(',').map(s => s.trim()) })} /></label>
          <label>Minimum years of experience<input type="number" min="0" max="80" step="0.5" value={value.minExperience} onChange={e => setValue({ ...value, minExperience: e.target.value === '' ? 0 : Number(e.target.value) })} /></label>
          <label>Maximum notice period (days)<input type="number" min="0" max="730" placeholder="Any" value={value.maxNoticeDays ?? ''} onChange={e => setValue({ ...value, maxNoticeDays: e.target.value === '' ? null : Number(e.target.value) })} /></label>
          <label>Maximum salary expectation (₹ LPA)<input type="number" min="0" max="10000" step="0.5" placeholder="Any" value={value.maxSalaryLpa ?? ''} onChange={e => setValue({ ...value, maxSalaryLpa: e.target.value === '' ? null : Number(e.target.value) })} /></label>
        </div>
        <p className="kit-settings-note">A profile URL is a reference only. It does not sign you in or unlock candidate data. Do not enter passwords, OTPs, cookies or tokens. Use uploaded resumes for real local matches; external search opens in a new tab.</p>
        <div className="kit-actions">
          <button className="btn small" onClick={() => { try { apply(parsePreferences(JSON.stringify({ ...value, defaultSkills: value.defaultSkills.filter(Boolean) }))); } catch (cause) { setMessage(''); setError(cause instanceof Error ? cause.message : 'Check your settings.'); } }}>Apply preferences</button>
          <label className="btn secondary small kit-file-button">Import JSON<input type="file" accept=".json,application/json" onChange={importFile} aria-label="Import hiring settings JSON" /></label>
          <button className="btn secondary small" onClick={() => { try { saveSettings(parsePreferences(JSON.stringify({ ...value, defaultSkills: value.defaultSkills.filter(Boolean) }))); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Check your settings.'); } }}>Export my settings</button>
          <button className="btn secondary small" onClick={() => saveSettings(defaultPreferences)}>Download blank template</button>
        </div>
        {message && <p role="status">{message}</p>}
        {error && <p className="kit-error" role="alert">{error}</p>}
      </div>
    </details>
  );
}

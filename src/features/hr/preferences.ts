export interface HrPreferences {
  recruiterName: string;
  company: string;
  defaultRole: string;
  defaultLocation: string;
  defaultSkills: string[];
  minExperience: number;
  maxNoticeDays: number | null;
  maxSalaryLpa: number | null;
  linkedinProfileUrl: string;
}

export const defaultPreferences: HrPreferences = {
  recruiterName: '', company: '', defaultRole: '', defaultLocation: '',
  defaultSkills: [], minExperience: 0, maxNoticeDays: null, maxSalaryLpa: null,
  linkedinProfileUrl: '',
};

export function parsePreferences(json: string): HrPreferences {
  if (json.length > 65536) throw new Error('Settings file must be smaller than 64 KB.');
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { throw new Error('This is not valid JSON. Check commas and double quotes.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Settings must be a JSON object.');
  const source = parsed as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    if (!Object.prototype.hasOwnProperty.call(defaultPreferences, key)) throw new Error('Unsupported setting. Use the downloaded template; do not include passwords or tokens.');
  }
  const result = { ...defaultPreferences, ...source } as HrPreferences;
  for (const key of ['recruiterName', 'company', 'defaultRole', 'defaultLocation', 'linkedinProfileUrl'] as const) {
    if (typeof result[key] !== 'string' || result[key].length > 500) throw new Error(`${key} must be text of at most 500 characters.`);
    result[key] = result[key].trim();
  }
  if (!Array.isArray(result.defaultSkills) || result.defaultSkills.length > 50 || result.defaultSkills.some(skill => typeof skill !== 'string' || !skill.trim() || skill.length > 100)) {
    throw new Error('defaultSkills must be a list of up to 50 non-empty skill names.');
  }
  result.defaultSkills = result.defaultSkills.map(skill => skill.trim()).filter((skill, index, skills) => skills.findIndex(item => item.toLowerCase() === skill.toLowerCase()) === index);
  for (const [key, max] of [['minExperience', 80], ['maxNoticeDays', 730], ['maxSalaryLpa', 10000]] as const) {
    const value = result[key];
    if (value === null && key !== 'minExperience') continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) throw new Error(`${key} must be a number between 0 and ${max}${key === 'minExperience' ? '' : ', or null'}.`);
  }
  if (result.linkedinProfileUrl) {
    let url: URL;
    try { url = new URL(result.linkedinProfileUrl); } catch { throw new Error('Use a full https://www.linkedin.com/in/ profile URL or leave it blank.'); }
    if (url.protocol !== 'https:' || !/^(www\.)?linkedin\.com$/.test(url.hostname) || !url.pathname.startsWith('/in/') || url.username || url.password) throw new Error('Use a LinkedIn public profile URL starting with https://www.linkedin.com/in/.');
  }
  return result;
}

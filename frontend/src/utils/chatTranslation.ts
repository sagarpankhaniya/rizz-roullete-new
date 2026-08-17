export const CHAT_TRANSLATE_STORAGE_KEY = 'rizz_chat_translate_lang';

export const CHAT_TRANSLATE_OPTIONS = [
  { value: '', label: 'Off' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ru', label: 'Russian' },
  { value: 'tr', label: 'Turkish' },
  { value: 'th', label: 'Thai' },
  { value: 'vi', label: 'Vietnamese' },
  { value: 'zh-hans', label: 'Chinese (Simplified)' },
  { value: 'zh-hant', label: 'Chinese (Traditional)' },
] as const;

const ALLOWED = new Set<string>(
  CHAT_TRANSLATE_OPTIONS.filter((o) => o.value).map((o) => o.value),
);

function normalizeBrowserLanguage(): string {
  const raw = (navigator.language || 'en').trim().toLowerCase().replace('_', '-');
  if (ALLOWED.has(raw)) return raw;
  const base = raw.split('-')[0];
  if (ALLOWED.has(base)) return base;
  if (base === 'zh') {
    return raw.includes('hant') || raw.includes('tw') || raw.includes('hk')
      ? 'zh-hant'
      : 'zh-hans';
  }
  return 'en';
}

export function loadChatTranslateLanguage(): string {
  try {
    const stored = localStorage.getItem(CHAT_TRANSLATE_STORAGE_KEY);
    if (stored === '') return '';
    if (stored && ALLOWED.has(stored)) return stored;
  } catch {
    /* ignore */
  }
  return normalizeBrowserLanguage();
}

export function saveChatTranslateLanguage(code: string): void {
  try {
    if (!code) {
      localStorage.removeItem(CHAT_TRANSLATE_STORAGE_KEY);
    } else {
      localStorage.setItem(CHAT_TRANSLATE_STORAGE_KEY, code);
    }
  } catch {
    /* ignore */
  }
}

export function chatTranslatePayload(code: string): { language: string | null } {
  return { language: code || null };
}

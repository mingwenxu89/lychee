export type SupportedLanguage = { code: string; displayName: string }

// Shared by the admin "Generate Translations" dropdown and the learner's preferred-language
// setting — one list, one place to add a new language later. The backend does not validate
// LanguageCode against this (or any) whitelist; it's a free string.
export const SUPPORTED_TRANSLATION_LANGUAGES: SupportedLanguage[] = [
  { code: 'zh', displayName: 'Chinese' }
]

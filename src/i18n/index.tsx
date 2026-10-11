import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { en } from './en'
import { es } from './es'

export type Language = 'en' | 'es'
export type TranslationKey = keyof typeof en
type Variables = Record<string, string | number>
type I18nContextValue = {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: TranslationKey, variables?: Variables) => string
}

const STORAGE_KEY = 'astral-audio.language.v1'
const dictionaries = { en, es }
const I18nContext = createContext<I18nContextValue | null>(null)

function initialLanguage(): Language {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'en' || saved === 'es') return saved
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage)
  const setLanguage = useCallback((next: Language) => {
    localStorage.setItem(STORAGE_KEY, next)
    setLanguageState(next)
  }, [])
  const t = useCallback((key: TranslationKey, variables?: Variables) => {
    const template = dictionaries[language][key] ?? en[key]
    if (!variables) return template
    return Object.entries(variables).reduce((text, [name, value]) => text.split(`{${name}}`).join(String(value)), template)
  }, [language])
  useEffect(() => { document.documentElement.lang = language }, [language])
  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used inside I18nProvider')
  return context
}

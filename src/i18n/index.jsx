import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import zhCN from './zh-CN'
import en from './en'

const locales = { 'zh-CN': zhCN, en }
const I18nContext = createContext(null)

function getLocale() {
  try {
    const stored = localStorage.getItem('jsos-locale')
    if (stored && locales[stored]) return stored
  } catch {}
  const lang = navigator.language || 'en'
  if (lang.startsWith('zh')) return 'zh-CN'
  return 'en'
}

function interpolate(str, params) {
  if (!params) return str
  return str.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`)
}

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState(getLocale)

  useEffect(() => {
    async function initLocale() {
      try {
        const sysLocale = await window.JSOS?.getLocale?.()
        if (sysLocale && locales[sysLocale]) {
          setLocale(sysLocale)
        }
      } catch {}
    }
    initLocale()

    const unsub = window.JSOS?.onLocaleChange?.((newLocale) => {
      if (newLocale && locales[newLocale]) {
        setLocale(newLocale)
      }
    })
    return () => unsub?.()
  }, [])

  const t = useCallback((key, params) => {
    const dict = locales[locale] || locales.en
    const value = dict[key] || locales.en[key] || key
    return interpolate(value, params)
  }, [locale])

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext) || { locale: 'en', t: (k) => k, setLocale: () => {} }
}

export function t(key, params) {
  const locale = getLocale()
  const dict = locales[locale] || locales.en
  const value = dict[key] || locales.en[key] || key
  return interpolate(value, params)
}

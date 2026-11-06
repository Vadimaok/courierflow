import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
  }
  interface ImportMeta { readonly env: ImportMetaEnv }
  interface Window {
    Telegram?: { WebApp?: {
      ready: () => void
      expand: () => void
      setHeaderColor?: (color: string) => void
      setBackgroundColor?: (color: string) => void
      initData?: string
      initDataUnsafe?: { user?: { id?: number; first_name?: string; username?: string } }
    } }
  }
}

const tg = window.Telegram?.WebApp
tg?.ready()
tg?.expand()
tg?.setHeaderColor?.('#0b1020')
tg?.setBackgroundColor?.('#0b1020')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
)

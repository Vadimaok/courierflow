import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

const tg = window.Telegram?.WebApp
tg?.ready()
tg?.expand()
tg?.setHeaderColor?.('#0b1020')
tg?.setBackgroundColor?.('#0b1020')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
)

declare global {
  interface Window {
    Telegram?: { WebApp?: {
      ready: () => void; expand: () => void;
      setHeaderColor?: (color: string) => void;
      setBackgroundColor?: (color: string) => void;
      initData?: string; initDataUnsafe?: { user?: { first_name?: string; username?: string } };
    } }
  }
}
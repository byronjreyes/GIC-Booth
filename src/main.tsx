import '@fontsource/archivo/500.css'
import '@fontsource/archivo/700.css'
import '@fontsource/barlow-condensed/700.css'
import '@fontsource/barlow-condensed/800.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Admin from './Admin'
import App from './App'
import Share from './Share'
import './styles.css'

const Screen = window.location.pathname.startsWith('/admin') ? Admin : window.location.pathname.startsWith('/share/') ? Share : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Screen />
  </StrictMode>,
)

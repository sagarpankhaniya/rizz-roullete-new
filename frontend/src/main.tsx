import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import './landing.css'
import App from './App.tsx'

const googleClientId =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ??
  '128875252757-3t3i5ao7tf0r0r954u80qii6n78sjfs2.apps.googleusercontent.com'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)

import './assets/main.css'

import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  // Temporarily disabled StrictMode to fix double rendering in development
  // TODO: Re-enable StrictMode and ensure all effects are properly cleaned up
  // <StrictMode>
  <App />
  // </StrictMode>
)

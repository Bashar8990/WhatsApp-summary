import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// منع تكبير الصفحة بالإصبعين على iOS (يتجاهل أحيانًا إعدادات viewport)
document.addEventListener('gesturestart', (e) => e.preventDefault())
// منع تكبير الصفحة بالنقر المزدوج على iOS
let lastTouchEnd = 0
document.addEventListener('touchend', (e) => {
  const now = Date.now()
  if (now - lastTouchEnd <= 300) e.preventDefault()
  lastTouchEnd = now
}, { passive: false })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

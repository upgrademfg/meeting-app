import './aura.css'

const aura = document.querySelector<HTMLDivElement>('.aura')!

window.api.onCursorClick(() => {
  const ripple = document.createElement('div')
  ripple.className = 'ripple'
  ripple.addEventListener('animationend', () => ripple.remove())
  aura.appendChild(ripple)
})

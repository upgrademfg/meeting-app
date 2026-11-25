import './aura.css'

const pulse = document.querySelector<HTMLDivElement>('.pulse')!

pulse.addEventListener('animationend', () => pulse.classList.remove('clicked'))

window.api.onCursorClick(() => {
  pulse.classList.remove('clicked')
  void pulse.offsetWidth
  pulse.classList.add('clicked')
})

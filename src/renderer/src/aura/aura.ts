import './aura.css'

const pulse = document.querySelector<SVGGElement>('.pulse')!

pulse.addEventListener('animationend', () => pulse.classList.remove('clicked'))

window.api.onCursorClick(() => {
  pulse.classList.remove('clicked')
  void pulse.getBoundingClientRect()
  pulse.classList.add('clicked')
})

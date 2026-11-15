// Is this a phone or tablet (touch screen, no mouse)?
export const isTouch: boolean =
  typeof window !== 'undefined' &&
  ((window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window);

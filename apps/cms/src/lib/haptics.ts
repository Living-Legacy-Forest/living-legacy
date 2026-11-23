// A small tap under the finger. Android answers navigator.vibrate; iPhones have no such call, but
// Safari 17.4+ gives a tap when a switch-style checkbox is toggled, so a hidden one is clicked
// instead. Only on touch screens: a laptop has nothing to vibrate, and the hidden switch would
// do nothing there. Both ways are best effort, so a device with neither just stays silent.

let iosSwitch: HTMLLabelElement | null = null;

function ensureSwitch() {
  if (iosSwitch?.isConnected) return iosSwitch;
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText =
    'position:fixed;top:0;left:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  iosSwitch = label;
  return label;
}

/** A light tap, for a detent or a snap; call it from a touch or pointer handler. */
export function tick(ms = 6) {
  if (typeof window === 'undefined') return;
  if (typeof navigator.vibrate === 'function') {
    navigator.vibrate(ms);
    return;
  }
  if (window.matchMedia('(hover: none)').matches) ensureSwitch().click();
}

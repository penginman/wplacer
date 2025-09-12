console.log('[AUTO-LOGIN EXTENSION] cf-click.js loaded');

function simulateMouseClick(targetElement) {
  if (targetElement instanceof HTMLElement) targetElement.focus();
  const rect = targetElement.getBoundingClientRect();
  const clientX = Math.random() * rect.width + rect.left;
  const clientY = Math.random() * rect.height + rect.top;
  const screenX = Math.random() * window.screen.width;
  const screenY = Math.random() * window.screen.height;
  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    screenX,
    screenY
  });
  targetElement.dispatchEvent(clickEvent);
}

function clickCheckbox() {
  console.log('[AUTO-LOGIN EXTENSION] clickCheckbox: looking for Turnstile checkbox');
  const interval = setInterval(() => {
    const body = document.querySelector('body');
    const input = body && body.shadowRoot && body.shadowRoot.querySelector('input[type=checkbox]');
    if (input) {
      const label = body.shadowRoot.querySelector('label');
      console.log('[AUTO-LOGIN EXTENSION] clickCheckbox: found, clicking');
      setTimeout(() => simulateMouseClick(label || input), 50);
      clearInterval(interval);
    }
  }, 100);
}

if (document && document.documentElement) {
  clickCheckbox();
} else {
  let armed = false;
  const observer = new MutationObserver(() => {
    if (!armed && document.head) {
      armed = true;
      clickCheckbox();
      observer.disconnect();
    }
  });
  observer.observe(document, { childList: true, subtree: true });
}



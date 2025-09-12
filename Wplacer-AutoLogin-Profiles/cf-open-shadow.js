// Open ShadowRoot on challenges.cloudflare.com to expose Turnstile internals
console.log('[AUTO-LOGIN EXTENSION] cf-open-shadow.js loaded');
const originalAttachShadow = Element.prototype.attachShadow;
Element.prototype.attachShadow = function(args) {
  const newArgs = { ...args, mode: 'open' };
  return originalAttachShadow.call(this, newArgs);
};
console.log('[AUTO-LOGIN EXTENSION] cf-open-shadow: attachShadow patched to open mode');



/* Bump N Beyond Physio: GitHub Pages -> Apps Script RPC bridge.
   Keep this file on GitHub Pages only. Do not place Apps Script server code in the public repository. */
(function () {
  'use strict';
  const GAS_URL = "https://script.google.com/macros/s/AKfycbx5wCN-W10pAGsbudHglnAyhVzMESGCgVxziNdLWDmWwhEKAlgucnqH1Rp2Z-EaF5b3Fg/exec";
  const SITE_ORIGIN = 'https://bumpnbeyondphysio-dot.github.io';
  const BRIDGE_URL = GAS_URL + '?page=bridge';
  const pending = new Map();
  let nextId = 1;
  let frame = null;
  let frameReady = null;
  let resolveReady = null;

  function ensureFrame() {
    if (frameReady) return frameReady;
    frameReady = new Promise((resolve) => { resolveReady = resolve; });
    const add = () => {
      if (frame) return;
      frame = document.createElement('iframe');
      frame.title = 'Secure clinic backend connection';
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;
      frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10px;bottom:-10px;opacity:0;border:0;pointer-events:none';
      frame.onload = () => { if (resolveReady) { resolveReady(); resolveReady = null; } };
      frame.src = BRIDGE_URL;
      (document.body || document.documentElement).appendChild(frame);
    };
    if (document.body) add(); else document.addEventListener('DOMContentLoaded', add, { once: true });
    return frameReady;
  }

  window.addEventListener('message', (event) => {
    if (!frame || event.source !== frame.contentWindow) return;
    const data = event.data;
    if (!data || data.type !== 'BNB_RPC_RESULT' || !pending.has(data.id)) return;
    const entry = pending.get(data.id);
    pending.delete(data.id);
    clearTimeout(entry.timer);
    if (data.ok) entry.resolve(data.value);
    else entry.reject(new Error(data.error || 'The clinic server request failed.'));
  });

  function callServer(method, args) {
    if (method === 'getWebAppUrl') return Promise.resolve(SITE_ORIGIN + '/BumpnBeyondPhysio/');
    return ensureFrame().then(() => new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('The clinic server took too long to respond. Please try again.')); }, 120000);
      pending.set(id, { resolve, reject, timer });
      frame.contentWindow.postMessage({ type: 'BNB_RPC_REQUEST', id, method, args }, '*');
    }));
  }

  // Preserve the existing google.script.run API shape without changing every legacy call site.
  function makeRunner(success, failure) {
    return new Proxy({}, {
      get(_target, prop) {
        if (prop === 'withSuccessHandler') return fn => makeRunner(typeof fn === 'function' ? fn : null, failure);
        if (prop === 'withFailureHandler') return fn => makeRunner(success, typeof fn === 'function' ? fn : null);
        if (prop === 'withUserObject') return () => makeRunner(success, failure);
        if (prop === 'then') return undefined;
        return (...args) => {
          callServer(String(prop), args).then(value => { if (success) success(value); }).catch(error => { if (failure) failure(error); else console.error(error); });
        };
      }
    });
  }
  window.BNB_CALL = callServer;
  // When opened in Apps Script HTML Service, retain the native google.script.run unchanged.
  if (!(window.google && window.google.script && window.google.script.run)) {
    window.google = window.google || {};
    window.google.script = window.google.script || {};
    window.google.script.run = makeRunner(null, null);
  }
})();

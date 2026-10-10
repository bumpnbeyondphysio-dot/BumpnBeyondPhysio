/* Bump N Beyond Physio: GitHub Pages -> Apps Script RPC bridge.
   Keep this frontend helper in GitHub. The bridge endpoint and business logic stay in Apps Script. */
(function () {
  'use strict';
  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyk_hKXWVKCIwdVWif5_4W6laZtz1uWWyQRUQEpX5wmjuxeFEzVOJ66zZfQPWKiWr--EQ/exec';
  var BRIDGE_URL = SCRIPT_URL + (SCRIPT_URL.indexOf('?') >= 0 ? '&' : '?') + 'page=bridge';
  var frame, ready = false, nextId = 1, pending = Object.create(null), queue = [];

  function ensureFrame() {
    if (frame) return;
    frame = document.createElement('iframe');
    frame.title = 'Secure clinic backend connection';
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:absolute;width:1px;height:1px;border:0;left:-9999px;bottom:0;opacity:0;pointer-events:none';
    frame.src = BRIDGE_URL;
    (document.body || document.documentElement).appendChild(frame);
  }
  function sendRequest(req) {
    if (!ready || !frame || !frame.contentWindow) { queue.push(req); return; }
    try { frame.contentWindow.postMessage({type:'BNB_RPC_REQUEST', id:req.id, method:req.method, args:req.args}, '*'); }
    catch (e) { delete pending[req.id]; if (req.failure) req.failure(e); }
  }
  window.addEventListener('message', function (event) {
    if (!frame || event.source !== frame.contentWindow) return;
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'BNB_BRIDGE_READY') {
      ready = true;
      var waiting = queue.splice(0);
      waiting.forEach(sendRequest);
      return;
    }
    if (data.type !== 'BNB_RPC_RESULT' || !Number.isInteger(data.id)) return;
    var cb = pending[data.id];
    if (!cb) return;
    delete pending[data.id];
    if (data.ok) { if (cb.success) cb.success(data.value); }
    else { var err = new Error(data.error || 'Server request failed'); if (cb.failure) cb.failure(err); }
  });

  // Compatibility layer lets existing pages keep using google.script.run syntax.
  var runner = { success: null, failure: null };
  var runProxy = new Proxy({}, {
    get: function (_target, prop) {
      if (prop === 'withSuccessHandler') return function (fn) { runner.success = typeof fn === 'function' ? fn : null; return runProxy; };
      if (prop === 'withFailureHandler') return function (fn) { runner.failure = typeof fn === 'function' ? fn : null; return runProxy; };
      if (prop === 'withUserObject') return function () { return runProxy; };
      if (typeof prop !== 'string') return undefined;
      return function () {
        var req = {id: nextId++, method: prop, args: Array.prototype.slice.call(arguments), success: runner.success, failure: runner.failure};
        pending[req.id] = req;
        runner.success = null; runner.failure = null;
        ensureFrame();
        sendRequest(req);
      };
    }
  });
  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = runProxy;
  window.BNB_SCRIPT_URL = SCRIPT_URL;
  window.BNB_FRONTEND_BASE = './';
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureFrame, {once:true});
  else ensureFrame();
})();

/* ---------- DOM helpers ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.core = CeoDash.core || {};

  function isNode(x) {
    return x && typeof x === 'object' && typeof x.nodeType === 'number';
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);

    if (attrs) {
      for (var key in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, key)) { continue; }
        var value = attrs[key];
        if (value === undefined || value === null || value === false) { continue; }
        if (key === 'className') {
          node.className = value;
        } else if (key === 'style' && typeof value === 'object') {
          for (var styleKey in value) {
            if (Object.prototype.hasOwnProperty.call(value, styleKey)) { node.style[styleKey] = value[styleKey]; }
          }
        } else if (key.indexOf('on') === 0 && typeof value === 'function') {
          var evtName = key.substring(2).toLowerCase();
          if (node.addEventListener) { node.addEventListener(evtName, value, false); }
          else { node.attachEvent('on' + evtName, value); }
        } else if (key === 'html') {
          node.innerHTML = value;
        } else {
          node.setAttribute(key, value);
        }
      }
    }

    if (children !== undefined && children !== null) {
      function appendChildItem(c) {
        if (c === undefined || c === null || c === false) { return; }
        if (Object.prototype.toString.call(c) === '[object Array]') {
          for (var j = 0; j < c.length; j++) { appendChildItem(c[j]); }
        } else if (isNode(c)) {
          node.appendChild(c);
        } else {
          node.appendChild(document.createTextNode(String(c)));
        }
      }
      appendChildItem(children);
    }

    return node;
  }

  function clear(node) {
    while (node.firstChild) { node.removeChild(node.firstChild); }
  }

  function text(str) { return document.createTextNode(str); }

  CeoDash.core.dom = { el: el, clear: clear, text: text };
})(window);

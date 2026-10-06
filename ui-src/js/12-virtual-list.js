/* ---------- Virtual list for long rankings ---------- */
(function (global) {
  'use strict';

  var CeoDash = global.CeoDash = global.CeoDash || {};
  CeoDash.core = CeoDash.core || {};

  function VirtualList(container, options) {
    this.container = container;
    this.items = options.items || [];
    this.itemHeight = options.itemHeight || 40;
    this.renderRow = options.renderRow;
    this.overscan = options.overscan || 6;
    this._build();
  }

  VirtualList.prototype._build = function () {
    while (this.container.firstChild) { this.container.removeChild(this.container.firstChild); }
    this.container.className = (this.container.className + ' cd-virtual-viewport').replace(/^\s+/, '');

    this.sizer = document.createElement('div');
    this.sizer.style.position = 'relative';
    this.sizer.style.height = (this.items.length * this.itemHeight) + 'px';

    this.content = document.createElement('div');
    this.content.style.position = 'absolute';
    this.content.style.left = '0';
    this.content.style.right = '0';
    this.content.style.top = '0';

    this.sizer.appendChild(this.content);
    this.container.appendChild(this.sizer);

    var self = this;
    this._onScroll = function () { self._render(); };
    if (this.container.addEventListener) {
      this.container.addEventListener('scroll', this._onScroll, false);
    } else if (this.container.attachEvent) {
      this.container.attachEvent('onscroll', this._onScroll);
    }
    this._render();
  };

  VirtualList.prototype._render = function () {
    var scrollTop = this.container.scrollTop;
    var viewportHeight = this.container.clientHeight || 400;
    var start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.overscan);
    var visibleCount = Math.ceil(viewportHeight / this.itemHeight) + this.overscan * 2;
    var end = Math.min(this.items.length, start + visibleCount);

    this.content.style.top = (start * this.itemHeight) + 'px';
    while (this.content.firstChild) { this.content.removeChild(this.content.firstChild); }

    for (var i = start; i < end; i++) {
      var rowEl = this.renderRow(this.items[i], i);
      rowEl.style.height = this.itemHeight + 'px';
      rowEl.style.boxSizing = 'border-box';
      this.content.appendChild(rowEl);
    }
  };

  VirtualList.prototype.setItems = function (items) {
    this.items = items || [];
    this.sizer.style.height = (this.items.length * this.itemHeight) + 'px';
    this.container.scrollTop = 0;
    this._render();
  };

  VirtualList.prototype.refresh = function () {
    this._render();
  };

  VirtualList.prototype.destroy = function () {
    if (this.container.removeEventListener) {
      this.container.removeEventListener('scroll', this._onScroll, false);
    } else if (this.container.detachEvent) {
      this.container.detachEvent('onscroll', this._onScroll);
    }
  };

  CeoDash.core.VirtualList = VirtualList;
})(window);

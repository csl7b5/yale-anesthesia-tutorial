/**
 * Ventilator modes stub dialog — teaser strip animation is CSS/SVG (see ventilator.css).
 */
(function () {
  'use strict';

  var dialog = document.getElementById('vent-modes-tutorial');
  var btnOpen = document.getElementById('vent-modes-tutorial-open');
  var btnClose = document.getElementById('vent-modes-tutorial-close');
  var btnCloseFoot = document.getElementById('vent-modes-tutorial-close-foot');

  function openDialog() {
    if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
  }

  function closeDialog() {
    if (dialog && typeof dialog.close === 'function') dialog.close();
  }

  if (btnOpen) btnOpen.addEventListener('click', openDialog);
  if (btnClose) btnClose.addEventListener('click', closeDialog);
  if (btnCloseFoot) btnCloseFoot.addEventListener('click', closeDialog);
  if (dialog) {
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) closeDialog();
    });
  }
})();

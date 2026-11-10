(function () {
  var modal = document.getElementById('confirmModal');
  if (!modal) return;

  var titleEl = modal.querySelector('[data-confirm-title]');
  var textEl = modal.querySelector('[data-confirm-text]');
  var okBtn = modal.querySelector('[data-confirm-ok]');
  var pendingForm = null;

  function openModal(title, text) {
    if (titleEl) titleEl.textContent = title || 'Please confirm';
    if (textEl) textEl.textContent = text || 'This cannot be undone.';
    modal.hidden = false;
    modal.classList.add('is-open');
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.hidden = true;
    pendingForm = null;
  }

  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!form.hasAttribute('data-confirm')) return;
    if (form.getAttribute('data-confirmed') === '1') return;
    event.preventDefault();
    pendingForm = form;
    openModal(
      form.getAttribute('data-confirm-title') || 'Please confirm',
      form.getAttribute('data-confirm')
    );
  });

  okBtn && okBtn.addEventListener('click', function () {
    if (!pendingForm) {
      closeModal();
      return;
    }
    pendingForm.setAttribute('data-confirmed', '1');
    pendingForm.submit();
  });

  modal.querySelectorAll('[data-close-confirm]').forEach(function (button) {
    button.addEventListener('click', closeModal);
  });

  modal.addEventListener('click', function (event) {
    if (event.target === modal) closeModal();
  });
})();

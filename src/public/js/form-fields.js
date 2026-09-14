(function () {
  function bindName(input) {
    if (!input) return;
    function check() {
      const value = input.value.trim().replace(/\s+/g, ' ');
      if (!value) {
        input.setCustomValidity('');
        return;
      }
      const lettersOnly = /^[A-Za-z]+(?: [A-Za-z]+)*$/.test(value);
      const enoughLetters = value.replace(/ /g, '').length >= 3;
      if (!lettersOnly || !enoughLetters) {
        input.setCustomValidity('Full name must be at least 3 letters and contain only alphabets.');
      } else {
        input.setCustomValidity('');
      }
    }
    input.addEventListener('input', check);
    input.addEventListener('blur', check);
  }

  function bindPhone(input) {
    if (!input) return;
    function check() {
      input.value = input.value.replace(/\D/g, '').slice(0, 10);
      if (!input.value) {
        input.setCustomValidity('');
        return;
      }
      if (!/^\d{10}$/.test(input.value)) {
        input.setCustomValidity('Phone number must be exactly 10 digits.');
      } else {
        input.setCustomValidity('');
      }
    }
    input.addEventListener('input', check);
    input.addEventListener('blur', check);
  }

  document.querySelectorAll('[data-validate-name]').forEach(bindName);
  document.querySelectorAll('[data-validate-phone]').forEach(bindPhone);
})();

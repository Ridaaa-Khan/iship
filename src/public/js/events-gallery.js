(function () {
  var root = document.querySelector('[data-gallery]');
  if (!root) return;

  var search = root.querySelector('[data-gallery-search]');
  var status = root.querySelector('[data-gallery-status]');
  var tabs = Array.from(root.querySelectorAll('[data-gallery-tab]'));
  var cards = Array.from(root.querySelectorAll('[data-gallery-card]'));
  var empty = root.querySelector('[data-gallery-empty]');
  var activeTab = 'all';

  function apply() {
    var q = (search && search.value || '').trim().toLowerCase();
    var st = (status && status.value || '').trim().toLowerCase();
    var shown = 0;

    cards.forEach(function (card) {
      var flags = (card.getAttribute('data-flags') || 'all').toLowerCase().split(/\s+/);
      var hay = (card.getAttribute('data-search') || '').toLowerCase();
      var cardStatus = (card.getAttribute('data-status') || '').toLowerCase();
      var matchTab = activeTab === 'all' || flags.indexOf(activeTab) !== -1;
      var matchSearch = !q || hay.indexOf(q) !== -1;
      var matchStatus = !st || cardStatus === st;
      var ok = matchTab && matchSearch && matchStatus;
      card.hidden = !ok;
      if (ok) shown += 1;
    });

    if (empty) empty.hidden = shown > 0;
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      activeTab = tab.getAttribute('data-gallery-tab') || 'all';
      tabs.forEach(function (item) {
        item.classList.toggle('is-active', item === tab);
      });
      apply();
    });
  });

  if (search) search.addEventListener('input', apply);
  if (status) status.addEventListener('change', apply);
  apply();
})();

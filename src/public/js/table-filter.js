(function () {
  var PAGE_SIZE = 10;

  function tableRows(table) {
    if (!table || !table.tBodies[0]) return [];
    return Array.from(table.tBodies[0].rows);
  }

  function rootFor(table) {
    return table.closest('[data-filter-root]') || document;
  }

  function filterValues(root) {
    return {
      search: (root.querySelector('[data-filter-search]')?.value || '').trim().toLowerCase(),
      status: (root.querySelector('[data-filter-status]')?.value || '').trim().toLowerCase(),
    };
  }

  function rowMatches(row, search, status) {
    if (!row.hasAttribute('data-filter-row') && !search && !status) return true;
    var hay = (row.getAttribute('data-search') || row.textContent || '').toLowerCase();
    var rowStatus = (row.getAttribute('data-status') || '').toLowerCase();
    var matchSearch = !search || hay.includes(search);
    var matchStatus = !status || rowStatus === status;
    return matchSearch && matchStatus;
  }

  function ensurePager(table) {
    if (table.hasAttribute('data-no-pager')) return null;
    var wrap = table.closest('.table-wrap');
    if (!wrap) return null;
    var pager = wrap.nextElementSibling;
    if (!pager || !pager.classList.contains('table-pager')) {
      pager = document.createElement('nav');
      pager.className = 'table-pager';
      pager.setAttribute('aria-label', 'Table pages');
      pager.innerHTML =
        '<button type="button" class="btn btn-ghost btn-sm" data-page-prev>Previous</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-page-next>Next</button>';
      wrap.insertAdjacentElement('afterend', pager);
      pager.querySelector('[data-page-prev]').addEventListener('click', function () {
        table.dataset.page = String(Math.max(1, Number(table.dataset.page || 1) - 1));
        renderTable(table);
      });
      pager.querySelector('[data-page-next]').addEventListener('click', function () {
        table.dataset.page = String(Number(table.dataset.page || 1) + 1);
        renderTable(table);
      });
    }
    return pager;
  }

  function renderTable(table) {
    var root = rootFor(table);
    var filters = filterValues(root);
    var rows = tableRows(table);
    var matched = [];

    rows.forEach(function (row) {
      var ok = rowMatches(row, filters.search, filters.status);
      if (ok) {
        row.removeAttribute('data-filtered-out');
        matched.push(row);
      } else {
        row.setAttribute('data-filtered-out', '1');
        row.removeAttribute('data-page-hidden');
      }
    });

    var pageCount = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
    var page = Math.min(pageCount, Math.max(1, Number(table.dataset.page || 1)));
    table.dataset.page = String(page);

    matched.forEach(function (row, index) {
      var start = (page - 1) * PAGE_SIZE;
      if (index >= start && index < start + PAGE_SIZE) {
        row.removeAttribute('data-page-hidden');
      } else {
        row.setAttribute('data-page-hidden', '1');
      }
    });

    var pager = ensurePager(table);
    if (!pager) return;
    var prev = pager.querySelector('[data-page-prev]');
    var next = pager.querySelector('[data-page-next]');
    if (!matched.length) {
      pager.hidden = true;
      return;
    }
    pager.hidden = matched.length <= PAGE_SIZE;
    prev.disabled = page <= 1;
    next.disabled = page >= pageCount;
  }

  function renderRoot(root) {
    (root.querySelectorAll ? root : document)
      .querySelectorAll('.data-table')
      .forEach(function (table) {
        table.dataset.page = '1';
        renderTable(table);
      });
  }

  document.querySelectorAll('.data-table:not([data-no-pager])').forEach(function (table) {
    renderTable(table);
  });

  document.querySelectorAll('.data-table[data-no-pager]').forEach(function (table) {
    tableRows(table).forEach(function (row) {
      row.removeAttribute('data-page-hidden');
    });
  });

  document.querySelectorAll('[data-filter-root]').forEach(function (root) {
    root.addEventListener('input', function (event) {
      if (event.target.matches('[data-filter-search]')) renderRoot(root);
    });
    root.addEventListener('change', function (event) {
      if (event.target.matches('[data-filter-status]')) renderRoot(root);
    });
  });
})();

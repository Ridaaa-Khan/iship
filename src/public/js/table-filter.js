(function () {
  function applyFilter(root) {
    const search = (root.querySelector('[data-filter-search]')?.value || '')
      .trim()
      .toLowerCase();
    const status = (root.querySelector('[data-filter-status]')?.value || '')
      .trim()
      .toLowerCase();

    root.querySelectorAll('[data-filter-row]').forEach((row) => {
      const hay = (row.getAttribute('data-search') || '').toLowerCase();
      const rowStatus = (row.getAttribute('data-status') || '').toLowerCase();
      const matchSearch = !search || hay.includes(search);
      const matchStatus = !status || rowStatus === status;
      row.hidden = !(matchSearch && matchStatus);
    });
  }

  document.querySelectorAll('[data-filter-root]').forEach((root) => {
    root.addEventListener('input', (event) => {
      if (event.target.matches('[data-filter-search]')) applyFilter(root);
    });
    root.addEventListener('change', (event) => {
      if (event.target.matches('[data-filter-status]')) applyFilter(root);
    });
  });
})();

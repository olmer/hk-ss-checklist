(() => {
  const groups = window.SILKSONG_CHECKLIST_DATA;
  const STORAGE_KEY = 'silksong-checklist-state-v1';
  const COLLAPSED_KEY = 'silksong-checklist-collapsed-v1';
  const includedKeys = new Set(groups.slice(0, 11).map(group => group.key));
  const trackedItems = groups.filter(group => includedKeys.has(group.key)).flatMap(group => group.items);
  const categories = document.getElementById('categories');
  const search = document.getElementById('search');
  const toast = document.getElementById('toast');
  const state = readState();
  const collapsedGroups = readCollapsedGroups();
  const totalWeight = trackedItems.reduce((sum, item) => sum + (item.weight ?? 1), 0);
  let toastTimer;
  let imageScrollY = 0;

  function readState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return saved && typeof saved === 'object' && saved.checked && typeof saved.checked === 'object' ? saved.checked : {};
    } catch { return {}; }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, checked: state }));
    } catch { showToast('Could not save progress in this browser.'); }
  }

  function readCollapsedGroups() {
    try {
      const saved = JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '[]');
      return new Set(Array.isArray(saved) ? saved.filter(key => groups.some(group => group.key === key)) : []);
    } catch { return new Set(); }
  }

  function saveCollapsedGroups() {
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsedGroups])); }
    catch { showToast('Could not save collapsed sections in this browser.'); }
  }

  function formatPercent(value) {
    return `${Number(value.toFixed(2))}%`;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2400);
  }

  function progress() {
    const done = trackedItems.filter(item => state[item.id]).length;
    const total = trackedItems.length;
    const weightDone = trackedItems.reduce((sum, item) => sum + (state[item.id] ? item.weight ?? 1 : 0), 0);
    const percent = totalWeight ? weightDone * 100 / totalWeight : 0;
    document.getElementById('progressText').textContent = formatPercent(percent);
    document.getElementById('progressCount').textContent = `${done} / ${total} items`;
    document.getElementById('remainingCount').textContent = `${total - done} remaining`;
    document.getElementById('progressBar').style.width = `${percent}%`;
    document.querySelector('[role="progressbar"]').setAttribute('aria-valuenow', String(percent));
    groups.forEach(group => {
      const count = group.items.filter(item => state[item.id]).length;
      const node = document.querySelector(`[data-count-for="${CSS.escape(group.key)}"]`);
      if (node) node.textContent = `${count}/${group.items.length}${includedKeys.has(group.key) ? ` (${formatPercent(count * 100 / (group.items.length || 1))})` : ''}`;
    });
  }

  function imageUrl(path) {
    return !path ? '' : /^https?:\/\//i.test(path) ? path : `https://checklistsilksong.com/${path}`;
  }

  function imageButton(path, alt, className) {
    if (!path) return '';
    const url = imageUrl(path);
    return `<button type="button" class="${className}" data-zoom="${url}" aria-label="Show ${escapeAttr(alt)} image"><img src="${url}" alt="${escapeAttr(alt)}" loading="lazy" /></button>`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
  }
  function escapeAttr(value) { return escapeHtml(value); }

  function render() {
    const query = search.value.trim().toLocaleLowerCase();
    let visibleCount = 0;
    categories.innerHTML = groups.map(group => {
      const matches = group.items.filter(item => !query || `${item.name} ${item.description} ${item.location} ${group.category}`.toLocaleLowerCase().includes(query));
      if (!matches.length) return '';
      visibleCount += matches.length;
      const completionHint = includedKeys.has(group.key) ? '' : `<span class="category-hint">${group.key === 'pulgas' ? 'Does not count toward 100%' : 'Optional encounters'}</span>`;
      const cards = matches.map(item => `
        <article class="item${state[item.id] ? ' is-checked' : ''}" data-item="${escapeAttr(item.id)}">
          <input class="item-check" type="checkbox" id="check-${escapeAttr(item.id)}" data-check="${escapeAttr(item.id)}" aria-label="Mark ${escapeAttr(item.name)} complete" ${state[item.id] ? 'checked' : ''} />
          ${imageButton(item.image, item.name, 'item-thumb')}
          <div class="item-copy"><h3 class="item-name">${escapeHtml(item.name)}</h3>${item.description ? `<p class="item-desc">${escapeHtml(item.description)}</p>` : ''}${item.map ? `<div class="map-row">${imageButton(item.map, `Location of ${item.name}`, 'map-preview')}<span>LOCATION MAP</span></div>` : ''}</div>
        </article>`).join('');
      const title = group.key === 'pulgas' ? 'Fleas' : group.key === 'bosses' ? 'Bosses' : group.category;
      const expanded = !collapsedGroups.has(group.key);
      return `<section class="category" data-group="${escapeAttr(group.key)}">
        <button type="button" class="category-header" aria-expanded="${expanded}"><span class="collapse-icon" aria-hidden="true">${expanded ? '−' : '+'}</span><h2 class="category-title">${escapeHtml(title)}</h2>${completionHint}<span class="category-count" data-count-for="${escapeAttr(group.key)}"></span></button>
        <div class="category-body"${expanded ? '' : ' hidden'}>${cards}</div>
      </section>`;
    }).join('');
    document.getElementById('resultCount').textContent = `${visibleCount} ${visibleCount === 1 ? 'entry' : 'entries'}`;
    progress();
  }

  categories.addEventListener('change', event => {
    const input = event.target.closest('[data-check]');
    if (!input) return;
    state[input.dataset.check] = input.checked;
    input.closest('.item').classList.toggle('is-checked', input.checked);
    saveState();
    progress();
  });

  categories.addEventListener('click', event => {
    const zoom = event.target.closest('[data-zoom]');
    if (zoom) {
      imageScrollY = window.scrollY;
      document.getElementById('largeImage').src = zoom.dataset.zoom;
      document.getElementById('largeImage').alt = zoom.querySelector('img')?.alt || 'Checklist location image';
      document.getElementById('imageDialog').showModal();
      return;
    }
    const header = event.target.closest('.category-header');
    if (header) {
      const section = header.closest('.category');
      const body = section.querySelector('.category-body');
      const expanded = header.getAttribute('aria-expanded') !== 'true';
      header.setAttribute('aria-expanded', String(expanded));
      body.hidden = !expanded;
      header.querySelector('.collapse-icon').textContent = expanded ? '−' : '+';
      if (expanded) collapsedGroups.delete(section.dataset.group);
      else collapsedGroups.add(section.dataset.group);
      saveCollapsedGroups();
    }
  });

  search.addEventListener('input', render);
  document.getElementById('exportButton').addEventListener('click', () => {
    const backup = { source: 'Silksong local checklist', version: 1, exportedAt: new Date().toISOString(), checked: state };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'silksong-checklist-progress.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Progress exported.');
  });
  const importFile = document.getElementById('importFile');
  document.getElementById('importButton').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const incoming = data.checked && typeof data.checked === 'object' ? data.checked : data;
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw new Error('Invalid checklist data');
      trackedItems.concat(groups.slice(11).flatMap(group => group.items)).forEach(item => { state[item.id] = incoming[item.id] === true; });
      saveState(); render(); showToast('Progress imported.');
    } catch { showToast('That file is not a valid checklist backup.'); }
    importFile.value = '';
  });
  document.getElementById('resetButton').addEventListener('click', () => {
    if (!confirm('Reset all checklist progress in this browser?')) return;
    Object.keys(state).forEach(key => delete state[key]);
    saveState(); render(); showToast('Checklist progress reset.');
  });
  const info = document.getElementById('infoDialog');
  document.getElementById('infoButton').addEventListener('click', () => info.showModal());
  document.querySelectorAll('.dialog-close').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  const imageDialog = document.getElementById('imageDialog');
  [info, imageDialog].forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); }));
  imageDialog.addEventListener('close', () => requestAnimationFrame(() => window.scrollTo({ top: imageScrollY, behavior: 'instant' })));

  render();
})();

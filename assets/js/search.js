/* ================================================
   SEARCH.JS — Live search via GBIF suggest API
   ================================================ */

const GBIF_SUGGEST = 'https://api.gbif.org/v1/species/suggest';
const GBIF_OCC     = 'https://api.gbif.org/v1/occurrence/search';

let searchTimeout = null;

function initSearch() {
  const input    = document.getElementById('searchInput');
  const dropdown = document.getElementById('liveDropdown');
  const btn      = document.getElementById('searchBtn');
  if (!input) return;

  /* Live typing */
  input.addEventListener('input', function () {
    clearTimeout(searchTimeout);
    const q = this.value.trim();
    if (q.length < 2) { hideDropdown(dropdown); return; }
    showLoading(dropdown);
    searchTimeout = setTimeout(function () { fetchSuggestions(q, dropdown); }, 300);
  });

  /* Enter key */
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      const first = dropdown.querySelector('.dropdown-item');
      if (first) { window.location.href = first.getAttribute('href'); return; }
      const q = input.value.trim();
      if (q) window.location.href = 'details.html?q=' + encodeURIComponent(q);
    }
    if (e.key === 'Escape') { hideDropdown(dropdown); }
  });

  /* Search button */
  if (btn) {
    btn.addEventListener('click', function () {
      const q = input.value.trim();
      if (!q) return;
      const first = dropdown.querySelector('.dropdown-item');
      if (first) { window.location.href = first.getAttribute('href'); return; }
      window.location.href = 'details.html?q=' + encodeURIComponent(q);
    });
  }

  /* Close on outside click */
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#searchWrapper')) hideDropdown(dropdown);
  });
}

async function fetchSuggestions(query, dropdown) {
  try {
    const url  = GBIF_SUGGEST + '?q=' + encodeURIComponent(query) + '&limit=7';
    const res  = await fetch(url);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      showNoResult(dropdown);
      return;
    }
    renderDropdown(data.slice(0, 7), dropdown);
  } catch (err) {
    dropdown.innerHTML = '<div class="dropdown-no-result">Connection error. Try again.</div>';
    showDropdown(dropdown);
  }
}

function renderDropdown(items, dropdown) {
  dropdown.innerHTML = items.map(function (item) {
    const name    = item.canonicalName || item.scientificName || 'Unknown';
    const sci     = item.scientificName || '';
    const kingdom = (item.kingdom || '').toLowerCase();
    const key     = item.key || item.usageKey || '';
    const isPlant = kingdom === 'plantae' || kingdom === 'fungi';
    const badgeClass = isPlant ? 'badge-plant' : 'badge-animal';
    const badgeText  = item.kingdom || item.rank || 'Species';
    const emoji      = isPlant ? '&#127807;' : '&#128062;';
    const dataKey    = key ? ' data-key="' + key + '"' : '';

    return '<a class="dropdown-item" href="details.html?key=' + esc(key) + '"' + dataKey + '>' +
      '<div class="dropdown-item-img" id="dimg-' + esc(key) + '">' + emoji + '</div>' +
      '<div style="min-width:0;flex:1">' +
        '<div class="dropdown-item-name">' + esc(name) + '</div>' +
        '<div class="dropdown-item-sci">' + esc(sci) + '</div>' +
      '</div>' +
      '<span class="dropdown-item-badge ' + badgeClass + '">' + esc(badgeText) + '</span>' +
    '</a>';
  }).join('');

  showDropdown(dropdown);
  lazyLoadThumbnails(items, dropdown);
}

async function lazyLoadThumbnails(items, dropdown) {
  items.slice(0, 5).forEach(async function (item) {
    const key   = item.key || item.usageKey;
    const imgEl = document.getElementById('dimg-' + key);
    if (!key || !imgEl) return;
    try {
      const r = await fetch(GBIF_OCC + '?taxonKey=' + key + '&mediaType=StillImage&limit=1');
      const d = await r.json();
      const src = d && d.results && d.results[0] && d.results[0].media && d.results[0].media[0]
        ? d.results[0].media[0].identifier
        : null;
      if (src && document.getElementById('dimg-' + key)) {
        var img = new Image();
        img.onload = function () {
          var el = document.getElementById('dimg-' + key);
          if (!el) return;
          el.innerHTML = '';
          el.style.padding = '0';
          var i = document.createElement('img');
          i.src = src;
          i.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:6px';
          el.appendChild(i);
        };
        img.src = src;
      }
    } catch (e) { /* silently ignore */ }
  });
}

/* ── Helpers ─────────────────────────────────────── */
function showDropdown(el)  { if (el) el.classList.add('show'); }
function hideDropdown(el)  { if (el) el.classList.remove('show'); }

function showLoading(el) {
  if (!el) return;
  el.innerHTML = '<div class="dropdown-loading">Searching&hellip;</div>';
  showDropdown(el);
}

function showNoResult(el) {
  if (!el) return;
  el.innerHTML = '<div class="dropdown-no-result">No matches found for your search.</div>';
  showDropdown(el);
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Quick-search chip helper (called from HTML) ─── */
function quickSearch(term) {
  var input = document.getElementById('searchInput');
  if (!input) return;
  input.value = term;
  input.dispatchEvent(new Event('input'));
  input.focus();
}

document.addEventListener('DOMContentLoaded', initSearch);

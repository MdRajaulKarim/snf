/* ================================================
   SEARCH.JS — Live search via GBIF API
   Searches by both common name AND scientific name
   ================================================ */

var GBIF_SUGGEST  = 'https://api.gbif.org/v1/species/suggest';
var GBIF_SEARCH   = 'https://api.gbif.org/v1/species/search';
var GBIF_OCC      = 'https://api.gbif.org/v1/occurrence/search';

var searchTimeout = null;
var selectedIndex = -1;

function initSearch() {
  var input    = document.getElementById('searchInput');
  var dropdown = document.getElementById('liveDropdown');
  var btn      = document.getElementById('searchBtn');
  if (!input) return;

  input.addEventListener('input', function () {
    clearTimeout(searchTimeout);
    selectedIndex = -1;
    var q = this.value.trim();
    if (q.length < 2) { hideDropdown(dropdown); return; }
    showLoading(dropdown);
    searchTimeout = setTimeout(function () { fetchSuggestions(q, dropdown); }, 320);
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      var items = dropdown.querySelectorAll('.dropdown-item');
      if (selectedIndex >= 0 && items[selectedIndex]) {
        window.location.href = items[selectedIndex].getAttribute('href');
        return;
      }
      var first = dropdown.querySelector('.dropdown-item');
      if (first) { window.location.href = first.getAttribute('href'); return; }
      var q = input.value.trim();
      if (q) fetchAndGoToFirst(q);
    }
    if (e.key === 'Escape') { hideDropdown(dropdown); selectedIndex = -1; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      var items = dropdown.querySelectorAll('.dropdown-item');
      if (!items.length) return;
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      highlightSelected(items);
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      var items = dropdown.querySelectorAll('.dropdown-item');
      if (!items.length) return;
      selectedIndex = Math.max(selectedIndex - 1, -1);
      highlightSelected(items);
    }
  });

  if (btn) {
    btn.addEventListener('click', function () {
      var q = input.value.trim();
      if (!q) return;
      var first = dropdown.querySelector('.dropdown-item');
      if (first) { window.location.href = first.getAttribute('href'); return; }
      fetchAndGoToFirst(q);
    });
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest('#searchWrapper')) { hideDropdown(dropdown); selectedIndex = -1; }
  });

  /* Press "/" to focus search */
  document.addEventListener('keydown', function (e) {
    if (e.key === '/') {
      e.preventDefault();
      input.focus();
    }
  });
}

/* Go directly to first result when Enter is pressed */
async function fetchAndGoToFirst(query) {
  try {
    var url  = GBIF_SUGGEST + '?q=' + encodeURIComponent(query) + '&limit=1';
    var res  = await fetch(url);
    var data = await res.json();
    var key  = data && data[0] ? (data[0].key || data[0].usageKey) : null;
    if (key) {
      window.location.href = 'details.html?key=' + key;
    } else {
      window.location.href = 'details.html?q=' + encodeURIComponent(query);
    }
  } catch (e) {
    window.location.href = 'details.html?q=' + encodeURIComponent(query);
  }
}

async function fetchSuggestions(query, dropdown) {
  try {
    /* Run both suggest (scientific) and vernacular search in parallel */
    var [suggestRes, vernacularRes] = await Promise.all([
      fetch(GBIF_SUGGEST + '?q=' + encodeURIComponent(query) + '&limit=5'),
      fetch(GBIF_SEARCH  + '?q=' + encodeURIComponent(query) + '&limit=4&language=eng')
    ]);

    var suggestData   = await suggestRes.json();
    var vernacularData = await vernacularRes.json();

    /* Merge results, deduplicate by key */
    var seen = new Set();
    var merged = [];

    (Array.isArray(suggestData) ? suggestData : []).forEach(function (item) {
      var k = item.key || item.usageKey;
      if (k && !seen.has(k)) { seen.add(k); merged.push(item); }
    });

    var vResults = (vernacularData && vernacularData.results) ? vernacularData.results : [];
    vResults.forEach(function (item) {
      var k = item.key || item.usageKey;
      if (k && !seen.has(k)) { seen.add(k); merged.push(item); }
    });

    if (!merged.length) { showNoResult(dropdown); return; }
    selectedIndex = -1;
    renderDropdown(merged.slice(0, 7), dropdown);

  } catch (err) {
    dropdown.innerHTML = '<div class="dropdown-no-result">Connection error..</div>';
    showDropdown(dropdown);
  }
}

function renderDropdown(items, dropdown) {
  dropdown.innerHTML = items.map(function (item) {
    var name     = item.vernacularName || item.canonicalName || item.scientificName || '';
    var sci      = item.canonicalName  || item.scientificName || '';
    /* Don't show sci name if it's identical to display name */
    var sciLine  = (sci && sci !== name) ? sci : '';
    var kingdom  = (item.kingdom || '').toLowerCase();
    var key      = item.key || item.usageKey || '';
    var isPlant  = kingdom === 'plantae' || kingdom === 'fungi';
    var badgeClass = isPlant ? 'badge-plant' : 'badge-animal';
    var badgeText  = item.kingdom || item.rank || 'Species';
    var emoji      = isPlant ? '&#127807;' : '&#128062;';

    return '<a class="dropdown-item" href="details.html?key=' + esc(key) + '" id="drow-' + esc(key) + '">' +
      '<div class="dropdown-item-img" id="dimg-' + esc(key) + '">' + emoji + '</div>' +
      '<div style="min-width:0;flex:1">' +
        '<div class="dropdown-item-name">' + esc(name) + '</div>' +
        (sciLine ? '<div class="dropdown-item-sci">' + esc(sciLine) + '</div>' : '') +
      '</div>' +
      '<span class="dropdown-item-badge ' + badgeClass + '">' + esc(badgeText) + '</span>' +
    '</a>';
  }).join('');

  showDropdown(dropdown);
  lazyLoadThumbnails(items);
}

async function lazyLoadThumbnails(items) {
  items.slice(0, 5).forEach(async function (item) {
    var key   = item.key || item.usageKey;
    var imgEl = document.getElementById('dimg-' + key);
    if (!key || !imgEl) return;
    try {
      var r   = await fetch(GBIF_OCC + '?taxonKey=' + key + '&mediaType=StillImage&limit=1');
      var d   = await r.json();
      var src = d && d.results && d.results[0] &&
                d.results[0].media && d.results[0].media[0]
        ? d.results[0].media[0].identifier : null;

      if (src) {
        var img   = new Image();
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
    } catch (e) { /* skip */ }
  });
}

/* ── Helpers ─────────────────────────────────── */
function showDropdown(el)  { if (el) el.classList.add('show'); }
function hideDropdown(el)  { if (el) el.classList.remove('show'); }

function highlightSelected(items) {
  items.forEach(function (item, idx) {
    if (idx === selectedIndex) {
      item.classList.add('dropdown-item-selected');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('dropdown-item-selected');
    }
  });
}

function showLoading(el) {
  if (!el) return;
  el.innerHTML = '<div class="dropdown-loading">Searching&hellip;</div>';
  showDropdown(el);
}

function showNoResult(el) {
  if (!el) return;
  el.innerHTML = '<div class="dropdown-no-result">No species found. Try a different name.</div>';
  showDropdown(el);
}

function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* Called from HTML quick-search chips */
function quickSearch(term) {
  var input = document.getElementById('searchInput');
  if (!input) return;
  input.value = term;
  input.dispatchEvent(new Event('input'));
  input.focus();
}

document.addEventListener('DOMContentLoaded', initSearch);

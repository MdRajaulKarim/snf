/* ================================================
   RESULTS.JS — Search results page via GBIF API
   Shows all matches for a query (common or scientific name)
   ================================================ */

var GBIF_SUGGEST  = 'https://api.gbif.org/v1/species/suggest';
var GBIF_SEARCH   = 'https://api.gbif.org/v1/species/search';
var GBIF_OCC_R    = 'https://api.gbif.org/v1/occurrence/search';

var PAGE_SIZE  = 12;
var currentPage = 0;
var allResults  = [];

async function initResults() {
  var params = new URLSearchParams(window.location.search);
  var query  = params.get('q');

  if (!query || !query.trim()) {
    showState('stateNoResults');
    var msg = document.getElementById('noResultsMsg');
    if (msg) msg.textContent = 'No search query provided. Please go back and enter a species name.';
    return;
  }

  query = query.trim();

  /* Pre-fill the search bar */
  var input = document.getElementById('searchInput');
  if (input) input.value = query;

  /* Set page title */
  document.title = 'Results for \u201c' + query + '\u201d \u2014 Scientific Name Finder';

  /* Show results header */
  var header = document.getElementById('resultsHeader');
  if (header) header.style.display = 'flex';

  var queryEl = document.getElementById('resultsQuery');
  if (queryEl) queryEl.textContent = '\u201c' + query + '\u201d';

  await fetchResults(query);
}

async function fetchResults(query) {
  showState('stateLoading');

  try {
    /* Run suggest (matches scientific & common names) and full-text search in parallel */
    var [suggestRes, searchRes] = await Promise.all([
      fetch(GBIF_SUGGEST + '?q=' + encodeURIComponent(query) + '&limit=20'),
      fetch(GBIF_SEARCH  + '?q=' + encodeURIComponent(query) + '&limit=20&language=eng')
    ]);

    var suggestData = await suggestRes.json();
    var searchData  = await searchRes.json();

    /* Merge and deduplicate by taxon key */
    var seen   = new Set();
    var merged = [];

    (Array.isArray(suggestData) ? suggestData : []).forEach(function (item) {
      var k = item.key || item.usageKey;
      if (k && !seen.has(k)) { seen.add(k); merged.push(item); }
    });

    var sResults = (searchData && searchData.results) ? searchData.results : [];
    sResults.forEach(function (item) {
      var k = item.key || item.usageKey;
      if (k && !seen.has(k)) { seen.add(k); merged.push(item); }
    });

    if (!merged.length) {
      showState('stateNoResults');
      return;
    }

    allResults  = merged;
    currentPage = 0;
    renderPage(0);

  } catch (err) {
    console.error('SNF results error:', err);
    showState('stateError');
  }
}

function renderPage(page) {
  var start = page * PAGE_SIZE;
  var items = allResults.slice(start, start + PAGE_SIZE);

  var countEl = document.getElementById('resultsCount');
  if (countEl) {
    countEl.textContent = allResults.length + ' species found';
  }

  var grid = document.getElementById('resultsGrid');
  if (!grid) return;

  grid.innerHTML = items.map(function (item) {
    var key      = item.key || item.usageKey || '';
    var name     = item.vernacularName || item.canonicalName || item.scientificName || 'Unknown Species';
    var sci      = item.canonicalName  || item.scientificName || '';
    var sciLine  = (sci && sci !== name) ? sci : '';
    var kingdom  = (item.kingdom || '').toLowerCase();
    var isPlant  = kingdom === 'plantae' || kingdom === 'fungi';
    var badgeClass = isPlant ? 'badge-plant' : 'badge-animal';
    var badgeText  = item.kingdom || item.rank || 'Species';
    var emoji      = isPlant ? '&#127807;' : '&#128062;';
    var family     = item.family ? 'Family: ' + esc(item.family) : '';

    return '<a class="result-card" href="details.html?key=' + esc(key) + '">' +
      '<div class="result-card-img" id="rimg-' + esc(key) + '">' + emoji + '</div>' +
      '<div class="result-card-body">' +
        '<span class="result-badge ' + badgeClass + '">' + esc(badgeText) + '</span>' +
        '<div class="result-name">' + esc(name) + '</div>' +
        (sciLine ? '<div class="result-sci">'    + esc(sciLine) + '</div>' : '') +
        (family  ? '<div class="result-family">' + family       + '</div>' : '') +
      '</div>' +
      '<span class="result-arrow">&rarr;</span>' +
    '</a>';
  }).join('');

  buildPagination();
  showState('resultsContent');
  lazyLoadResultThumbnails(items);
}

async function lazyLoadResultThumbnails(items) {
  items.slice(0, PAGE_SIZE).forEach(async function (item) {
    var key   = item.key || item.usageKey;
    var imgEl = document.getElementById('rimg-' + key);
    if (!key || !imgEl) return;
    try {
      var r   = await fetch(GBIF_OCC_R + '?taxonKey=' + key + '&mediaType=StillImage&limit=1');
      var d   = await r.json();
      var src = d && d.results && d.results[0] &&
                d.results[0].media && d.results[0].media[0]
        ? d.results[0].media[0].identifier : null;

      if (src) {
        var img = new Image();
        img.onload = function () {
          var el = document.getElementById('rimg-' + key);
          if (!el) return;
          el.innerHTML = '';
          el.style.padding = '0';
          var i = document.createElement('img');
          i.src = src;
          i.alt = '';
          i.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:var(--r-md) 0 0 var(--r-md)';
          el.appendChild(i);
        };
        img.src = src;
      }
    } catch (e) { /* skip */ }
  });
}

function buildPagination() {
  var container = document.getElementById('resultsPagination');
  if (!container) return;

  var totalPages = Math.ceil(allResults.length / PAGE_SIZE);
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  var html = '';
  for (var i = 0; i < totalPages; i++) {
    var active = i === currentPage ? ' active' : '';
    html += '<button class="page-btn' + active + '" onclick="goToPage(' + i + ')">' + (i + 1) + '</button>';
  }
  container.innerHTML = html;
}

function goToPage(page) {
  currentPage = page;
  renderPage(page);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── State helpers ──────────────────────────── */
function showState(id) {
  var ids = ['stateLoading', 'stateError', 'stateNoResults', 'resultsContent'];
  ids.forEach(function (s) {
    var el = document.getElementById(s);
    if (el) el.style.display = (s === id) ? (s === 'resultsContent' ? 'block' : 'flex') : 'none';
  });
  /* stateLoading and stateError use block layout */
  var el = document.getElementById(id);
  if (el && (id === 'stateLoading' || id === 'stateError' || id === 'stateNoResults')) {
    el.style.display = 'block';
  }
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', initResults);

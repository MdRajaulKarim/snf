/* ================================================
   DETAILS.JS — Species detail page via GBIF API
   ================================================ */

var GBIF_SP  = 'https://api.gbif.org/v1/species';
var GBIF_OCC = 'https://api.gbif.org/v1/occurrence/search';

var currentSpecies = null;

async function loadSpecies() {
  var params = new URLSearchParams(window.location.search);
  var key    = params.get('key');
  var query  = params.get('q');

  if (!key && !query) { showError(); return; }

  try {
    var taxonKey = key;

    /* No key — search for species first */
    if (!taxonKey && query) {
      var r = await fetch(GBIF_SP + '/suggest?q=' + encodeURIComponent(query) + '&limit=1');
      var d = await r.json();
      taxonKey = d && d[0] ? (d[0].key || d[0].usageKey) : null;
      if (!taxonKey) { showError(); return; }
    }

    var results = await Promise.all([
      fetch(GBIF_SP + '/' + taxonKey),
      fetch(GBIF_OCC + '?taxonKey=' + taxonKey + '&mediaType=StillImage&limit=1')
    ]);

    var spec = await results[0].json();
    var occ  = await results[1].json();

    if (!spec || spec.key === undefined) { showError(); return; }

    var img = occ && occ.results && occ.results[0] && occ.results[0].media && occ.results[0].media[0]
      ? occ.results[0].media[0].identifier
      : null;

    currentSpecies = { spec: spec, img: img };
    renderDetails(spec, img);

  } catch (err) {
    console.error('SNF details error:', err);
    showError();
  }
}

function renderDetails(spec, imgUrl) {
  var displayName = spec.vernacularName || spec.canonicalName || spec.scientificName || 'Unknown Species';
  var sciName     = spec.canonicalName  || spec.scientificName || '';

  /* Page title + breadcrumb */
  document.title = displayName + ' — Scientific Name Finder';
  var breadEl = document.getElementById('breadcrumbName');
  if (breadEl) breadEl.textContent = sciName || displayName;

  /* Image */
  var imgEl  = document.getElementById('detailsImg');
  var phEl   = document.getElementById('detailsImgPlaceholder');
  if (imgUrl && imgEl) {
    imgEl.src = imgUrl;
    imgEl.alt = displayName;
    imgEl.style.display = 'block';
    if (phEl) phEl.style.display = 'none';
    imgEl.onerror = function () {
      imgEl.style.display = 'none';
      if (phEl) phEl.style.display = 'flex';
    };
  }

  /* Kingdom badge */
  var kingdom  = spec.kingdom || '';
  var isPlant  = kingdom.toLowerCase() === 'plantae';
  var isFungi  = kingdom.toLowerCase() === 'fungi';
  var badgeEl  = document.getElementById('detailsBadge');
  if (badgeEl) {
    badgeEl.textContent = kingdom || spec.rank || 'Species';
    if (isPlant || isFungi) {
      badgeEl.style.cssText = 'background:rgba(14,154,174,0.15);color:var(--teal-3);border:1px solid var(--border-2)';
    } else {
      badgeEl.style.cssText = 'background:rgba(240,90,40,0.1);color:var(--coral-3);border:1px solid rgba(240,90,40,0.25)';
    }
  }

  /* Names */
  var commonEl = document.getElementById('detailsCommon');
  var sciEl    = document.getElementById('detailsSci');
  if (commonEl) commonEl.textContent = displayName;
  if (sciEl)    sciEl.textContent    = sciName;

  /* Taxonomy grid */
  var fields = [
    { label: 'Kingdom',  value: spec.kingdom  },
    { label: 'Phylum',   value: spec.phylum   },
    { label: 'Class',    value: spec.class    },
    { label: 'Order',    value: spec.order    },
    { label: 'Family',   value: spec.family   },
    { label: 'Genus',    value: spec.genus    },
    { label: 'Rank',     value: spec.rank     },
    { label: 'Status',   value: spec.taxonomicStatus },
    { label: 'GBIF Key', value: spec.key      },
  ].filter(function (f) { return f.value; });

  var grid = document.getElementById('taxonomyGrid');
  if (grid) {
    grid.innerHTML = fields.map(function (f) {
      return '<div class="taxon-item">' +
        '<div class="taxon-label">' + esc(f.label) + '</div>' +
        '<div class="taxon-value">' + esc(String(f.value)) + '</div>' +
        '</div>';
    }).join('');
  }

  /* Description — GBIF doesn't always have one, so we build a fallback */
  var descEl = document.getElementById('detailsDesc');
  if (descEl) {
    if (spec.description) {
      descEl.textContent = spec.description;
    } else {
      var parts = [
        displayName + ' (' + (sciName || 'Unknown') + ')',
        'is a ' + ((spec.rank || 'species').toLowerCase()),
        spec.kingdom  ? 'in the kingdom ' + spec.kingdom  : '',
        spec.phylum   ? ', phylum '  + spec.phylum         : '',
        spec.class    ? ', class '   + spec.class          : '',
        spec.order    ? ', order '   + spec.order          : '',
        spec.family   ? ', and family ' + spec.family + '.' : '.',
      ];
      descEl.textContent = parts.filter(Boolean).join(' ') +
        ' Data sourced from GBIF \u2014 the Global Biodiversity Information Facility.';
    }
  }

  /* Show content */
  document.getElementById('stateLoading').style.display  = 'none';
  document.getElementById('detailsContent').style.display = 'grid';
}

function showError() {
  document.getElementById('stateLoading').style.display = 'none';
  document.getElementById('stateError').style.display   = 'block';
}

function copyDetails() {
  if (!currentSpecies) return;
  var s    = currentSpecies.spec;
  var text = [
    'Common Name:    ' + (s.vernacularName || s.canonicalName || '\u2014'),
    'Scientific Name: ' + (s.canonicalName || s.scientificName || '\u2014'),
    'Kingdom:  ' + (s.kingdom  || '\u2014'),
    'Phylum:   ' + (s.phylum   || '\u2014'),
    'Class:    ' + (s.class    || '\u2014'),
    'Order:    ' + (s.order    || '\u2014'),
    'Family:   ' + (s.family   || '\u2014'),
    'Genus:    ' + (s.genus    || '\u2014'),
    'Status:   ' + (s.taxonomicStatus || '\u2014'),
    'Source:   GBIF (https://www.gbif.org)',
  ].join('\n');

  navigator.clipboard.writeText(text).then(function () {
    var btn = document.getElementById('copyBtn');
    if (btn) {
      btn.textContent = '\u2713 Copied!';
      setTimeout(function () { btn.innerHTML = '&#128203; Copy Details'; }, 2000);
    }
  }).catch(function () {
    alert('Could not copy. Please copy manually.');
  });
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

document.addEventListener('DOMContentLoaded', loadSpecies);

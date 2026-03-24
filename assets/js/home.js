/* ================================================
   HOME.JS — Species slider powered by GBIF API
   ================================================ */

var GBIF_SPECIES = 'https://api.gbif.org/v1/species';
var GBIF_OCC     = 'https://api.gbif.org/v1/occurrence/search';

/* Curated taxon keys — diverse, highly visual species */
var FEATURED_KEYS = [
  2435098,  /* Panthera leo        — Lion                */
  5219404,  /* Rosa canina         — Dog Rose            */
  2481433,  /* Panthera tigris     — Tiger               */
  3189866,  /* Helianthus annuus   — Sunflower           */
  2437480,  /* Elephas maximus     — Asian Elephant      */
  2891770,  /* Papilio machaon     — Swallowtail         */
  5334080,  /* Orcinus orca        — Killer Whale        */
  5231190,  /* Quercus robur       — English Oak         */
  2474953,  /* Acer palmatum       — Japanese Maple      */
  2440447,  /* Vulpes vulpes       — Red Fox             */
  5232437,  /* Nelumbo nucifera    — Sacred Lotus        */
  2440091,  /* Canis lupus         — Wolf                */
];

var sliderIndex   = 0;
var cardsPerView  = 4;
var autoTimer     = null;
var totalCards    = 0;

async function initSlider() {
  var track = document.getElementById('sliderTrack');
  var dots  = document.getElementById('sliderDots');
  if (!track) return;

  updateCardsPerView();
  window.addEventListener('resize', function () {
    updateCardsPerView();
    goToSlide(0);
  });

  var species = await fetchFeaturedSpecies();

  if (!species.length) {
    track.innerHTML = '<div style="padding:48px 20px;color:var(--text-3);font-size:14px;text-align:center">Could not load species. Please check your internet connection.</div>';
    return;
  }

  totalCards = species.length;
  track.innerHTML = species.map(buildCard).join('');
  buildDots(dots, species.length);
  startAutoSlide();

  var prevBtn = document.getElementById('sliderPrev');
  var nextBtn = document.getElementById('sliderNext');
  if (prevBtn) prevBtn.addEventListener('click', function () { prevSlide(); resetAutoSlide(); });
  if (nextBtn) nextBtn.addEventListener('click', function () { nextSlide(); resetAutoSlide(); });
}

function updateCardsPerView() {
  var w = window.innerWidth;
  if (w <= 480)       cardsPerView = 1;
  else if (w <= 768)  cardsPerView = 2;
  else if (w <= 1024) cardsPerView = 3;
  else                cardsPerView = 4;
}

async function fetchFeaturedSpecies() {
  var results = [];
  /* Shuffle for variety each load */
  var keys = FEATURED_KEYS.slice().sort(function () { return Math.random() - 0.5; });

  await Promise.all(keys.map(async function (key) {
    try {
      var responses = await Promise.all([
        fetch(GBIF_SPECIES + '/' + key),
        fetch(GBIF_OCC + '?taxonKey=' + key + '&mediaType=StillImage&limit=1')
      ]);
      var spec = await responses[0].json();
      var occ  = await responses[1].json();

      var img = occ && occ.results && occ.results[0] && occ.results[0].media && occ.results[0].media[0]
        ? occ.results[0].media[0].identifier
        : null;

      results.push({
        key:     key,
        common:  spec.vernacularName || spec.canonicalName || spec.scientificName || 'Unknown Species',
        sci:     spec.canonicalName  || spec.scientificName || '',
        family:  spec.family  || '',
        kingdom: spec.kingdom || '',
        img:     img
      });
    } catch (e) { /* skip failed */ }
  }));

  return results.sort(function () { return Math.random() - 0.5; });
}

function buildCard(s) {
  var kingdom  = (s.kingdom || '').toLowerCase();
  var isPlant  = kingdom === 'plantae' || kingdom === 'fungi';
  var badgeBg  = isPlant
    ? 'background:rgba(14,138,158,0.88);color:#c8f0f8'
    : 'background:rgba(220,65,20,0.88);color:#fff0ea';
  var badgeText  = esc(s.kingdom || 'Species');
  var placeholder = isPlant ? '&#127807;' : '&#128062;';

  var imgHtml = s.img
    ? '<img src="' + esc(s.img) + '" alt="' + esc(s.common) + '" loading="lazy"' +
      ' onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
    : '';
  var phDisplay = s.img ? 'display:none' : '';

  return '<a class="species-card" href="details.html?key=' + s.key + '">' +
    '<div class="card-img-wrap">' +
      imgHtml +
      '<div class="card-img-placeholder" style="' + phDisplay + '">' + placeholder + '</div>' +
      '<span class="card-kingdom-badge" style="' + badgeBg + '">' + badgeText + '</span>' +
    '</div>' +
    '<div class="card-body">' +
      '<div class="card-common">' + esc(s.common) + '</div>' +
      '<div class="card-sci">' + esc(s.sci) + '</div>' +
      (s.family ? '<div class="card-family">Family: ' + esc(s.family) + '</div>' : '') +
      '<div class="card-cta"><span class="card-view-btn">View Details &rarr;</span></div>' +
    '</div>' +
  '</a>';
}

function goToSlide(index) {
  var track = document.getElementById('sliderTrack');
  if (!track) return;
  var cards = track.querySelectorAll('.species-card');
  if (!cards.length) return;

  var max = Math.max(0, cards.length - cardsPerView);
  sliderIndex = Math.max(0, Math.min(index, max));

  var cardWidth = cards[0].offsetWidth;
  var gap       = 20;
  track.style.transform = 'translateX(-' + (sliderIndex * (cardWidth + gap)) + 'px)';
  updateDots();
}

function nextSlide() {
  var track = document.getElementById('sliderTrack');
  if (!track) return;
  var cards = track.querySelectorAll('.species-card');
  var max   = Math.max(0, cards.length - cardsPerView);
  goToSlide(sliderIndex >= max ? 0 : sliderIndex + 1);
}

function prevSlide() {
  var track = document.getElementById('sliderTrack');
  if (!track) return;
  var cards = track.querySelectorAll('.species-card');
  var max   = Math.max(0, cards.length - cardsPerView);
  goToSlide(sliderIndex <= 0 ? max : sliderIndex - 1);
}

function buildDots(container, total) {
  if (!container) return;
  var pages = Math.ceil(total / cardsPerView);
  var html = '';
  for (var i = 0; i < pages; i++) {
    var slideIdx = i * cardsPerView;
    html += '<button class="dot' + (i === 0 ? ' active' : '') + '" aria-label="Page ' + (i + 1) + '" onclick="goToSlide(' + slideIdx + ');resetAutoSlide()"></button>';
  }
  container.innerHTML = html;
}

function updateDots() {
  var dots = document.querySelectorAll('.dot');
  var page = Math.floor(sliderIndex / cardsPerView);
  dots.forEach(function (d, i) { d.classList.toggle('active', i === page); });
}

function startAutoSlide()  { autoTimer = setInterval(nextSlide, 4000); }
function resetAutoSlide()  { clearInterval(autoTimer); startAutoSlide(); }

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', initSlider);

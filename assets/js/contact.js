/* ================================================
   CONTACT.JS — Netlify Forms handler
   ================================================ */

document.addEventListener('DOMContentLoaded', function () {
  var form  = document.getElementById('contactForm');
  var alert = document.getElementById('formAlert');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    var btn = form.querySelector('button[type="submit"]');
    btn.textContent = 'Sending\u2026';
    btn.disabled    = true;

    var data = new FormData(form);

    try {
      var res = await fetch('/', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    new URLSearchParams(data).toString()
      });

      if (res.ok) {
        showAlert('success', '\u2705 Thank you! Your message has been sent successfully.');
        form.reset();
      } else {
        showAlert('error', '\u26a0\ufe0f Something went wrong. Please try again.');
      }
    } catch (err) {
      showAlert('error', '\u26a0\ufe0f Network error. Please check your connection.');
    } finally {
      btn.innerHTML = 'Send Message &rarr;';
      btn.disabled  = false;
    }
  });

  function showAlert(type, msg) {
    alert.className   = 'form-alert ' + type;
    alert.textContent = msg;
    alert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});

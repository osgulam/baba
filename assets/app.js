(function () {
  'use strict';

  var ALL = 'הכל';
  var CATS = ['כדים', 'מריצות', 'אופניים', 'שולחנות', 'שידות', 'מיטות', 'מטבחים', 'אחר'];
  var WOODS = ['אלון', 'אגוז', 'אורן', 'בוק', 'טיק', 'דובדבן', 'זית', 'מייפל', 'אקליפטוס'];
  var DATA_PATH = 'data/works.json';
  var TOKEN_KEY = 'babahaim-token';

  function $(id) { return document.getElementById(id); }
  var grid = $('grid'), chips = $('chips'), empty = $('empty'), loading = $('loading'), addBtn = $('addBtn');
  var detail = $('detail'), dBody = $('dBody'), editor = $('editor'), form = $('form'), login = $('login');

  var items = [], loadError = false, cat = ALL, editing = null, current = null, busy = false, idx = 0, io = null, draft = [];
  var localUrls = {}; // path -> blob URL for photos saved this session (until GitHub Pages rebuilds)
  var smooth = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- repo + token ---------- */
  var repo = (function () {
    var c = window.SITE_CONFIG || {};
    var owner = c.owner, name = c.repo, branch = c.branch || 'main';
    if ((!owner || !name) && /\.github\.io$/i.test(location.hostname)) {
      owner = owner || location.hostname.split('.')[0];
      var seg = location.pathname.split('/').filter(Boolean)[0];
      name = name || (seg && seg.indexOf('.') < 0 ? seg : location.hostname);
    }
    return owner && name ? { owner: owner, name: name, branch: branch } : null;
  })();

  function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} }
  var token = getToken();
  function canEdit() { return !!(token && repo); }

  function gh(path, opts) {
    opts = opts || {};
    var headers = { 'Authorization': 'Bearer ' + token, 'Accept': opts.accept || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (opts.body) headers['Content-Type'] = 'application/json';
    return fetch('https://api.github.com/repos/' + repo.owner + '/' + repo.name + path, {
      method: opts.method || 'GET', headers: headers, cache: 'no-store',
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { var e = new Error(t); e.status = r.status; throw e; });
      return opts.raw ? r.text() : r.json();
    });
  }

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function imgs(it) { return Array.isArray(it.images) ? it.images : []; }
  function urlOf(p) { return localUrls[p] || p; }
  function rawUrl(p) { return repo ? 'https://raw.githubusercontent.com/' + repo.owner + '/' + repo.name + '/' + repo.branch + '/' + p : ''; }
  function catOf(i) { return CATS.indexOf(i.category) >= 0 ? i.category : 'אחר'; }
  function woods() { var s = []; items.forEach(function (i) { if (i.wood && s.indexOf(i.wood) < 0) s.push(i.wood); }); return s; }
  function newId() { return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function lock(on) { document.body.style.overflow = on ? 'hidden' : ''; }
  var tt; function toast(t, ms) { var el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(tt); tt = setTimeout(function () { el.hidden = true; }, ms || 4500); }

  /* ---------- load ---------- */
  function parse(text) { var d = JSON.parse(text); return Array.isArray(d.items) ? d.items : []; }
  function load() {
    var p = canEdit()
      ? gh('/contents/' + DATA_PATH + '?ref=' + encodeURIComponent(repo.branch), { accept: 'application/vnd.github.raw+json', raw: true })
          .catch(function (e) { if (e.status === 401) { signOut(); toast('מפתח הגישה כבר לא תקף. היכנסו לעריכה מחדש.'); } return fetchPublic(); })
      : fetchPublic();
    return p.then(function (text) { items = parse(text); })
      .catch(function () { items = []; loadError = true; })
      .then(function () { loading.hidden = true; render(); });
  }
  function fetchPublic() { return fetch(DATA_PATH + '?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }); }

  /* ---------- gallery ---------- */
  function render() {
    chips.innerHTML = [ALL].concat(CATS).map(function (c) { return '<button type="button" class="chip" role="tab" aria-selected="' + (c === cat) + '" data-c="' + esc(c) + '">' + esc(c) + '</button>'; }).join('');
    var ws = woods();
    $('woodList').innerHTML = ws.concat(WOODS.filter(function (w) { return ws.indexOf(w) < 0; })).map(function (c) { return '<option value="' + esc(c) + '">'; }).join('');
    var list = items.filter(function (i) { return cat === ALL || catOf(i) === cat; });
    grid.innerHTML = list.map(function (i) {
      var ims = imgs(i), n = ims.length;
      var sub = [catOf(i), i.wood].filter(Boolean).join(' · ');
      return '<li class="work" data-id="' + esc(i.id) + '">' +
        '<div class="r-media"><div class="r-track" data-open>' + ims.map(function (p, k) {
          return '<div class="r-slide"><img' + (k ? ' loading="lazy"' : '') + ' src="' + esc(urlOf(p)) + '" data-path="' + esc(p) + '" alt="' + esc(i.title) + (n > 1 ? ' – תמונה ' + (k + 1) : '') + '"></div>';
        }).join('') + '</div>' + (i.sample ? '<span class="badge">דוגמה</span>' : '') +
        (n > 1 ? '<div class="dots" aria-hidden="true">' + ims.map(function (_, k) { return '<span' + (k ? '' : ' class="on"') + '></span>'; }).join('') + '</div>' : '') + '</div>' +
        '<button type="button" class="r-info" data-open><span class="name">' + esc(i.title) + '</span>' +
        (sub ? '<span class="sub">' + esc(sub) + '</span>' : '') + (i.size ? '<span class="sub">' + esc(i.size) + ' ס״מ</span>' : '') +
        (i.year ? '<span class="yr">' + esc(i.year) + '</span>' : '') + (n > 1 ? '<span class="more">' + n + ' תמונות ›</span>' : '') + '</button>' +
        (i.description ? '<p class="r-desc">' + esc(i.description) + '</p>' : '') + '</li>';
    }).join('');
    grid.querySelectorAll('.r-track').forEach(function (t) {
      var dots = t.parentNode.querySelectorAll('.dots span'); if (!dots.length) return;
      t.addEventListener('scroll', function () {
        var k = Math.round(Math.abs(t.scrollLeft) / t.clientWidth);
        dots.forEach(function (d, j) { d.className = j === k ? 'on' : ''; });
      }, { passive: true });
    });
    addBtn.hidden = !canEdit();
    $('loginLink').hidden = canEdit();
    $('logoutLink').hidden = !canEdit();
    if (!loading.hidden) return;
    empty.hidden = list.length > 0;
    empty.textContent = loadError ? 'לא הצלחנו לטעון את העבודות. נסו לרענן את הדף.' : items.length && cat !== ALL ? 'אין עדיין עבודות בקטגוריה "' + cat + '".' : canEdit() ? 'עוד אין עבודות. לחצו על "עבודה חדשה" כדי להעלות את הראשונה.' : 'עוד אין עבודות להציג.';
  }

  // A just-uploaded photo may not be on GitHub Pages yet: fall back to the raw file, then hide.
  document.addEventListener('error', function (e) {
    var img = e.target; if (!img || img.tagName !== 'IMG' || !img.dataset.path) return;
    if (!img.dataset.retried && repo) { img.dataset.retried = '1'; img.src = rawUrl(img.dataset.path); }
    else img.style.visibility = 'hidden';
  }, true);

  /* ---------- detail viewer ---------- */
  function openDetail(it) {
    current = it; idx = 0;
    var ims = imgs(it), n = ims.length;
    var rows = [['קטגוריה', catOf(it)], ['עץ', it.wood], ['מידות', it.size ? it.size + ' ס״מ' : ''], ['שנה', it.year]].filter(function (r) { return r[1]; });
    var media = '<div class="viewer"><div class="track" id="track">' + ims.map(function (p, k) {
      return '<div class="slide" data-k="' + k + '"><img src="' + esc(urlOf(p)) + '" data-path="' + esc(p) + '" alt="' + esc(it.title) + (n > 1 ? ' – תמונה ' + (k + 1) + ' מתוך ' + n : '') + '"' + (k ? ' loading="lazy"' : '') + '></div>';
    }).join('') + '</div>' +
      (n > 1 ? '<button class="nav prev" type="button" data-act="prev" aria-label="התמונה הקודמת" disabled>›</button><button class="nav next" type="button" data-act="next" aria-label="התמונה הבאה">‹</button><span class="counter" id="counter">1 / ' + n + '</span>' : '') + '</div>' +
      (n > 1 ? '<div class="thumbs">' + ims.map(function (p, k) { return '<button type="button" class="thumb" data-act="go" data-k="' + k + '" aria-label="תמונה ' + (k + 1) + '" aria-current="' + (k === 0) + '"><img src="' + esc(urlOf(p)) + '" data-path="' + esc(p) + '" alt=""></button>'; }).join('') + '</div>' : '');
    dBody.innerHTML = '<div class="d-wrap"><div class="d-media">' + media + '</div><div class="d-info"><h2 id="dTitle">' + esc(it.title) + '</h2>' +
      (canEdit() ? '<div class="row" id="dActs"><button class="btn" type="button" data-act="edit">עריכה</button><button class="btn danger" type="button" data-act="ask">מחיקה</button></div>' +
        '<div class="confirm" id="dConfirm" hidden><p><b>למחוק את "' + esc(it.title) + '"?</b></p><p class="hint">העבודה וכל התמונות שלה יימחקו מהאתר לכולם. אפשר לשחזר רק דרך ההיסטוריה ב־GitHub.</p><div class="row"><button class="btn danger" type="button" data-act="del">כן, למחוק</button><button class="btn" type="button" data-act="keep">ביטול</button></div></div>' : '') +
      (rows.length ? '<dl class="tag">' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>' : '') +
      (it.description ? '<p class="d-desc">' + esc(it.description) + '</p>' : '') +
      (it.sample ? '<p class="note">זו עבודה לדוגמה. אפשר למחוק אותה ולהעלות עבודות אמיתיות.</p>' : '') +
      '</div></div>';
    detail.hidden = false; lock(true);
    if (io) { io.disconnect(); io = null; }
    if (n > 1 && 'IntersectionObserver' in window) {
      var track = $('track');
      io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) setIdx(+e.target.dataset.k); }); }, { root: track, threshold: 0.6 });
      track.querySelectorAll('.slide').forEach(function (sl) { io.observe(sl); });
    }
  }
  function setIdx(k) {
    idx = k; var n = dBody.querySelectorAll('.slide').length;
    var c = $('counter'); if (c) c.textContent = (k + 1) + ' / ' + n;
    dBody.querySelectorAll('.thumb').forEach(function (t) { t.setAttribute('aria-current', String(+t.dataset.k === k)); });
    var pv = dBody.querySelector('.nav.prev'), nx = dBody.querySelector('.nav.next');
    if (pv) pv.disabled = k === 0; if (nx) nx.disabled = k === n - 1;
  }
  function go(k) {
    var sl = dBody.querySelectorAll('.slide'); if (!sl.length) return;
    k = Math.max(0, Math.min(sl.length - 1, k));
    sl[k].scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'nearest', inline: 'center' });
    setIdx(k);
  }
  function closeAll() {
    if (busy) return;
    detail.hidden = true; editor.hidden = true; login.hidden = true; $('aboutView').hidden = true; $('aboutEditor').hidden = true; lock(false); current = null;
    if (io) { io.disconnect(); io = null; }
  }

  /* ---------- editor ---------- */
  function renderPhotos() {
    $('photos').innerHTML = draft.map(function (d, k) {
      return '<div class="ptile' + (k ? '' : ' main') + '"><button type="button" class="pimg" data-pk="' + k + '" aria-label="' + (k ? 'הפיכה לתמונה הראשית' : 'התמונה הראשית') + '"><img src="' + esc(d.url) + '" alt=""></button>' +
        (k ? '' : '<span class="mainlbl">ראשית</span>') + '<button type="button" class="pdel" data-pdel="' + k + '" aria-label="הסרת התמונה">×</button></div>';
    }).join('') + '<label class="padd" for="fImg"><b>+</b><span>' + (draft.length ? 'עוד תמונות' : 'הוספת תמונות') + '</span></label>';
  }
  function openEditor(it) {
    editing = it || null;
    $('formTitle').textContent = it ? 'עריכת עבודה' : 'עבודה חדשה';
    $('fCat').value = it ? catOf(it) : (cat !== ALL ? cat : 'אחר');
    $('fTitle').value = it ? it.title : ''; $('fWood').value = it ? (it.wood || '') : ''; $('fSize').value = it ? (it.size || '') : '';
    $('fYear').value = it ? (it.year || '') : ''; $('fDesc').value = it ? (it.description || '') : '';
    $('fImg').value = '';
    draft = it ? imgs(it).map(function (p) { return { path: p, url: urlOf(p) }; }) : [];
    renderPhotos(); setStatus('');
    detail.hidden = true; editor.hidden = false; lock(true);
  }
  function setStatus(t, err, el) { var s = el || $('status'); s.textContent = t; s.className = 'status' + (err ? ' err' : ''); }
  function setBusy(b, f) { busy = b; (f || form).querySelectorAll('input,textarea,select,button').forEach(function (el) { el.disabled = b; }); }

  function toJpeg(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        try {
          var max = 1800, w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, max / Math.max(w, h));
          w = Math.round(w * s); h = Math.round(h * s);
          var c = document.createElement('canvas'); c.width = w; c.height = h;
          var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
          c.toBlob(function (b) { URL.revokeObjectURL(url); b ? res(b) : rej(new Error('decode')); }, 'image/jpeg', 0.85);
        } catch (e) { URL.revokeObjectURL(url); rej(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('decode')); };
      img.src = url;
    });
  }
  function toBase64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1]); };
      r.onerror = rej; r.readAsDataURL(blob);
    });
  }

  // One commit: upload new files, rewrite works.json from the latest copy, delete removed files.
  function commit(message, newFiles, mutate, path) {
    path = path || DATA_PATH; var isWorks = path === DATA_PATH;
    var blobShas;
    return Promise.all(newFiles.map(function (f) { return gh('/git/blobs', { method: 'POST', body: { content: f.base64, encoding: 'base64' } }); }))
      .then(function (bs) { blobShas = bs.map(function (b) { return b.sha; }); return attempt(0); });
    function attempt(n) {
      var refSha, latest;
      return gh('/git/ref/heads/' + encodeURIComponent(repo.branch))
        .then(function (ref) { refSha = ref.object.sha; return gh('/git/commits/' + refSha); })
        .then(function (c) {
          return gh('/contents/' + path + '?ref=' + refSha, { accept: 'application/vnd.github.raw+json', raw: true })
            .then(function (t) { latest = isWorks ? parse(t) : JSON.parse(t); }, function (e) { if (!isWorks && e.status === 404) latest = {}; else throw e; })
            .then(function () { return c.tree.sha; });
        })
        .then(function (baseTree) {
          var out = mutate(latest);
          var tree = newFiles.map(function (f, i) { return { path: f.path, mode: '100644', type: 'blob', sha: blobShas[i] }; });
          tree.push({ path: path, mode: '100644', type: 'blob', content: JSON.stringify(isWorks ? { items: out.items } : out.data, null, 2) + '\n' });
          out.remove.forEach(function (p) { tree.push({ path: p, mode: '100644', type: 'blob', sha: null }); });
          return gh('/git/trees', { method: 'POST', body: { base_tree: baseTree, tree: tree } })
            .then(function (t) { return gh('/git/commits', { method: 'POST', body: { message: message, tree: t.sha, parents: [refSha] } }); })
            .then(function (c) { return gh('/git/refs/heads/' + encodeURIComponent(repo.branch), { method: 'PATCH', body: { sha: c.sha } }); })
            .then(function () { return isWorks ? out.items : out.data; });
        })
        .catch(function (e) { if (n < 1 && (e.status === 422 || e.status === 409)) return attempt(n + 1); throw e; });
    }
  }
  function errMsg(e) {
    var s = e && e.status;
    if (s === 401) return 'מפתח הגישה לא תקף או שפג תוקפו. היכנסו לעריכה מחדש.';
    if (s === 403 || s === 404) return 'למפתח אין הרשאת כתיבה למאגר. בדקו שנבחרה הרשאת Contents: Read and write.';
    if (e && e.message === 'decode') return 'לא הצלחנו לקרוא אחת התמונות. נסו קובץ אחר.';
    if (!navigator.onLine) return 'אין חיבור לאינטרנט. נסו שוב כשיש קליטה.';
    return 'השמירה נכשלה. נסו שוב.';
  }
  function paths(list) { var s = {}; list.forEach(function (it) { imgs(it).forEach(function (p) { s[p] = 1; }); }); return s; }

  form.addEventListener('submit', function (e) {
    e.preventDefault(); if (busy) return;
    var title = $('fTitle').value.trim();
    if (!draft.length) { setStatus('צריך להוסיף לפחות תמונה אחת.', true); return; }
    if (!title) { setStatus('צריך לתת שם לעבודה.', true); $('fTitle').focus(); return; }
    var id = editing ? editing.id : newId();
    var fields = { title: title, category: $('fCat').value, wood: $('fWood').value.trim(), size: $('fSize').value.trim(), year: $('fYear').value.replace(/[^\d]/g, ''), description: $('fDesc').value.trim() };
    var fresh = draft.filter(function (d) { return d.file; }), done = 0;
    setBusy(true);
    var stamp = Date.now().toString(36);
    var prep = fresh.reduce(function (p, d, k) {
      return p.then(function (acc) {
        setStatus(fresh.length > 1 ? 'מכין תמונה ' + (++done) + ' מתוך ' + fresh.length + '…' : 'מכין את התמונה…');
        return toJpeg(d.file).catch(function (err) { if (/^image\/(jpeg|png|webp|gif)$/.test(d.file.type)) return d.file; throw err; })
          .then(toBase64).then(function (b64) {
            d.path = 'images/works/' + id + '-' + stamp + '-' + (k + 1) + '.jpg';
            acc.push({ path: d.path, base64: b64 }); return acc;
          });
      });
    }, Promise.resolve([]));
    prep.then(function (files) {
      setStatus('שומר ומפרסם…');
      var imagesNow = draft.map(function (d) { return d.path; });
      return commit((editing ? 'עדכון עבודה: ' : 'עבודה חדשה: ') + title, files, function (latest) {
        var prev = latest.filter(function (x) { return x.id === id; })[0];
        var item = Object.assign({}, prev || {}, fields, { id: id, images: imagesNow });
        if (!imagesNow.some(function (p) { return p.indexOf('images/samples/') === 0; })) delete item.sample;
        var next = prev ? latest.map(function (x) { return x.id === id ? item : x; }) : [item].concat(latest);
        var keep = paths(next);
        var remove = prev ? imgs(prev).filter(function (p) { return !keep[p]; }) : [];
        return { items: next, remove: remove };
      });
    }).then(function (next) {
      draft.forEach(function (d) { if (d.file) localUrls[d.path] = d.url; });
      items = next; busy = false; setBusy(false); closeAll(); render();
      toast('נשמר! העבודה תופיע לכל המשפחה תוך דקה־שתיים.', 6000);
    }).catch(function (err) { setBusy(false); setStatus(errMsg(err), true); });
  });

  function remove(it) {
    if (busy) return; busy = true;
    dBody.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    commit('מחיקת עבודה: ' + it.title, [], function (latest) {
      var next = latest.filter(function (x) { return x.id !== it.id; });
      var prev = latest.filter(function (x) { return x.id === it.id; })[0];
      var keep = paths(next);
      return { items: next, remove: prev ? imgs(prev).filter(function (p) { return !keep[p]; }) : [] };
    }).then(function (next) {
      items = next; busy = false; closeAll(); render(); toast('העבודה נמחקה.');
    }).catch(function (err) {
      busy = false; dBody.querySelectorAll('button').forEach(function (b) { b.disabled = false; }); toast(errMsg(err), 6000);
    });
  }

  /* ---------- sign in ---------- */
  function signOut() { token = ''; setToken(''); render(); if ($('artist')) renderAbout(); }
  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault(); if (busy) return;
    var st = $('loginStatus'), t = $('fToken').value.trim();
    if (!repo) { setStatus('לא הצלחנו לזהות את המאגר. צריך למלא owner ו־repo בקובץ index.html.', true, st); return; }
    if (!t) { setStatus('הדביקו את מפתח הגישה.', true, st); return; }
    setBusy(true, this); setStatus('בודק את המפתח…', false, st);
    var f = this, prev = token; token = t;
    gh('').then(function (r) {
      if (!r.permissions || !r.permissions.push) { var er = new Error('no push'); er.status = 403; throw er; }
      setToken(t); $('fToken').value = ''; busy = false; setBusy(false, f); closeAll();
      loading.hidden = false; loadAbout(); return load().then(function () { toast('נכנסת למצב עריכה. אפשר להוסיף עבודות.'); });
    }).catch(function (err) { token = prev; busy = false; setBusy(false, f); setStatus(errMsg(err), true, st); });
  });

  /* ---------- events ---------- */
  grid.addEventListener('click', function (e) { if (!e.target.closest('[data-open],.r-desc')) return; var b = e.target.closest('.work'); if (!b) return; var it = items.filter(function (x) { return x.id === b.dataset.id; })[0]; if (it) openDetail(it); });
  chips.addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (!b) return; cat = b.dataset.c; render(); });
  $('fCat').innerHTML = CATS.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
  addBtn.addEventListener('click', function () { openEditor(null); });
  $('loginLink').addEventListener('click', function () { setStatus('', false, $('loginStatus')); login.hidden = false; lock(true); });
  $('logoutLink').addEventListener('click', function () { signOut(); toast('יצאת ממצב עריכה במכשיר הזה.'); });
  dBody.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || !current) return; var a = b.dataset.act;
    if (a === 'prev') go(idx - 1);
    else if (a === 'next') go(idx + 1);
    else if (a === 'go') go(+b.dataset.k);
    else if (a === 'edit') openEditor(current);
    else if (a === 'ask') { $('dConfirm').hidden = false; $('dActs').hidden = true; }
    else if (a === 'keep') { $('dConfirm').hidden = true; $('dActs').hidden = false; }
    else if (a === 'del') remove(current);
  });
  $('photos').addEventListener('click', function (e) {
    if (busy) return;
    var d = e.target.closest('[data-pdel]');
    if (d) { draft.splice(+d.dataset.pdel, 1); renderPhotos(); return; }
    var p = e.target.closest('[data-pk]');
    if (p && +p.dataset.pk > 0) { var m = draft.splice(+p.dataset.pk, 1)[0]; draft.unshift(m); renderPhotos(); }
  });
  $('fImg').addEventListener('change', function () {
    Array.prototype.forEach.call(this.files, function (f) { draft.push({ file: f, url: URL.createObjectURL(f) }); });
    this.value = ''; renderPhotos(); setStatus('');
  });
  [detail, editor, login, $('aboutView'), $('aboutEditor')].forEach(function (o) { o.addEventListener('click', function (e) { if (e.target === o || e.target.closest('[data-close]')) closeAll(); }); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAll();
    else if (!detail.hidden && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) go(idx + (e.key === 'ArrowLeft' ? 1 : -1));
  });

  /* ---------- about the artist ---------- */
  var ABOUT_PATH = 'data/about.json';
  var about = {}, aDraft = null;
  function loadAbout() {
    var p = canEdit()
      ? gh('/contents/' + ABOUT_PATH + '?ref=' + encodeURIComponent(repo.branch), { accept: 'application/vnd.github.raw+json', raw: true })
      : fetch(ABOUT_PATH + '?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); });
    return p.then(function (t) { about = JSON.parse(t) || {}; }).catch(function () { about = {}; }).then(renderAbout);
  }
  function hasAbout() { return !!(about.photo || (about.story || '').trim()); }
  function renderAbout() {
    var sec = $('artist'), photo = $('aPhoto');
    sec.hidden = !hasAbout() && !canEdit();
    if (sec.hidden) return;
    photo.hidden = !about.photo;
    if (about.photo) { photo.src = urlOf(about.photo); photo.dataset.path = about.photo; }
    $('aLead').textContent = hasAbout() ? (about.story || '').replace(/\s*\n+\s*/g, ' ').trim() : 'עוד לא נכתב. לחצו כאן כדי להוסיף תמונה של באבא חיים ואת הסיפור שלו.';
    $('aMore').textContent = hasAbout() ? 'לסיפור המלא ›' : 'הוספה ›';
    $('aCard').classList.toggle('empty', !hasAbout());
  }
  function openAbout() {
    if (!hasAbout()) { if (canEdit()) openAboutEditor(); return; }
    $('avBody').innerHTML = '<div class="d-wrap">' + (about.photo ? '<div class="d-media"><div class="a-big"><img src="' + esc(urlOf(about.photo)) + '" data-path="' + esc(about.photo) + '" alt="באבא חיים"></div></div>' : '') +
      '<div class="d-info"><p class="eyebrow" style="margin:0">האומן</p><h2 id="avTitle">באבא חיים</h2>' +
      (canEdit() ? '<div class="row"><button class="btn" type="button" id="aEditBtn">עריכה</button></div>' : '') +
      '<p class="d-desc">' + esc(about.story || '') + '</p></div></div>';
    $('aboutView').hidden = false; lock(true);
  }
  function renderAPhoto() {
    var box = $('aPhotoBox');
    box.innerHTML = aDraft.url
      ? '<div class="ptile main"><img src="' + esc(aDraft.url) + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block"><button type="button" class="pdel" id="aPhotoDel" aria-label="הסרת התמונה">×</button></div>'
      : '<label class="padd" for="aImg"><b>+</b><span>הוספת תמונה</span></label>';
  }
  function openAboutEditor() {
    aDraft = { path: about.photo || '', url: about.photo ? urlOf(about.photo) : '', file: null };
    $('aStory').value = about.story || ''; $('aImg').value = '';
    renderAPhoto(); setStatus('', false, $('aStatus'));
    $('aboutView').hidden = true; $('aboutEditor').hidden = false; lock(true);
  }
  $('aCard').addEventListener('click', openAbout);
  $('avBody').addEventListener('click', function (e) { if (e.target.closest('#aEditBtn')) openAboutEditor(); });
  $('aPhotoBox').addEventListener('click', function (e) { if (busy) return; if (e.target.closest('#aPhotoDel')) { aDraft = { path: '', url: '', file: null }; renderAPhoto(); } });
  $('aImg').addEventListener('change', function () { var f = this.files[0]; if (!f) return; aDraft = { file: f, url: URL.createObjectURL(f), path: '' }; this.value = ''; renderAPhoto(); });
  $('aboutForm').addEventListener('submit', function (e) {
    e.preventDefault(); if (busy) return;
    var f = this, st = $('aStatus'), story = $('aStory').value.trim();
    if (!story && !aDraft.url) { setStatus('הוסיפו תמונה או כתבו את הסיפור.', true, st); return; }
    setBusy(true, f); setStatus(aDraft.file ? 'מכין את התמונה…' : 'שומר ומפרסם…', false, st);
    var prep = aDraft.file
      ? toJpeg(aDraft.file).catch(function (err) { if (/^image\/(jpeg|png|webp|gif)$/.test(aDraft.file.type)) return aDraft.file; throw err; }).then(toBase64).then(function (b64) {
          aDraft.path = 'images/about/haim-' + Date.now().toString(36) + '.jpg'; return [{ path: aDraft.path, base64: b64 }];
        })
      : Promise.resolve([]);
    prep.then(function (files) {
      setStatus('שומר ומפרסם…', false, st);
      return commit('עדכון הסיפור של באבא חיים', files, function (latest) {
        var old = latest.photo || '';
        var data = Object.assign({}, latest, { photo: aDraft.path || '', story: story });
        return { data: data, remove: old && old !== data.photo && old.indexOf('images/about/') === 0 ? [old] : [] };
      }, ABOUT_PATH);
    }).then(function (data) {
      if (aDraft.file) localUrls[aDraft.path] = aDraft.url;
      about = data; busy = false; setBusy(false, f); closeAll(); renderAbout();
      toast('נשמר! הסיפור יתעדכן לכל המשפחה תוך דקה־שתיים.', 6000);
    }).catch(function (err) { busy = false; setBusy(false, f); setStatus(errMsg(err), true, st); });
  });

  render();
  load();
  loadAbout();
})();

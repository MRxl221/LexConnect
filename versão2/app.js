/* Lex Connect - utilitários compartilhados
   Autenticação simulada no navegador (localStorage). Para produção, troque por um backend real. */
const LC = {
  /* ---------- Usuários e sessão ---------- */
  users() { try { return JSON.parse(localStorage.getItem('lc_users') || '[]'); } catch { return []; } },
  saveUsers(list) { localStorage.setItem('lc_users', JSON.stringify(list)); },
  session() { try { return JSON.parse(localStorage.getItem('lc_session') || 'null'); } catch { return null; } },
  setSession(u) { localStorage.setItem('lc_session', JSON.stringify({ id: u.id, nome: u.nome, email: u.email })); },
  logout() { localStorage.removeItem('lc_session'); location.href = 'login.html'; },
  requireAuth() {
    if (!this.session()) {
      const next = location.pathname.split('/').pop() + location.search;
      location.href = 'login.html?next=' + encodeURIComponent(next);
      return false;
    }
    return true;
  },
  async hash(text) {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 0; for (const c of text) h = (h * 31 + c.charCodeAt(0)) | 0; return 'x' + h;
  },

  /* ---------- Solicitações ---------- */
  requests() { try { return JSON.parse(localStorage.getItem('lc_requests') || '[]'); } catch { return []; } },
  saveRequests(list) { localStorage.setItem('lc_requests', JSON.stringify(list)); },

  /* ---------- Utilidades ---------- */
  esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  initials(name) { return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase(); },
  km(lat1, lon1, lat2, lon2) {
    const R = 6371, rad = d => d * Math.PI / 180;
    const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  },
  fmtDist(km) { return km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1).replace('.', ',') + ' km'; },
  toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2800);
  },
  showMsg(el, text, type = 'err') { el.className = 'msg ' + type; el.textContent = text; },

  /* ---------- Navegação (injetada em <header id="nav">) ---------- */
  renderNav(active) {
    const s = this.session();
    const link = (href, label, key) => `<a href="${href}" class="${active === key ? 'active' : ''}">${label}</a>`;
    const links = s
      ? link('advogados.html', 'Advogados', 'advogados') +
        link('solicitacoes.html', 'Minhas solicitações', 'solicitacoes') +
        `<span class="nav-user">Olá, ${this.esc(s.nome.split(' ')[0])}</span>` +
        `<button class="btn btn-ghost btn-sm" id="btn-logout">Sair</button>`
      : link('login.html', 'Entrar', 'login') +
        `<a href="cadastro.html" class="btn btn-gold btn-sm">Criar conta</a>`;
    const el = document.getElementById('nav');
    el.className = 'nav';
    el.innerHTML = `<div class="container">
      <a class="logo" href="${s ? 'advogados.html' : 'index.html'}"><i>⚖</i>Lex<span>Connect</span></a>
      <nav class="nav-links">${links}</nav></div>`;
    const out = document.getElementById('btn-logout');
    if (out) out.onclick = () => this.logout();
  },

  /* ---------- API: Overpass (OpenStreetMap) e Nominatim ---------- */
  OVERPASS: ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'],
  async overpass(query) {
    let lastErr;
    for (const url of this.OVERPASS) {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(query)
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return await r.json();
      } catch (e) { lastErr = e; }
    }
    throw lastErr;
  },
  normalize(el, origin) {
    const t = el.tags || {};
    const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) return null;
    const addr = [
      [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(', '),
      t['addr:suburb'], t['addr:city'], t['addr:postcode']
    ].filter(Boolean).join(' · ');
    return {
      id: el.type + '-' + el.id,
      nome: t.name || t.operator || 'Escritório de advocacia',
      semNome: !t.name && !t.operator,
      endereco: addr, lat, lon,
      telefone: t.phone || t['contact:phone'] || '',
      site: t.website || t['contact:website'] || '',
      email: t.email || t['contact:email'] || '',
      horario: t.opening_hours || '',
      dist: origin ? this.km(origin.lat, origin.lon, lat, lon) : null
    };
  },
  async searchLawyers(lat, lon, radiusKm) {
    const r = Math.round(radiusKm * 1000);
    const q = `[out:json][timeout:25];(nwr["office"="lawyer"](around:${r},${lat},${lon});nwr["amenity"="lawyer"](around:${r},${lat},${lon}););out center tags 100;`;
    const data = await this.overpass(q);
    return data.elements.map(e => this.normalize(e, { lat, lon })).filter(Boolean).sort((a, b) => a.dist - b.dist);
  },
  async geocode(text) {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=' + encodeURIComponent(text));
    const j = await r.json();
    return j[0] ? { lat: +j[0].lat, lon: +j[0].lon, label: j[0].display_name } : null;
  },
  async reverseGeocode(lat, lon) {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=14&lat=${lat}&lon=${lon}`);
      const j = await r.json();
      const a = j.address || {};
      return [a.suburb || a.neighbourhood, a.city || a.town || a.village, a.state].filter(Boolean).join(', ') || j.display_name || '';
    } catch { return ''; }
  },

  /* Dados fictícios, apenas para demonstração quando a API não retorna nada */
  demoLawyers(lat, lon) {
    const base = [
      ['Silva & Almeida Advocacia', -.006, .004], ['Dra. Camila Duarte', .009, -.005], ['Costa Mendes Advogados', -.012, -.009],
      ['Dr. Rafael Nogueira', .003, .013], ['Martins Lima & Associados', .015, .008], ['Dra. Beatriz Fontes', -.02, .012]
    ];
    return base.map(([nome, dLat, dLon], i) => ({
      id: 'demo-' + i, nome, semNome: false, demo: true,
      endereco: 'Endereço fictício (demonstração)', lat: lat + dLat, lon: lon + dLon,
      telefone: '', site: '', email: '', horario: 'Seg–Sex 09:00–18:00',
      dist: this.km(lat, lon, lat + dLat, lon + dLon)
    })).sort((a, b) => a.dist - b.dist);
  }
};

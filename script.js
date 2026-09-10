/* ============================================================
   LexConnect — script.js
   ============================================================ */

// ── STORAGE (troque DB.add por fetch('/api/...') para backend real) ──
const DB = {
    get: (key) => JSON.parse(localStorage.getItem(key) || '[]'),
    set: (key, data) => localStorage.setItem(key, JSON.stringify(data)),
    add: (key, item) => {
      const list = DB.get(key);
      list.unshift({
        ...item,
        id: Date.now(),
        criado_em: new Date().toLocaleString('pt-BR')
      });
      DB.set(key, list);
    }
  };
  
  // ── TOAST ──
  function toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = (type === 'success' ? '✓ ' : type === 'error' ? '✕ ' : 'ℹ ') + msg;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
  
  // ── MÁSCARA DE TELEFONE ──
  function aplicarMascaraTel(id) {
    const el = document.getElementById(id);
    el.addEventListener('input', () => {
      let v = el.value.replace(/\D/g, '');
      if (v.length > 11) v = v.slice(0, 11);
      if (v.length > 6)      v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
      else if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
      else if (v.length > 0) v = `(${v}`;
      el.value = v;
    });
  }
  
  // ── VALIDAÇÃO ──
  function validate(fields) {
    for (const [label, val] of Object.entries(fields)) {
      if (!val || val.trim() === '') {
        toast(`Preencha o campo: ${label}`, 'error');
        return false;
      }
    }
    return true;
  }
  
  function emailExiste(key, email) {
    return DB.get(key).some(i => i.email.toLowerCase() === email.toLowerCase());
  }
  
  // ── LOADING BUTTON ──
  function setLoading(btnId, on) {
    document.getElementById(btnId).classList.toggle('loading', on);
  }
  
  // ── LIMPAR CAMPOS ──
  function limparCampos(ids) {
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  }
  
  // ── CADASTRAR CLIENTE ──
  function cadastrarCliente() {
    const nome    = document.getElementById('c-nome').value;
    const email   = document.getElementById('c-email').value;
    const tel     = document.getElementById('c-tel').value;
    const cidade  = document.getElementById('c-cidade').value;
    const assunto = document.getElementById('c-assunto').value;
  
    if (!validate({ 'Nome': nome, 'E-mail': email, 'Telefone': tel, 'Cidade': cidade, 'Assunto': assunto })) return;
    if (emailExiste('clientes', email)) {
      toast('Este e-mail já está cadastrado como cliente.', 'error');
      return;
    }
  
    setLoading('btn-client', true);
  
    // Simula latência de API — remova o setTimeout em produção
    setTimeout(() => {
      DB.add('clientes', { nome, email, telefone: tel, cidade, assunto });
      toast(`Bem-vindo(a), ${nome.split(' ')[0]}! Buscando advogados...`);
      limparCampos(['c-nome', 'c-email', 'c-tel', 'c-cidade', 'c-assunto']);
      setLoading('btn-client', false);
      updateCounts();
    }, 1200);
  }
  
  // ── CADASTRAR ADVOGADO ──
  function cadastrarAdvogado() {
    const nome          = document.getElementById('a-nome').value;
    const email         = document.getElementById('a-email').value;
    const tel           = document.getElementById('a-tel').value;
    const cidade        = document.getElementById('a-cidade').value;
    const especialidade = document.getElementById('a-especialidade').value;
  
    if (!validate({ 'Nome': nome, 'E-mail': email, 'Telefone': tel, 'Cidade': cidade, 'Especialidade': especialidade })) return;
    if (emailExiste('advogados', email)) {
      toast('Este e-mail já está cadastrado como advogado.', 'error');
      return;
    }
  
    setLoading('btn-lawyer', true);
  
    setTimeout(() => {
      DB.add('advogados', { nome, email, telefone: tel, cidade, especialidade });
      toast(`Dr(a). ${nome.split(' ')[0]}, perfil criado com sucesso!`);
      limparCampos(['a-nome', 'a-email', 'a-tel', 'a-cidade', 'a-especialidade']);
      setLoading('btn-lawyer', false);
      updateCounts();
    }, 1200);
  }
  
  // ── TROCAR SEÇÃO ──
  function showSection(name) {
    ['register', 'clients', 'lawyers'].forEach(s => {
      document.getElementById(`section-${s}`).style.display = s === name ? 'block' : 'none';
    });
    document.querySelectorAll('.tab-btn').forEach((btn, i) => {
      btn.classList.toggle('active', ['register', 'clients', 'lawyers'][i] === name);
    });
    if (name === 'clients') renderList('clients');
    if (name === 'lawyers') renderList('lawyers');
  }
  
  // ── RENDER LISTA ──
  function renderList(type, query = '') {
    const key  = type === 'clients' ? 'clientes' : 'advogados';
    const grid = document.getElementById(`${type}-grid`);
    let items  = DB.get(key);
  
    if (query) {
      const q = query.toLowerCase();
      items = items.filter(i =>
        i.nome.toLowerCase().includes(q) ||
        i.cidade.toLowerCase().includes(q) ||
        (i.assunto || i.especialidade || '').toLowerCase().includes(q)
      );
    }
  
    grid.innerHTML = '';
  
    if (items.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="icon">${type === 'clients' ? '👤' : '⚖️'}</div>
          <p>${query ? 'Nenhum resultado encontrado.' : 'Nenhum ' + (type === 'clients' ? 'cliente' : 'advogado') + ' cadastrado ainda.'}</p>
        </div>`;
      return;
    }
  
    items.forEach(item => {
      const initials = item.nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
      const tag = item.assunto || item.especialidade || '';
      grid.innerHTML += `
        <div class="card">
          <div class="card-avatar">${initials}</div>
          <div class="card-name">${item.nome}</div>
          <div class="card-info">
            <span>📍 ${item.cidade}</span>
            <span>📱 ${item.telefone}</span>
            <span>✉️ ${item.email}</span>
            <span style="opacity:0.5;font-size:0.75rem">🕐 ${item.criado_em}</span>
          </div>
          ${tag ? `<div class="card-specialty">${tag}</div>` : ''}
        </div>`;
    });
  }
  
  // ── FILTRO DE BUSCA ──
  function filterList(type, q) {
    renderList(type, q);
  }
  
  // ── CONTADOR DOS BADGES ──
  function updateCounts() {
    document.getElementById('client-count').textContent = DB.get('clientes').length + ' cadastrados';
    document.getElementById('lawyer-count').textContent = DB.get('advogados').length + ' cadastrados';
  }
  
  // ── INICIALIZAÇÃO ──
  document.addEventListener('DOMContentLoaded', () => {
    aplicarMascaraTel('c-tel');
    aplicarMascaraTel('a-tel');
    updateCounts();
  });
/* ============================================================
   Cantina SENAI — app.js
   Lógica do app (JavaScript + jQuery).
   - Carrega dados de arquivos JSON (cardapio.json / usuarios.json)
   - Renderiza cardápio, filtros, áreas de acesso e 4 dashboards
   - Login SPA, carrinho/pedidos, quiz de alergias
   - Persistência em localStorage (funciona offline)
   ============================================================ */
(function ($) {
  "use strict";

  /* ============ ESTADO GLOBAL ============ */
  const State = {
    cardapio: null,
    usuarios: null,
    currentUser: null,
    carrinho: [],
    pedidos: [],
    alergias: [],
    prefs: "",
    filtro: "todos",
    estoque: {},
    config: { nomeCantina: "Cantina SENAI", horarios: "Seg–Sex: 7h às 22h" },
    logs: []
  };

  /* ============ PERSISTÊNCIA (localStorage) ============ */
  const LS = {
    get(key, def) {
      try { const v = localStorage.getItem("cantina_" + key); return v === null ? def : JSON.parse(v); }
      catch (e) { return def; }
    },
    set(key, val) { try { localStorage.setItem("cantina_" + key, JSON.stringify(val)); } catch (e) {} }
  };

  /* ============ UTILIDADES ============ */
  const fmt = (v) => "R$ " + Number(v).toFixed(2).replace(".", ",");
  const escapeHtml = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toast = (msg, ms = 2400) => {
    $("#toast").text(msg).removeClass("hidden");
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => $("#toast").addClass("hidden"), ms);
  };
  const log = (acao, detalhe = "") => {
    const entry = { ts: new Date().toISOString(), user: State.currentUser ? State.currentUser.nome : "visitante", papel: State.currentUser ? State.currentUser.papel : "—", acao, detalhe };
    State.logs.unshift(entry);
    State.logs = State.logs.slice(0, 120);
    LS.set("logs", State.logs);
  };
  const papelNome = (id) => { const p = (State.usuarios.papeis || []).find(x => x.id === id); return p ? p.nome : id; };
  const papelObj = (id) => (State.usuarios.papeis || []).find(x => x.id === id) || { icone: "👤", cor: "#6B1220", descricao: "" };
  const catObj = (id) => (State.cardapio.categorias || []).find(c => c.id === id) || { icone: "🍽️", nome: id };
  const itemById = (id) => State.cardapio.itens.find(i => i.id === id);
  const disponivel = (id) => State.estoque[id] !== false; // default true
  const temAlergia = (item) => (item.alergias || []).some(a => State.alergias.includes(a));

  const ALERGENOS = [
    { id: "gluten", nome: "Glúten", icone: "🌾" },
    { id: "leite", nome: "Leite / Lactose", icone: "🥛" },
    { id: "ovo", nome: "Ovo", icone: "🥚" },
    { id: "calabresa", nome: "Calabresa / Embutidos", icone: "🌶️" },
    { id: "frutose", nome: "Frutas", icone: "🍎" },
    { id: "corantes", nome: "Corantes / Açúcar", icone: "🎨" }
  ];

  /* ============ CARREGAR DADOS (JSON) ============ */
  async function carregarDados() {
    try {
      const [r1, r2] = await Promise.all([
        fetch("dados/cardapio.json", { cache: "no-store" }),
        fetch("dados/usuarios.json", { cache: "no-store" })
      ]);
      if (!r1.ok || !r2.ok) throw new Error("HTTP");
      State.cardapio = await r1.json();
      State.usuarios = await r2.json();
    } catch (e) {
      // Fallback embutido (ex.: aberto via file://) — JSON indisponível
      State.cardapio = $.extend(true, {}, window.CARDAPIO_FALLBACK);
      State.usuarios = $.extend(true, {}, window.USUARIOS_FALLBACK);
      console.warn("Dados JSON não puderam ser carregados via fetch; usando fallback embutido.", e);
    }
    // Hidratar estado persistido
    State.pedidos = LS.get("pedidos", []);
    State.alergias = LS.get("alergias", []);
    State.prefs = LS.get("prefs", "");
    State.estoque = LS.get("estoque", {});
    State.config = LS.get("config", { nomeCantina: "Cantina SENAI", horarios: "Seg–Sex: 7h às 22h" });
    State.logs = LS.get("logs", []);
    // Usuários extras criados pelo admin
    const extraUsers = LS.get("usuariosExtra", []);
    State.usuarios.usuarios = (State.usuarios.usuarios || []).concat(extraUsers);
    // Edits de cardápio feitos pelo proprietário
    const editCard = LS.get("cardapioEdit", {});
    State.cardapio.itens = State.cardapio.itens.map(it => editCard[it.id] ? $.extend({}, it, editCard[it.id]) : it);
    const novos = LS.get("cardapioNovos", []);
    State.cardapio.itens = State.cardapio.itens.concat(novos);
    // Sessão (se ainda ativa)
    const sessao = LS.get("sessao", null);
    if (sessao) State.currentUser = (State.usuarios.usuarios || []).find(u => u.id === sessao.id) || null;
  }

  /* ============ RENDER: faixa de categorias ============ */
  function renderCategoriasStrip() {
    const cats = (State.cardapio.categorias || []).slice().sort((a, b) => a.ordem - b.ordem);
    const html = cats.map(c => `
      <button class="flex flex-col items-center gap-1.5 py-4 px-2 hover:bg-cream-dark transition" data-filtro-cat="${c.id}">
        <span class="text-2xl">${c.icone}</span>
        <span class="text-[11px] sm:text-xs font-semibold text-ink-soft smallcaps">${c.nome}</span>
      </button>`).join("");
    $("#categorias-strip > div").html(html);
  }

  /* ============ RENDER: filtros (pills) ============ */
  function renderFiltros() {
    const cats = [{ id: "todos", nome: "Todos", icone: "✦" }]
      .concat((State.cardapio.categorias || []).slice().sort((a, b) => a.ordem - b.ordem));
    const html = cats.map(c => `
      <button class="btn-filtro btn px-4 py-2 rounded-full text-sm font-medium border ${State.filtro === c.id ? "pill-active border-transparent" : "bg-cream-light border-cream-sand text-ink hover:bg-cream-dark"}" data-filtro="${c.id}">
        <span class="mr-1">${c.icone}</span>${c.nome}
      </button>`).join("");
    $("#filtros").html(html);
  }

  /* ============ RENDER: grid de produtos ============ */
  function renderGridProdutos() {
    const itens = State.cardapio.itens.filter(i => State.filtro === "todos" || i.categoria === State.filtro);
    if (!itens.length) {
      $("#grid-produtos").html(`<div class="col-span-full text-center text-ink-soft py-10">Nenhum item nesta categoria.</div>`);
      return;
    }
    const html = itens.map(i => {
      const disp = disponivel(i.id);
      const alerg = temAlergia(i);
      const alergLbl = (i.alergias || []).length
        ? `<span class="inline-flex items-center gap-1 text-[10px] text-ink-soft mt-1">${alerg ? "⚠️ contém: " : "contém: "}${(i.alergias || []).join(", ")}</span>` : "";
      const cat = catObj(i.categoria);
      return `
        <article class="card-hover cursor-pointer bg-cream-light rounded-xl border border-cream-sand overflow-hidden flex flex-col ${alerg ? "alergia-atencao" : ""} ${!disp ? "alergia-bloq" : ""}" data-id="${i.id}" title="Toque para detalhes e observação">
          <div class="relative h-32 sm:h-36 bg-gradient-to-br from-cream-sand to-cream-dark flex items-center justify-center overflow-hidden">
            <span class="text-5xl sm:text-6xl">${i.emoji || cat.icone}</span>
            ${i.imagem ? `<img src="${i.imagem}" alt="${escapeHtml(i.nome)}" class="absolute inset-0 w-full h-full object-cover" loading="lazy" onerror="this.remove()"/>` : ``}
            <span class="absolute top-2 left-2 text-[10px] font-semibold smallcaps text-wine bg-cream-light/80 px-2 py-0.5 rounded-full">${cat.nome}</span>
            <button class="btn-detalhes absolute bottom-2 right-2 bg-ink/60 text-cream-light text-[10px] px-2 py-1 rounded-md hover:bg-ink/80" data-id="${i.id}">Detalhes / Obs</button>
          </div>
          <div class="p-3.5 flex flex-col flex-1">
            <h3 class="font-serif font-bold text-ink text-base leading-snug">${escapeHtml(i.nome)}</h3>
            <p class="text-xs text-ink-soft mt-1 leading-relaxed flex-1">${escapeHtml(i.descricao)}</p>
            ${alergLbl}
            <div class="mt-2 flex items-center gap-2">
              ${disp
                ? `<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-sage-text bg-sage-bg px-2 py-0.5 rounded-full">● Disponível</span>`
                : `<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-brick bg-brick/10 px-2 py-0.5 rounded-full">○ Esgotado</span>`}
            </div>
            <div class="mt-3 flex items-center justify-between">
              <span class="font-serif font-bold text-wine text-lg">${fmt(i.preco)}</span>
              <button class="btn-add btn inline-flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-full border border-wine text-wine hover:bg-wine hover:text-cream-light disabled:opacity-40" data-id="${i.id}" ${!disp ? "disabled" : ""}>
                + Pedir
              </button>
            </div>
          </div>
        </article>`;
    }).join("");
    $("#grid-produtos").html(html);
    // re-ativar stagger
    $("#grid-produtos").removeClass("animata-stagger").addClass("animata-stagger");
  }

  /* ============ RENDER: áreas de acesso ============ */
  function renderAreas() {
    const papeis = State.usuarios.papeis || [];
    // exemplo de credencial para cada papel
    const cred = (pid) => {
      const u = (State.usuarios.usuarios || []).find(x => x.papel === pid);
      return u ? { email: u.email, senha: u.senha } : { email: "—", senha: "—" };
    };
    const html = papeis.map(p => {
      const c = cred(p.id);
      return `
        <button class="area-card card-hover text-left bg-cream-light rounded-xl border border-cream-sand overflow-hidden" data-papel="${p.id}">
          <div class="p-5" style="background:linear-gradient(135deg, ${p.cor}14, transparent)">
            <div class="w-12 h-12 rounded-full flex items-center justify-center text-2xl" style="background:${p.cor}22">${p.icone}</div>
            <h3 class="mt-3 font-serif font-bold text-lg text-ink">${p.nome}</h3>
            <p class="text-xs text-ink-soft mt-1 leading-relaxed">${p.descricao}</p>
          </div>
          <div class="px-5 py-3 bg-cream-dark/60 text-[11px] text-ink-soft border-t border-cream-sand">
            <div>👤 <span class="font-mono">${c.email}</span></div>
            <div>🔑 <span class="font-mono">${c.senha}</span></div>
            <div class="mt-1 text-wine font-semibold">Entrar →</div>
          </div>
        </button>`;
    }).join("");
    $("#grid-areas").html(html);
  }

  /* ============ RENDER: quiz opções ============ */
  function renderQuizOpcoes() {
    const html = ALERGENOS.map(a => `
      <label class="flex items-center gap-2 rounded-xl border border-cream-sand bg-cream-light px-3 py-2 cursor-pointer hover:bg-cream-dark">
        <input type="checkbox" class="quiz-chk accent-wine" value="${a.id}" ${State.alergias.includes(a.id) ? "checked" : ""} />
        <span class="text-lg">${a.icone}</span>
        <span class="text-sm text-ink">${a.nome}</span>
      </label>`).join("");
    $("#quiz-opcoes").html(html);
    $("#quiz-pref").val(State.prefs);
  }

  /* ============ RENDER: carrinho ============ */
  function renderCarrinho() {
    const itens = State.carrinho;
    if (!itens.length) {
      $("#carrinho-conteudo").html(`
        <div class="text-center py-10 text-ink-soft">
          <div class="text-4xl mb-2">🛒</div>
          <p>Seu pedido está vazio.</p>
          <button id="btn-ir-cardapio" class="mt-4 btn bg-wine text-cream-light font-semibold px-4 py-2 rounded-full">Ver cardápio</button>
        </div>`);
      atualizarCount();
      return;
    }
    const linhas = itens.map((it, idx) => `
      <div class="flex items-center gap-3 py-3 border-b border-cream-sand last:border-0">
        <span class="text-2xl">${it.emoji}</span>
        <div class="flex-1 min-w-0">
          <div class="font-semibold text-ink text-sm truncate">${escapeHtml(it.nome)}</div>
          <div class="text-xs text-ink-soft">${fmt(it.preco)}${it.obs ? " • " + escapeHtml(it.obs) : ""}</div>
        </div>
        <div class="flex items-center gap-1.5">
          <button class="btn-qtd btn w-7 h-7 rounded-full bg-cream-dark text-wine font-bold" data-idx="${idx}" data-delta="-1">−</button>
          <span class="w-6 text-center text-sm font-semibold">${it.qtd}</span>
          <button class="btn-qtd btn w-7 h-7 rounded-full bg-cream-dark text-wine font-bold" data-idx="${idx}" data-delta="1">+</button>
        </div>
        <button class="btn-rm btn text-brick text-xs px-2" data-idx="${idx}">remover</button>
      </div>`).join("");

    const subtotal = itens.reduce((s, it) => s + it.preco * it.qtd, 0);
    const taxa = itens.reduce((s, it) => s + 1.5 * it.qtd, 0); // viagem
    const total = subtotal + taxa;

    $("#carrinho-conteudo").html(`
      <div class="divide-y divide-cream-sand">${linhas}</div>
      <div class="mt-4 space-y-1 text-sm">
        <div class="flex justify-between text-ink-soft"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
        <div class="flex justify-between text-ink-soft"><span>Embalagem p/ viagem (R$ 1,50/item)</span><span>${fmt(taxa)}</span></div>
        <div class="flex justify-between font-serif font-bold text-wine text-lg pt-2 border-t border-cream-sand"><span>Total</span><span>${fmt(total)}</span></div>
      </div>
      <div class="mt-4">
        <label class="block text-xs font-semibold text-ink-soft uppercase tracking-wider mb-1">Observação do pedido</label>
        <input id="carrinho-obs-geral" type="text" class="w-full rounded-xl border border-cream-sand bg-cream-light px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-wine/40" placeholder="Ex.: sem maionese, entregar na sala 3…" />
      </div>
      <button id="btn-enviar-pedido" class="btn mt-4 w-full bg-wine hover:bg-wine-dark text-cream-light font-semibold py-3 rounded-xl shadow-soft">
        ${State.currentUser ? "Enviar pedido à cantina" : "Entrar como aluno para enviar"}
      </button>
      <p class="mt-2 text-[11px] text-ink-soft text-center">Seu pedido vai para a fila do funcionário da cantina.</p>
    `);
    atualizarCount();
  }

  function atualizarCount() {
    const n = State.carrinho.reduce((s, it) => s + it.qtd, 0);
    const $c = $("#carrinho-count");
    if (n > 0) { $c.text(n).removeClass("hidden"); } else { $c.addClass("hidden").text(0); }
  }

  /* ============ MODAL: detalhe produto ============ */
  function abrirProduto(id) {
    const i = itemById(id);
    if (!i) return;
    const cat = catObj(i.categoria);
    const disp = disponivel(i.id);
    const alerg = temAlergia(i);
    $("#modal-produto-inner").html(`
      <div class="relative h-44 bg-gradient-to-br from-cream-sand to-cream-dark flex items-center justify-center overflow-hidden">
        <span class="text-7xl">${i.emoji || cat.icone}</span>
        ${i.imagem ? `<img src="${i.imagem}" alt="${escapeHtml(i.nome)}" class="absolute inset-0 w-full h-full object-cover"/>` : ``}
        <button id="btn-fechar-produto" class="absolute top-3 right-3 bg-ink/60 text-cream-light w-8 h-8 rounded-full text-xl leading-none">×</button>
        <span class="absolute top-3 left-3 text-[11px] font-semibold smallcaps text-wine bg-cream-light/90 px-2 py-0.5 rounded-full">${cat.nome}</span>
      </div>
      <div class="p-5">
        <h3 class="font-serif font-bold text-2xl text-ink">${escapeHtml(i.nome)}</h3>
        <p class="mt-2 text-ink-soft text-sm leading-relaxed">${escapeHtml(i.descricao)}</p>
        ${(i.alergias || []).length ? `<div class="mt-3 text-xs ${alerg ? "text-brick" : "text-ink-soft"} bg-${alerg ? "brick/10" : "cream-dark"} rounded-lg px-3 py-2">⚠️ Contém: ${(i.alergias || []).join(", ")}</div>` : `<div class="mt-3 text-xs text-sage-text bg-sage-bg rounded-lg px-3 py-2">✓ Sem alérgenos cadastrados</div>`}
        <div class="mt-4">
          <label class="block text-xs font-semibold text-ink-soft uppercase tracking-wider mb-1">Observação deste item</label>
          <input id="produto-obs" type="text" class="w-full rounded-xl border border-cream-sand bg-cream-light px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-wine/40" placeholder="Ex.: quero sem cebola, tenho alergia a ovo…" />
          <p class="mt-1 text-[11px] text-ink-soft">A observação vai junto do seu pedido para a cozinha. 😊</p>
        </div>
        <div class="mt-4 flex items-center justify-between">
          <span class="font-serif font-bold text-wine text-2xl">${fmt(i.preco)}</span>
          ${disp ? `<button class="btn-add-modal btn bg-wine hover:bg-wine-dark text-cream-light font-semibold px-4 py-2 rounded-full" data-id="${i.id}">+ Adicionar ao pedido</button>` : `<span class="text-brick font-semibold">Item esgotado</span>`}
        </div>
      </div>`);
    $("#modal-produto").removeClass("hidden").find(".animata-scale");
  }

  /* ============ AÇÕES: carrinho ============ */
  function addCarrinho(id, obs) {
    const i = itemById(id);
    if (!i || !disponivel(id)) return;
    const existente = State.carrinho.find(c => c.id === id && c.obs === (obs || ""));
    if (existente) { existente.qtd++; } else {
      State.carrinho.push({ id: i.id, nome: i.nome, preco: i.preco, qtd: 1, obs: obs || "", emoji: i.emoji || catObj(i.categoria).icone });
    }
    renderCarrinho();
    toast(`"${i.nome}" adicionado ao pedido`);
    log("adicionou item", i.nome);
  }
  function altQtd(idx, delta) {
    const it = State.carrinho[idx];
    if (!it) return;
    it.qtd += delta;
    if (it.qtd <= 0) State.carrinho.splice(idx, 1);
    renderCarrinho();
  }
  function rmCarrinho(idx) { State.carrinho.splice(idx, 1); renderCarrinho(); }

  /* ============ AÇÕES: pedido ============ */
  function enviarPedido(obsGeral) {
    if (!State.carrinho.length) { toast("Pedido vazio."); return; }
    if (!State.currentUser || State.currentUser.papel !== "aluno") {
      toast("Faça login como aluno para enviar o pedido.");
      abrirLogin("aluno");
      return;
    }
    const subtotal = State.carrinho.reduce((s, it) => s + it.preco * it.qtd, 0);
    const taxa = State.carrinho.reduce((s, it) => s + 1.5 * it.qtd, 0);
    const num = (State.pedidos.length + 1).toString().padStart(4, "0");
    const pedido = {
      id: "PED-" + num,
      usuarioId: State.currentUser.id,
      usuarioNome: State.currentUser.nome,
      turma: State.currentUser.turma || "",
      itens: State.carrinho.map(c => $.extend({}, c)),
      subtotal, taxaViagem: taxa, total: subtotal + taxa,
      obs: obsGeral || "",
      status: "Recebido",
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };
    State.pedidos.unshift(pedido);
    LS.set("pedidos", State.pedidos);
    State.carrinho = [];
    renderCarrinho();
    $("#modal-carrinho").addClass("hidden");
    log("enviou pedido", pedido.id + " (" + pedido.itens.length + " itens, " + fmt(pedido.total) + ")");
    toast("✅ Pedido " + pedido.id + " enviado à cantina!");
    if (State.currentUser && State.currentUser.papel === "aluno") renderPainel();
  }

  /* ============ LOGIN ============ */
  let _loginPapel = "aluno";
  function abrirLogin(papel) {
    _loginPapel = papel;
    const p = papelObj(papel);
    const u = (State.usuarios.usuarios || []).find(x => x.papel === papel);
    $("#login-icone").text(p.icone);
    $("#login-titulo").text("Área do " + p.nome);
    $("#login-desc").text(p.descricao);
    $("#login-email").val(u ? u.email : "");
    $("#login-senha").val("");
    $("#login-erro").addClass("hidden");
    $("#login-dica").html(u ? `Credencial de demonstração: <strong>${u.email}</strong> / senha <strong>${u.senha}</strong>` : "Use uma credencial válida.");
    $("#modal-login").removeClass("hidden");
    setTimeout(() => $("#login-senha").focus(), 100);
  }
  function fecharLogin() { $("#modal-login").addClass("hidden"); }
  function tentarLogin(email, senha) {
    const u = (State.usuarios.usuarios || []).find(x =>
      x.email.toLowerCase() === email.trim().toLowerCase() && x.senha === senha && x.papel === _loginPapel);
    if (!u) {
      const $err = $("#login-erro").removeClass("hidden");
      $("#modal-login .animata-scale").addClass("animata-shake");
      setTimeout(() => $("#modal-login .animata-scale").removeClass("animata-shake"), 500);
      $err.text("E-mail ou senha incorretos para a área de " + papelNome(_loginPapel) + ".");
      return false;
    }
    State.currentUser = u;
    LS.set("sessao", { id: u.id });
    fecharLogin();
    log("login", u.papel + " — " + u.nome);
    toast("Bem-vindo(a), " + u.nome.split(" ")[0] + "!");
    mostrarPainel();
    return true;
  }
  function logout() {
    log("logout", State.currentUser ? State.currentUser.papel : "");
    State.currentUser = null;
    LS.set("sessao", null);
    $("#painel-logado").addClass("hidden");
    toast("Você saiu.");
  }
  function mostrarPainel() {
    if (!State.currentUser) return;
    const p = papelObj(State.currentUser.papel);
    $("#painel-icone").text(p.icone);
    $("#painel-titulo").text("Área do " + p.nome);
    $("#painel-usuario").text(State.currentUser.nome + (State.currentUser.turma ? " • " + State.currentUser.turma : State.currentUser.cargo ? " • " + State.currentUser.cargo : ""));
    $("#painel-logado").removeClass("hidden");
    renderPainel();
    $("html, body").animate({ scrollTop: $("#painel-logado").offset().top - 80 }, 400);
  }

  /* ============ PAINEL: dispatcher ============ */
  function renderPainel() {
    if (!State.currentUser) return;
    const r = State.currentUser.papel;
    let html = "";
    if (r === "aluno") html = painelAluno();
    else if (r === "funcionario") html = painelFuncionario();
    else if (r === "proprietario") html = painelProprietario();
    else if (r === "administrador") html = painelAdministrador();
    $("#painel-conteudo").html(html);
  }

  /* ============ PAINEL: ALUNO ============ */
  function painelAluno() {
    const meus = State.pedidos.filter(p => p.usuarioId === State.currentUser.id);
    const statusCor = { "Recebido": "bg-brick/15 text-brick", "Em preparo": "bg-gold/20 text-ink", "Pronto": "bg-sage-bg text-sage-text", "Entregue": "bg-cream-dark text-ink-soft", "Cancelado": "bg-ink/10 text-ink-soft" };
    const tbl = meus.length ? `
      <div class="overflow-x-auto rounded-xl border border-cream-sand">
      <table class="w-full text-sm">
        <thead class="bg-cream-dark text-ink-soft text-xs uppercase tracking-wider">
          <tr><th class="text-left px-3 py-2">Pedido</th><th class="text-left px-3 py-2">Itens</th><th class="text-right px-3 py-2">Total</th><th class="text-center px-3 py-2">Status</th><th class="text-left px-3 py-2">Horário</th></tr>
        </thead>
        <tbody class="divide-y divide-cream-sand">
          ${meus.map(p => `
            <tr>
              <td class="px-3 py-2 font-mono text-wine font-semibold">${p.id}</td>
              <td class="px-3 py-2 text-ink-soft">${p.itens.map(i => i.qtd + "× " + i.nome).join(", ")}</td>
              <td class="px-3 py-2 text-right font-semibold">${fmt(p.total)}</td>
              <td class="px-3 py-2 text-center"><span class="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusCor[p.status] || ""}">${p.status}</span></td>
              <td class="px-3 py-2 text-ink-soft text-xs">${new Date(p.criadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
            </tr>`).join("")}
        </tbody>
      </table></div>` : `<div class="text-center text-ink-soft py-8 bg-cream-dark/50 rounded-xl">Você ainda não fez pedidos.</div>`;

    const alergiasOn = State.alergias.length
      ? `<span class="text-sage-text font-semibold">${State.alergias.join(", ")}</span>`
      : `<span class="text-ink-soft">nenhuma restrição marcada</span>`;

    return `
      <div class="grid sm:grid-cols-3 gap-3 mb-6">
        <div class="bg-cream-dark/60 rounded-xl p-4"><div class="text-xs text-ink-soft uppercase tracking-wider">Pedidos feitos</div><div class="font-serif text-2xl font-bold text-wine">${meus.length}</div></div>
        <div class="bg-cream-dark/60 rounded-xl p-4"><div class="text-xs text-ink-soft uppercase tracking-wider">Em andamento</div><div class="font-serif text-2xl font-bold text-wine">${meus.filter(p => p.status !== "Entregue" && p.status !== "Cancelado").length}</div></div>
        <div class="bg-cream-dark/60 rounded-xl p-4"><div class="text-xs text-ink-soft uppercase tracking-wider">Total gasto</div><div class="font-serif text-2xl font-bold text-wine">${fmt(meus.reduce((s, p) => s + p.total, 0))}</div></div>
      </div>
      <div class="flex flex-wrap gap-3 mb-6">
        <a href="#cardapio" class="btn bg-wine text-cream-light font-semibold px-4 py-2 rounded-full">Ver cardápio</a>
        <button id="btn-aluno-quiz" class="btn bg-cream-light border border-cream-sand text-ink font-semibold px-4 py-2 rounded-full">🧪 Quiz de alergias</button>
        <button id="btn-aluno-carrinho" class="btn bg-cream-light border border-cream-sand text-ink font-semibold px-4 py-2 rounded-full">🛒 Meu pedido</button>
      </div>
      <p class="text-sm text-ink-soft mb-4">Suas restrições ativas: ${alergiasOn}.</p>
      <h3 class="font-serif font-bold text-lg text-ink mb-3">Meus pedidos</h3>
      ${tbl}
      <p class="mt-4 text-xs text-ink-soft">O status é atualizado pela cantina em tempo real. Fique de olho em “Pronto” para buscar no balcão.</p>
    `;
  }

  /* ============ PAINEL: FUNCIONÁRIO ============ */
  const STATUS_FLOW = ["Recebido", "Em preparo", "Pronto", "Entregue"];
  function painelFuncionario() {
    const ativos = State.pedidos.filter(p => p.status !== "Entregue" && p.status !== "Cancelado");
    const fila = ativos.length ? ativos.map(p => `
      <div class="kanban-card bg-cream-light border border-cream-sand rounded-xl p-4" data-id="${p.id}">
        <div class="flex items-center justify-between">
          <span class="font-mono font-bold text-wine">${p.id}</span>
          <span class="text-xs text-ink-soft">${new Date(p.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <div class="text-xs text-ink-soft mt-0.5">${escapeHtml(p.usuarioNome)}${p.turma ? " • " + escapeHtml(p.turma) : ""}</div>
        <ul class="mt-2 space-y-1 text-sm">
          ${p.itens.map(i => `<li class="flex justify-between"><span>${i.emoji} ${i.qtd}× ${escapeHtml(i.nome)}</span><span class="text-ink-soft">${fmt(i.preco * i.qtd)}</span></li>`).join("")}
        </ul>
        ${p.obs ? `<div class="mt-2 text-xs text-brick bg-brick/10 rounded px-2 py-1">📝 ${escapeHtml(p.obs)}</div>` : ""}
        <div class="mt-3 flex items-center justify-between">
          <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusBg(p.status)}">${p.status}</span>
          <div class="flex gap-2">
            ${p.status !== "Entregue" ? `<button class="btn-avancar btn bg-wine text-cream-light text-xs font-semibold px-3 py-1.5 rounded-full" data-id="${p.id}">Avançar →</button>` : ""}
            ${p.status === "Recebido" ? `<button class="btn-cancelar btn bg-brick/10 text-brick text-xs font-semibold px-3 py-1.5 rounded-full" data-id="${p.id}">Cancelar</button>` : ""}
          </div>
        </div>
      </div>`).join("") : `<div class="text-center text-ink-soft py-10 bg-cream-dark/50 rounded-xl">Nenhum pedido na fila no momento. 🎉</div>`;

    // Controle de estoque (disponibilidade)
    const cats = (State.cardapio.categorias || []).slice().sort((a, b) => a.ordem - b.ordem);
    const estoqueHtml = cats.map(c => {
      const itens = State.cardapio.itens.filter(i => i.categoria === c.id);
      if (!itens.length) return "";
      const lista = itens.map(i => `
        <label class="flex items-center justify-between py-1.5 border-b border-cream-sand last:border-0">
          <span class="text-sm text-ink truncate">${i.emoji} ${escapeHtml(i.nome)}</span>
          <input type="checkbox" class="chk-estoque accent-wine" data-id="${i.id}" ${disponivel(i.id) ? "checked" : ""} />
        </label>`).join("");
      return `<details class="bg-cream-light rounded-xl border border-cream-sand mb-2"><summary class="px-4 py-3 font-semibold text-ink flex items-center justify-between"><span>${c.icone} ${c.nome}</span><span class="text-xs text-ink-soft">${itens.length} itens ▾</span></summary><div class="px-4 pb-3">${lista}</div></details>`;
    }).join("");

    return `
      <div class="grid sm:grid-cols-3 gap-3 mb-6">
        <div class="bg-cream-dark/60 rounded-xl p-4"><div class="text-xs text-ink-soft uppercase tracking-wider">Na fila agora</div><div class="font-serif text-2xl font-bold text-wine">${ativos.length}</div></div>
        <div class="bg-cream-dark/60 rounded-xl p-4"><div class="text-xs text-ink-soft uppercase tracking-wider">Prontos p/ entregar</div><div class="font-serif text-2xl font-bold text-sage-text">${ativos.filter(p => p.status === "Pronto").length}</div></div>
        <div class="bg-cream-dark/60 rounded-xl p-4"><div class="text-xs text-ink-soft uppercase tracking-wider">Entregues hoje</div><div class="font-serif text-2xl font-bold text-ink">${hojeEntregues()}</div></div>
      </div>
      <h3 class="font-serif font-bold text-lg text-ink mb-3">Fila de pedidos</h3>
      <div class="grid sm:grid-cols-2 gap-3 mb-8">${fila}</div>
      <h3 class="font-serif font-bold text-lg text-ink mb-3">Disponibilidade dos itens</h3>
      <p class="text-sm text-ink-soft mb-3">Desmarque um item quando ele esgotar — ele some do cardápio do aluno automaticamente.</p>
      <div>${estoqueHtml}</div>
    `;
  }
  function statusBg(s) {
    return { "Recebido": "bg-brick/15 text-brick", "Em preparo": "bg-gold/20 text-ink", "Pronto": "bg-sage-bg text-sage-text", "Entregue": "bg-cream-dark text-ink-soft", "Cancelado": "bg-ink/10 text-ink-soft" }[s] || "bg-cream-dark text-ink-soft";
  }
  function hojeEntregues() {
    const hoje = new Date().toDateString();
    return State.pedidos.filter(p => p.status === "Entregue" && new Date(p.atualizadoEm).toDateString() === hoje).length;
  }
  function avancarStatus(id) {
    const p = State.pedidos.find(x => x.id === id);
    if (!p) return;
    const idx = STATUS_FLOW.indexOf(p.status);
    if (idx >= 0 && idx < STATUS_FLOW.length - 1) {
      p.status = STATUS_FLOW[idx + 1];
      p.atualizadoEm = new Date().toISOString();
      LS.set("pedidos", State.pedidos);
      log("avançou pedido", id + " → " + p.status);
      toast(p.id + " → " + p.status);
      renderPainel();
    }
  }
  function cancelarPedido(id) {
    const p = State.pedidos.find(x => x.id === id);
    if (!p) return;
    p.status = "Cancelado";
    p.atualizadoEm = new Date().toISOString();
    LS.set("pedidos", State.pedidos);
    log("cancelou pedido", id);
    toast(p.id + " cancelado.");
    renderPainel();
  }
  function toggleEstoque(id, val) {
    State.estoque[id] = val;
    LS.set("estoque", State.estoque);
    log(val ? "reativou item" : "esgotou item", (itemById(id) || {}).nome || id);
    renderGridProdutos();
  }

  /* ============ PAINEL: PROPRIETÁRIO ============ */
  function painelProprietario() {
    const todos = State.pedidos;
    const faturamento = todos.filter(p => p.status !== "Cancelado").reduce((s, p) => s + p.total, 0);
    const hoje = new Date().toDateString();
    const pedidosHoje = todos.filter(p => new Date(p.criadoEm).toDateString() === hoje).length;
    const validos = todos.filter(p => p.status !== "Cancelado");
    const ticket = validos.length ? faturamento / validos.length : 0;

    // item mais vendido
    const vendas = {};
    todos.filter(p => p.status !== "Cancelado").forEach(p => p.itens.forEach(i => { vendas[i.id] = vendas[i.id] || { nome: i.nome, emoji: i.emoji, qtd: 0, receita: 0 }; vendas[i.id].qtd += i.qtd; vendas[i.id].receita += i.preco * i.qtd; }));
    const ranking = Object.values(vendas).sort((a, b) => b.qtd - a.qtd);
    const topItem = ranking[0];

    const rankingHtml = ranking.slice(0, 8).map((r, i) => `
      <tr>
        <td class="px-3 py-2 text-ink-soft">${i + 1}º</td>
        <td class="px-3 py-2">${r.emoji} ${escapeHtml(r.nome)}</td>
        <td class="px-3 py-2 text-center font-semibold text-wine">${r.qtd}</td>
        <td class="px-3 py-2 text-right">${fmt(r.receita)}</td>
      </tr>`).join("") || `<tr><td colspan="4" class="text-center text-ink-soft py-6">Sem vendas ainda.</td></tr>`;

    // CRUD cardápio
    const cats = (State.cardapio.categorias || []).slice().sort((a, b) => a.ordem - b.ordem);
    const cardapioLista = cats.map(c => {
      const itens = State.cardapio.itens.filter(i => i.categoria === c.id);
      if (!itens.length) return "";
      const linhas = itens.map(i => `
        <div class="flex items-center gap-2 py-1.5 border-b border-cream-sand last:border-0">
          <span class="text-lg">${i.emoji}</span>
          <input class="edit-nome input-mini flex-1" data-id="${i.id}" value="${escapeHtml(i.nome)}" />
          <input class="edit-preco input-mini w-24 text-right" data-id="${i.id}" value="${i.preco.toFixed(2).replace(".", ",")}" />
          <button class="btn-salvar-item btn text-xs text-wine font-semibold px-2" data-id="${i.id}">salvar</button>
          <button class="btn-remover-item btn text-xs text-brick px-2" data-id="${i.id}">×</button>
        </div>`).join("");
      return `<details class="bg-cream-light rounded-xl border border-cream-sand mb-2"><summary class="px-4 py-3 font-semibold text-ink flex items-center justify-between"><span>${c.icone} ${c.nome}</span><span class="text-xs text-ink-soft">${itens.length} ▾</span></summary><div class="px-4 pb-3">${linhas}</div></details>`;
    }).join("");

    return `
      <div class="grid sm:grid-cols-4 gap-3 mb-6">
        <div class="bg-cream-dark/60 rounded-xl p-4"><div class="text-xs text-ink-soft uppercase tracking-wider">Faturamento</div><div class="font-serif text-xl font-bold text-wine">${fmt(faturamento)}</div></div>
        <div class="bg-cream-dark/60 rounded-xl p-4"><div class="text-xs text-ink-soft uppercase tracking-wider">Pedidos hoje</div><div class="font-serif text-xl font-bold text-wine">${pedidosHoje}</div></div>
        <div class="bg-cream-dark/60 rounded-xl p-4"><div class="text-xs text-ink-soft uppercase tracking-wider">Ticket médio</div><div class="font-serif text-xl font-bold text-wine">${fmt(ticket)}</div></div>
        <div class="bg-cream-dark/60 rounded-xl p-4"><div class="text-xs text-ink-soft uppercase tracking-wider">Mais vendido</div><div class="font-serif text-sm font-bold text-ink leading-tight">${topItem ? topItem.emoji + " " + escapeHtml(topItem.nome) : "—"}</div></div>
      </div>

      <h3 class="font-serif font-bold text-lg text-ink mb-3">Ranking de vendas</h3>
      <div class="overflow-x-auto rounded-xl border border-cream-sand mb-8">
        <table class="w-full text-sm">
          <thead class="bg-cream-dark text-ink-soft text-xs uppercase tracking-wider"><tr><th class="text-left px-3 py-2">#</th><th class="text-left px-3 py-2">Item</th><th class="text-center px-3 py-2">Qtd</th><th class="text-right px-3 py-2">Receita</th></tr></thead>
          <tbody class="divide-y divide-cream-sand">${rankingHtml}</tbody>
        </table>
      </div>

      <div class="flex items-center justify-between mb-3">
        <h3 class="font-serif font-bold text-lg text-ink">Gerenciar cardápio</h3>
        <button id="btn-novo-item" class="btn bg-wine text-cream-light text-sm font-semibold px-3 py-1.5 rounded-full">+ Novo item</button>
      </div>
      <p class="text-sm text-ink-soft mb-3">Edite nome/preço, salve ou remova. As alterações aparecem para o aluno imediatamente.</p>
      <div>${cardapioLista}</div>
    `;
  }
  function salvarItemEdit(id, nome, preco) {
    const editCard = LS.get("cardapioEdit", {});
    editCard[id] = { nome, preco };
    LS.set("cardapioEdit", editCard);
    const i = itemById(id);
    if (i) { i.nome = nome; i.preco = preco; }
    log("editou item", id + " → " + nome + " / " + fmt(preco));
    toast("Item atualizado.");
    renderGridProdutos();
    renderAreas();
  }
  function removerItem(id) {
    // marca como removido via editCard
    const editCard = LS.get("cardapioEdit", {});
    editCard[id] = editCard[id] || {};
    editCard[id].removido = true;
    LS.set("cardapioEdit", editCard);
    State.cardapio.itens = State.cardapio.itens.filter(i => i.id !== id);
    log("removeu item", id);
    toast("Item removido do cardápio.");
    renderPainel();
    renderGridProdutos();
  }
  function novoItem() {
    const nome = prompt("Nome do novo item:");
    if (!nome) return;
    const precoStr = prompt("Preço (ex.: 12.50):");
    const preco = parseFloat(precoStr.replace(",", "."));
    if (isNaN(preco)) { toast("Preço inválido."); return; }
    const cats = (State.cardapio.categorias || []).map(c => c.id + " - " + c.nome).join("\n");
    const catId = prompt("Categoria (escolha):\n" + cats);
    if (!catId || !State.cardapio.categorias.find(c => c.id === catId)) { toast("Categoria inválida."); return; }
    const emoji = prompt("Emoji (ex.: 🍔):") || "🍽️";
    const desc = prompt("Descrição curta:") || "";
    const id = "n" + Date.now().toString(36);
    const item = { id, categoria: catId, nome, preco, descricao: desc, emoji, alergias: [] };
    State.cardapio.itens.push(item);
    const novos = LS.get("cardapioNovos", []);
    novos.push(item);
    LS.set("cardapioNovos", novos);
    log("criou item", id + " → " + nome);
    toast("Item adicionado!");
    renderPainel();
    renderGridProdutos();
  }

  /* ============ PAINEL: ADMINISTRADOR ============ */
  function painelAdministrador() {
    const users = State.usuarios.usuarios || [];
    const porPapel = (pid) => users.filter(u => u.papel === pid).length;
    const usersTbl = users.map(u => `
      <tr>
        <td class="px-3 py-2"><div class="font-semibold text-ink">${escapeHtml(u.nome)}</div><div class="text-xs text-ink-soft">${u.email}</div></td>
        <td class="px-3 py-2"><span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style="background:${papelObj(u.papel).cor}22;color:${papelObj(u.papel).cor}">${papelObj(u.papel).icone} ${papelNome(u.papel)}</span></td>
        <td class="px-3 py-2 text-ink-soft text-xs">${escapeHtml(u.turma || u.cargo || "—")}</td>
        <td class="px-3 py-2 text-center"><button class="btn-del-user btn text-brick text-xs px-2" data-id="${u.id}">remover</button></td>
      </tr>`).join("");

    const logsHtml = State.logs.slice(0, 12).map(l => `
      <li class="flex gap-2 py-1.5 border-b border-cream-sand last:border-0">
        <span class="text-xs text-ink-soft shrink-0 w-32">${new Date(l.ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
        <span class="text-xs"><strong class="text-wine">${escapeHtml(l.papel)}</strong> ${escapeHtml(l.acao)} ${l.detalhe ? "<span class='text-ink-soft'>• " + escapeHtml(l.detalhe) + "</span>" : ""}</span>
      </li>`).join("") || `<li class="text-ink-soft py-4 text-center text-sm">Nenhum log ainda.</li>`;

    return `
      <div class="grid sm:grid-cols-4 gap-3 mb-6">
        <div class="bg-cream-dark/60 rounded-xl p-4"><div class="text-xs text-ink-soft uppercase tracking-wider">Alunos</div><div class="font-serif text-2xl font-bold text-wine">${porPapel("aluno")}</div></div>
        <div class="bg-cream-dark/60 rounded-xl p-4"><div class="text-xs text-ink-soft uppercase tracking-wider">Funcionários</div><div class="font-serif text-2xl font-bold text-wine">${porPapel("funcionario")}</div></div>
        <div class="bg-cream-dark/60 rounded-xl p-4"><div class="text-xs text-ink-soft uppercase tracking-wider">Proprietários</div><div class="font-serif text-2xl font-bold text-wine">${porPapel("proprietario")}</div></div>
        <div class="bg-cream-dark/60 rounded-xl p-4"><div class="text-xs text-ink-soft uppercase tracking-wider">Admins</div><div class="font-serif text-2xl font-bold text-wine">${porPapel("administrador")}</div></div>
      </div>

      <div class="flex items-center justify-between mb-3">
        <h3 class="font-serif font-bold text-lg text-ink">Usuários</h3>
        <button id="btn-novo-user" class="btn bg-wine text-cream-light text-sm font-semibold px-3 py-1.5 rounded-full">+ Novo usuário</button>
      </div>
      <div class="overflow-x-auto rounded-xl border border-cream-sand mb-8">
        <table class="w-full text-sm">
          <thead class="bg-cream-dark text-ink-soft text-xs uppercase tracking-wider"><tr><th class="text-left px-3 py-2">Usuário</th><th class="text-left px-3 py-2">Papel</th><th class="text-left px-3 py-2">Turma/Cargo</th><th class="text-center px-3 py-2">Ação</th></tr></thead>
          <tbody class="divide-y divide-cream-sand">${usersTbl}</tbody>
        </table>
      </div>

      <h3 class="font-serif font-bold text-lg text-ink mb-3">Configurações</h3>
      <div class="grid sm:grid-cols-2 gap-3 mb-8">
        <label class="block"><span class="text-xs font-semibold text-ink-soft uppercase tracking-wider">Nome da cantina</span>
          <input id="cfg-nome" class="w-full mt-1 rounded-xl border border-cream-sand bg-cream-light px-4 py-2 text-sm" value="${escapeHtml(State.config.nomeCantina)}" />
        </label>
        <label class="block"><span class="text-xs font-semibold text-ink-soft uppercase tracking-wider">Horário de funcionamento</span>
          <input id="cfg-horarios" class="w-full mt-1 rounded-xl border border-cream-sand bg-cream-light px-4 py-2 text-sm" value="${escapeHtml(State.config.horarios)}" />
        </label>
        <div class="sm:col-span-2"><button id="btn-salvar-cfg" class="btn bg-wine text-cream-light font-semibold px-4 py-2 rounded-full">Salvar configurações</button></div>
      </div>

      <h3 class="font-serif font-bold text-lg text-ink mb-3">Logs de atividade</h3>
      <ul class="bg-cream-light rounded-xl border border-cream-sand px-4">${logsHtml}</ul>
      <button id="btn-limpar-logs" class="mt-3 btn text-xs text-brick underline">limpar logs</button>
    `;
  }
  function novoUsuario() {
    const nome = prompt("Nome completo:");
    if (!nome) return;
    const papeis = (State.usuarios.papeis || []).map(p => p.id + " - " + p.nome).join("\n");
    const papel = prompt("Papel:\n" + papeis);
    if (!papel || !papelObj(papel).id) { toast("Papel inválido."); return; }
    const email = prompt("E-mail (ex.: nome@senai):") || (nome.split(" ")[0].toLowerCase() + "@senai");
    const senha = prompt("Senha:") || "123";
    const extra = prompt(papel === "aluno" ? "Turma:" : "Cargo:") || "";
    const id = "u" + Date.now().toString(36);
    const u = { id, papel, nome, email, senha };
    if (papel === "aluno") u.turma = extra; else u.cargo = extra;
    const extras = LS.get("usuariosExtra", []);
    extras.push(u);
    LS.set("usuariosExtra", extras);
    State.usuarios.usuarios.push(u);
    log("criou usuário", nome + " (" + papel + ")");
    toast("Usuário criado!");
    renderPainel();
  }
  function removerUsuario(id) {
    if (!confirm("Remover este usuário?")) return;
    State.usuarios.usuarios = State.usuarios.usuarios.filter(u => u.id !== id);
    let extras = LS.get("usuariosExtra", []);
    extras = extras.filter(u => u.id !== id);
    LS.set("usuariosExtra", extras);
    log("removeu usuário", id);
    toast("Usuário removido.");
    renderPainel();
  }

  /* ============ EVENTOS ============ */
  function registrarEventos() {
    // Filtros
    $(document).on("click", ".btn-filtro", function () {
      State.filtro = $(this).data("filtro");
      renderFiltros(); renderGridProdutos();
      $("html, body").animate({ scrollTop: $("#grid-produtos").offset().top - 90 }, 300);
    });
    $(document).on("click", "[data-filtro-cat]", function () {
      State.filtro = $(this).data("filtro-cat");
      renderFiltros(); renderGridProdutos();
      $("html, body").animate({ scrollTop: $("#cardapio").offset().top - 70 }, 300);
    });

    // Detalhe / adicionar
    // Clique em qualquer parte do card abre o detalhe com campo de observação
    $(document).on("click", "#grid-produtos article[data-id]", function (e) {
      abrirProduto($(this).data("id"));
    });
    $(document).on("click", ".btn-detalhes", function (e) { e.stopPropagation(); abrirProduto($(this).data("id")); });
    $(document).on("click", ".btn-add", function (e) {
      e.stopPropagation(); // não abrir o modal ao adicionar rápido
      if (!disponivel($(this).data("id"))) return;
      addCarrinho($(this).data("id"), "");
    });
    $(document).on("click", ".btn-add-modal", function () {
      const obs = $("#produto-obs").val();
      addCarrinho($(this).data("id"), obs);
      $("#modal-produto").addClass("hidden");
    });
    $(document).on("click", "#btn-fechar-produto", () => $("#modal-produto").addClass("hidden"));
    $("#modal-produto").on("click", function (e) { if (e.target === this) $(this).addClass("hidden"); });

    // Carrinho
    $("#btn-carrinho").on("click", () => { renderCarrinho(); $("#modal-carrinho").removeClass("hidden"); });
    $("#btn-fechar-carrinho").on("click", () => $("#modal-carrinho").addClass("hidden"));
    $("#modal-carrinho").on("click", function (e) { if (e.target === this) $(this).addClass("hidden"); });
    $(document).on("click", "#btn-ir-cardapio", () => { $("#modal-carrinho").addClass("hidden"); $("html, body").animate({ scrollTop: $("#cardapio").offset().top - 70 }, 300); });
    $(document).on("click", ".btn-qtd", function () { altQtd(parseInt($(this).data("idx"), 10), parseInt($(this).data("delta"), 10)); });
    $(document).on("click", ".btn-rm", function () { rmCarrinho(parseInt($(this).data("idx"), 10)); });
    $(document).on("click", "#btn-enviar-pedido", function () {
      if ($(this).text().indexOf("Entrar") !== -1) { abrirLogin("aluno"); return; }
      const obs = $("#carrinho-obs-geral").val() || "";
      enviarPedido(obs);
    });

    // Quiz
    $("#btn-abrir-quiz").on("click", () => { renderQuizOpcoes(); $("#modal-quiz").removeClass("hidden"); });
    $("#btn-fechar-quiz").on("click", () => $("#modal-quiz").addClass("hidden"));
    $("#modal-quiz").on("click", function (e) { if (e.target === this) $(this).addClass("hidden"); });
    $("#form-quiz").on("submit", function (e) {
      e.preventDefault();
      State.alergias = $(".quiz-chk:checked").map(function () { return $(this).val(); }).get();
      State.prefs = $("#quiz-pref").val() || "";
      LS.set("alergias", State.alergias);
      LS.set("prefs", State.prefs);
      $("#modal-quiz").addClass("hidden");
      atualizarAlertaAlergia();
      renderGridProdutos();
      log("salvou alergias", State.alergias.join(", ") || "nenhuma");
      toast(State.alergias.length ? "Preferências salvas. Itens marcados em vermelho." : "Sem restrições. Cardápio completo liberado.");
    });
    $("#limpar-alergias").on("click", () => {
      State.alergias = []; State.prefs = "";
      LS.set("alergias", []); LS.set("prefs", "");
      atualizarAlertaAlergia(); renderGridProdutos();
    });

    // Áreas / login
    $(document).on("click", ".area-card", function () { abrirLogin($(this).data("papel")); });
    $(".btn-login-fechar").on("click", fecharLogin);
    $("#modal-login").on("click", function (e) { if (e.target === this) fecharLogin(); });
    $("#form-login").on("submit", function (e) {
      e.preventDefault();
      tentarLogin($("#login-email").val(), $("#login-senha").val());
    });
    $("#btn-logout").on("click", logout);

    // Mobile menu
    $("#btn-menu-mobile").on("click", () => $("#menu-mobile").toggleClass("hidden"));
    $("#menu-mobile a").on("click", () => $("#menu-mobile").addClass("hidden"));

    // Nav active state
    $(document).on("click", "[data-nav]", function () {
      $("[data-nav]").removeClass("pill-active").addClass("text-ink");
      $(this).addClass("pill-active");
    });

    // Dashboards — delegação
    $(document).on("click", "#btn-aluno-quiz", () => { renderQuizOpcoes(); $("#modal-quiz").removeClass("hidden"); });
    $(document).on("click", "#btn-aluno-carrinho", () => { renderCarrinho(); $("#modal-carrinho").removeClass("hidden"); });
    $(document).on("click", ".btn-avancar", function () { avancarStatus($(this).data("id")); });
    $(document).on("click", ".btn-cancelar", function () { cancelarPedido($(this).data("id")); });
    $(document).on("change", ".chk-estoque", function () { toggleEstoque($(this).data("id"), $(this).prop("checked")); });
    $(document).on("click", ".btn-salvar-item", function () {
      const id = $(this).data("id");
      const nome = $(".edit-nome[data-id='" + id + "']").val();
      const preco = parseFloat($(".edit-preco[data-id='" + id + "']").val().replace(",", "."));
      if (isNaN(preco)) { toast("Preço inválido."); return; }
      salvarItemEdit(id, nome, preco);
    });
    $(document).on("click", ".btn-remover-item", function () { if (confirm("Remover este item do cardápio?")) removerItem($(this).data("id")); });
    $(document).on("click", "#btn-novo-item", novoItem);
    $(document).on("click", "#btn-novo-user", novoUsuario);
    $(document).on("click", ".btn-del-user", function () { removerUsuario($(this).data("id")); });
    $(document).on("click", "#btn-salvar-cfg", function () {
      State.config.nomeCantina = $("#cfg-nome").val();
      State.config.horarios = $("#cfg-horarios").val();
      LS.set("config", State.config);
      log("atualizou configurações", State.config.nomeCantina);
      toast("Configurações salvas.");
    });
    $(document).on("click", "#btn-limpar-logs", function () { if (confirm("Limpar todos os logs?")) { State.logs = []; LS.set("logs", []); renderPainel(); } });

    // Instalar app
    $("[id^='btn-instalar']").on("click", function () {
      if (window._deferredPrompt) {
        window._deferredPrompt.prompt();
        window._deferredPrompt.userChoice.then(() => { window._deferredPrompt = null; });
      } else {
        toast("Para instalar: no Chrome/Edge Android toque no menu (⋮) → “Adicionar à tela inicial”. No iOS use Compartilhar → “Adicionar à Tela de Início”.");
      }
    });
  }

  function atualizarAlertaAlergia() {
    if (State.alergias.length) {
      $("#alerta-alergia-txt").text("Filtrando para alergias: " + State.alergias.join(", ") + (State.prefs ? " • " + State.prefs : "") + ". Itens com esses alérgenos estão destacados em vermelho.");
      $("#alerta-alergia").removeClass("hidden");
    } else {
      $("#alerta-alergia").addClass("hidden");
    }
  }

  /* ============ PWA: instalar + service worker ============ */
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    window._deferredPrompt = e;
    $("#btn-instalar").removeClass("hidden");
  });
  function registrarSW() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch((err) => console.warn("SW falhou:", err));
      });
    }
  }

  /* ============ RENDER TUDO ============ */
  function renderTudo() {
    $("#ano").text(new Date().getFullYear());
    if (!State.cardapio.itens.length) {
      $("#grid-produtos").html(`<div class="col-span-full text-center text-brick py-10">Não foi possível carregar o cardápio. Verifique se o app está sendo servido por HTTP ou abra via servidor local.</div>`);
      return;
    }
    renderCategoriasStrip();
    renderFiltros();
    renderGridProdutos();
    renderAreas();
    atualizarAlertaAlergia();
    // observações do cardápio
    const obs = (State.cardapio.observacoes || []).map(o => `<div>• ${escapeHtml(o)}</div>`).join("");
    $("#obs-cardapio").html("<strong class='text-ink-soft'>Observações:</strong>" + obs);
    // se sessão ativa
    if (State.currentUser) mostrarPainel();
  }

  /* ============ INIT ============ */
  $(async () => {
    await carregarDados();
    renderTudo();
    registrarEventos();
    registrarSW();
  });

})(jQuery);

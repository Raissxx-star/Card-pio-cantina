# Cantina SENAI — Pratos &amp; Lanches • App (PWA / APK)

Cardápio digital da **Cantina SENAI** com pedidos online, quiz de alergias e **4 áreas de acesso** (Aluno, Funcionário, Proprietário, Administrador). É um **PWA** (app web progressivo): funciona **offline** e pode ser **instalado como app** no celular — inclusive empacotado como **APK** para Android.

## 🎨 Identidade visual

Inspirado nas cores das primeiras fotos enviadas (Cantina SENAI) e no layout da inspiração japonesa:

| Cor | Hex | Uso |
|---|---|---|
| Bordô / Vinho | `#6B1220` | Cor principal (títulos, botões, preços) |
| Vinho escuro | `#5C1A1B` | Footer, anúncio |
| Vinho claro | `#8E1F2F` | Eyebrows, destaques |
| Creme | `#FAF5E8` | Fundo geral |
| Creme claro | `#FDFBF7` | Cards |
| Areia | `#E8D5C4` | Bordas, seções suaves |
| Vermelho vivo | `#C0272D` | Botão "Instalar App" |
| Verde sálvia | `#E4F0E2` / `#4A7C59` | Badge "Disponível" |
| Dourado | `#D9A441` | Detalhes, ícones |

Tipografia: **Playfair Display** (serifa dos títulos) + **Inter** (corpo). Cantos arredondados, sombras suaves, eyebrow labels, faixa de categorias com ícones, footer escuro.

## 🍽️ Cardápio

Apenas comida e lanche, em **6 categorias**: Salgados, Lanches, Refeições, Saladas, Frutas e Bebidas. (A categoria Matinais foi removida; os pães passaram a integrar a seção Lanches.) Os dados estão em `dados/cardapio.json`.

## 🛠️ Tecnologias usadas (todas da lista permitida)

| Linguagem | Onde |
|---|---|
| **JavaScript** | `app.js` — toda a lógica (login, carrinho, pedidos, dashboards) |
| **JSON** | `dados/cardapio.json`, `dados/usuarios.json`, `manifest.json` |
| **Tailwind CSS** | Estilização (CDN, sem build) — `index.html` |
| **jQuery** | Manipulação de DOM e eventos — `app.js` |
| **Animata.css** | `animata.css` — animações próprias (fade, float, marquee, pulse) |

As linguagens **React**, **React Native** e **Vue.js** da lista foram **não usadas** neste projeto: para um PWA instalável sem etapa de build (requisito para empacotamento simples em APK), o conjunto JavaScript + Tailwind + jQuery + Animata.css + JSON é mais direto e suficiente.

## 👥 4 Áreas de Acesso (credenciais de demonstração)

| Área | Usuário | Senha | O que faz |
|---|---|---|---|
| 🎓 Aluno | `aluno@senai` | `aluno` | Vê cardápio, faz pedidos, responde ao quiz de alergias, acompanha status |
| 👩‍🍳 Funcionário | `func@senai` | `func` | Recebe a fila de pedidos, avança status, controla disponibilidade dos itens |
| 🏢 Proprietário | `dono@senai` | `dono` | Faturamento, ranking de vendas, CRUD do cardápio (preço/nome/criar/remover) |
| 🛡️ Administrador | `admin@senai` | `admin` | Gestão de usuários, configurações do sistema e logs de atividade |

Os pedidos feitos pelo Aluno aparecem na fila do Funcionário em tempo real; o Proprietário vê as vendas; o Administrador vê os logs. Tudo persiste no `localStorage` do aparelho (funciona offline).

## 📦 Estrutura de arquivos

```
cantina-senai/
├── index.html          # App principal (HTML + Tailwind config)
├── app.js              # Lógica (JavaScript + jQuery)
├── animata.css         # Animações (Animata.css)
├── manifest.json       # Manifesto PWA (instalação / APK)
├── sw.js               # Service worker (offline)
├── dados/
│   ├── cardapio.json   # Menu (7 categorias, ~60 itens)
│   └── usuarios.json   # Usuários das 4 áreas
├── icones/             # Ícones do app (192, 512, maskable, favicon)
└── README.md           # Este arquivo
```

## 🚀 Como rodar localmente

O app precisa ser servido por **HTTP** (não `file://`) para o service worker e o `fetch` dos JSON funcionarem.

```bash
# Na pasta do app:
python3 -m http.server 8080
# Abra: http://localhost:8080/
```

Ou use qualquer servidor estático: `npx serve`, Live Server (VS Code), etc.

## 📲 Instalar como app no celular (PWA)

### Android (Chrome / Edge)
1. Abra a URL do app no navegador.
2. Toque no botão **“Instalar App”** (no topo) ou no menu **⋮ → “Adicionar à tela inicial”**.
3. Confirme. O ícone da Cantina aparece como um app nativo e abre em tela cheia, funcionando offline.

### iOS (Safari)
1. Abra a URL no Safari.
2. Toque em **Compartilhar → “Adicionar à Tela de Início”**.
3. Confirme. O app aparece com ícone próprio.

## 🤖 Converter em APK (Android Package)

O PWA já é instalável. Para gerar um **arquivo `.apk`** instalável diretamente (sem passar pelo navegador), use o **PWABuilder** (gratuito, da Microsoft):

### Passo a passo
1. **Publique o app online** em qualquer hospedagem estática gratuita:
   - **GitHub Pages**: suba a pasta `cantina-senai/` num repositório e ative Pages.
   - **Netlify** ou **Vercel**: arraste a pasta no painel (drag & drop).
   - Exemplo de URL final: `https://seu-usuario.github.io/cantina-senai/`
2. Acesse **[https://www.pwabuilder.com/](https://www.pwabuilder.com/)**.
3. Cole a URL publicada e clique em **Start**.
4. O PWABuilder avalia o PWA. No card **Android**, clique em **Generate Package**.
5. Preencha:
   - **Package ID**: `br.senai.cantina` (ou similar).
   - **App name**: Cantina SENAI.
   - **Signing key**: crie uma nova (ou use a padrão).
6. Clique em **Generate** e baixe o `.apk` (e o `.aab` para loja).
7. No Android, ative **“Fontes desconhecidas”** (Configurações → Segurança) e instale o `.apk`.

### Alternativa: Bubblewrap (linha de comando, Google)
```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://seu-usuario.github.io/cantina-senai/manifest.json
bubblewrap build
# gera app-release-signed.apk
```

> O APK gerado é um **TWA** (Trusted Web Activity): o app abre o PWA em tela cheia, sem a barra do navegador, com ícone próprio — visualmente idêntico a um app nativo.

## 🔒 Observações

- Os dados (pedidos, usuários criados, edições de cardápio, alergias) ficam **no próprio aparelho** (`localStorage`). Limpe os dados do navegador para resetar.
- Em produção real, conecte a um backend (Node/PHP + banco) para sincronizar pedidos entre aparelhos. Nesta versão demo, a sincronização ocorre dentro do mesmo aparelho.
- As credenciais acima são de demonstração. Em produção, troque por autenticação real.

---

© Cantina SENAI — Pratos &amp; Lanches. App offline (PWA).

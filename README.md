# Alicerce

**Wireframes de baixa fidelidade, rápidos, offline e sem dependências.**

O **Alicerce** é um PWA de prototipação rápida (estilo rascunho) para estruturar telas e fluxos de aplicativos web e mobile com atrito zero — com toque e pinça no smartphone, com mouse e atalhos no desktop.

> **Por que "Alicerce"?** O alicerce é a fundação de qualquer construção: a base sólida, clara e bem planejada que existe *antes* de levantar as paredes. Em software, é a etapa de estruturar telas, hierarquia e fluxo antes de escrever o código e definir a estética final.

🔗 **App:** <https://magpe-stack.github.io/Alicerce/>
📦 **Código:** <https://github.com/magpe-stack/Alicerce>

---

## Sumário

1. [Recursos](#recursos)
2. [Como usar](#como-usar)
3. [Atalhos de teclado](#atalhos-de-teclado)
4. [Temas e acessibilidade](#temas-e-acessibilidade)
5. [Arquitetura](#arquitetura)
6. [Formato dos arquivos](#formato-dos-arquivos)
7. [Instalação e publicação no GitHub Pages](#publicação-no-github-pages)
8. [Compatibilidade](#compatibilidade)
9. [Privacidade](#privacidade)

---

## Recursos

- **Projetos e telas:** vários projetos, cada um com várias telas (Splash, Home, Menu, Perfil…) em abas. Criar, renomear, duplicar e excluir.
- **Prancheta híbrida:** grade magnética (liga/desliga), moldura **Mobile 360×800** ou **Desktop 1280×800**, zoom (botões, `Ctrl`+roda do mouse, pinça no toque) e rolagem.
- **Edição completa:** arrastar, redimensionar pelas 8 alças, duplicar, excluir, trazer para frente / enviar para trás, editar texto com duplo clique (ou duplo toque), seleção múltipla (`Shift`/`Ctrl`+clique).
- **11 componentes de baixa fidelidade:** Container/Card, Botão, Campo de input, Cabeçalho/Navbar, Menu hambúrguer, Imagem placeholder (caixa com X), Bloco de texto, Lista, Toggle, Checkbox e Divisor. Clique para inserir ou arraste (mouse) para a prancheta.
- **Painel de propriedades:** texto, posição (X/Y), tamanho e estado (ligado/marcado) do elemento selecionado.
- **Desfazer / Refazer** com histórico de até 100 passos, **persistido** junto com o projeto.
- **Autosave** em IndexedDB: nada se perde ao fechar a aba.
- **Exportação:** projeto completo em `.json`, **PNG** (tela atual ou folha com todas as telas) via `<canvas>` nativo e **impressão** limpa de todas as telas (`@media print`).
- **Importação / Backup:** abrir `.alicerce` / `.json`, **Backup Geral** de todos os projetos em um único arquivo e restauração (substituir tudo ou mesclar).
- **Integração com o sistema:** File System Access API, File Handling API (abrir arquivos pelo sistema operacional), Clipboard API, Web Share API, Badging API (contagem de projetos no ícone), Fullscreen API, atalhos do aplicativo e Window Controls Overlay.
- **Offline-first real:** o App Shell inteiro fica em cache pelo Service Worker.
- **4 temas × modo claro/escuro**, com contrastes WCAG auditados.

## Como usar

### Primeiros passos

1. Abra o app (a splash dura 3 segundos). O projeto **Meu primeiro projeto** já vem com uma tela vazia.
2. Insira componentes pela **paleta** (parte inferior no celular, coluna à esquerda no desktop).
3. Arraste para mover, use as alças para redimensionar, toque duas vezes para editar o texto.
4. Use as abas para criar outras telas.
5. Tudo é salvo automaticamente. Use **Exportar** para gerar arquivos.

### Menu (☰)

Abre a gaveta lateral com: **Novo Projeto**, **Meus Projetos**, abrir/salvar arquivo, exportar/importar/compartilhar, imprimir, **Backup Geral**, **Restaurar Backup**, seletor dos 4 temas, modo claro/escuro, tela cheia, **Instalar**, **Sobre**, GitHub e Ajuda.

### Novo Projeto

Pede o **nome** e o **formato inicial** (Mobile ou Desktop). Também é um atalho do aplicativo instalado (clique direito no ícone).

### Meus Projetos

Gerenciador visual para **abrir, renomear, duplicar e excluir** os projetos salvos neste dispositivo. Também é um atalho do aplicativo instalado.

### Salvar e abrir arquivos

- **Salvar no disco** (`Ctrl+S`): grava direto no arquivo via *File System Access API*. Na primeira vez, pede o local; depois, o Alicerce lembra o arquivo e regrava nele. **Salvar como…** (`Ctrl+Shift+S`) escolhe outro arquivo.
- **Abrir** (`Ctrl+O`): abre `.alicerce` ou `.json` (projeto ou backup).
- Em navegadores sem a API, o salvar vira **download** e o abrir usa o seletor de arquivos padrão — de forma transparente.
- Com o app **instalado**, arquivos `.alicerce` e `.json` podem ser abertos pelo sistema operacional (*File Handling API*).

### Exportar, importar e compartilhar

| Ação | Resultado |
|---|---|
| Projeto (.json) | Todas as telas, coordenadas, dimensões, textos, estilos e metadados |
| PNG — tela atual | Imagem 2× da tela ativa |
| PNG — todas as telas | Uma folha com **todas** as telas e seus nomes |
| Imprimir | Uma tela por página, todas as telas do projeto |
| Compartilhar projeto / PNG | Web Share API (se o navegador não suportar, baixa o arquivo) |

### Backup Geral

**Backup Geral** exporta *todos* os projetos do IndexedDB de uma só vez em um `.json` consolidado. Para restaurar, use **Restaurar Backup…** (ou **Abrir**): você escolhe entre **Substituir tudo** (apaga os atuais) ou **Mesclar** (mantém os atuais e sobrescreve os de mesmo identificador).

### Copiar e colar

`Ctrl+C` / `Ctrl+X` / `Ctrl+V` (ou os botões da barra) copiam elementos para a área de transferência do sistema, em texto. É possível colar em **outra tela**, **outro projeto** ou **outra janela** do Alicerce.

### Instalar

Quando o Chrome permite a instalação, aparece o botão **Instalar** (no cabeçalho e no menu). Ele some automaticamente quando o app já está instalado. O número de projetos aparece no ícone do app (*Badging API*, onde o sistema suporta).

## Atalhos de teclado

| Atalho | Ação |
|---|---|
| `Tab` / `Shift+Tab` | Navegar entre elementos e controles |
| Setas | Mover o elemento selecionado (1 px, ou 10 px com a grade magnética; `Shift` = 10 px) |
| `Alt` + setas | Redimensionar o elemento selecionado |
| `Enter` / `F2` | Editar o texto (`Enter` confirma, `Esc` cancela; em textos multilinha, `Ctrl+Enter` confirma) |
| `Delete` / `Backspace` | Excluir selecionados |
| `Ctrl+D` | Duplicar |
| `Ctrl+C` / `X` / `V` | Copiar / recortar / colar |
| `Ctrl+]` / `Ctrl+[` | Trazer para frente / enviar para trás |
| `Ctrl+A` | Selecionar tudo |
| `Ctrl+Z` / `Ctrl+Y` | Desfazer / refazer (`Ctrl+Shift+Z` também refaz) |
| `Ctrl+S` / `Ctrl+Shift+S` | Salvar / Salvar como |
| `Ctrl+O` | Abrir arquivo |
| `Esc` | Limpar seleção, fechar diálogos e a gaveta |

**Toque:** um dedo arrasta elementos ou rola a prancheta (arrastando no fundo); dois dedos fazem zoom de pinça; toque duplo edita o texto.

## Temas e acessibilidade

Quatro temas exclusivos, combinados com **Modo Claro** (obrigatório ao iniciar, fundo `#FFFFFF`) e **Modo Escuro** (fundo `#10141D`). A escolha é salva no `localStorage`.

| Tema | Harmonia | Cor principal (claro) | Texto sobre a cor |
|---|---|---|---|
| **Original** (padrão) | Análoga | `#29243C` | Branco |
| **Sóbrio** | Monocromática | `#156372` / `#2098AE` | Branco / Preto |
| **Hawaii** | Análoga | `#FF7800` | Preto |
| **Groenlândia** | Análoga | `#002699` / `#007299` | Branco |

Regras aplicadas (laboratório Itten, WCAG 2.1 AA/AAA):

- **Texto branco só sobre fundos escuros** (`#29243C`, `#35243C`, `#002699`, `#156372`, `#703500`…) e **texto preto só sobre fundos claros** (`#FFF700`, `#87FF00`, `#ABE5EF`, `#00A8E0`, `#3BC2DB`, `#2098AE`…).
- No **Modo Escuro**, os destaques usam as cores claras de cada paleta (`#F07DDC`, `#3BC2DB`, `#FFF700`, `#00A8E0`) como fundo de botão com texto preto, e como cor de texto/ícone/borda sobre `#10141D`.
- **Nunca só a cor:** estados ativos usam borda sólida mais espessa, ponto indicador, ícones e sublinhado (útil em protanopia, deuteranopia e tritanopia — especialmente no tema Hawaii).
- Navegação completa por teclado, foco visível, `aria-*`, *skip link*, anúncios por leitor de tela, alvos de toque de 44 px e respeito a `prefers-reduced-motion`.

## Arquitetura

Somente **HTML5, CSS3 e JavaScript (ES6+) puros**: sem frameworks, bibliotecas, CDNs ou fontes externas. Ícones em SVG inline.

```
Alicerce/
├── index.html         Estrutura, sprite SVG, splash, gaveta, diálogos
├── style.css          Layout responsivo, componentes, splash, impressão
├── themes.css         4 temas × claro/escuro (tokens CSS)
├── app.js             Orquestração: projetos, telas, histórico, arquivos, temas, PWA
├── canvas-engine.js   Motor da prancheta: PointerEvents, zoom, PNG, impressão
├── storage.js         Camada IndexedDB (projects, history, meta)
├── sw.js              Service Worker offline-first (Cache API)
├── manifest.json      Web App Manifest (atalhos, file_handlers, WCO)
├── icon-192.png       (já existe na raiz do repositório)
├── icon-512.png       (já existe na raiz do repositório)
└── README.md
```

### Módulos

- **`storage.js`** — `AlicerceStorage`: Promises sobre IndexedDB. *Stores:* `projects` (um registro por projeto), `history` (pilha de desfazer/refazer por projeto) e `meta` (guarda o `FileSystemFileHandle` de cada projeto para regravar no mesmo arquivo).
- **`canvas-engine.js`** — `AlicerceEngine.CanvasEngine`: desenha elementos em DOM, gerencia seleção, arrastar/redimensionar, zoom e pinça com `PointerEvents` (mouse, toque e caneta), teclado e edição de texto. Também renderiza PNG com `<canvas>` 2D e monta a área de impressão.
- **`app.js`** — estado do projeto, histórico por *snapshots* (com agrupamento de ações repetidas, como setas ou digitação), autosave com *debounce*, importação com validação e sanitização, backup, temas, gaveta, diálogos, paleta, instalação e integração com as APIs do Chrome.
- **`sw.js`** — pré-cacheia o App Shell na instalação; navegações respondem do cache (instantâneo e offline) e atualizam em segundo plano; demais arquivos usam *stale-while-revalidate*.

### Atualizando o app em produção

Ao publicar uma nova versão dos arquivos, **incremente `CACHE_VERSION` em `sw.js`**. Assim, o cache antigo é descartado e a nova versão assume.

### Modelo de dados

```jsonc
{
  "id": "uuid",
  "name": "Meu projeto",
  "viewport": "mobile",              // "mobile" (360×800) | "desktop" (1280×800)
  "activeScreenId": "uuid",
  "createdAt": 1700000000000,
  "updatedAt": 1700000000000,
  "version": 1,
  "screens": [
    {
      "id": "uuid",
      "name": "Home",
      "elements": [
        { "id": "uuid", "type": "button", "x": 40, "y": 120, "w": 140, "h": 44,
          "text": "Entrar", "checked": false }
      ]
    }
  ]
}
```

Tipos de elemento: `container`, `button`, `input`, `navbar`, `hamburger`, `image`, `text`, `list`, `toggle`, `checkbox`, `divider`.

## Formato dos arquivos

- **Projeto** (`.alicerce` ou `.json`):
  `{ "app": "alicerce", "kind": "project", "version": 1, "exportedAt": "…", "project": { … } }`
- **Backup Geral** (`.json`):
  `{ "app": "alicerce", "kind": "backup", "version": 1, "exportedAt": "…", "projects": [ { … }, … ] }`

Todo arquivo importado é **validado e sanitizado** (tipos, limites numéricos, tamanhos de texto, identificadores únicos) antes de entrar no banco.

## Publicação no GitHub Pages

1. Coloque todos os arquivos na **raiz** do repositório `magpe-stack/Alicerce`, junto com `icon-192.png` e `icon-512.png`.
2. Em **Settings → Pages**, escolha *Deploy from a branch* → `main` → `/ (root)`.
3. Acesse <https://magpe-stack.github.io/Alicerce/>.

Todos os caminhos são **relativos** (`./`), então funcionam no subcaminho `/Alicerce/` do GitHub Pages. O Service Worker e a instalação exigem **HTTPS** (o GitHub Pages já fornece) ou `localhost`.

Para testar localmente:

```bash
python3 -m http.server 8080
# abra http://localhost:8080
```

## Compatibilidade

Projetado para o **Google Chrome** (desktop e Android) e navegadores baseados em Chromium, usando somente suas APIs nativas:

Service Worker · Cache API · IndexedDB · File System Access API · File Handling API · Clipboard API · Web Share API · Fullscreen API · Badging API · Window Controls Overlay · `beforeinstallprompt` · Pointer Events.

Recursos de integração com o sistema operacional (arquivos, compartilhamento, badge, instalação) dependem do suporte da plataforma; quando indisponíveis, o Alicerce usa o fallback (download/upload padrão) e informa o usuário.

## Privacidade

Tudo acontece **no seu dispositivo**. O Alicerce não envia dados a nenhum servidor, não usa analytics e não carrega recursos externos. Seus projetos ficam no IndexedDB do navegador — faça **Backup Geral** periodicamente, pois limpar os dados do site apaga os projetos.

## Contribuindo

Sugestões e correções são bem-vindas em <https://github.com/magpe-stack/Alicerce>.

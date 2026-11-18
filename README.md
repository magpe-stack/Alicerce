# Alicerce

**A base das interfaces de PWAs: wireframes de baixa fidelidade, rápidos, offline e sem dependências.**

O **Alicerce** é um PWA de prototipação rápida (estilo rascunho) para estruturar telas e fluxos de aplicativos web e mobile com atrito zero — com toque e pinça no smartphone, com mouse e atalhos no desktop.

> **Por que "Alicerce"?** O alicerce é a base sobre a qual tudo se apoia. O Alicerce é um sistema de wireframes para desenhar as **interfaces de PWAs**: estruturar telas, hierarquia e fluxo antes de escrever o código e definir a estética final.

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
- **Visão geral das telas:** o botão de grade na barra de telas abre uma grade de miniaturas de todas as telas. Clique numa miniatura para abri-la; arraste os cartões ou use as setas ◀ ▶ para reordenar (a ordem vale para as abas, o PNG do fluxo e a impressão, e pode ser desfeita). O botão *Exportar fluxo (PNG)* gera a folha com todas as telas.
- **Modelos de tela:** o botão *Nova tela* abre um diálogo com o nome e um ponto de partida: **Em branco**, **Login**, **Cadastro**, **Lista com busca**, **Painel**, **Configurações** e **Perfil**. Cada modelo se adapta à moldura do projeto (Mobile 360×800 ou Desktop 1280×800, com menu lateral no desktop), usa os componentes normais e entra como uma única ação de desfazer. O nome sugerido segue o modelo escolhido, até você digitar o seu.
- **Disposição da interface:** abrir, salvar, exportar, imprimir e compartilhar ficam no cabeçalho, entre *Projetos* e o seletor de tema; a mãozinha e os controles de zoom ficam no centro do rodapé; a barra de ferramentas guarda histórico, prancheta e ferramentas de elemento (a lixeira fica à vista em telas de 1100 px ou mais).
- **Barra flutuante:** ao selecionar elementos, uma barra aparece junto da seleção com cadeado, editar texto, cores, copiar, duplicar, frente, trás, espelhar e excluir. Ela some enquanto você arrasta e volta ao soltar. A barra fixa guarda só histórico, prancheta, camadas, selecionar tudo e colar.
- **Alinhar e distribuir:** com 2 ou mais elementos selecionados, a barra flutuante e o inspetor mostram alinhar (esquerda, centro, direita, topo, meio, base); com 3 ou mais, distribuir na horizontal e na vertical. A referência é a caixa que envolve a seleção; elementos travados contam como referência, mas não se movem.
- **Grupos:** com 2 ou mais elementos selecionados, `Ctrl+G` (ou o botão de agrupar da barra flutuante) cria um grupo. Clicar em um membro seleciona o grupo todo; mover, travar, espelhar, copiar, duplicar e excluir valem para o conjunto, e uma moldura tracejada mostra a área do grupo. Para editar só um membro, use `Alt`+clique ou clique na linha dele na aba Camadas (que mostra um crachá G1, G2…). Ao alinhar e distribuir, cada grupo conta como uma peça. `Ctrl+Shift+G` desfaz. Grupos com menos de 2 elementos deixam de existir. No modelo de dados, os membros compartilham o campo `g`.
- **Guias inteligentes:** ao arrastar ou redimensionar, bordas e centros do elemento encaixam nas bordas e centros dos outros elementos e da própria tela (limite de 6 px na tela), e uma linha rosa mostra o alinhamento. O botão de guias da barra liga e desliga (a escolha é lembrada). As guias têm prioridade sobre a grade magnética quando há um alvo por perto; as setas do teclado não usam guias.
- **Componentes salvos:** selecione elementos (ou um grupo) e use o botão de marcador da barra flutuante, ou *Salvar seleção* na aba **Salvos** da paleta, para guardar o conjunto com um nome. Os componentes salvos valem para todos os projetos do dispositivo, ficam no IndexedDB (chave `alicerce.snippets`), entram no *Backup Geral* e voltam ao restaurar. Para usar, clique ou arraste o item da aba Salvos; o layout, as cores, os cantos e os grupos são preservados, e as cópias entram com ids e grupos novos. Cada item tem botões de renomear e excluir. Limite: 60 componentes, até 200 elementos cada.
- **Prancheta híbrida:** grade magnética (liga/desliga), moldura **Mobile 360×800** ou **Desktop 1280×800**, zoom (botões, `Ctrl`+roda do mouse, pinça no toque) e rolagem.
- **Espelhar e cantos:** Flip horizontal/vertical (`Shift+H`/`Shift+V`) e controle de cantos retos ou arredondados (predefinições, pílula e cantos independentes), com destaque para containers.
- **Edição completa:** arrastar, redimensionar pelas 8 alças, duplicar, excluir, trazer para frente / enviar para trás, editar texto com duplo clique (ou duplo toque), seleção múltipla (`Shift`/`Ctrl`+clique).
- **31 componentes de interface**, em 5 grupos. Clique para inserir ou arraste (mouse) para a prancheta:
  - **Ações:** Botão, Botão de ícone, Botão flutuante (FAB).
  - **Formulários:** Campo de input, Seleção (dropdown), Checkbox, Radio button, Toggle, Slider.
  - **Navegação:** Navbar, Menu hambúrguer, Menu lateral (drawer), Navegação inferior (tab bar), Abas (tabs), Breadcrumb, Barra de rolagem.
  - **Conteúdo e feedback:** Container, Card com imagem, Imagem placeholder, Bloco de texto, Lista, Divisor, Badge/Tag, Chip removível, Tooltip, Barra de progresso, Skeleton, Modal/Diálogo, Toast/Snackbar.
  - **Fluxo e anotações:** Seta de fluxo e Nota adesiva. A seta é reta ao longo do lado maior da caixa (horizontal ou vertical) e vira diagonal de canto a canto quando o lado menor passa de 28 px; *Espelhar* inverte o sentido da ponta. Aceita cor de linha. A nota tem fundo amarelo (editável), texto com quebra de linha e canto dobrado; serve para explicar destinos e comportamentos. Ambas saem no PNG e na impressão.
- **Painel de propriedades:** texto, posição (X/Y), tamanho e estado (ligado/marcado) do elemento selecionado.
- **Ferramenta de cores:** troque o **fundo**, a **borda/linhas** e o **texto** de qualquer elemento (ou de vários de uma vez), com paleta dos 4 temas + neutras, seletor de cor livre e aviso de contraste WCAG. [Detalhes](#cores-dos-elementos)
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
4. Use as abas para criar outras telas (com **+**, escolha um modelo pronto ou comece em branco).
5. Tudo é salvo automaticamente. Use **Exportar** para gerar arquivos.

### Cores dos elementos

Selecione um ou mais elementos e abra **Cores** (ícone de paleta na barra, ou a seção *Cores* do painel de propriedades; no celular, a folha inferior).

1. Escolha onde aplicar: **Fundo**, **Borda** (bordas, linhas e ícones) ou **Texto**.
2. Toque em uma cor da paleta — **Neutras**, **Original**, **Sóbrio**, **Hawaii** ou **Groenlândia** — ou use a **Cor personalizada** (qualquer `#RRGGBB`).
3. **Fundo padrão / Borda padrão / Texto automático** remove a cor e volta ao visual de rascunho.

**Texto automático e contraste:** ao escolher um fundo, o texto passa sozinho para **preto** (fundos claros) ou **branco** (fundos escuros), sempre o de maior contraste. Se você definir manualmente uma cor de texto, o painel mostra a taxa de contraste texto/fundo com nível (**AAA ✓**, **AA ✓**, **só para texto grande ⚠**, **abaixo do mínimo WCAG ✗**) — sempre com texto e símbolo, nunca só cor.

As cores entram em **tudo**: PNG, impressão, `.json`, backup, copiar/colar, duplicar e desfazer/refazer (aplicar uma cor a vários elementos é um único passo de histórico). Cores inválidas em arquivos importados são descartadas.

### Como editar os componentes novos

- **Texto em linhas:** *Abas*, *Breadcrumb*, *Navegação inferior* e *Menu lateral* usam uma linha por item (edite no painel ou com duplo clique). A primeira linha do Menu lateral é o título; o primeiro item de cada um aparece como ativo. *Card*, *Modal* e *Toast* usam a primeira linha como título (ou mensagem) e as seguintes como descrição (no Toast, a 2ª linha é a ação, ex.: "Desfazer").
- **Navegação inferior** é encaixada na base da tela ao ser inserida.
- **Radio button** tem a opção *Selecionado*; **Barra de rolagem** fica horizontal quando a largura passa da altura.
- **Slider**, **Barra de progresso** e **Barra de rolagem** mostram um valor fixo de exemplo (40% ou 60%); com o Flip, o preenchimento vai para o outro lado.
- Cores e cantos funcionam em quase todos; Badge e Chip já nascem em formato de pílula.

### Camadas

A aba **Camadas** (botão de camadas na barra, ou a aba ao lado de *Propriedades*; no celular abre como painel inferior) mostra todos os elementos da tela na ordem de empilhamento: **1 é o primeiro plano** (no topo da lista) e o último número é o fundo. Isso facilita, por exemplo, colocar botões sobre containers ou barras de rolagem sobre outros elementos.

- **Selecionar:** clique na linha para selecionar o elemento (`Shift`/`Ctrl` somam); selecionar na prancheta destaca a linha.
- **Reordenar:** arraste a linha (mouse) ou use as setas para subir/descer uma camada por vez. *Trazer para frente* e *Enviar para trás* da barra continuam funcionando.
- **Ocultar (olho):** esconde o elemento da prancheta, do PNG e da impressão sem excluí-lo; útil para alcançar o que está por baixo.
- **Travar (cadeado):** o mesmo cadeado descrito abaixo, direto na linha.

A ordem e os estados de ocultar/travar são salvos no projeto e entram no desfazer/refazer. Os elementos ocultos não são alcançados pelo retângulo de seleção.

### Selecionar com o mouse e travar elementos

**Seleção por retângulo.** Com o mouse, arraste em uma área vazia da prancheta para desenhar um retângulo: todo elemento tocado por ele é selecionado, ao vivo. Segure `Shift` ou `Ctrl` para somar à seleção atual. Um clique no vazio limpa a seleção. O botão **Selecionar tudo** da barra (ou `Ctrl+A`) seleciona todos os elementos da tela. Para mover a visão da prancheta, use **barra de espaço + arrastar**, o **botão do meio** do mouse, ou arraste com o dedo no toque.

**Mãozinha.** O botão de mão do rodapé, ao lado do zoom (ou a tecla `H`) liga a ferramenta de mover o palco: com ela ativa, arrastar com o botão principal do mouse (ou com o dedo) em qualquer ponto, inclusive sobre elementos, desloca a vista como se você movesse as barras de rolagem. Enquanto a mãozinha está ligada, nada é selecionado, movido ou redimensionado por engano. Desligue-a com o botão ou com `H` para voltar a editar. Alternativas temporárias: segurar `Espaço` ou usar o botão do meio do mouse.

**Cadeado.** Selecione um ou mais elementos e use o botão de cadeado da barra, a caixa *Travar posição e tamanho* do painel de propriedades, ou `Shift+L`. O elemento travado ganha um selo de cadeado e fica fixo no lugar: não move (mouse, setas ou campos X/Y), não redimensiona, não é espelhado e não é excluído por engano. Texto, cores e cantos continuam editáveis. Em uma seleção mista, só os destravados se movem; ao excluir, os travados permanecem. Duplicar ou colar gera cópias destravadas. O estado é salvo no projeto e entra no desfazer/refazer. O selo não aparece no PNG nem na impressão.

### Espelhar e cantos

**Espelhar (Flip).** Selecione um ou mais elementos e use os botões **Espelhar na horizontal** (`Shift+H`) e **Espelhar na vertical** (`Shift+V`) na barra.

- Com vários elementos, o grupo é espelhado em torno do próprio retângulo envolvente: eles trocam de lado, mantendo a composição.
- Cada elemento também é invertido por dentro (ícone do menu, bolinhas da lista, caixa do checkbox, chave do toggle passam para o outro lado; o texto alinha à direita), mas **o texto nunca é escrito de trás para frente**.
- Os raios dos cantos acompanham o espelhamento. O botão fica marcado quando todos os selecionados já estão espelhados; apertar de novo desfaz.

**Cantos retos e arredondados.** Disponível em Container, Botão, Campo de input, Navbar, Menu hambúrguer, Imagem, Bloco de texto e Lista (seção *Cantos* do painel).

1. **Predefinições:** Reto (0), Suave (4), Médio (8), Grande (16) e Pílula (máximo possível, acompanha o tamanho do elemento).
2. **Controle deslizante** de 0 até o máximo do elemento (metade da menor lateral).
3. **Cantos independentes** (um elemento por vez): define separadamente superior esquerdo, superior direito, inferior esquerdo e inferior direito.
4. **Cantos padrão** volta ao visual original de cada tipo.

Como no CSS, raios que somados passam do tamanho do lado são reduzidos proporcionalmente. Tudo vale também para PNG, impressão, `.json`, copiar/colar e desfazer/refazer.

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
| `Shift+H` / `Shift+V` | Espelhar na horizontal / vertical |
| `Shift+L` | Travar / destravar elemento (cadeado) |
| `Ctrl+G` | Agrupar os elementos selecionados |
| `Ctrl+Shift+G` | Desagrupar |
| `Alt`+clique | Selecionar só um elemento dentro de um grupo |
| `H` | Mãozinha: liga/desliga a ferramenta de mover o palco |
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
          "text": "Entrar", "checked": false,
          "fill": "#29243C", "stroke": "", "color": "",    // cores: "#RRGGBB" ou "" (padrão)
          "flipH": false, "flipV": false,
          "hidden": false,        // oculto da prancheta, do PNG e da impressão
          "locked": false,        // cadeado: true impede mover, redimensionar, espelhar e excluir
          "r": null }   // cantos: null (padrão do tipo) ou [sup.esq., sup.dir., inf.dir., inf.esq.] em px, 0–999
      ]
    }
  ]
}
```

Tipos de elemento: `container`, `button`, `input`, `navbar`, `hamburger`, `image`, `text`, `list`, `toggle`, `checkbox`, `divider`, `fab`, `iconbutton`, `select`, `radio`, `slider`, `tabs`, `breadcrumb`, `bottomnav`, `sidebar`, `scrollbar`, `card`, `modal`, `toast`, `badge`, `chip`, `tooltip`, `progress`, `skeleton`.

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

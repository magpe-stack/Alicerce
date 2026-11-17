# Manual do Alicerce

## 1. Conhecendo o Alicerce

O Alicerce é um sistema de wireframe de baixa fidelidade para desenhar as interfaces de PWAs (Progressive Web Apps), e seu lema é "A base das interfaces de PWAs". Ele não gera código nem protótipos clicáveis: serve para pensar a estrutura de cada tela antes de desenhar o visual final.

### Para quem é

- Designers e desenvolvedores que precisam esboçar telas de um PWA com rapidez.
- Equipes que querem discutir a estrutura de um app antes de investir em design de alta fidelidade.
- Estudantes que estão aprendendo a organizar interfaces.

### O que o Alicerce faz

- Oferece 29 componentes de interface em 4 grupos, que você arrasta para a tela.
- Permite mover, redimensionar, espelhar, travar, ocultar e reordenar elementos em camadas.
- Ajusta cores, com verificação de contraste, e o arredondamento dos cantos.
- Gerencia vários projetos, cada um com várias telas, e salva tudo automaticamente no seu dispositivo.
- Exporta telas em PNG, imprime e faz backup do projeto em arquivo JSON.
- Funciona offline depois de instalado e tem 4 temas, cada um nos modos claro e escuro.

### O que o Alicerce não faz

- Não é uma ferramenta de design de alta fidelidade: os componentes são propositalmente simples e sem imagens ou estilos finais.
- Não simula comportamento: botões, menus e abas não respondem a cliques dentro do desenho.
- Não envia seus dados para nenhum servidor. Tudo fica no navegador do seu dispositivo.

### Como este manual está organizado

As seções 2 a 4 ensinam a instalar o app e a organizar projetos e telas. As seções 5 a 11 cobrem a edição, do uso dos componentes ao zoom e ao salvamento. As seções 12 e 13 tratam de exportação, temas e acessibilidade. A seção 14 reúne os atalhos. A seção 15 é um tutorial prático e as seções 16 e 17 trazem soluções de problemas, glossário e histórico de versões. Este manual descreve a versão 1.5.0.

## 2. Instalação e primeiros passos

Você pode usar o Alicerce direto no navegador, sem instalar nada, ou instalá-lo como app para trabalhar offline. O endereço é [magpe-stack.github.io/Alicerce](https://magpe-stack.github.io/Alicerce/).

### Abrir pela primeira vez

1. Acesse o endereço em um navegador moderno (Chrome, Edge, Safari ou Firefox).
2. Aguarde a tela de abertura, que dura cerca de 3 segundos e mostra o lema do app.
3. Na tela de projetos, crie o primeiro projeto com o botão de novo projeto.

### Instalar como app

Instalado, o Alicerce abre em janela própria, tem ícone na tela inicial e funciona sem internet.

- **Chrome ou Edge (computador):** use o ícone de instalação na barra de endereços ou o botão de instalar do próprio Alicerce, quando ele aparecer.
- **Android (Chrome):** abra o menu do navegador e escolha "Instalar app" ou "Adicionar à tela inicial".
- **iPhone e iPad (Safari):** toque em Compartilhar e depois em "Adicionar à Tela de Início".

O botão de instalar depende do navegador. Se ele não aparecer, use o menu do navegador como descrito acima.

### Funcionamento offline

Na primeira visita, o Alicerce guarda seus próprios arquivos no navegador. A partir daí, ele abre mesmo sem conexão. Quando sai uma nova versão, o app se atualiza sozinho na visita seguinte com internet.

### Onde ficam seus dados

Seus projetos ficam no banco de dados do navegador (IndexedDB), neste dispositivo. Eles não vão para a nuvem. Por isso, faça backup em arquivo JSON de projetos importantes (seção 12) e não limpe os dados do site no navegador sem antes exportar.

## 3. Tour pela interface

A tela do Alicerce tem quatro áreas: o cabeçalho no topo, a paleta de componentes, a área de desenho (o palco) no centro e o inspetor, que mostra as propriedades do elemento selecionado. Em telas pequenas, a paleta fica em um menu lateral (botão de menu) e o inspetor abre como uma folha sobre a tela.

### Cabeçalho

| Botão | Para que serve |
| --- | --- |
| Renomear projeto | Troca o nome do projeto atual |
| Novo projeto / Meus projetos | Cria um projeto ou abre a lista de projetos |
| Modo claro/escuro | Alterna a aparência do app |
| Tela cheia | Entra e sai do modo de tela cheia |
| Instalar | Instala o Alicerce como app (aparece só quando o navegador permite) |

### Barra de ferramentas

| Grupo | Botões |
| --- | --- |
| Histórico | Desfazer (Ctrl+Z), Refazer (Ctrl+Y) |
| Visualização | Reduzir e aumentar zoom, Ajustar à janela, Mostrar grade, Grade magnética |
| Moldura | Mobile 360×800 e Desktop 1280×800 |
| Arquivo | Abrir (Ctrl+O), Salvar no disco (Ctrl+S), Exportar/Importar, Imprimir, Compartilhar |
| Elemento | Camadas, Selecionar tudo, Travar, Copiar, Colar, Duplicar, Trazer para frente, Enviar para trás, Editar texto, Espelhar H e V, Cores, Propriedades, Excluir |
| Telas | Nova tela, Renomear, Duplicar, Excluir |

Se a janela for estreita, a barra rola na horizontal. Passe o mouse sobre qualquer botão para ver o nome e o atalho.

### Paleta

A paleta lista os 29 componentes em quatro grupos: Ações, Formulários, Navegação e Conteúdo e feedback. Você arrasta um item para a tela ou o toca para inseri-lo (seção 5).

### Palco

É a moldura da tela que você está desenhando, com grade de fundo opcional. Fora da moldura há espaço vazio para arrastar e selecionar vários elementos.

### Inspetor

O inspetor tem duas abas: **Propriedades** (posição, tamanho, texto, cores, cantos, espelhamento e cadeado) e **Camadas** (ordem de empilhamento). Ele muda conforme o tipo do elemento selecionado.

## 4. Projetos e telas

Um projeto reúne todas as telas de um PWA, e cada tela é um quadro onde você posiciona os componentes. Na primeira abertura, o Alicerce cria sozinho o projeto "Meu primeiro projeto", em moldura Mobile.

### Projetos

1. Toque em **Novo projeto** e informe o nome e a moldura (Mobile 360×800 ou Desktop 1280×800).
2. Abra **Meus projetos** para ver a lista salva neste dispositivo.
3. Em cada projeto da lista, use **Abrir**, **Renomear**, **Duplicar** ou **Excluir**.

Excluir um projeto é definitivo e não pode ser desfeito. Exporte um backup antes (seção 12).

### Telas

Os botões **Nova tela**, **Renomear**, **Duplicar** e **Excluir** ficam na barra de ferramentas, e a tela atual aparece em destaque.

- Use **Duplicar tela** para criar variações de uma mesma tela, como "Login" e "Login com erro".
- Todo projeto precisa ter ao menos uma tela; o Alicerce não deixa excluir a última.
- Excluir uma tela pede confirmação, mas você pode desfazer logo em seguida com Ctrl+Z.

### Moldura Mobile e Desktop

A moldura define o tamanho do quadro: 360×800 para celulares e 1280×800 para computadores. Ela pertence ao projeto e pode ser trocada pelos botões da barra de ferramentas.

## 5. Componentes (os 29 blocos de montar)

A paleta oferece 29 componentes em 4 grupos. Cada um aparece com o tamanho padrão indicado na tabela (largura × altura, em pixels da moldura) e pode ser redimensionado depois.

### Como inserir

- **Arrastar:** segure um item da paleta e solte sobre a tela.
- **Tocar ou clicar:** o componente entra na tela em posição livre.
- **Colar ou duplicar:** copie um elemento existente com Ctrl+C e Ctrl+V, ou use Ctrl+D.

A grade magnética encaixa o elemento nas linhas da grade; desligue o botão de grade magnética para posicionar livremente.

### Catálogo

| Grupo | Componente | Tamanho | Edição de texto |
| --- | --- | --- | --- |
| Ações | Botão | 140×44 | Um rótulo |
| Ações | Botão de ícone | 44×44 | Um símbolo (padrão "+") |
| Ações | Botão flutuante (FAB) | 56×56 | Não tem texto |
| Formulários | Campo de input | 260×44 | Texto de apoio |
| Formulários | Seleção (dropdown) | 260×44 | Texto de apoio |
| Formulários | Checkbox | 180×32 | Rótulo e estado marcado |
| Formulários | Radio button | 180×32 | Rótulo e estado selecionado |
| Formulários | Toggle | 180×32 | Rótulo e estado ativado |
| Formulários | Slider | 240×32 | Não tem texto |
| Navegação | Cabeçalho / Navbar | 360×56 | Título |
| Navegação | Menu hambúrguer | 44×44 | Não tem texto |
| Navegação | Menu lateral (drawer) | 240×400 | Uma linha por item |
| Navegação | Navegação inferior | 360×64 | Uma linha por item |
| Navegação | Abas (tabs) | 320×44 | Uma linha por aba |
| Navegação | Breadcrumb | 300×28 | Uma linha por nível |
| Navegação | Barra de rolagem | 16×200 | Não tem texto |
| Conteúdo e feedback | Container / Card | 300×180 | Opcional |
| Conteúdo e feedback | Card com imagem | 280×240 | Título e descrição, em linhas |
| Conteúdo e feedback | Imagem placeholder | 200×140 | Não tem texto |
| Conteúdo e feedback | Bloco de texto | 260×72 | Texto livre |
| Conteúdo e feedback | Lista | 280×112 | Uma linha por item |
| Conteúdo e feedback | Divisor | 280×12 | Não tem texto |
| Conteúdo e feedback | Badge / Tag | 64×24 | Um rótulo |
| Conteúdo e feedback | Chip removível | 104×32 | Um rótulo |
| Conteúdo e feedback | Tooltip | 160×56 | Texto da dica |
| Conteúdo e feedback | Barra de progresso | 240×16 | Não tem texto |
| Conteúdo e feedback | Skeleton (carregando) | 280×72 | Não tem texto |
| Conteúdo e feedback | Modal / Diálogo | 300×200 | Título e texto, em linhas |
| Conteúdo e feedback | Toast / Snackbar | 300×48 | Mensagem e ação, em linhas |

### Editar o texto

Selecione o elemento e pressione Enter, dê um duplo clique ou use o botão Editar texto. Nos componentes de várias linhas, cada linha vira um item: no menu lateral, a primeira linha é o título; no card, a primeira linha é o título e a segunda a descrição; no toast, a segunda linha é o botão de ação. Em componentes de várias linhas, Enter cria uma nova linha e Ctrl+Enter confirma a edição.

### Estados

Checkbox, radio e toggle têm um estado (marcado, selecionado, ativado) que você altera no inspetor. Isso permite mostrar, na mesma tela, a versão marcada e a desmarcada.

### Componentes que se ajustam sozinhos

A navbar e a navegação inferior ocupam a largura toda da tela. A navegação inferior encaixa na base da moldura quando você a insere.

## 6. Selecionar, mover e redimensionar

Selecionar é o primeiro passo de quase toda edição: o que está selecionado recebe a borda de seleção e é o alvo dos botões da barra de ferramentas e do inspetor.

### Selecionar um elemento

Clique ou toque no elemento. Clicar em uma área vazia tira a seleção.

### Selecionar vários elementos

- **Com o mouse:** arraste em uma área vazia, dentro ou fora da moldura. O retângulo que aparece seleciona todos os elementos que ele toca.
- **Tudo de uma vez:** use Ctrl+A ou o botão Selecionar tudo.
- **Elementos ocultos ou travados:** os ocultos não entram na seleção por retângulo; os travados entram, mas não se movem.

Na tela de toque, arrastar em área vazia move a vista (pan) e não desenha o retângulo. Para arrastar a vista com o mouse, use o botão do meio ou segure a barra de espaço enquanto arrasta.

### Mover

Arraste o elemento, ou use as setas do teclado para mover um passo por vez. Com a grade magnética ligada, o elemento encaixa na grade. Se vários elementos estiverem selecionados, todos se movem juntos.

### Redimensionar

Arraste as alças nos cantos e bordas do elemento selecionado, ou digite os valores de largura e altura no inspetor. Cada componente tem um tamanho mínimo, e o Alicerce não deixa passar dele.

### Copiar, colar, duplicar e excluir

| Ação | Atalho |
| --- | --- |
| Copiar | Ctrl+C |
| Colar | Ctrl+V |
| Duplicar | Ctrl+D |
| Excluir | Delete |

Elementos travados não são excluídos pelo teclado. Destrave-os antes (seção 8).

## 7. Camadas

Camadas definem quem fica na frente de quem quando elementos se sobrepõem, como um botão sobre um container ou uma barra de rolagem sobre uma lista. O painel de camadas mostra essa ordem como uma lista numerada, em que o número 1 é o elemento mais à frente.

### Abrir o painel

Clique em **Camadas** na barra de ferramentas e o inspetor passa para a aba Camadas. Para voltar às propriedades, use o botão Propriedades.

### O que cada linha mostra

Cada linha traz a posição na pilha, o nome do componente com seu texto, e os botões de **olho** (mostrar ou ocultar), **cadeado** (travar ou destravar) e setas para subir ou descer uma posição.

### O que você pode fazer

- **Selecionar:** clique na linha para selecionar o elemento na tela. Isso ajuda a alcançar elementos que estão cobertos por outros.
- **Reordenar:** use as setas de cada linha ou arraste a linha para outra posição.
- **Ocultar:** o olho esconde o elemento na tela, na exportação e na impressão, sem excluí-lo. Ele continua na lista e pode voltar a qualquer momento.
- **Travar:** o cadeado da linha faz o mesmo que o cadeado da barra (seção 8).

### Atalhos de ordem

Ctrl+\] traz o elemento selecionado para a frente de todos e Ctrl+\[ o envia para trás de todos. Os botões Trazer para frente e Enviar para trás da barra fazem o mesmo.

### Dica

Para colocar um botão sobre um container, insira o container primeiro. O último elemento inserido fica na frente. Se o botão ficar escondido, abra as camadas e suba a linha dele.

## 8. Cadeado: travar elementos no lugar

O cadeado impede que um elemento seja movido, redimensionado, espelhado ou excluído por acidente depois de posicionado. Um elemento travado mostra um pequeno cadeado no canto.

### Como travar e destravar

1. Selecione um ou mais elementos.
2. Clique em **Travar** na barra de ferramentas, ou pressione Shift+L.
3. Para destravar, selecione o elemento e repita o comando. Você também pode usar o cadeado da linha no painel de camadas.

O Alicerce avisa com uma mensagem quando você tenta mexer em algo travado. O aviso aparece no máximo uma vez a cada 1,5 segundo, para não atrapalhar.

### O que o cadeado bloqueia

| Ação | Elemento travado |
| --- | --- |
| Arrastar | Bloqueado |
| Redimensionar | Bloqueado |
| Mover com as setas | Bloqueado |
| Espelhar (Flip) | Bloqueado |
| Excluir | Bloqueado |
| Selecionar | Permitido |
| Editar texto, cores e cantos | Permitido |
| Copiar e duplicar | Permitido |

O cadeado protege a posição e o tamanho. Você ainda pode trocar cores e texto de um elemento travado.

### Quando usar

Trave a moldura de fundo, a navbar e a navegação inferior assim que estiverem no lugar. Depois, a edição dos elementos dentro delas fica mais segura, e o retângulo de seleção não move as peças de base.

## 9. Espelhar (Flip) e cantos

Esta seção cobre duas ferramentas de forma: o espelhamento, que vira o elemento, e o ajuste de cantos, que alterna entre quinas retas e arredondadas.

### Espelhar (Flip)

Espelhar vira o elemento como em um espelho, sem mudar a posição nem o tamanho dele. É útil para criar a versão direita de um componente que você desenhou voltado para a esquerda, como uma barra de rolagem ou uma navegação em idioma que se lê da direita para a esquerda.

- **Horizontal:** troca esquerda e direita (Shift+H).
- **Vertical:** troca topo e base (Shift+V).

Os dois botões ficam marcados enquanto o espelhamento estiver ativo. Para desfazer, clique de novo. O espelhamento vale também na exportação PNG e na impressão. Elementos travados não são espelhados.

Em alguns componentes de conteúdo, o texto continua legível quando o elemento é espelhado, como lista, menu lateral, card, modal e tooltip; só a forma e os ícones viram.

### Cantos retos e arredondados

O ajuste de cantos aparece no inspetor para os componentes que têm bordas: container, botão, botão de ícone, campo de input, seleção, bloco de texto, lista, hambúrguer, navbar, navegação inferior, menu lateral, card, imagem, modal, toast, badge, chip e tooltip. Cada tipo tem um arredondamento padrão, que você pode restaurar com o botão **Cantos padrão**.

| Predefinição | Valor |
| --- | --- |
| Reto | 0 px |
| Suave | 4 px |
| Médio | 8 px |
| Grande | 16 px |
| Pílula | Máximo (cantos totalmente redondos) |

1. Selecione o elemento e abra **Propriedades**.
2. Em **Cantos**, escolha uma predefinição ou arraste o controle **Arredondamento** de 0 a 100 px.
3. Para valores maiores, ou para cada quina separada, marque **Cantos independentes** e preencha os quatro campos: superior esquerdo, superior direito, inferior esquerdo e inferior direito.

Uma miniatura no painel mostra o resultado enquanto você ajusta. Se um raio for grande demais para o elemento, o Alicerce o reduz proporcionalmente, de modo que as curvas nunca ultrapassem os lados. Para uma tela de login, por exemplo, use um container com cantos Grandes e um botão Pílula.

## 10. Cores e contraste

Cada elemento tem três cores que você pode trocar: Fundo, Borda e Texto. Sem nenhuma cor aplicada, o elemento usa o tom neutro do tema, o que combina com o propósito de wireframe. Use cor com parcimônia, para destacar o que importa, como um botão principal ou um aviso.

### Aplicar uma cor

1. Selecione um ou mais elementos.
2. Clique em **Cores** na barra, ou abra o inspetor na seção **Cores**.
3. Escolha o alvo: **Fundo**, **Borda** ou **Texto**. Cada alvo mostra seu valor atual, como "padrão" ou "automático".
4. Clique em uma amostra da paleta ou use **Cor personalizada** para escolher qualquer cor.

Com vários elementos selecionados, a cor vale para todos de uma vez.

### Remover uma cor

O botão **Remover cor** devolve o alvo escolhido ao padrão do tema. Para voltar tudo ao padrão, repita o procedimento nos três alvos.

### Texto automático e contraste

Enquanto você não escolher uma cor de texto, o Alicerce escolhe sozinho preto ou branco, o que for mais legível sobre o fundo. Quando há cor de fundo e de texto, o painel mostra a taxa de contraste entre elas e a avalia pela norma WCAG:

| Taxa de contraste | Avaliação mostrada |
| --- | --- |
| 7:1 ou mais | AAA |
| 4,5:1 a 7:1 | AA |
| 3:1 a 4,5:1 | Só para texto grande |
| Abaixo de 3:1 | Abaixo do mínimo WCAG |

Se a avaliação ficar abaixo de AA, o painel sugere remover a cor de texto para voltar ao automático.

### As cores na exportação

As cores e a borda aparecem iguais na tela, no PNG exportado e na impressão.

## 11. Zoom, desfazer/refazer e salvamento automático

O Alicerce salva seu trabalho sozinho, guarda um histórico de até 100 passos por projeto e permite aproximar ou afastar a visão de 10% a 400%.

### Zoom e navegação

- **Botões:** Reduzir zoom, Aumentar zoom e Ajustar à janela, na barra de ferramentas.
- **Mouse:** segure Ctrl (ou Cmd) e gire a roda.
- **Toque:** faça o gesto de pinça com dois dedos.
- **Mover a vista:** use o botão do meio do mouse, ou segure a barra de espaço e arraste. Na tela de toque, arraste em área vazia.

O modo **Ajustar à janela** mantém a tela inteira visível e se reajusta quando a janela muda de tamanho. Ao dar zoom manual, o ajuste automático é desligado até você usar o botão de novo.

### Grade e encaixe

A grade mostra linhas a cada 10 px. Com a **Grade magnética** ligada, elementos movidos e redimensionados encaixam nelas. As setas movem 10 px por vez com a grade ligada, 1 px com ela desligada, e 10 px com Shift pressionado.

### Desfazer e refazer

Ctrl+Z desfaz a última alteração, e Ctrl+Y (ou Ctrl+Shift+Z) a refaz. Também há botões na barra. O histórico guarda até 100 passos, cobre mover, redimensionar, cores, cantos, espelhar, travar, ocultar, reordenar e excluir, e fica salvo junto com o projeto, de modo que continua disponível depois de fechar e reabrir o app.

### Salvamento automático

A cada alteração, o Alicerce grava o projeto no banco do navegador cerca de 0,4 segundo depois. Também grava ao trocar de aba ou fechar a página. A barra de status mostra "Salvo às HH:MM". Se o navegador não permitir armazenamento local, o app avisa que o projeto não será salvo automaticamente, e você deve exportar o arquivo (seção 12).

O salvamento automático é local ao dispositivo. Ele não substitui o backup em arquivo.

## 12. Exportar, imprimir, compartilhar, backup e importação

Todas as opções de saída ficam no botão **Exportar / Importar** da barra de ferramentas. Elas tratam o projeto completo: todas as telas, posições, tamanhos, textos, cores, cantos, espelhamentos, travas e camadas.

### Exportar

| Opção | O que gera | Quando usar |
| --- | --- | --- |
| Projeto (.json) | Arquivo com o projeto inteiro | Backup e envio para outra pessoa |
| PNG — tela atual | Imagem da tela aberta | Colar em documento ou chat |
| PNG — todas as telas | Uma imagem com todas as telas do projeto | Apresentar o fluxo completo |
| Imprimir todas as telas | Folha de impressão com todas as telas | Papel ou PDF pelo navegador |

O PNG e a impressão respeitam a moldura (Mobile ou Desktop), as cores, os cantos, o espelhamento e a ordem das camadas. Elementos ocultos não aparecem. Para gerar um PDF, escolha "Salvar como PDF" na janela de impressão.

### Salvar no disco

**Salvar no disco** (Ctrl+S) grava o projeto em um arquivo seu. **Salvar como…** (Ctrl+Shift+S) permite escolher outro nome ou pasta. Em navegadores com acesso a arquivos (Chrome e Edge), o Alicerce lembra do arquivo e grava nele nas próximas vezes. Nos demais, o arquivo é baixado.

### Importar

Use **Importar projeto ou backup…** (ou Ctrl+O) e escolha um arquivo .alicerce ou .json. Se o projeto já existir neste dispositivo, o Alicerce pergunta se você quer substituir o conteúdo ou importar como uma cópia.

### Compartilhar

**Compartilhar projeto** e **Compartilhar imagem PNG** abrem o menu de compartilhamento do sistema, em navegadores que o oferecem. Se o navegador não compartilha arquivos, o Alicerce baixa o arquivo e avisa.

### Backup geral

No menu lateral, **Backup Geral (todos os projetos)** reune todos os seus projetos em um único arquivo, e **Restaurar Backup…** os traz de volta. Faça um backup antes de limpar os dados do navegador, trocar de computador ou excluir projetos. Arquivos inválidos dentro de um backup são ignorados, e o aviso informa quantos foram.

## 13. Temas, modo claro/escuro e acessibilidade

O Alicerce tem 4 temas de cores, cada um em modo claro (padrão) e modo escuro, e foi desenhado para ser legível por pessoas com diferentes necessidades visuais. O tema muda só a aparência do app, não o conteúdo dos seus wireframes.

### Escolher o tema

Use o seletor **Tema de cores** no cabeçalho, ou o menu lateral em telas pequenas. O app lembra sua escolha na próxima visita.

| Tema | Harmonia de cores |
| --- | --- |
| Original | Análoga |
| Sóbrio | Monocromática |
| Hawaii | Análoga |
| Groenlândia | Análoga |

### Modo claro e escuro

O botão **Alternar modo claro/escuro** muda a aparência. O modo claro é o padrão: o app só passa para o escuro se você escolher.

### Recursos de acessibilidade

- **Contraste auditado:** cada par de texto e fundo dos temas segue as taxas WCAG 2.1 AA ou AAA. Texto branco só aparece sobre fundos escuros, e texto preto só sobre fundos claros.
- **Não depende só de cor:** estados ativos usam também bordas, ícones e formas, o que ajuda quem tem protanopia, deuteranopia ou tritanopia.
- **Teclado:** todas as funções têm atalho ou podem ser alcançadas com Tab. O link "Ir para a prancheta", no início da página, pula direto para a área de desenho.
- **Leitores de tela:** botões têm nome acessível, e as mudanças importantes (tema ativado, cor aplicada, elemento travado) são anunciadas.
- **Movimento reduzido:** quem configura o sistema para reduzir animações recebe o app com menos movimento.
- **Tela cheia:** o botão do cabeçalho libera mais espaço para desenhar.

## 14. Atalhos de teclado

No Mac, use Cmd no lugar de Ctrl. Os atalhos de edição funcionam quando a área de desenho está em foco e não há um campo de texto aberto.

| Atalho | Ação |
| --- | --- |
| Ctrl+Z | Desfazer |
| Ctrl+Y ou Ctrl+Shift+Z | Refazer |
| Ctrl+S | Salvar no disco |
| Ctrl+Shift+S | Salvar como |
| Ctrl+O | Abrir ou importar arquivo |
| Ctrl+A | Selecionar tudo |
| Ctrl+C / Ctrl+V | Copiar / Colar |
| Ctrl+D | Duplicar |
| Delete ou Backspace | Excluir |
| Enter ou F2 | Editar o texto do elemento |
| Esc | Limpar a seleção ou fechar o inspetor |
| Setas | Mover o elemento (1 px, ou 10 px com a grade magnética) |
| Shift + setas | Mover 10 px |
| Ctrl+\] | Trazer para frente |
| Ctrl+\[ | Enviar para trás |
| Shift+H | Espelhar na horizontal |
| Shift+V | Espelhar na vertical |
| Shift+L | Travar ou destravar |
| Ctrl + roda do mouse | Zoom |
| Espaço + arrastar | Mover a vista |
| Arrastar em área vazia | Selecionar com retângulo |

## 15. Tutorial prático: uma tela de login

Neste tutorial você monta uma tela de login mobile em cerca de 10 minutos e usa quase todos os recursos do Alicerce: componentes, cantos, cores, camadas, cadeado, espelhamento e exportação.

### Preparação

1. Abra **Novo projeto**, dê o nome "App de exemplo" e escolha a moldura **Mobile 360×800**.
2. Renomeie a primeira tela para "Login" com o botão **Renomear tela**.
3. Deixe a **Grade magnética** ligada para os elementos alinharem.

### Passo 1: o cabeçalho

Arraste **Cabeçalho / Navbar** para o topo da tela e edite o texto (Enter) para "Entrar". Como ele ocupa a largura toda, basta soltar no topo. Em seguida, trave-o com Shift+L.

### Passo 2: o cartão de login

1. Arraste um **Container / Card** para o centro da tela.
2. No inspetor, em **Cantos**, escolha **Grande** para arredondar as quinas.
3. Trave o container para não movê-lo sem querer ao montar o que fica sobre ele.

### Passo 3: os campos

Arraste dois **Campo de input** para dentro do container, um sobre o outro. Edite os textos para "E-mail" e "Senha". Selecione os dois (Shift+clique ou retângulo de seleção) e alinhe-os pela grade.

Se um campo ficar escondido atrás do container, abra **Camadas**, selecione a linha do campo e suba-a, ou use Ctrl+\].

### Passo 4: a ação principal

1. Arraste um **Botão** abaixo dos campos e edite o texto para "Entrar".
2. Em **Cantos**, escolha **Pílula**.
3. Em **Cores**, escolha uma cor de **Fundo**. O painel mostra o contraste com o texto: procure AA ou AAA.

### Passo 5: as opções extras

- Adicione um **Checkbox** com o texto "Lembrar de mim" e marque o estado no inspetor.
- Adicione um **Bloco de texto** com "Esqueci minha senha".
- Adicione um **Toast / Snackbar** no rodapé, com a mensagem "Senha incorreta", para mostrar o estado de erro.

### Passo 6: uma segunda tela

Use **Duplicar tela**, renomeie a cópia para "Login com erro" e altere as cores ou o texto do toast. Assim você documenta dois estados sem refazer nada.

### Passo 7: conferir e exportar

1. Abra **Camadas** e confira a ordem: navbar e container ao fundo, campos e botão na frente.
2. Abra **Exportar / Importar** e escolha **PNG — todas as telas** para ver o fluxo completo, ou **Projeto (.json)** para guardar um backup.

Pronto: você tem um wireframe de duas telas, pronto para mostrar a quem vai projetar ou programar a interface.

## 16. Solução de problemas e perguntas frequentes

A maioria dos problemas tem causa simples: um elemento travado, oculto ou coberto por outro, ou um recurso que o navegador não oferece.

### Problemas comuns

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| O elemento não se move, não muda de tamanho ou não é excluído | Está travado (aparece um cadeado no canto) | Selecione-o e pressione Shift+L |
| O elemento sumiu | Está oculto, fora da vista ou atrás de outro | Abra **Camadas**: reative o olho, ou selecione a linha e suba-a |
| Não consigo clicar no elemento de baixo | Outro elemento o cobre | Selecione pela lista de **Camadas** |
| O rascunho de uma tela não aparece depois de reabrir | O navegador bloqueou o armazenamento local | Libere o armazenamento do site e use backup em arquivo |
| O botão Instalar não aparece | O navegador não oferece instalação neste momento | Use o menu do navegador (seção 2) |
| A barra de ferramentas passa da largura da janela | Janela estreita | Role a barra na horizontal ou aumente a janela |
| O PNG não foi gerado | Projeto muito grande para o navegador | Exporte tela por tela, ou reduza a quantidade de elementos |
| Compartilhar baixou um arquivo | O navegador não compartilha arquivos | Envie o arquivo baixado manualmente |
| Salvar no disco baixa um arquivo novo a cada vez | O navegador não grava direto em arquivos | Comportamento esperado em navegadores sem essa função |
| O app não mostra a versão nova | O navegador ainda usa a versão guardada | Feche e reabra o app, ou recarregue a página com conexão |

### Perguntas frequentes

**Posso trabalhar sem internet?** Sim, depois da primeira visita ou da instalação. O app inteiro é guardado no dispositivo.

**Meus dados ficam na nuvem?** Não. Tudo fica neste navegador e neste dispositivo. Para usar em outro computador, exporte o projeto ou o backup geral e importe lá.

**Perdi um projeto. Consigo recuperar?** Só se houver backup. A exclusão de projetos é definitiva, e limpar os dados do site apaga todos os projetos.

**Por que os botões do desenho não fazem nada ao clicar?** O Alicerce é um wireframe estático: ele não simula comportamento. A intenção é definir estrutura e hierarquia.

**Posso usar imagens minhas?** Não. O componente de imagem é um espaço reservado, de propósito, para manter o foco na estrutura.

**Quantas telas e elementos posso criar?** Não há limite fixo. Projetos muito grandes podem deixar o app mais lento ou impedir a geração de PNG.

**Posso editar o mesmo projeto em dois dispositivos?** Não ao mesmo tempo. Cada dispositivo guarda sua cópia. Exporte em um e importe no outro, escolhendo substituir ou importar como cópia.

## 17. Glossário e histórico de versões

### Glossário

| Termo | Significado |
| --- | --- |
| Wireframe | Esboço de baixa fidelidade que mostra a estrutura de uma tela, sem cores finais, imagens ou detalhes visuais |
| PWA | Progressive Web App: site que se instala como app e funciona offline |
| Moldura | Tamanho da tela desenhada: Mobile 360×800 ou Desktop 1280×800 |
| Palco | Área central onde você posiciona os componentes |
| Inspetor | Painel que mostra as propriedades e as camadas do elemento selecionado |
| Componente | Bloco de interface da paleta, como botão, campo ou navbar |
| Elemento | Componente já colocado em uma tela |
| Camada | Posição de um elemento na pilha de sobreposição: a primeira está à frente |
| Grade magnética | Encaixe automático de elementos nas linhas da grade (10 px) |
| Flip | Espelhamento horizontal ou vertical de um elemento |
| Raio de canto | Medida de arredondamento das quinas de um elemento, em pixels |
| FAB | Floating Action Button: botão redondo flutuante para a ação principal |
| Toast / Snackbar | Mensagem curta e temporária de retorno ao usuário |
| Skeleton | Esboço cinza que indica conteúdo ainda carregando |
| Breadcrumb | Trilha de navegação que mostra onde o usuário está na hierarquia |
| Drawer | Menu lateral que desliza sobre a tela |
| Contraste (WCAG) | Razão entre as luminosidades do texto e do fundo; AA exige ao menos 4,5:1 |
| IndexedDB | Banco de dados do navegador onde os projetos são salvos |
| Backup geral | Arquivo único com todos os projetos do dispositivo |

### Histórico de versões

| Versão | Novidades |
| --- | --- |
| 1.5.0 | Painel de camadas: ordem de empilhamento, ocultar, travar e reordenar por setas ou arrastando |
| 1.4.0 | Seleção por retângulo com o mouse e cadeado para travar elementos |
| 1.3.0 | Novo lema "A base das interfaces de PWAs" e 29 componentes em 4 grupos |
| 1.2.1 | Correção do movimento indesejado da tela ao inserir ou mover elementos |
| 1.2.0 | Ferramenta de espelhamento (Flip) e sistema de cantos retos e arredondados |
| 1.1.0 | Ferramenta de cores para fundo, borda e texto, com verificação de contraste |
| 1.0.0 | Versão inicial: projetos, telas, componentes básicos, exportação, impressão, temas e uso offline |

### Mais informações

O código e a documentação técnica estão no [repositório do Alicerce no GitHub](https://github.com/magpe-stack/Alicerce). O app está em [magpe-stack.github.io/Alicerce](https://magpe-stack.github.io/Alicerce/).

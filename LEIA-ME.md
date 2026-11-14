# Music Space

Site e app web para guardar músicas, em HTML, CSS e JavaScript puros (sem build).

## Como abrir
- Dê dois cliques em `index.html`, ou
- publique a pasta no GitHub Pages (ou qualquer hospedagem estática).

## Estrutura
- `index.html`: página inteira (início, músicas, órbita, playlists, player e modais)
- `css/style.css`: tokens de cor/tipografia e todos os estilos
- `js/core.js`: humores, planetas procedurais e armazenamento
- `js/audio.js`: player, faixas demo geradas em tempo real e analisador de áudio
- `js/cosmos.js`: fundo de estrelas, galáxia do hero e túnel de estrelas
- `js/orbit.js`: mapa orbital (hover, clique, teclado, cometa, buraco negro)
- `js/app.js`: filtros, lista, painel, player, modal e toasts

## Onde mexer
- Cores: variáveis em `:root` no topo de `css/style.css`.
- Paletas dos planetas: `MS.MOODS` em `js/core.js`.
- Músicas de exemplo: `DEMO` em `js/core.js` (apague para começar vazio).
- Fontes: Bricolage Grotesque e Instrument Serif, carregadas do Google Fonts.

## Arquivos aceitos
MP3, WAV, OGG, M4A, AAC, FLAC, OPUS e também vídeos (MP4, WEBM, M4V, MOV, MKV): do vídeo
toca só o áudio. É possível escolher vários arquivos de uma vez; o título e o artista vêm
do nome do arquivo no formato `Música - Artista`. O que o navegador não consegue abrir é
recusado na hora (MP4 com vídeo H.264 e áudio AAC abre em todos os navegadores comuns).

## Onde ficam os dados
Os dados das músicas ficam no `localStorage` e os arquivos de áudio no `IndexedDB`,
os dois só neste navegador. Para ligar a um backend depois, troque as funções de
`MS.store` em `js/core.js`.

## Acessibilidade
Navegação por teclado (no mapa: setas e Enter), foco visível, `prefers-reduced-motion`
respeitado, e a visão em Lista como alternativa ao mapa.

## Navegação simplificada
A inicial (`#top`) mantém o hero e o convite final. O header contém Baixar app à
esquerda, Início, Músicas, Playlists e Adicionar Músicas. A Órbita é acessível pelo
seletor Órbita/Lista em Músicas e pelo convite da inicial. Álbuns, Artistas,
Favoritas, Humores e Como funciona não são mais áreas da interface.

As playlists são criadas somente pelo usuário e continuam salvas na chave
`musicspace.playlists.v1`, preservando as existentes. É possível criar uma playlist
vazia, editar seu nome, buscar e adicionar faixas, remover faixas sem apagar os
arquivos, mudar a ordem pelas setas e excluir a playlist. O botão + de cada música
também permite escolher uma playlist ou criar uma nova. A fila respeita a ordem da
playlist e continua ao navegar entre as áreas. Não há integração com Spotify.

Os planetas são distribuídos equilibradamente pelas cinco órbitas, independentemente
do humor das músicas. Coleções pequenas ocupam também os anéis externos.

Baixar app abre a instalação nativa quando disponível ou exibe instruções para o
navegador. O botão fica oculto no modo instalado e após uma instalação detectada
neste navegador; navegadores não permitem detectar universalmente instalações
feitas em outros navegadores ou dispositivos.

`js/navigation.js` controla as áreas e playlists. `js/library-model.js` contém a
distribuição orbital e operações de playlist. `npm run check`, `npm test` e
`npm run build` validam e geram `dist/`. Publique essa pasta para atualizar site e
PWA; as alterações locais não publicam automaticamente em uma hospedagem.
`src/` e os scripts antigos da raiz foram preservados; a interface atual carrega
os scripts de `js/` e a folha de estilos de `css/`.

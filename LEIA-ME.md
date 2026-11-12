# Music Space

Site e app web para guardar músicas, em HTML, CSS e JavaScript puros (sem build).

## Como abrir
- Dê dois cliques em `index.html`, ou
- publique a pasta no GitHub Pages (ou qualquer hospedagem estática).

## Estrutura
- `index.html`: página inteira (hero, universo, sistemas, passos, final, player, modal)
- `css/style.css`: tokens de cor/tipografia e todos os estilos
- `js/core.js`: humores, planetas procedurais e armazenamento
- `js/audio.js`: player, faixas demo geradas em tempo real e analisador de áudio
- `js/cosmos.js`: fundo de estrelas, galáxia do hero e túnel de estrelas
- `js/orbit.js`: mapa orbital (hover, clique, teclado, cometa, buraco negro)
- `js/app.js`: filtros, lista, painel, player, modal e toasts

## Onde mexer
- Cores: variáveis em `:root` no topo de `css/style.css`.
- Humores (órbitas): `MS.MOODS` em `js/core.js`.
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

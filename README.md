# Music Space

Seu universo musical. Player local em português, com interface responsiva e instalação como **PWA no desktop, Android e iOS**. Login Google opcional, sem assinaturas ou upload de áudio.

## Executar

Requisito de desenvolvimento: Node.js 20 ou superior. Instale as dependências com `npm install`.

```sh
npm run build
npm start
```

Abra http://localhost:4173. Para servir a versão de produção:

```sh
node scripts/serve.mjs --dist --port 4173
```

## Login com Google

O login é opcional. O botão **Entrar** abre a autenticação oficial do Google; o servidor valida o ID token com `google-auth-library` antes de criar uma sessão em cookie HttpOnly. O script do Google só é carregado ao abrir o login. Nenhum áudio é enviado. A biblioteca continua compartilhada localmente neste navegador, independentemente da conta conectada: não há sincronização nem isolamento de arquivos por conta.

1. No Google Cloud, configure a tela de consentimento e crie um **ID do cliente OAuth → Aplicativo da Web**.
2. Adicione `http://localhost:4173` às **Origens JavaScript autorizadas**. Para produção, adicione a origem HTTPS exata do site.
3. Configure as variáveis no terminal PowerShell e inicie o servidor:

```powershell
$env:GOOGLE_CLIENT_ID = 'SEU_CLIENT_ID.apps.googleusercontent.com'
$env:APP_ORIGIN = 'http://localhost:4173'
npm start
```

Não é necessário Client Secret para esse fluxo. `APP_ORIGIN` deve corresponder à origem usada no navegador (incluindo a porta, sem barra final). Para produção, use HTTPS e execute `node scripts/serve.mjs --dist` atrás do proxy HTTPS; apenas hospedar `dist/` estaticamente mantém o player, mas não disponibiliza login. O cookie usa Secure quando `APP_ORIGIN` é HTTPS. As sessões duram oito horas, ficam na memória de uma única instância e são encerradas ao reiniciar o servidor. Para múltiplas instâncias, substitua esse armazenamento por um repositório de sessões compartilhado.

Sem `GOOGLE_CLIENT_ID`, a interface informa que o login ainda não foi configurado. Offline, a biblioteca permanece disponível, mas entrar/sair exige conexão. A integração real com Google precisa ser validada com o Client ID e a origem da implantação.

Referência: [verificação oficial de ID tokens do Google](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## Instalar o aplicativo

- Chrome/Edge no computador ou Android: abra a aplicação e escolha **Instalar aplicativo** no menu do navegador, ou em **Ajustes e instalação** quando o navegador disponibilizar o botão.
- iPhone/iPad: abra no Safari, toque em **Compartilhar → Adicionar à Tela de Início**.
- Para acessar de outro dispositivo, publique o conteúdo de `dist/` em hospedagem estática com **HTTPS**. HTTP em um IP da rede local não habilita service worker, instalação e APIs seguras. `localhost` é permitido para desenvolvimento.
- Aguarde o indicador **Pronto para ouvir offline** antes de desconectar. Os módulos, ícones e estilos ficam no cache; os áudios ficam no IndexedDB.

Esta entrega é uma PWA compartilhada entre Web e Mobile. **Não inclui APK, IPA, executável nativo ou publicação em lojas.** A instalação depende do suporte do navegador. Reprodução em segundo plano e controles na tela bloqueada usam HTMLAudio e Media Session quando disponíveis; o sistema operacional pode interromper a sessão.

## Funcionalidades

- Importação múltipla por seletor e arrastar/soltar de áudio (MP3, FLAC, WAV, M4A, AAC, OGG, OGA, OPUS, WMA, AIFF, AIF) e vídeo (MP4, M4V, WEBM, MKV, MOV, AVI, WMV, OGV, 3GP). Nos vídeos, o player reproduz o áudio e preserva o arquivo original.
- Arquivos e capas persistidos em IndexedDB; deduplicação por SHA-256 do conteúdo.
- Leitura local de ID3v2.2/v2.3/v2.4 e ID3v1, comentários/capas FLAC e tags RIFF INFO em WAV. Metadados ausentes usam o nome do arquivo, com edição manual disponível.
- Músicas, álbuns, artistas, favoritas, pesquisa sem distinção de acentos, ordenação e modos lista/grade.
- Playlists locais: criar, renomear, excluir, adicionar/remover músicas.
- Player com fila, seek, volume, mute, anterior/próxima, aleatório, repetir fila/faixa e modo expandido.
- Atalhos de teclado, foco visível, nomes acessíveis, suporte a movimento reduzido e safe areas mobile.
- Download do áudio original e remoção da cópia na biblioteca, com confirmação.
- Faixa ambiente original gerada localmente para experimentar o app, sem arquivos ou serviços externos.

## Dados e compatibilidade

Os arquivos permanecem neste navegador/dispositivo, sem sincronização entre aparelhos. Apagar os dados do site, usar navegação privada ou a limpeza automática de armazenamento pelo navegador pode apagar a biblioteca. Mantenha os arquivos originais. O botão de armazenamento persistente solicita proteção ao navegador, que pode recusá-la.

A importação não converte os arquivos. A reprodução depende do codec e navegador; AVI, MKV, WMV e WMA podem ser importados, mas não tocar no navegador; WAV comprimido, por exemplo, pode não ser reproduzível. Tags comprimidas, criptografadas ou com unsynchronisation não são interpretadas. A leitura de tags limita-se aos primeiros 16 MiB; metadados podem ser editados manualmente. Cada arquivo é lido integralmente para calcular seu hash, sequencialmente, portanto arquivos muito grandes podem exigir memória adicional.

## Estrutura

```text
index.html              Estrutura semântica e shell
src/app.js              Estado, interface, importação e player
src/storage.js          IndexedDB e transações
src/metadata.js         Leitores de metadados
src/icons.js            Ícones SVG locais
src/demo.js             Gerador da faixa ambiente
src/styles.css         Design responsivo e microinterações
assets/                Marca e ícones PWA locais
sw.js                  Cache offline do shell
manifest.webmanifest   Instalação PWA
scripts/               Servidor, build e geração de ícones PNG
tests/                 Testes dos leitores e do áudio gerado
dist/                  Build estático gerado
```

## Validação

```sh
npm run check
npm test
npm run build
```

O build copia o frontend; o servidor Node usa a biblioteca oficial google-auth-library. Sirva os arquivos por HTTP/HTTPS, não por `file://`. Ao publicar mudanças, incremente `CACHE` em `sw.js` para substituir o shell em cache. Os áudios do IndexedDB não são removidos durante atualizações do shell.

Teste manual recomendado: importar MP3/FLAC/WAV reais, tocar/pausar/avançar/buscar, favoritar, adicionar a playlist, recarregar, fechar/reabrir instalado e desconectar da internet após o cache estar pronto. Verifique codecs e comportamento em segundo plano nos aparelhos de destino.

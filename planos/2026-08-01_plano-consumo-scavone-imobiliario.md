---
type: plano
title: Consumo do material Scavone (32 modelos RTF + livro) no arsenal-juridico
description: Estratégia em 3 fases para incorporar os modelos do Scavone e o livro escaneado ao bundle de direito imobiliário sem gerar acervo morto nem risco de distribuição de obra de terceiro.
timestamp: '2026-08-01'
status: em_teste
autor: escritorio
---

# Plano — consumo do material Scavone no `arsenal-juridico`

## Diagnóstico (2026-08-01)

- `direito/imobiliario/` **não é** um bundle de direito imobiliário: é um bundle de
  **rescisão de compromisso de compra e venda de lote urbano** (v0.2.0). README, index e
  atividades delimitam assim.
- A pasta `consumir/MODELO_DIREITO_IMOBILIARIO_SCAVONE.../` tem **32 modelos RTF**
  (não só o 1_7_14), cobrindo ~10 temas: possessórias (reintegração, manutenção,
  interdito, nunciação), registro (dúvida, providências), usucapião (judicial +
  ata notarial), condomínio (cobrança + contestação), pauliana, demarcação,
  compromisso de compra e venda (notificações + resolução por inadimplemento +
  contestação + impugnação), construtora (redibitória, cominatória, indenização),
  leilão extrajudicial/alienação fiduciária, execução hipotecária, ações contra banco.
- Desses temas, o acervo cobre **apenas** rescisão de lote. Possessórias, usucapião,
  condomínio, locação, incorporação e leilão extrajudicial: **zero cobertura**.
- O livro (`DIREITO_IMOBILIÁRIO_TEORIA_E_PRÁTICA...pdf`, 18,5 MB) é **escaneado** —
  conversão só por OCR Tesseract (rodando). Texto sairá com ruído: **não serve como
  fonte de transcrição literal** para o `lint-citacoes`; serve como mapa doutrinário.
- Schema §6.6 (obras comerciais): o arquivo fica em `raw/` **excluído de distribuição**;
  só o conhecimento **reescrito** circula. Precedente interno: os 4 manuais de DPC em
  `direito/pecas/raw/`.

## Decisões de fronteira (antes de qualquer ingestão)

1. **Modelo do Scavone nunca vira peça por cópia.** O estilo conflita com o padrão PMA
   (endereçamento, BLUF, títulos-tese, assinatura). O que se extrai é o **esqueleto
   técnico**: requisitos legais, cascata de pedidos, fundamentos por tipo de ação.
   Destino: **playbook/heurística**, não pasta `modelos/` (que não existe no schema).
2. **Obra de terceiro não vai para o GitHub público.** A Fase 7 do PRD de versionamento
   prevê publicação do repositório — os RTF e o livro em `raw/` precisam estar no
   manifesto de exclusão antes disso.
3. **Citação de lei/julgado nunca se confere no livro** (OCR + obra datada): sempre no
   Planalto/tribunal, como já manda a regra dura 4.

## Fase A — depósito e catálogo (barato, fazer já)

1. Converter os 32 RTF para `.md` (pandoc; RTF é texto, conversão sem perda).
2. Depositar em `direito/imobiliario/raw/modelos-scavone/` como par `.rtf` + `.md`,
   imutáveis, com aviso de obra de terceiro no cabeçalho.
3. Criar **uma página-catálogo** (`raw/modelos-scavone/index.md`): uma linha por modelo —
   tema, ação, artigos-chave — para que qualquer sessão futura saiba que o material
   existe e onde está. É isto que evita o acervo virar caixa fechada.
4. Quando o OCR do livro terminar: validar tamanho/legibilidade (regra 4 da skill
   pdfmd), depositar o `.md` ao lado do PDF em `raw/` e **anotar no catálogo o sumário
   por capítulo** (mapa de mineração futura).

## Fase B — enriquecer o bundle existente (valor imediato)

Os modelos `3_10_*` (notificação extrajudicial, notificação judicial, inicial de
resolução por inadimplemento, contestação, resposta à impugnação) e `1_7_13`
(notificação) tratam **exatamente** do tema do bundle atual:

1. Cruzar `3_10_4` (contestação do Scavone) com
   `playbook-contestacao-notificacao-viciada.md` — incorporar o que faltar.
2. Cruzar `3_10_1/3_10_2` com a tese
   `notificacao-previa-invalida-obsta-rescisao-por-loteadora.md` — os requisitos formais
   da notificação viram checklist na heurística de vício de notificação.
3. Capítulo correspondente do livro (quando convertido): minerar só este tema agora.

## Fase C — temas novos: só sob demanda (regra do roteador)

**Não criar 10 sub-bundles de uma vez.** Bundle sem caso vivo vira `em_teste` eterno e
engorda o backlog do lint (já há 26 erros de conteúdo pendentes). Quando chegar o
primeiro caso de um tema:

1. Promover a estrutura: `direito/imobiliario/` → `direito/imobiliario/rescisao-lote/`
   (mesmo movimento já feito em `bancario/`), criando o irmão do tema novo
   (`possessorias/`, `leilao-extrajudicial/`, `usucapiao/`...). Divisão proposta ao
   titular, conforme regra do roteador global.
2. Semear o bundle novo com: esqueleto do modelo Scavone correspondente (playbook) +
   capítulo do livro (heurísticas/teses reescritas) + jurisprudência atual via
   `radar-jurisprudencia` (o livro não substitui precedente verificado).
3. Prioridades prováveis pela banca do escritório: possessórias (1_7_14/1_7_15/1_8_2) e
   alienação fiduciária/leilão (12_11, 10_6) — este último conversa com a prática
   bancária já existente.

## O que NÃO fazer

- Ingerir o livro inteiro como páginas de tese/heurística "para ter" — viola a
  granularidade do schema e produz conhecimento não verificado em escala.
- Copiar prosa do Scavone para peça (estilo pré-CPC/15 em parte, sem jurisprudência,
  doutrina de rodapé de 1917/1997; o `lint-ia`/humanizer não resolve texto de terceiro).
- Publicar `raw/` com obra comercial no repositório público (Fase 7).

## Execução (2026-08-01)

- [x] **Fase A** — depósito: eram **94** RTF (não 32; a listagem inicial estava truncada).
      Convertidos com `striprtf` (sem pandoc na máquina; lib adicionada ao
      `requirements.txt`) e depositados como par `.rtf`+`.md` em
      `<bundles>/direito/imobiliario/raw/modelos-scavone/`, cada `.md` com aviso de obra
      de terceiro. 3 arquivos curtos conferidos à vista (completos). Catálogo por tema em
      `raw/modelos-scavone/index.md`. A coleção cobre também locação/despejo (15+),
      consignação, adjudicação compulsória, renovatória, reivindicatória, embargos de
      terceiro, desapropriação — além dos temas previstos.
- [x] **Fase B** — anatomia dos modelos 3.10.x reescrita no bundle: heurística de
      notificação (prazos por regime, conteúdo mínimo, fallback judicial arts. 726-729),
      tese de notificação (novo contra-argumento) e playbook de contestação (preliminares
      valor da causa/incompetência/art. 338; mérito culpa da mora/adimplemento
      substancial/retenção art. 1.219/tutela art. 300 §3º; reconvenção invertendo a
      culpa). Bundle v0.2.0 → **v0.3.0**; log.md e índices atualizados.
- [x] **Fase C, decisão** — titular aprovou em 2026-08-01 a promoção futura
      `direito/imobiliario/` → `direito/imobiliario/rescisao-lote/` + bundles irmãos por
      tema. **Execução segue sob demanda**: disparar quando chegar o primeiro caso de tema
      novo, sem nova consulta.

## Pendências

- [x] OCR do livro concluído e depositado
      (`raw/scavone-direito-imobiliario-9ed-2015.{pdf,md}`, commit 85ebc25), com sumário
      por Livro no catálogo. **Achado: é a 9ª edição, de 2015** — anterior à Lei
      13.786/2018, à Lei 14.382/2022 e à Lei 14.711/2023; dupla trava de citação
      (edição datada + ruído de OCR) carimbada no `.md` e nos índices.
- [x] Manifesto de exclusão criado em 2026-08-01 (`distribuicao.json` + `empacotar.py`
      na raiz do arsenal). **Correção importante na mesma data:** o `.gitignore` do
      arsenal já era a camada 1 da política (obra comercial e PDF de processo de
      terceiro nunca entram no git) — a ingestão dos Scavone havia rastreado a obra por
      engano; os commits locais foram **reescritos antes do push** e agora só o catálogo
      circula (os arquivos vivem na máquina da titular, como os manuais de DPC).
      Camada 2 (rastreado mas fora de pacote externo): `escritorio.md`, cadeia golpe
      anonimizada, catálogo Scavone, o próprio manifesto. Portão:
      `python empacotar.py --verificar`; export testado (274 no pacote, 20 retidos,
      zero vazamento). Obs.: a Fase 7 já estava executada (repos privados no GitHub
      desde 28/07) — o CLAUDE.md está desatualizado nesse ponto.
- [ ] Fase B estendida: minerar o Livro II do livro (compromisso de compra e venda,
      caps. 1-5 e 7) — sempre cruzando com a redação vigente da lei.
- [ ] Avaliar aquisição da edição atual do Scavone (digital/texto): a 9ª ed. de 2015
      perde exatamente as reformas que mais importam ao bundle (distrato, garantias).

# PRD — Fluxo próprio da petição inicial no acervo

**Data:** 2026-09-04
**Status:** rascunho aguardando aprovação da titular
**Origem:** análise de dois prompts genéricos de inicial (série de seis etapas; framework
P.A.C.E.F de `skills-juridicas-ia`) contra o pipeline do escritório, mais leitura de
`direito/pecas/peticao-inicial/`, dos playbooks de inicial dos bundles bancário e imobiliário,
do encadeamento canônico do `legal-writer` e do template de lote.

---

## 0. Problema

A petição inicial é a peça que o escritório mais produz e a única entre as três "em estoque"
(`agravo-de-instrumento`, `peticao-inicial`, `contestacao`) cuja técnica não tem fluxo próprio no
acervo. Apelação, REsp, agravos, embargos e réplica têm playbook + workflow + heurísticas; a
inicial tem "o essencial em 5 linhas" e, desde 04/09/2026, um checklist de saída.

A técnica existe, mas espalhada em quatro lugares que **divergiam entre si** até 04/09:

| Ponto | `legal-writer` | Template de lote | `definicoes.md` |
|---|---|---|---|
| Valor da causa | "= soma dos pedidos" | valor do contrato | §1: depende do inciso do 292 |
| Autocomposição | desinteresse fixo | interesse fixo | silente |
| Tutela | antes do direito, fixo | depois do direito, fixo | silente |

As três divergências foram resolvidas nas skills em 04/09 (writer v3.5.0, orchestrator v4.7.0:
apontam para o §1; autocomposição e posição da tutela viraram decisão por caso na `ANALISE.md`
e na estrutura). O que resta é **construir a técnica que não existe** e **depositar as fontes**
que o acervo não tem.

## 1. Já feito sem PRD (04/09/2026)

- `legal-orchestrator` v4.5→4.7: `ANALISE.md` por caso (cronologia com prescrição, teses
  candidatas com regime/responsabilidade/ônus/tutela/autocomposição, mapa probatório em três
  estados, ataques previstos); `<PECA>.estrutura.md` com portão humano; Estágio 6 aponta para o
  checklist de saída em `direito/pecas/<tipo>/`.
- `direito/pecas/peticao-inicial/index.md`: seção "Checklist de saída" (319 I–VII, 320,
  encargos, tutela, requerimentos, forma).
- `legal-writer` v3.5.0 e `legal-consistency-validator` v2.5.0 alinhados.

## 2. Escopo deste PRD

### F1 — Esqueleto único da inicial PMA (acervo, sem fonte nova)

Criar `direito/pecas/peticao-inicial/playbooks/playbook-peticao-inicial.md` e
`workflows/peticao-inicial.md`, no molde da apelação. O esqueleto é **um só**, extraído de três
lugares que hoje o repetem: o "Encadeamento Canônico — Inicial PMA" do `legal-writer`, a
"Estrutura da peça" do `playbook-peticao-inicial-fraude-consignado.md` e a do
`playbook-peticao-inicial-rescisao-imovel.md`. Os playbooks de matéria passam a **apontar** para o
transversal e a guardar só o que é da matéria (bifurcação de regime, teses, documentos típicos).
O `legal-writer` mantém o estilo e aponta para o esqueleto.

Variáveis do esqueleto, decididas por caso (não fixadas): posição da tutela; interesse na
autocomposição; capítulo de competência (só quando há cláusula de eleição de foro ou foro do
consumidor a afirmar); gratuidade (só pessoa natural, enxuta, §2).

**Pronto quando:** os dois playbooks de matéria não têm mais "Estrutura da peça" própria; o
`lint-bundle` não acusa órfã nova; uma inicial real (lote ou golpe) gerada pelo pipeline segue o
esqueleto sem adaptação manual.

### F2 — Heurísticas transversais (acervo, fonte já depositada)

Páginas em `direito/pecas/peticao-inicial/heuristicas/`, todas com fonte em `raw/` já existente
(CPC compilado, Lei 9.099, CDC, Scarpinella 2024 e Montans 2024 aprovados):

1. **Competência e foro** — art. 53; eleição de foro após a Lei 14.879/2024 (art. 63: pertinência
   com domicílio ou obrigação; abusividade); foro do consumidor (CDC 101, I). O template de lote
   tem esse capítulo escrito à mão, sem página-fonte: passa a citar a heurística.
2. **Juizado × vara comum** — decisão de abertura: teto de 40 salários, complexidade e perícia,
   custas e honorários em 1º grau, recurso inominado. Lei 9.099 já está em `raw/`.
3. **Tutela provisória na inicial** — urgência (300) × evidência (311) × antecedente (303/304,
   estabilização); reversibilidade e caução (300 §§ 1º–3º). Recorte dos artigos por
   `recortar-artigo.py`, o que também resolve o aviso W3 de `cpc-art-300.md`.
4. **Exibição de documentos a partir do mapa probatório** — todo fato "a produzir" cuja prova
   está com o réu vira pedido incidental (396–400); consequência da recusa (400). Ligar o
   acórdão `apelacao-1027749-tjsp-exibicao-art-400.md` do bundle bancário, hoje órfão.
5. **Emenda da inicial** — o que fazer quando o juízo manda emendar (321): prazo de 15 dias,
   indicação precisa, indeferimento (330) e apelação com retratação (331). Peça de resposta
   curta, frequente, sem página hoje.

**Pronto quando:** cada página tem `fundamentos:` resolvendo para `raw/` ou para recorte;
`lint-bundle` sem erro novo; o checklist de saída aponta para as cinco.

### F3 — Páginas que exigem depósito de fonte pela titular (portão da titular)

O acervo **não cobre** e o agente **não cita de memória** (AGENTS.md, regra dura 3). Cada item
nasce `em_teste` e só vira `vigente` depois do depósito do inteiro teor oficial em `raw/`:

1. **Termo inicial de juros e correção** — Súmulas 43, 54 e 362 do STJ, lidas junto com a Lei
   14.905/2024 (CC 389, p.ú., e 406). O bundle bancário já tem
   `resp-1556834-sp-termo-inicial-juros-e-correcao.md`; avaliar promoção a transversal.
2. **Quantificação do dano moral** — método bifásico do STJ (grupo de casos + circunstâncias).
   A titular localiza o julgado paradigma e deposita; o número não entra aqui sem conferência.
3. **Presunção de veracidade da gratuidade e Tema 1.178** — já citado no §2 das definições;
   falta a página de jurisprudência com inteiro teor.

**Pronto quando:** as três páginas existem com `status: vigente` e `raw:` resolvido, ou a
titular decide mantê-las `em_teste` e a peça que as cita declara `cita_em_teste: sim`.

### F4 — Dado próprio que o escritório já tem

1. **Mineração dos despachos de emenda.** A fila do DJEN (246 intimações em 04/09) contém os
   despachos de emenda das próprias iniciais do escritório. Uma passada única: classificar as
   causas de emenda (valor da causa, documento faltante, qualificação, gratuidade, pedido
   indeterminado) e transformar as três mais frequentes em itens do checklist **com contagem**.
   Depende de F0.1 do PRD de 29/08 (triagem da fila pela titular) ou roda sobre a fila bruta,
   só leitura.
2. **Perfis de juízo** para as três ou quatro varas que recebem a maioria das iniciais, no molde
   de `perfis/1a-camara-civel-tjro.md`: tratamento da gratuidade, da tutela em golpe bancário,
   do valor da causa, prazo médio do primeiro despacho. Fonte: `casos_decididos/` e a própria
   fila do DJEN.

**Pronto quando:** o checklist de saída tem ao menos um item com a frequência real de emenda
anotada; existe um perfil de juízo lido pelo Estágio 0 quando a comarca coincide.

### F5 — Portões (sessão de manutenção, `PMA_MANUTENCAO=1`)

1. `perfil/definicoes.md` §1: incluir o **art. 292, V** (dano moral: valor pretendido) e o **§ 3º**
   (correção de ofício). O domínio principal do escritório é golpe bancário com dano moral e a
   tabela não cobre o caso mais comum.
2. `lint-inicial` no `md2docx` quando `tipo: inicial`, conferindo o que é mecânico no checklist
   de saída (endereçamento §5, capítulo I, seção de valor da causa, protesto por provas,
   manifestação sobre o 334, assinatura). Só depois de F1 rodar em algumas peças sem mudar.
3. Placeholder não compila (`[VERIFICAR]`, `[NOME]`, `[...]` fora de citação em bloco).
4. `protect-gates`: `(?!&)` no regex de escrita (handoff de 04/09).

## 3. Ordem e dependências

F1 e F2 não dependem de ninguém e cabem em uma sessão de agente cada. F3 depende da titular.
F4.1 depende da fila estar legível (PRD de 29/08, F0.1) ou roda em modo leitura. F5 é uma sessão
de manutenção, de preferência depois de F1 e F2 para o `lint-inicial` conferir o esqueleto final.

## 4. Fora de escopo

- Estágio novo no `legal-orchestrator`: o pipeline já tem os estágios que precisa.
- Contestação e agravo de instrumento: mesma carência, PRD próprio quando chegar a vez.
- Prompt genérico como fonte: nenhum dos dois analisados entra no acervo; o que agregava já foi
  absorvido nas skills (prescrição, regime, ônus, mapa probatório, checklist do 319).

## 5. Riscos

- **F3 sem depósito vira página fantasma.** Se a titular não depositar, as páginas ficam
  `em_teste` e o `lint-citacoes` exige `cita_em_teste: sim` a cada uso. Aceitável; o que não é
  aceitável é promover a `vigente` sem inteiro teor.
- **F1 pode homogeneizar demais.** Golpe bancário e rescisão de lote têm esqueletos parecidos,
  mas não iguais (competência, gratuidade, tutela com IPTU). O esqueleto único tem variáveis
  declaradas; se a lista de variáveis passar de cinco, é sinal de que são dois esqueletos.

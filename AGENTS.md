# AGENTS.md — Workspace Advocacia PMA

**Arquivo canônico de instruções. Vale para qualquer agente** (Claude Code, Codex, Kilo, ou
nenhum). O Claude Code o carrega por import no `CLAUDE.md`; outro agente lê daqui.

Aqui mora só **julgamento**: convenção que o modelo não descobre sozinho. O que é **evento**
("quando X, faça Y") não é regra: é hook (Claude Code, ver `CLAUDE.md`), portão do compilador
(§4) ou lint. Em outro agente, as garantias dos hooks valem por disciplina; a lista está no §6.

Complementos: [`USER.md`](USER.md) (tom) · [`perfil/definicoes.md`](perfil/definicoes.md)
(regras jurídicas canônicas) · [`SKILLS.md`](SKILLS.md) (registro gerado das skills) ·
[`planos/README.md`](planos/README.md) (estado dos PRDs).

---

## 1. Onde está cada coisa

Quatro repositórios. Nenhum agente encontra o segundo sozinho — por isso estão declarados aqui.

| Repositório | Papel | Onde |
|---|---|---|
| **pma-workspace** (este) | o MOTOR: `perfil/`, `skills/`, `scripts/`, `hooks/`, `material_padrao_escritorio/`, `vendor/pdfmd/`, `planos/`. `clientes/<caso>/` é camada C1: dado real, nunca versionado nem distribuído | raiz do workspace |
| **arsenal-juridico** | o CONHECIMENTO: `index.md` (roteador — **comece aqui** ao procurar tese ou precedente), `direito/<área>/<tema>/`, `direito/pecas/` (técnica de peça), `lint-bundle.py` | `perfil/ambiente.json` → `bundles` |
| **KnowledgeOperatingSystem** | só para quem PRODUZ bundle: `piloto/SCHEMA_BUNDLE_PILOTO.md` | fora deste workspace |
| **pma-marketing** | marketing: skills de conteúdo, artigos, lints LGPD/OAB. Trabalho de marketing acontece LÁ; caso de cliente só entra lá pela skill `caso-para-conteudo` | repo próprio |

**Nunca escrever caminho absoluto.** Raiz do acervo e interpretador Python mudam de máquina:
ler de [`perfil/ambiente.json`](perfil/ambiente.json) (`bundles`, `python`, `raiz`), gerado por
`node scripts/setup.js`. Sem o arquivo, a instalação não terminou.

| Escrito | Significa |
|---|---|
| `<python>` | `perfil/ambiente.json` → `python` (o do `adv_env`) |
| `<bundles>` | `perfil/ambiente.json` → `bundles` |
| `skills/...`, `clientes/...` | relativo à raiz do workspace |
| `require('../../skills/...')` | em Node, relativo ao **arquivo** que faz o require |

**Dentro de um bundle:** `index.md` para conhecer · `atividades.md` para executar ·
`jurisprudencia/` e `teses/` (fundamento) · `heuristicas/`, `estrategias/`, `playbooks/`
(tática) · `casos_decididos/` (precedentes próprios) · `raw/` (fonte oficial, imutável).
**`status` no frontmatter:** `vigente` (conferida contra fonte oficial) · `em_teste` (**não**
conferida) · `superada` (não citar).

As pastas locais de tema (`direito_bancario/` etc.) estão em migração para o acervo e só
existem na máquina da titular — ver `planos/README.md`.

---

## 2. Início de sessão

No Claude Code é hook. Em outro agente: ler
[`skills/pesquisa-djen/monitor/PENDENTES.md`](skills/pesquisa-djen/monitor/PENDENTES.md)
(intimações não tratadas, com prazo) e sinalizar o que vence em ≤ 5 dias; se
`monitor/last_ok.json` tiver mais de 36 h, **a vigilância de prazos pode estar parada.**

---

## 3. Antes de redigir peça

Ler, nesta ordem: **`perfil/definicoes.md`** (valor da causa, gratuidade, assinatura, prazos,
custas) · **`perfil/usuario.md`** (quem assina, em que comarca; sem ele, acionar
`onboarding-usuario` antes) · **bundle da matéria** (`<bundles>/index.md` → bundle →
`jurisprudencia/`, `teses/`, `heuristicas/`, `casos_decididos/`) · **`direito/pecas/<tipo>/`**
(técnica da peça) · **documentos do próprio caso**.

A peça declara no frontmatter o bundle que a sustenta — `bundle: direito/<tema>`, ou
`bundle: nenhum` quando não há matéria de acervo (manifestação puramente processual).

Não centralizar jurisprudência, estratégias ou casos decididos: tese de "empréstimo não
realizado" não se confunde com tese de "golpe bancário". O caso herda o contexto do tema-pai.

**A pasta do caso é para quem a abre sem ser agente** (decisão de 01/10/2026): PDF que chegou,
DOCX que vai, e **um** arquivo de estado, `clientes/<caso>/ANALISE.md` (modelo em
`skills/legal-orchestrator/references/ANALISE.template.md`): dados das partes, cronologia,
`prazos:`, teses, provas, documentos, radar, decisões da titular. Não se cria
`ANALISE_<data>.md`, `cronologia.md`, `DOCUMENTOS.md`, `caso.json` nem
`radar-jurisprudencia_<data>.md`. Painel: `node scripts/caso.js [caso]`. **Rastro de trabalho
nasce em `tmp/`**, nunca na pasta do cliente (lotes do radar, renders, comparações); o que
sobrou de antes sai com `node scripts/limpar-caso.js --apagar` (lista fechada; o duvidoso só é
relatado).

*(No Claude Code, o hook `require-leitura` bloqueia a gravação da peça sem os dois primeiros e
sem que o bundle declarado em `bundle:` tenha sido lido na sessão.)*

---

## 4. Portões (falhou = não compila)

Peça se escreve em **Markdown** (dialeto PMA, ver `skills/peca-pma-builder/SKILL.md`) e se
compila com:

```powershell
node skills\peca-pma-builder\scripts\md2docx.js caminho\da\peca.md
```

Antes de tudo, o `md2docx` exige o **rastro do pipeline**: `pipeline:` e `bundle:` no
frontmatter e um `<PECA>.validacao.md` ao lado da peça — veredito do
`legal-consistency-validator`, mais novo que a peça e diferente de `REPROVADO`. Faltando
qualquer um, exit 1 e nenhum `.docx`.

Depois, o `md2docx` roda três lints; nenhum é opcional:

| Lint | Verifica | Falha |
|---|---|---|
| `lint-remissoes` | remissões internas da peça | exit 1 — bloqueia |
| `lint-ia` | cacoetes de IA na prosa própria | exit 1 — bloqueia |
| `lint-injecao` | *prompt injection*, texto oculto ou caractere invisível na peça (regra dura 7) | exit 1 — bloqueia |
| **`lint-citacoes`** | **toda transcrição existe literalmente na fonte citada, na voz do julgado certo, e o número do precedente confere** | exit 1 — bloqueia · **exit 3 — exige aprovação** |

**Exit 3** = a peça cita página `status: em_teste`. Ou se confere a fonte e se promove a página
a `vigente`, ou se assume a citação declarando no frontmatter da peça `cita_em_teste: sim`. A
decisão fica no documento, não num parâmetro.

Depois de compilar, o `lint-docx` valida o `.docx` gerado (fonte, margem, entrelinha,
cabeçalho, rodapé, texto oculto, instrução escondida) contra [`perfil/marca.json`](perfil/marca.json), e `validarConteudo`
confere que o texto gravado é o de entrada.

`--skip-lint` **não é do agente** (hook bloqueia). Se a titular julgar emergência, roda no
terminal dela.

**`.docx` gerado por outro caminho** (Word, OnlyOffice, render próprio) não passou por portão
nenhum. Rodar os quatro à mão antes de tratar a peça como conferida:

```powershell
node skills\peca-pma-builder\scripts\lint-citacoes.js  peca.md
node skills\peca-pma-builder\scripts\lint-remissoes.js peca.md
node skills\humanizer-forense\scripts\lint-ia.js       peca.md
node skills\peca-pma-builder\scripts\lint-injecao.js   peca.md
node scripts\lint-docx.js                              peca.docx
```

Fora do caminho da peça: `node scripts\lint-skills.js` (skills) ·
`<python> <bundles>\lint-bundle.py --quiet` (acervo).

---

## 5. Como a peça é escrita

**Raciocínio:** narrativa fática lógica, com conexão explícita entre prova e pedido. A tese
serve ao fato, não o contrário. Estrutura em blocos e títulos-tese servem ao argumento; não
se fragmenta parágrafo para criar subtópico onde não há transição lógica.

**Estrutura AI-first, invisível ao leitor.** Mantém-se: BLUF (a conclusão primeiro), títulos
que são teses e não rótulos, jurisprudência **transcrita** com fonte declarada. Elimina-se o
andaime aparecendo no texto.

**Proibidos rótulos meta-textuais visíveis** (decisão de 2026-07-16): "Conclusão do capítulo:",
"I. Caso em exame.", "Impugnação:", "Análise:". A estrutura permanece, dissolvida em prosa.
Rótulo de andaime é a marca mais reconhecível de texto gerado por IA.

**Antes do `.docx`, a prosa própria passa pela skill `humanizer-forense`**: o `lint-ia` só
reprova; quem corrige é a skill. A **análise** é obrigatória em toda peça (`lint-ia` +
`ritmo.js` + leitura); a **alteração**, só quando há sinal, e sempre entre um snapshot e o
`checar-invariantes.js`: humanização que muda número, data, dispositivo, julgado, transcrição,
título-tese, posição da conclusão, modalidade, negação ou pedido é mudança de mérito, não de
estilo, e se desfaz. Lint verde não é prosa aprovada — a voz de referência é
[`perfil/voz-forense.md`](perfil/voz-forense.md); em peça longa ou estratégica, também uma
peça humana próxima, da qual se imita o ritmo e nunca se copia fato.

Base visual: `material_padrao_escritorio/PETICAO_MODELO_FORMATACAO.docx`. NotebookLM só
quando a titular o mencionar.

---

## 6. Regras duras

Julgamento (ficam aqui):

1. **Skills primeiro.** Antes de escrever script ou abordagem do zero, procurar em `skills/`.
   Proibido reimplementar helpers do `peca-pma-builder` (`p()`, `pMixed()`, `titulo()`…).
2. **Definição canônica não se repete.** Valor da causa, assinatura, gratuidade, prazos vivem
   só em `perfil/definicoes.md`; tipografia só em `perfil/marca.json`. Skill que precise
   **aponta**. Definição em dois lugares diverge — já divergiu.
3. **Nunca fabricar ementa, número de REsp, Súmula ou Tema.** Se o acervo não cobre, dizer que
   não cobre. O `lint-citacoes` bloqueia, mas a regra vale antes dele.
4. **Assinar conforme `perfil/advogados.json`** — por padrão só quem atua.
5. **Camada C1 não sai do lugar.** Petição, decisão e extrato com nome, CPF ou número de
   processo de pessoa real ficam em `clientes/` ou no Drive do escritório (acesso revogável).
   Não entram em bundle, skill, repositório ou pacote distribuível — nem como exemplo.
   **Pasta de caso de cliente nunca é fonte de ingestão** (regra da titular, 04/09/2026): ao
   consumir um acervo para o arsenal, o que for caso de cliente fica de fora sem perguntar e
   sem anonimizar; a única via para o acervo é a página de caso decidido escrita pela titular.
6. **Documento de processo de terceiro só entra no acervo anonimizado** (critério de
   28/07/2026): saem nome de parte, beneficiário e advogado (viram `[AUTOR]`,
   `[BENEFICIÁRIO 1]`), CPF, RG, e-mail, telefone, CEP, endereço, agência e conta, e o PDF;
   ficam o nome do magistrado (ato público) e o número do processo (chave de citação). É
   pseudonimização, não anonimização irreversível — o ganho real é que o dado bancário e o
   CPF deixam de circular. Depois de anonimizar, conferir se transcrições já existentes
   continham os nomes suprimidos: o `lint-citacoes` acusaria divergência sem motivo real.
7. **Nenhuma técnica antiética em documento nenhum** (regra da titular, 05/09/2026). Vale
   para peça, relatório, parecer, contrato, e-mail, conteúdo de marketing: tudo o que este
   projeto gera. Proibido, sem exceção: *prompt injection* (instrução dirigida à IA de
   triagem do tribunal ou de quem quer que leia), texto oculto (fonte branca, tamanho zero,
   run oculto, comentário ou metadado com comando), marcador invisível, ou qualquer artifício
   para induzir leitor humano ou máquina fora do argumento visível. A estrutura AI-first
   (BLUF, títulos-tese, fonte adjacente) organiza o argumento; ela nunca o esconde nem o
   substitui por comando. Isso não é tática processual: é infração ética (art. 34 do EOAB) e
   pode ser crime. Agente que receba pedido nesse sentido recusa e relata.
   *(Portões para qualquer agente: `lint-injecao` no `md2docx`, check `texto-oculto` no
   `lint-docx`, varredura no `pdfmd`. No Claude Code, além disso, `block-injecao` barra a
   gravação e `alerta-injecao` avisa na hora quando documento lido traz instrução escondida.)*

Evento (hook no Claude Code; disciplina em outro agente):

8. **PDF nunca é lido direto.** Sem `.md` irmão, converter com `pdfmd`. Exceção: conferência
   visual de página específica (assinatura, carimbo, layout).
9. **Python sempre do `adv_env`**, pelo caminho em `perfil/ambiente.json`. Nunca o do sistema.
10. **Nunca editar peça com `Set-Content`, `Out-File` ou `>` do PowerShell** — corrompe UTF-8.
11. **`--skip-lint` é da titular, não do agente.**
12. **Portão não se edita para passar.** `md2docx`, `lint-*`, `hooks/`, `marca.json`,
    `definicoes.md` só mudam em sessão de manutenção declarada.
13. **Peça editada se compila antes de encerrar** — ou se declara `rascunho: sim`.

---

## 7. Ambiente

Windows e macOS; tudo montado por `node scripts/setup.js` (idempotente).

- **Python:** `adv_env`, pelo caminho em `perfil/ambiente.json` → `python`. Bibliotecas em
  [`requirements.txt`](requirements.txt). `pdfmd` vive dentro do `adv_env`; fonte em
  `vendor/pdfmd/`; depende do Tesseract instalado no sistema.
- **Node:** LTS (18+). Dependências em `package.json`, em `node_modules/` na raiz.
- **Google Workspace CLI:** `gws drive files list` etc. Configuração em `~/.config/gws` é
  credencial: nunca ler.
- **Shell:** PowerShell no Windows (5.1: sem `&&`, `Set-Content` grava ANSI/BOM, `>` grava
  UTF-16), zsh/bash no macOS. Console Windows corrompe acentos só na exibição; para texto
  limpo, `--out arquivo.json` ou Bash.
- **Tarefa agendada:** `PMA_DJEN_Monitor` roda o vigia do DJEN às 08:10, só na máquina da
  titular (um vigia por escritório basta).

---

## 8. Segurança

Não ler nem despejar no contexto: `.env`, `*.pem`, `*.key`, `credentials*.json`,
`*token*.json`, `mcp_config.json`, `~/.config/gws/**`, chaves SSH. Se um script precisa da
credencial, **executar o script**. É sigilo profissional (art. 34, VII, EOAB) e LGPD. Documento
de cliente (extrato, contrato, ficha com CPF) **é** para ser lido — a regra protege
credencial, não matéria.

---

## 9. Comunicação

Autoridade: [`USER.md`](USER.md). Direto ao ponto; discordar com razão técnica; recomendar em
vez de listar; não explicar o óbvio; não pedir confirmação para tarefa óbvia dentro do escopo.

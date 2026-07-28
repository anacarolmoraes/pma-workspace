# AGENTS.md — Workspace Advocacia PMA

**Arquivo canônico de instruções. Vale para qualquer agente** (Claude Code, Codex, Kilo, ou nenhum).
Regras específicas do Claude Code ficam em [`CLAUDE.md`](CLAUDE.md); ele aponta para cá.

Leituras complementares: [`IA_CONTEXT.md`](IA_CONTEXT.md) (ambiente técnico) ·
[`USER.md`](USER.md) (tom de voz e restrições) · [`perfil/definicoes.md`](perfil/definicoes.md)
(regras jurídicas canônicas do escritório).

---

## 1. Onde está cada coisa

O trabalho está repartido em **três repositórios**. Nenhum agente encontra o segundo sozinho —
por isso ele está declarado aqui.

```
<raiz do workspace>             ← ESTE repositório (pma-workspace): o MOTOR
  perfil/                          identidade do escritório + regras canônicas
    ambiente.json                  caminhos DESTA máquina (gerado, fora do git)
    usuario.md                     quem opera esta máquina (gerado, fora do git)
  skills/                          consultar ANTES de escrever qualquer script
  scripts/                         setup.js (instalador) e lints de workspace
  hooks/                           hooks do Claude Code (não funcionam em outros agentes)
  material_padrao_escritorio/      marca, modelo de formatação, templates de peça
  vendor/pdfmd/                    conversor de PDF, embarcado no repositório
  planos/                          PRDs de evolução do sistema
  clientes/<nome>/                 camada C1: dado real de cliente. NUNCA versionar
                                   nem distribuir. Migra para o Drive do escritório

<acervo>                        ← arsenal-juridico: CONHECIMENTO (repo SEPARADO)
  index.md                         roteador global — COMECE AQUI ao procurar tese ou precedente
  direito/bancario/emprestimo-nao-realizado/
  direito/bancario/golpes/
  direito/imobiliario/
  direito/cobranca-honorarios/
  direito/pecas/                   transversal: técnica de peça, independente de matéria
  lint-bundle.py                   verificação estrutural do acervo

<KnowledgeOperatingSystem>       ← só para quem PRODUZ bundle
  piloto/SCHEMA_BUNDLE_PILOTO.md   contrato que disciplina a produção dos bundles
```

**Nunca escrever caminho absoluto.** A raiz do acervo e o interpretador Python mudam de
máquina e de sistema operacional: leia de [`perfil/ambiente.json`](perfil/ambiente.json)
(chaves `bundles`, `python`, `raiz`), gerado pelo `scripts/setup.js`. Se o arquivo não
existir, a instalação não terminou — rodar `node scripts/setup.js`.

**Convenção nas skills e comandos:**

| Escrito | Significa |
|---|---|
| `<python>` | `perfil/ambiente.json` → `python` (o interpretador do `adv_env`) |
| `<bundles>` | `perfil/ambiente.json` → `bundles` (raiz do arsenal-juridico) |
| `skills/...`, `clientes/...` | relativo à **raiz do workspace** |
| `require('../../skills/...')` | em código Node, relativo ao **arquivo** que faz o require |

Resolver o marcador na hora de executar. Exemplo em PowerShell:
`$py = (Get-Content perfil\ambiente.json -Raw | ConvertFrom-Json).python`.

O acervo local por tema (`direito_bancario/`, `direito_digital/`, `rescisao_contrato_imovel/`,
`recursos_gerais/`, `cobranca_honorarios/`) está **em migração para o arsenal-juridico** e não
é versionado: a auditoria de 28/07/2026 encontrou nele documento bruto de processo, com CPF de
terceiros, misturado à jurisprudência pública. Enquanto a migração não termina, essas pastas
existem só na máquina da titular.

**Dentro de um bundle:** `index.md` para conhecer · `atividades.md` para executar ·
`jurisprudencia/` e `teses/` (fundamento) · `heuristicas/`, `estrategias/`, `playbooks/`
(tática do escritório) · `casos_decididos/` (precedentes próprios) · `raw/` (fonte oficial
depositada, imutável).

**`status` no frontmatter de cada página:** `vigente` (conferida contra fonte oficial) ·
`em_teste` (**não** conferida) · `superada` (não citar).

---

## 2. Início de sessão

1. Ler [`skills/pesquisa-djen/monitor/PENDENTES.md`](skills/pesquisa-djen/monitor/PENDENTES.md) —
   fila de intimações não tratadas, com prazo calculado. Sinalizar o que vence em ≤ 5 dias.
2. Se `monitor/last_ok.json` tiver mais de 36 h, avisar: **a vigilância de prazos pode estar parada.**

*(No Claude Code isso é automático — hook `SessionStart`. Em outros agentes, é passo manual.)*

---

## 3. Protocolo de leitura antes de redigir peça — REGRA INVIOLÁVEL

Antes de escrever **qualquer** peça (inicial, contestação, réplica, apelação, embargos,
manifestação), ler nesta ordem:

1. **`perfil/definicoes.md`** — valor da causa, gratuidade, assinatura, prazos, custas.
2. **`perfil/usuario.md`** — quem assina, em que comarca. Se não existir, acionar
   `onboarding-usuario` antes de redigir.
3. **Bundle da matéria** (`<bundles>/index.md` → bundle → `index.md`): `jurisprudencia/`,
   `teses/`, `heuristicas/`, `casos_decididos/`.
4. **`direito/pecas/<tipo>/`** — técnica da peça (playbooks e heurísticas por tipo de recurso).
5. **Acervo local do tema-pai**, se ainda existir na máquina (em migração — ver §1).
6. **Documentos do próprio caso** — `INICIAL.md`, `CONTESTACAO.md`, `SENTENCA.md`, `REPLICA.md`.

Não centralizar `jurisprudencia`, `estrategias` ou `casos_decididos`: tese de "empréstimo não
realizado" não se confunde com tese de "golpe bancário". O caso herda o contexto do tema-pai.

---

## 4. Portões automáticos (falhou = não compila)

Peça se escreve em **Markdown** (dialeto PMA) e se compila com:

```powershell
node skills\peca-pma-builder\scripts\md2docx.js caminho\da\peca.md
```

O `md2docx` roda três lints antes de gerar o `.docx`. Nenhum deles é opcional:

| Lint | Verifica | Falha |
|---|---|---|
| `lint-remissoes` | remissões internas da peça | exit 1 — bloqueia |
| `lint-ia` | cacoetes de IA na prosa | exit 1 — bloqueia |
| **`lint-citacoes`** | **toda transcrição existe literalmente na fonte citada, e o número do precedente confere** | exit 1 — bloqueia · **exit 3 — exige aprovação** |

**Exit 3** significa que a peça cita página `status: em_teste`. Não é erro de redação: ou se
confere a fonte e se promove a página a `vigente`, ou se assume a citação declarando no
frontmatter da peça:

```yaml
cita_em_teste: sim
```

A decisão fica registrada no documento, não num parâmetro de linha de comando.

Depois de compilar, o `md2docx` roda ainda o **`lint-docx`**, que valida o `.docx` gerado
(fonte, margem, entrelinha, cabeçalho, rodapé, banner) contra
[`perfil/marca.json`](perfil/marca.json).

`--skip-lint` existe e é **para emergência**, não para conveniência.

### Gerou o `.docx` por outro caminho?

Se por qualquer razão o `.docx` **não** vier do `md2docx` (render próprio, Word, OnlyOffice),
os portões de entrada não rodaram. Nesse caso é **obrigatório** rodar os quatro à mão:

```powershell
node skills\peca-pma-builder\scripts\lint-citacoes.js  peca.md
node skills\peca-pma-builder\scripts\lint-remissoes.js peca.md
node skills\humanizer-forense\scripts\lint-ia.js       peca.md
node scripts\lint-docx.js                              peca.docx
```

O `lint-docx` valida o **artefato**, então funciona sobre qualquer `.docx`, tenha vindo de
onde tiver vindo. Os outros três dependem do `.md` — sem ele, não há o que verificar, e a
peça não pode ser protocolada como conferida.

Outros lints, fora do caminho da peça:

```powershell
node scripts\lint-skills.js                     # integridade das skills
<python> <bundles>\lint-bundle.py --quiet       # integridade do acervo
```

`<python>` e `<bundles>` saem de [`perfil/ambiente.json`](perfil/ambiente.json). No macOS os
mesmos comandos rodam trocando `\` por `/`.

---

## 5. Como a peça é escrita

**Raciocínio:** narrativa fática lógica, com conexão explícita entre prova e pedido. A tese
serve ao fato, não o contrário.

**Estrutura AI-first, invisível ao leitor.** Mantém-se: BLUF (a conclusão primeiro), títulos que
são teses e não rótulos, jurisprudência **transcrita** com fonte declarada. Elimina-se: o
andaime aparecendo no texto.

**Proibidos rótulos meta-textuais visíveis** (decisão de 2026-07-16): "Conclusão do capítulo:",
"I. Caso em exame.", "Impugnação:", "Análise:". A estrutura permanece — dissolvida em prosa
natural. Rótulo de andaime é a marca mais reconhecível de texto gerado por IA.

**Antes de gerar o `.docx`, passar a prosa própria pela skill `humanizer-forense`** (`lint-ia.js`
+ correções): remove cacoetes de IA sem tocar na estrutura nem nas transcrições. O `md2docx` roda
o `lint-ia` como portão, mas o portão só reprova — quem corrige é a skill.

Bases visuais e estratégicas: `material_padrao_escritorio/PETICAO_MODELO_FORMATACAO.docx` e,
quando mencionado explicitamente pela titular, o NotebookLM.

---

## 6. Regras duras

1. **Skills primeiro.** Antes de escrever script ou abordagem do zero, procurar em `skills/`.
   Proibido reimplementar helpers do `peca-pma-builder` (`p()`, `pMixed()`, `titulo()`…).
2. **Definição canônica não se repete.** Valor da causa, assinatura, gratuidade, prazos e
   tipografia vivem só em `perfil/definicoes.md`. Uma skill que precise de uma delas **aponta**
   para o arquivo. Definição escrita em dois lugares diverge — já divergiu.
3. **PDF nunca é lido direto.** Sem o `.md` irmão, converter com a skill `pdfmd` e ler o `.md`.
   Exceção única: conferência visual de layout, assinatura ou carimbo.
4. **Nunca fabricar ementa, número de REsp, Súmula ou Tema.** Se o acervo não cobre, dizer que
   não cobre. O `lint-citacoes` bloqueia, mas a regra vale antes dele.
5. **Python sempre do `adv_env`**, pelo caminho em `perfil/ambiente.json` → `python`, nunca o
   do sistema e nunca escrito à mão. O `pdfmd` mora nesse mesmo ambiente.
6. **Nunca editar peça com `Set-Content` ou `-replace` do PowerShell** — corrompe o UTF-8. Usar
   ferramenta de edição de arquivo.
7. **Camada C1 não sai do lugar.** `clientes/` não vai para bundle, nem para repositório, nem
   para pacote distribuível. Vale para **qualquer** documento de caso, onde quer que esteja:
   petição, decisão e extrato com nome, CPF ou número de processo de pessoa real ficam fora
   do git — inclusive dentro de pasta de skill ou de tema. Se precisar circular, vai pelo
   Drive do escritório, onde o acesso é revogável.
8. **Assinar conforme `perfil/advogados.json`** — por padrão só quem atua.
9. **Caso de cliente não vira conteúdo de marketing por cópia.** Só despersonalizado, sem
   número de processo (ele identifica as partes em consulta pública) e com aprovação humana.
10. **Documento de processo de terceiro só entra no acervo anonimizado** — critério fixado em
    28/07/2026 e aplicado à cadeia "golpe":

    | Sai | Fica |
    |---|---|
    | nome de parte, de beneficiário e de advogado → rótulo de papel (`[AUTOR]`, `[BENEFICIÁRIO 1]`) | nome do magistrado — assinar decisão é ato público do Estado |
    | CPF, RG, e-mail, telefone, CEP, endereço, agência e conta | número do processo — é a chave de citação do precedente |
    | o PDF (binário não se redige com segurança nem se confere) | o `.md` anonimizado, com aviso no cabeçalho |

    Manter o número do processo torna isto **pseudonimização**, não anonimização
    irreversível: o feito é público e consultável. O ganho real é que CPF, RG, telefone,
    e-mail e conta bancária deixam de circular — esses não estão na consulta pública.
    Depois de anonimizar, conferir se as transcrições já existentes nas páginas de trabalho
    não continham os nomes suprimidos: se continham, o `lint-citacoes` passaria a acusar
    divergência e bloquearia peça sem motivo real.

---

## 7. Ambiente

O workspace roda em **Windows e macOS**. Tudo é montado por `node scripts/setup.js`, que pode
ser rodado quantas vezes for preciso.

- **Python:** o do `adv_env`, sempre pelo caminho em `perfil/ambiente.json` → `python`
  (Windows: `adv_env\Scripts\python.exe` · macOS: `adv_env/bin/python`). Nunca o do sistema.
  Bibliotecas declaradas em [`requirements.txt`](requirements.txt) — entre elas pdfplumber,
  PyMuPDF, python-docx, openpyxl, faster-whisper, playwright, pytesseract.
- **Conversor de PDF:** `pdfmd` vive **dentro do `adv_env`** (não tem mais ambiente próprio);
  o código-fonte está em `vendor/pdfmd/`. Depende do programa Tesseract instalado no sistema.
- **Node:** LTS (18+). Dependências em [`package.json`](package.json), instaladas em
  `node_modules/` na raiz — não depender mais de pacote global.
- **Google Workspace CLI:** `gws drive files list` etc.
- **Shell:** PowerShell no Windows, zsh/bash no macOS. Armadilhas de sintaxe em
  [`IA_CONTEXT.md`](IA_CONTEXT.md).
- **Tarefa agendada:** `PMA_DJEN_Monitor` roda o vigia do DJEN diariamente às 08:10 — existe
  só na máquina da titular (um vigia por escritório basta).

---

## 8. Segurança

Não ler nem despejar no contexto: `.env`, `*.pem`, `*.key`, `credentials*.json`, `*token*.json`,
`mcp_config.json`, `~/.config/gws/**`, chaves SSH. Se um script precisa da credencial, **executar
o script** — ele lê o arquivo sem trazer o conteúdo para o contexto.

Isso é sigilo profissional (art. 34, VII, EOAB) e LGPD, não zelo de desenvolvedor. Documento de
cliente (extrato, contrato, ficha com CPF) **é** para ser lido — a regra protege credencial,
não matéria.

*(No Claude Code há hook `PreToolUse` que bloqueia. Em outros agentes, é disciplina.)*

---

## 9. Comunicação

Autoridade máxima: [`USER.md`](USER.md). Em resumo: direto ao ponto, sem preâmbulo nem
disclaimer; discordar com razão técnica em vez de validar ideia fraca; recomendar em vez de
listar opções; não explicar o óbvio; não pedir confirmação para tarefa óbvia dentro do escopo.

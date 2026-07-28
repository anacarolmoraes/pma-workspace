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
D:\WORK\advocacia\              ← ESTE workspace: casos, skills, ferramentas
  clientes/<nome>/                 camada C1: dados reais de cliente. NUNCA versionar nem distribuir
  perfil/                          identidade + regras canônicas do escritório
  skills/                          46 skills — consultar ANTES de escrever qualquer script
  scripts/                         lints de workspace
  hooks/                           hooks do Claude Code (não funcionam em outros agentes)
  material_padrao_escritorio/      marca, modelo de formatação, templates de peça
  planos/                          PRDs de evolução do sistema
  direito_bancario/, direito_digital/, rescisao_contrato_imovel/, recursos_gerais/
                                   acervo local por tema (jurisprudencia_stj/, estrategias/, casos_decididos/)

D:\GITHUB\bundles\              ← ACERVO DE CONHECIMENTO (repositório SEPARADO)
  index.md                         roteador global — COMECE AQUI ao procurar tese ou precedente
  direito/bancario/emprestimo-nao-realizado/
  direito/bancario/golpes/
  direito/imobiliario/
  direito/cobranca-honorarios/
  direito/pecas/                   transversal: técnica de peça, independente de matéria
  lint-bundle.py                   verificação estrutural do acervo

D:\GITHUB\KnowledgeOperatingSystem\
  piloto/SCHEMA_BUNDLE_PILOTO.md   contrato que disciplina a produção dos bundles
```

O caminho dos bundles é lido de [`perfil/perfil.json`](perfil/perfil.json) → `caminhos.bundles`.
Use essa chave em vez de escrever o caminho em código novo.

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
2. **Bundle da matéria** (`D:\GITHUB\bundles\index.md` → bundle → `index.md`): `jurisprudencia/`,
   `teses/`, `heuristicas/`, `casos_decididos/`.
3. **`direito/pecas/<tipo>/`** — técnica da peça (playbooks e heurísticas por tipo de recurso).
4. **Acervo local do tema-pai**, quando o caso estiver em `direito_bancario/<tema>/` etc.
5. **Documentos do próprio caso** — `INICIAL.md`, `CONTESTACAO.md`, `SENTENCA.md`, `REPLICA.md`.

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
node scripts\lint-skills.js                                        # integridade das skills
python D:\GITHUB\bundles\lint-bundle.py --quiet                     # integridade do acervo
```

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
5. **Python sempre do `adv_env`** (`adv_env\Scripts\python.exe`), nunca o global. O `pdfmd` tem
   ambiente próprio (`pdfmd\pdfmd_env`).
6. **Nunca editar peça com `Set-Content` ou `-replace` do PowerShell** — corrompe o UTF-8. Usar
   ferramenta de edição de arquivo.
7. **Camada C1 não sai do lugar.** `clientes/` não vai para bundle, nem para repositório, nem
   para pacote distribuível.
8. **Assinar conforme `perfil/advogados.json`** — por padrão só quem atua.

---

## 7. Ambiente

- **Python:** `D:\WORK\advocacia\adv_env\Scripts\python.exe` · libs: pandas, openpyxl, pdfplumber,
  google-api-python-client, whisper.
- **Node:** LTS. `docx` instalado globalmente em `C:\Users\anamo\AppData\Roaming\npm\node_modules`.
- **Google Workspace CLI:** `gws drive files list` etc. Config em `C:\Users\anamo\.config\gws`.
- **Shell padrão:** PowerShell. Sintaxe e armadilhas em [`IA_CONTEXT.md`](IA_CONTEXT.md).
- **Tarefa agendada:** `PMA_DJEN_Monitor` roda o vigia do DJEN diariamente às 08:10.

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

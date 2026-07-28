# Advocacia PMA — Workspace

Sistema AI-first do escritório Paulo Moraes Advocacia.

> Leitura obrigatória para qualquer agente: **[AGENTS.md](AGENTS.md)** (canônico) · [IA_CONTEXT.md](IA_CONTEXT.md) · [USER.md](USER.md) · [perfil/definicoes.md](perfil/definicoes.md).
> Específico do Claude Code (hooks, skills, memória): [CLAUDE.md](CLAUDE.md).
> Este README é para uso humano — fluxos de trabalho práticos.

---

## 📚 Arquitetura — conhecimento organizado por tema

```
<area>/<tema>/
├── jurisprudencia_stj/   ← ementas/teses STJ aplicáveis ao tema (.md + .pdf)
├── estrategias/          ← táticas validadas pelo escritório
├── casos_decididos/      ← peças-modelo, sentenças favoráveis do próprio escritório
└── <caso>/               ← caso concreto (Marly, Bolívar, Alex...)
    ├── INICIAL.md, SENTENCA.md, REPLICA.md, ...
    ├── APELACAO_<NOME>.md, APELACAO_<NOME>.docx
    └── _gerar_apelacao.js
```

**Por que assim:** tese de "empréstimo não realizado" ≠ tese de "golpe bancário". Centralizar misturaria. O caso herda automaticamente o contexto do tema-pai.

**Nomenclatura canônica:** `jurisprudencia_stj` (lowercase), `estrategias` (sem typo), `casos_decididos` (snake_case).

---

## 🚀 Fluxos típicos

### 1. Pedir uma apelação ao Claude

**Pré-requisito:** caso já tem `SENTENCA.md`, `INICIAL.md`, `REPLICA.md` (PDFs convertidos via `pdfmd` se necessário).

**Comando:**
```
Revise a apelação do caso <nome> em clientes/<nome>/
```

O Claude vai (skill `apelacao-cirurgica` é acionada automaticamente):

1. Ler o bundle da matéria no acervo `arsenal-juridico` — `jurisprudencia/`, `teses/`, `heuristicas/`, `casos_decididos/` (protocolo do [AGENTS.md](AGENTS.md) §3)
2. Ler os docs do próprio caso (sentença, inicial, réplica, contestação)
3. Montar mapa de impugnação cirúrgica (trecho da sentença ↔ vício ↔ tese que neutraliza)
4. Redigir `APELACAO_<NOME>.md` na estrutura I→II→III→IV→V
5. Gerar `APELACAO_<NOME>.docx` via [`peca-pma-builder`](skills/peca-pma-builder/)
6. Entregar os dois arquivos + um resumo do que foi impugnado

### 2. Regerar manualmente o .docx de uma apelação

Já existe um `_gerar_apelacao.js` no diretório do caso (criado pelo Claude).

```powershell
cd clientes\<nome>
node _gerar_apelacao.js
# → OK: ...\APELACAO_<NOME>.docx
```

Banner, logo, paginação, Montserrat 12pt, margens 3cm, entrelinha 1,3 saem automaticamente — vêm da skill [`peca-pma-builder`](skills/peca-pma-builder/).

### 3. Criar um gerador para uma peça nova (qualquer caso)

Esqueleto mínimo (≈30 linhas):
```js
const path = require('path');
// caminho relativo a partir do arquivo — nunca absoluto (quebra em outra máquina)
const { p, pMixed, pQuote, pCentered, titulo, subtitulo,
        endereco, quebra, pageBreak, assinatura, buildDoc }
  = require('../../skills/peca-pma-builder');

const conteudo = [
  ...endereco([ 'EXMO. SR. JUIZ...', 'COMARCA DE...' ]),
  quebra(),
  pMixed([{ text: 'Processo nº ', bold: true }, { text: '0000-00.0000.0.00.0000', bold: true }]),
  // ...
  titulo('I.', 'Síntese'),
  p('Texto da síntese...'),
  pQuote('Citação literal de algo (sentença, ementa, contrato).'),
  subtitulo('I.1.', 'Subseção'),
  pMixed([{ text: 'Texto com ' }, { text: 'negrito inline', bold: true }, { text: '.' }]),
  // ...
  ...assinatura(
    [{ nome: 'ANA CAROLINA RIBEIRO DE MORAES PAULO', oab: 'OAB/TO 6573' }],
    { localData: 'Palmas — TO, data por extenso.' }
  ),
];

buildDoc({
  titulo: 'Título da peça',
  processo: 'nº do processo',
  conteudo,
  outPath: path.join(__dirname, 'PECA.docx'),
}).then(console.log).catch(e => { console.error(e); process.exit(1); });
```

API completa em [`skills/peca-pma-builder/SKILL.md`](skills/peca-pma-builder/SKILL.md).

### 4. Adicionar nova tese ou ementa ao tema

Salve o `.md` (de preferência com o `.pdf` correspondente ao lado) em `<area>/<tema>/jurisprudencia_stj/`. A próxima peça naquele tema já lerá automaticamente.

**Convenção de nome:**
```
EMENTA_<curto-descritivo>.md
EMENTA_<curto-descritivo>.pdf
<acordao-ou-resp>_<numero>_<uf>_<assunto>.md
```

### 5. Adicionar nova estratégia validada

Em `<area>/<tema>/estrategias/<nome>.md`. Formato livre. Sugestão: começar com **"Quando usar"** e **"O que argumentar"**, com referências cruzadas para teses STJ aplicáveis.

### 6. Adicionar precedente favorável do escritório

Em `<area>/<tema>/casos_decididos/<descritivo>.md` (e o `.docx`/`.pdf` da peça vencedora, se houver).

---

## 🛠️ Skills do workspace (resumo)

| Skill | Para quê | Trigger |
|---|---|---|
| [`apelacao-cirurgica`](skills/apelacao-cirurgica/) | Apelação cível: impugnação cirúrgica de sentença | "apelação", "apele", "revisar apelação" |
| [`legal-orchestrator`](skills/legal-orchestrator/) | Pipeline de inicial/contestação/manifestação | "elabore a inicial", "faça a contestação" |
| [`legal-writer`](skills/legal-writer/) | Redação jurídica (estilo PMA, conectivos, ritmo) | acionado pelo orchestrator |
| [`tipografia-pma`](skills/tipografia-pma/) | Regras visuais e tipográficas (Módulo 2 = cabeçalho/rodapé) | acionado pelo orchestrator |
| [`peca-pma-builder`](skills/peca-pma-builder/) | Geração de .docx (Node) — banner+logo+Montserrat | sempre que gerar .docx de peça |
| [`legal-consistency-validator`](skills/legal-consistency-validator/) | Auditoria adversarial da peça pronta | "valide", "audite" |
| [`pre-peticionamento`](skills/pre-peticionamento/) | Dossiê estratégico antes de redigir | "preparar caso", "investigar antes de peticionar" |
| [`pdfmd`](skills/pdfmd/) | Conversão de PDF para Markdown | "converta o PDF" |
| [`relatorio`](skills/relatorio/) | Relatório jurídico (formato ABNT, ./relatorios/) | "relatório", "parecer técnico" |
| [`analise-perfil`](skills/analise-perfil/) | Relatório de divergência de perfil de consumo | "análise de perfil", "relatório de perfil" |
| [`validador-extrato-pdf-excel`](skills/validador-extrato-pdf-excel/) | Cálculo/auditoria de extrato bancário | "valide o extrato", "calcule o débito" |
| [`pedido_justica_gratuita`](skills/pedido_justica_gratuita/) | Petição de gratuidade | "pedir gratuidade" |
| [`whisper-transcriber`](skills/whisper-transcriber/) | Transcrição de áudio | "transcreva o áudio" |

---

## ⚙️ Ambiente técnico

Roda em **Windows e macOS**; tudo é montado por `node scripts/setup.js`.

- **Python:** o do `adv_env`, sempre pelo caminho em `perfil/ambiente.json` → `python`. Nunca o
  do sistema, nunca escrito à mão.
- **Node:** LTS (18+). Dependências em `package.json`, instaladas em `node_modules/` na raiz.
- **PDF:** `pdfmd` vive dentro do `adv_env`; fonte em `vendor/pdfmd/`.
- **Google Workspace CLI:** `gws drive files list`, etc.
- **Shell:** PowerShell no Windows, zsh/bash no macOS. Armadilhas no [IA_CONTEXT.md](IA_CONTEXT.md).

---

## 📐 Padrão visual (resumo da tipografia-pma)

| Item | Valor |
|---|---|
| Fonte | Montserrat 12 pt (corpo e títulos) |
| Margens | 3 cm (topo, base, laterais) |
| Entrelinha | 1,3 (312 DXA) |
| Após parágrafo | 12 pt |
| Alinhamento | Justificado + hifenização automática |
| Citação em bloco | Montserrat Light 11 pt, recuo 2 cm esq + 1 cm dir, itálico |
| Cabeçalho | Banner PMA centralizado (`banner.png`, 794×59 px) |
| Rodapé | Logo PMA à direita (`logo.png`, 202×87 px) + "Página X de Y" centralizada |
| Títulos I/II/III | MAIÚSCULO + bold |
| Subtítulos I.1/I.2 | Caixa mista + bold |
| Pedidos | A) B) C) — letra + parêntese + bold |

Detalhes completos em [`skills/tipografia-pma/SKILL.md`](skills/tipografia-pma/SKILL.md).

---

## ❌ Proibições absolutas

1. **Não centralizar** `jurisprudencia_stj/`, `estrategias/` ou `casos_decididos/` — ficam por tema.
2. **Não duplicar** helpers `p()`, `pMixed()`, `titulo()` etc. em scripts locais — sempre importar de [`peca-pma-builder`](skills/peca-pma-builder/).
3. **Não rodar** Python fora do `adv_env`.
4. **Não tolerar** typos em nomes de pastas (`estategias`, `jurisprudencia_STJ`) — corrigir.
5. **Não fabricar** ementa ou número de Tema STJ. Se a jurisprudência da pasta não cobre, sinalizar.
6. **Não gerar** .docx sem cabeçalho/rodapé institucional — sempre via `peca-pma-builder`.

---

## 🔍 Onde encontrar referência

- Regras de comunicação e perfil → [USER.md](USER.md)
- Ambiente técnico, Python, GWS → [IA_CONTEXT.md](IA_CONTEXT.md)
- Arquitetura, regras invioláveis → [CLAUDE.md](CLAUDE.md)
- Padrão visual completo → [skills/tipografia-pma/SKILL.md](skills/tipografia-pma/SKILL.md)
- API do builder → [skills/peca-pma-builder/SKILL.md](skills/peca-pma-builder/SKILL.md)
- Pipeline de apelação → [skills/apelacao-cirurgica/SKILL.md](skills/apelacao-cirurgica/SKILL.md)

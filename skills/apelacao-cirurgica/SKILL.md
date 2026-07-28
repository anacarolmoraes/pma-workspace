---
name: apelacao-cirurgica
description: |
  Pipeline especializado para redação de Apelação Cível no padrão PMA: lê automaticamente
  jurisprudência STJ, estratégias e casos decididos do tema-pai, extrai trechos literais da
  sentença para impugnação cirúrgica em blockquote, monta estrutura canônica (I. Síntese →
  II. Cabimento → III. Preliminar → IV. Mérito → V. Pedidos) e gera o .docx via peca-pma-builder.
  Use sempre que o usuário pedir "revisar apelação", "elaborar apelação", "redigir recurso de
  apelação", "impugnar sentença". Triggers: "apelação", "apele", "recurso contra sentença".
---

# apelacao-cirurgica — Pipeline de Apelação Cível PMA

## Quando usar
- Pedido para redigir, revisar ou regenerar **apelação cível** em pasta de caso.
- Não usar para outros recursos (agravo de instrumento, embargos de declaração) — para esses, criar skills próprias se houver volume.

## Pré-requisitos obrigatórios
Antes de invocar esta skill, o caso deve ter:

| Arquivo | Caminho típico | Por quê |
|---|---|---|
| **Sentença convertida** | `<caso>/SENTENCA.md` | Fonte dos trechos literais a impugnar |
| **Inicial** | `<caso>/<NOME>_INICIAL.md` ou `INICIAL.md` | Identifica pedidos, ônus e a tese original |
| **Réplica** (se houver) | `<caso>/*REPLICA*.md` | Mostra o que foi reiterado após contestação |
| **Contestação** (se houver) | `<caso>/*CONT*.md` | Identifica os argumentos do banco |

PDFs sem `.md` correspondente: rodar a skill `pdfmd` **antes** de invocar esta.

## Protocolo de execução

### Etapa 1 — Leitura obrigatória de contexto
Conforme `CLAUDE.md` ("Arquitetura de Conhecimento por Tema"), leia **antes** de redigir uma única linha:

1. **`../jurisprudencia_stj/`** (todas as ementas STJ aplicáveis ao tema-pai)
2. **`../estrategias/`** (táticas validadas pelo escritório nesse tema)
3. **`../casos_decididos/`** (precedentes do próprio escritório)
4. **Documentos do próprio caso** (sentença, inicial, réplica, contestação)

Se alguma das pastas do tema-pai estiver vazia ou ausente, sinalize ao usuário e siga adiante registrando a omissão — não invente conteúdo.

### Etapa 2 — Mapa de impugnação cirúrgica
Para cada trecho relevante da sentença, monte uma linha do mapa:

| # | Trecho literal da sentença | Vício identificado | Tese/precedente que neutraliza | Onde vai na apelação |
|---|---|---|---|---|

Vícios típicos a procurar:
- Indeferimento de perícia grafotécnica → **Tema 1061/STJ**
- "Recebeu o valor, logo contratou" → **Súmula 479 + Tema 466/STJ**
- Descontos "legítimos" por presunção → circularidade lógica
- Pedido de julgamento antecipado tratado como renúncia à perícia → **art. 357 CPC**
- Omissão sobre indícios documentais de fraude → **art. 489, § 1º, IV, CPC**
- Devolução simples sem análise da boa-fé objetiva → **Tema 929/STJ** (marco 30/03/2021)

### Etapa 3 — Estrutura canônica da peça

```
[Interposição]
  Endereçamento ao juízo a quo (3ª Vara, Comarca, Estado) em negrito
  Processo nº
  Apelante (negrito), qualificada, vs. Apelado (negrito), interpõe APELAÇÃO CÍVEL...
  Efeito devolutivo e suspensivo
  Local — UF, data
  Advogadas centralizadas

[Quebra de página]

[Razões de apelação]
  RAZÕES DE APELAÇÃO (centralizado, bold)
  APELANTE: / APELADO:
  EGRÉGIO TRIBUNAL / COLENDA CÂMARA / EMINENTES DESEMBARGADORES (centralizado, bold)

I. SÍNTESE ESTRATÉGICA
  - Fatos centrais em 1-2 parágrafos
  - Indícios objetivos de fraude (numerados na prosa, não em lista)
  - Antecipação das N ordens de razões para reforma

II. DO CABIMENTO E DA TEMPESTIVIDADE
  - art. 1.009, 487 I, 1.003 § 5º
  - Gratuidade da justiça (se aplicável)

III. PRELIMINAR — Nulidade por cerceamento de defesa (se aplicável)
  III.1. Perícia foi requerida desde a exordial
  III.2. O que o Tema 1061/STJ realmente decidiu (com tese em blockquote)
  III.3. A negativa de perícia configurou cerceamento
  III.4. Julgamento antecipado ≠ renúncia à perícia

IV. MÉRITO — Reforma da sentença
  IV.1. Sentença confundiu transferência com contratação válida (cite trecho da sentença)
  IV.2. Indícios objetivos ignorados (Primeiro/Segundo/Terceiro/Quarto)
  IV.3. Responsabilidade objetiva (Súmula 479 + Tema 466 em blockquote)
  IV.4. Repetição em dobro (Tema 929 em blockquote + marco 30/03/2021)
  IV.5. Dano moral in re ipsa
  IV.6. Violação ao art. 489 § 1º IV CPC
  IV.7. Indevida conclusão pela legitimidade dos descontos (cite trecho)

V. DOS PEDIDOS
  A) RECONHECER, EM PRELIMINAR, a nulidade...
  B) CASO SUPERADA A PRELIMINAR, reformar a r. sentença para JULGAR PROCEDENTES, de modo a:
    B.1) DECLARAR A INEXISTÊNCIA...
    B.2) CONDENAR à restituição em dobro...
    B.3) CONDENAR ao pagamento de danos morais...
  C) CONDENAR às custas e honorários sucumbenciais (art. 85 § 2º + § 11)

  Intimações dirigidas exclusivamente à advogada principal (com OAB)
  Termos em que, pede deferimento
  Local — UF, data
  Advogadas centralizadas
```

### Etapa 4 — Citações literais (regra de ouro)
- Todo trecho da sentença citado vai em **blockquote** (`pQuote` do `peca-pma-builder`).
- Toda tese/súmula STJ vai em **blockquote**, antecedida por identificação completa: REsp X/UF, rel. Min. X, Órgão, j. DD/MM/AAAA (+ DJe quando disponível).
- Nunca parafrasear ementa real com travessões em cadeia — usar a íntegra ou citação indireta (regra do `legal-writer`).

### Etapa 5 — Geração do .docx
Use **obrigatoriamente** o `peca-pma-builder` (skill irmã). Não recriar helpers locais.

Esqueleto mínimo do `_gerar_apelacao.js`:
```js
const path = require('path');
const { p, pMixed, pQuote, pCentered, titulo, subtitulo,
        endereco, quebra, pageBreak, assinatura, buildDoc }
  = require('d:/WORK/advocacia/skills/peca-pma-builder');

const conteudo = [ /* ... seções I a V ... */ ];

buildDoc({
  titulo: 'Apelação Cível — <Nome>',
  processo: '<n.º>',
  conteudo,
  outPath: path.join(__dirname, 'APELACAO_<NOME>.docx'),
}).then(console.log).catch(e => { console.error(e); process.exit(1); });
```

### Etapa 6 — Entrega dupla
Sempre gerar:
- `APELACAO_<NOME>.md` (fonte de verdade legível para IA e revisão humana)
- `APELACAO_<NOME>.docx` (derivado do .md via builder; é o que vai para protocolo)

## Hard constraints
1. Não inventar tese, ementa ou número de Tema. Se a jurisprudência da pasta do tema não cobre o argumento, sinalize ao usuário em vez de fabricar.
2. Não usar `argumentos` enumerados `(a) ... (b) ... (c)` em seções argumentativas (regra `legal-writer`).
3. Não desviar do encadeamento I → II → III → IV → V sem justificativa concreta.
4. Não regravar peça inteira por correção pontual — editar cirurgicamente o `.md` e regenerar o `.docx`.
5. Não citar `art. 300 CPC` cru em tutela — explicar o perigo concreto primeiro (regra `legal-writer`).
6. Não duplicar boilerplate de docx — sempre via `peca-pma-builder`.

## Integração com outras skills
- **Pré:** `pdfmd` (se houver PDFs sem `.md`)
- **Durante:** `legal-writer` (estilo, conectivos, ritmo); `tipografia-pma` (regras visuais quando dúvida)
- **Pós:** `legal-consistency-validator` (auditoria adversarial)
- **Geração:** `peca-pma-builder` (sempre)

## Output esperado
Dois arquivos no diretório do caso:
- `APELACAO_<NOME>.md` (fonte)
- `APELACAO_<NOME>.docx` (derivado)
- `_gerar_apelacao.js` (gerador, baseado no esqueleto da Etapa 5)

E um mapa de impugnação (em conversa, não em arquivo) mostrando, para o usuário, quais trechos da sentença foram enfrentados e com qual tese.

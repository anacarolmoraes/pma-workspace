---
name: analise-perfil
description: >-
  Gera relatório judicial de PERFIL DE CONSUMO em casos de fraude bancária,
  contrastando o padrão habitual do correntista (baseline real dos extratos)
  com o cluster de operações fraudulentas, estruturado pelos seis critérios
  do REsp 2.222.059/STJ. Use SEMPRE que houver extratos bancários (CSV/Excel)
  de uma vítima de golpe e a tarefa envolver demonstrar ao juízo que as
  transações destoam do perfil/padrão de consumo — golpe do falso advogado,
  falsa central, mão fantasma, PIX a desconhecidos, empréstimo não desejado,
  esvaziamento de conta. Dispare mesmo que o usuário só peça "laudo",
  "relatório do perfil do cliente", "mostrar a divergência das movimentações"
  ou "perícia financeira do golpe", sem citar o precedente. NÃO é para
  parsear/validar PDF→Excel (isso é validador-extrato-pdf-excel) nem para
  redigir a petição (isso é legal-orchestrator).
---

# analise-perfil

Transforma extratos bancários em **prova objetiva de divergência de perfil de
consumo** — o teste que decide a responsabilidade do banco na jurisprudência
atual do STJ. O entregável é um relatório que conduz o julgador, fato a fato, à
mesma conclusão do precedente-paradigma.

## Por que isto importa

O STJ **não** exige prova subjetiva da boa-fé da vítima. O REsp 2.222.059/SP
(3ª Turma, Rel. Min. Villas Bôas Cueva, j. 21/10/2025) fixou que o banco deve
detectar e bloquear operações que fogem ao perfil do cliente, e que **validar
operação alheia ao padrão de consumo é, por si, defeito do serviço** (art. 14,
§1º, CDC; Súmula 479). Logo, o trabalho pericial não é "achar fraude" — é
**medir a distância** entre o que o cliente faz normalmente e o que foi feito
no golpe, e amarrar essa medida aos seis critérios do precedente. Leia
`references/criterios_stj.md` antes de redigir: é o esqueleto do relatório.

## Pré-requisitos

- Extratos já normalizados em CSV (saída do `validador-extrato-pdf-excel`).
  Se só houver PDF/imagem, rode antes aquela skill.
- Ambiente Python **obrigatório**: `<python>`
  (nunca o Python global).
- Fatos da fraude confirmados (não presumir): janela de dias do golpe, qual
  conta originou os pagamentos suspeitos, o dia do cluster e os **nomes dos
  beneficiários** (vêm das provas / petição / dossiê — não dos CSVs, que
  costumam trazer só "PIX ENVIADO").

## Workflow

### 1. Fixar os parâmetros factuais

Levante (das provas, petição, dossiê — confirme com a advogada se faltar):
janela do golpe (lista de `DD/MM`), CSV da conta de onde saíram os PIX
fraudulentos, o `DD/MM` do dia do cluster, e a identificação de cada
beneficiário desconhecido.

### 2. Rodar o motor determinístico

```powershell
& <python> `
  skills/analise-perfil/scripts/analise_perfil.py `
  --extratos     "<dir com os *_corrigido.csv>" `
  --janela       "12/12,13/12,14/12,15/12,16/12,17/12,18/12" `
  --conta-fraude "<csv da conta de origem dos PIX>" `
  --dia-fraude   "16/12" `
  --saida        "<dir do caso>/analise_perfil_consumo.json"
```

O script (ver `scripts/analise_perfil.py`):

- detecta automaticamente os esquemas PAN / BB / BRB;
- constrói o **baseline de saídas** por banco **excluída a janela do golpe**
  (o padrão de consumo é padrão de *disposição* de recursos — só saídas;
  entradas atípicas são anomalias, não baseline);
- isola o **cluster** do dia da fraude **na ordem cronológica real**,
  reconstruída pela cadeia de saldo (agnóstico a banco; não confie em ordem de
  arquivo nem em comparação de datas — vira o ano dez→jan);
- soma os PIX fraudulentos e calcula os **múltiplos de divergência**
  (valor ÷ mediana habitual e ÷ p95 da conta de origem);
- grava tudo num JSON auditável.

**Sempre confira a coluna `saldo` do `cluster_dia_fraude`**: ela deve encadear
de forma monotônica e consistente — é a prova de que a ordem está certa. Se
o JSON sair com ordem suspeita, force `--ordem reverse` ou `--ordem file`.

### 3. Redigir o relatório

Use **exatamente** a estrutura abaixo, preenchida com os números do JSON.
Há relatório de referência já produzido na pasta do caso correspondente, em
`clientes/<caso>/provas/` — consultar na máquina, não versionar.

```markdown
# RELATÓRIO TÉCNICO DE PERFIL DE CONSUMO
## Contraste entre o padrão habitual do correntista e as operações fraudulentas de <DATA>

1. PARA QUE SERVE ESTE RELATÓRIO   — o teste objetivo do REsp 2.222.059, citado
2. METODOLOGIA                     — só saídas; janela do golpe excluída; determinístico
3. O PADRÃO HABITUAL (BASELINE)    — tabela por banco + tabela PIX da conta-foco;
                                     leitura factual (conservador, conta-poupança,
                                     favorecidos habituais = família/despesas)
4. O QUE ACONTECEU NO DIA <DATA>   — tabela cronológica do cluster (com saldo),
                                     nomeando cada beneficiário e cada ponte
5. DIVERGÊNCIA, CRITÉRIO A CRITÉRIO — os 6 critérios do STJ, um a um, com números
6. QUADRO-RESUMO PARA O JUÍZO      — matriz critério × situação × ✔
7. CONCLUSÃO TÉCNICA               — divergência mensurável, reproduzível, detectável
```

Regras de redação:

- **Nomeie os fraudadores.** Este relatório é peça-prova judicial; anonimizar
  esvazia a função. (Contraste com laudos estatísticos genéricos, que anonimizam.)
- Cada número vem do JSON — nada estimado. Cite o script/JSON como auditáveis.
- Ancore o critério (vi) no empréstimo atípico que aparece como crédito-ponte
  no próprio cluster, imediatamente antes dos PIX suspeitos.
- Se o caso reproduzir o paradigma (conta-poupança + mesmo dia + fuga de
  perfil), diga isso explicitamente — é o que decide.
- Não argumente direito além do necessário para a subsunção; a valoração
  jurídica e a petição são do `legal-orchestrator`.

### 3.1. Mostrar o que cada instituição tinha diante de si

O relatório mede a divergência; o juiz precisa ver também que ela era **visível no
momento da validação**. Depois do quadro-resumo, inclua a tabela "O que cada
instituição tinha diante de si" (instituição × operação × sinais no próprio
sistema), uma linha por instituição, inclusive o banco emissor dos boletos quando
houver escoamento por boleto (linha digitável: banco nos três primeiros dígitos;
campos idênticos entre boletos = mesmo cedente). Só sinal que constava do próprio
registro da instituição naquele instante; nada de conhecimento posterior.

### 3.2. Compilar o .docx para juntada

O `.md` é a fonte de verdade; o que se junta é o `.docx` no padrão de relatório
(Times New Roman 12, entrelinha 1,5, ABNT 3/2/3/2; ver `.claude/commands/relatorio.md`).
Relatório não é peça: não passa pelo `md2docx` nem leva timbrado.

```powershell
node skills/analise-perfil/scripts/relatorio_abnt.js clientes/<caso>/provas/<relatorio>.md
```

O script reabre o `.docx` e confere fonte, margens e número de tabelas contra a
fonte; frontmatter (`titulo`, `subtitulo`, `data`, `processo`, `cliente`, `autor`,
`classificacao`) vira o bloco de abertura. Na peça, o `Doc. N` aponta para o `.docx`.

### 4. Entregar

Grave o `.md` na pasta `provas/` do caso, ao lado do JSON e do script
(auditabilidade). Reporte à advogada: total desviado, maior múltiplo de
divergência, e os 7 fatores do STJ atendidos.

## Encadeamento com outras skills

`validador-extrato-pdf-excel` (gera os CSV) → **`analise-perfil`** (este
relatório) → `legal-orchestrator` (petição, usando o relatório como doc. de
prova técnica) → `tipografia-pma`/`docx` (se for preciso versão .docx).

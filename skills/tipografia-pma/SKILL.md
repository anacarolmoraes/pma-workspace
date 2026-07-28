---
name: tipografia-pma
version: 1.1.0
description: |
  Aplica o padrão tipográfico e estrutural do escritório PMA a peças jurídicas: hierarquia de títulos,
  fonte Montserrat, cabeçalho/rodapé com imagens do escritório, espaçamento, citações em bloco,
  visual law funcional, contratos, PDF/protocolação e credibilidade documental.
  Opera como módulo de apoio do legal-orchestrator (Estágio 2): NÃO emite instruções jurídicas,
  estratégicas ou de redação — apenas estrutura e formata o que o legal-writer escreveu.
  Use após a redação jurídica, antes da geração do .docx.
  Triggers: "formate a petição", "aplique o padrão do escritório", "prepare para gerar o docx",
  "padronize a estrutura", ou quando o orchestrator acionar o Estágio 2.
---

# Tipografia PMA — Padronização Estrutural de Peças Jurídicas

**Missão:** estruturar o que o legal-writer escreveu. Nunca reescrever conteúdo.

Se uma alteração estrutural comprometer o raciocínio jurídico ou fragmentar argumento contínuo → não faça. Sinalize ao orchestrator.

---

## REGRA DE PRESERVAÇÃO (Absoluta)

Nunca altere: tese, argumentos, fatos, hierarquia argumentativa, ritmo de variação entre frases.

Atue apenas em: organização, estrutura, clareza visual e apresentação.

---

## ESCOPO E LIMITES OPERACIONAIS

Esta skill atua **somente** no domínio tipográfico e visual documental. Ao identificar tema fora deste escopo, sinalize e encaminhe:

> **[FORA DO ESCOPO TIPOGRAFIA]** — Encaminhar para skill competente no ecossistema legal-orchestrator.

Fora de escopo: estratégia processual, argumentação jurídica, mérito, redação de teses, revisão gramatical, formulação de pedidos, estratégia de acordo.

---

## MÓDULO 1 — PADRÃO CANÔNICO DO ESCRITÓRIO

> **Modelo de referência (canônico):** `assets/PETICAO_MODELO.docx` (relativo a esta skill). Já realinhado a este padrão (margens 3 cm · entrelinha 1,3/312 DXA · Montserrat 12 pt) e com as 8 fontes Montserrat **embutidas**. É a referência visual e a base para gerar o `.docx`. Backup do original pré-realinhamento mantido fora do bundle, na camada local do escritório.

### 1.1 Fontes

| Elemento | Fonte | Tamanho | Obs. |
|---|---|---|---|
| Corpo do texto | Montserrat | 12 pt | Nunca usar Montserrat Light no corpo |
| Tópicos principais | Montserrat | 12 pt | **MAIÚSCULO + Bold** |
| Subtópicos | Montserrat | 12 pt | **Bold** (caixa mista) |
| Subtópico de 3º nível | Montserrat | 12 pt | **Bold** |
| Pedidos | Montserrat | 12 pt | Letra + parêntese; rótulo em bold |
| Citações em bloco | Montserrat Light | 11 pt | Único uso válido do Light no fluxo |
| Rodapé / notas | Montserrat Light | 10 pt | |
| Contratos de adesão | Montserrat | ≥ 12 pt | Obrigatório por Art. 54 CDC |

A hierarquia **não** é dada por tamanho de fonte (tudo é 12 pt), e sim por **MAIÚSCULA + bold + esquema de numeração**. Citação (11 pt) e nota (10 pt) são as únicas reduções.

### 1.2 Página

| Parâmetro | Valor (padrão PMA) |
|---|---|
| Margens | **3 cm** (topo, base, laterais) |
| Entrelinhas | **312 DXA (1,3)** |
| Espaçamento após parágrafo | 12 pt |
| Alinhamento | Justificado + hifenização automática **ativada** |
| Marcação de parágrafo | Espaçamento de 12 pt (preferencial) — nunca recuo junto |
| Cabeçalho | Banner horizontal centralizado |
| Rodapé | Logo à direita + "PAGE de NUMPAGES" |
| Tópicos principais | Numeração romana: I., II., III. |
| Subtópicos | Romana composta: I.1., I.2. |
| Pedidos | Letra maiúscula + parêntese: A), B), C) |

### 1.3 Fontes Seguras e Fallback

**Problema crítico:** Montserrat é Google Fonts — se não instalada no sistema do receptor, há substituição automática que quebra o layout.

**Regra obrigatória ao exportar PDF:** incorporar fontes.
- Word: Arquivo → Opções → Avançado → Compartilhamento → **Incorporar fontes no arquivo**

**Fallback seguro** (se Montserrat indisponível):
- Sem serifa moderna: Calibri, Gill Sans, Trebuchet MS
- Serif clássica (peças formais impressas): Georgia, Garamond, Book Antiqua
- Nunca: Comic Sans, Papyrus, condensadas abaixo de 10 pt

### 1.4 Conformidade CDC

O CDC exige fonte tamanho 12 em contratos de consumo. Mas "12" varia por família (Arial 12 ≫ Garamond 12). A regra real é **legibilidade equivalente ao Arial 12** — referência no x-height, não no número puro.

---

## MÓDULO 2 — CABEÇALHO E RODAPÉ (PROTOCOLO DE EXECUÇÃO)

> Modelo canônico do timbrado (decisão da usuária, 2026-07-16):
> `D:\WORK\advocacia\material_padrao_escritorio\PETICAO_MODELO_FORMATACAO.docx`.
> O `peca-pma-builder` já reproduz este padrão — gere .docx por ele, não à mão.

**Cabeçalho:** UMA única imagem institucional centralizada (`timbrado.png` nos
assets do peca-pma-builder), exibida a cx=3449384 · cy=907733 EMU (362 × 95 px),
distância do topo 708 twips.

**Rodapé:** SEM imagem. Parágrafo único centralizado com filete superior
laranja `#F5A623` (single, sz 4), Montserrat 8 pt `#666666`:
`contato@paulomoraesadvocacia.com.br | +55 (63) 98489-2582 | Av. Teotônio Segurado, Ed. Urban Futuro, Sala 2204, Palmas/TO, CEP: 77015200 | Fl. PAGE de NUMPAGES`.
Distância da base 708 twips.

> Padrão ANTIGO (banner ~13:1 no cabeçalho + logo ~2:1 no rodapé) foi
> descontinuado em 2026-07-16 — não usar em peças novas.

**Rodapé duplo é crime tipográfico.** Referências de texto → **Notas de Fim** (nunca em rodapé institucional).

---

## MÓDULO 3 — HIERARQUIA DE TÍTULOS E ESTRUTURA

### 3.1 Hierarquia de Títulos

| Nível | Formato | Exemplo |
|---|---|---|
| Seção principal | Romano + ponto · 12 pt · **MAIÚSCULO + Bold** | `I. DOS FATOS` |
| Subseção | Romano + decimal + ponto · 12 pt · **Bold** | `I.1. A Fraude PIX` |
| Subseção de 3º nível | Romano + decimal duplo · 12 pt · **Bold** | `I.1.1. O papel do Banco PAN` |
| Pedidos | Letra maiúscula + parêntese · 12 pt | `A) A citação dos Requeridos` |

### 3.2 Títulos Hiperespecíficos — Obrigatório

O título antecipa a tese; nunca é genérico.
- ❌ `II. DO DIREITO`
- ✅ `II. A RESPONSABILIDADE OBJETIVA DAS INSTITUIÇÕES FINANCEIRAS`

### 3.3 Hierarquia Cognitiva — Ordem dos Blocos

O juiz não lê linearmente. Escaneia buscando fatos concretos e âncoras visuais. A estrutura explora isso.

**Ordem recomendada:**
1. **Resumo Estratégico** — 1ª página, logo após qualificação das partes *(posição rígida)*
2. **Fatos** — subtópicos hiperespecíficos por evento/elemento fático
3. **Tutela de Urgência** — obrigatoriamente **após** os fatos *(ordem inviolável)*
4. **Direito** — teses específicas, sem transcrição genérica de artigos
5. **Pedidos Finais** — o núcleo já foi antecipado no Resumo

> **Única sequência inviolável:** Fatos → Tutela. Inserir a Tutela antes dos fatos é erro técnico que compromete o deferimento.

### 3.4 Resumo Estratégico — FIRAC

**Posição:** 1ª página, após qualificação. Nunca mover.
**Formato:** flexível — quadro sintético ou parágrafo direto.
**Conteúdo mínimo obrigatório:**
- Pedido central antecipado
- Delimitação da controvérsia fática
- Valores envolvidos

Template FIRAC (quando usado):
```
SÍNTESE

FATOS: [quem, o quê, quando, valor]
QUESTÃO: [o que o juízo precisa decidir]
REGRA: [normas e jurisprudência aplicáveis]
APLICAÇÃO: [como a regra se aplica aos fatos]
CONCLUSÃO: [o que se pede e por quê decorre]
```

---

## MÓDULO 4 — LEGIBILIDADE E ESCANEABILIDADE

### 4.1 Leiturabilidade como Premissa

A fonte é secundária. Legibilidade = fonte + tamanho + entrelinhas + contraste + largura de linha.

**Regra da linha longa:** acima de ~75 caracteres cria "paredão de texto" que interrompe o escaneamento. Em coluna única, controlado pelas margens.

### 4.2 Serif vs. Sans-Serif por Contexto

| Contexto | Recomendação | Justificativa |
|---|---|---|
| Petições digitais (PJe/tela) | Sans-serif (Montserrat) | Renderização limpa em tela |
| Petições impressas formais | Serif (Garamond, Georgia) | Serifa guia o olho no papel |
| Contratos | Sans-serif leve + bold nos títulos | Contraste alto; leitura vertical |
| Pareceres | Serif ou sans-serif formal | Tom acadêmico, hierarquia clara |

**Proibido em qualquer contexto:** "Thin"/"Light" no corpo principal — desaparece após compressão de PDF judicial.

### 4.3 Comportamento de Escaneamento Judicial

Juízes e assessores rastreiam em diagonal buscando **pontos de parada visual** que distingam o caso das minutas repetitivas. Arquitetura para escaneabilidade:
1. Subtítulos hiperespecíficos que antecipam a tese (ver 3.2)
2. Resumo Estratégico na página 1 (ver 3.4)
3. **Negrito** como único destaque textual
4. **Espaço branco** como recurso — parágrafos curtos, margens respeitadas, "respiração" que convida o olhar

### 4.4 Parágrafo — Escolha Uma Técnica, Nunca Duas

**Pleonasmo tipográfico** = recuo de primeira linha **E** espaçamento entre parágrafos juntos. Afrouxa o texto, cria buracos, infla páginas.

| Técnica | Configuração | Quando usar |
|---|---|---|
| Americana (**preferencial**) | Sem recuo. Espaçamento 12 pt após parágrafo. | Padrão PMA |
| Tradicional | Recuo 1,5 cm na 1ª linha. Sem espaçamento extra. | Tom clássico |

**Nunca usar Tab** para simular recuo. **Nunca Enter duplo** para simular espaçamento.

### 4.5 Alinhamento e Hifenização

Justificado é o padrão jurídico — mas sem hifenização gera "rios brancos" que destroem a leitura.

**Regra:** Justificado = hifenização automática **obrigatória** (Word: Layout → Hifenização → Automática).

Alinhamento à esquerda (ragged right) é aceitável em contratos modernos de 2 colunas.

---

## MÓDULO 5 — ÊNFASE E HIERARQUIA DE DESTAQUES

| Recurso | Status | Impacto |
|---|---|---|
| **Negrito** | Único permitido | Atenção com credibilidade |
| Itálico | Só expressões latinas e títulos de obras | Funcional, discreto |
| CAIXA ALTA (palavra isolada) | Aceitável com moderação | Impactante em título curto |
| CAIXA ALTA (bloco longo) | Proibido | Agressivo, ilegível, amador |
| Sublinhado | Proibido | Confunde com hyperlink, datado |
| Marca-texto colorido | Proibido | Rascunho amador |
| Cores no texto | Proibido (exceto azul em hyperlinks) | Inconsistência, amador |
| Numeração de parágrafos | Proibido | Juízes referenciam tópicos, não nº de parágrafo |

---

## MÓDULO 6 — CITAÇÃO DE JURISPRUDÊNCIA

### 6.1 Citação em Bloco

| Parâmetro | Configuração correta |
|---|---|
| Fonte | 11 pt (Montserrat Light) |
| Recuo | 3 cm à esquerda |
| Aspas | **Remover** — o recuo já sinaliza a citação |
| Itálico | **Remover** — não é marca oficial de citação em bloco |
| Supressão | `[...]` para cortes; manter só o núcleo decisório |

> 🚫 **ERRO CRÍTICO:** nunca despejar páginas de ementa recuada. É ignorado pelo juiz e destrói o ritmo de leitura.

### 6.2 Citação Indireta (Estratégia de Ouro)

Resuma a tese do tribunal com as próprias palavras no corpo e jogue a referência entre parênteses ou em nota de fim.
- **Vantagem:** transforma 3 páginas de "copia e cola" em 1 parágrafo de alto impacto. Demonstra domínio da matéria e respeito ao tempo do julgador.

---

## MÓDULO 7 — VISUAL LAW FUNCIONAL

### 7.1 Princípio de Uso

Elementos visuais apenas quando as palavras **não conseguem explicar** com eficiência equivalente. Visual law decorativo (ícones, balanças, cores aleatórias) foi abandonado pelo judiciário de qualidade.

### 7.2 Elementos Visuais por Finalidade

| Elemento | Quando usar |
|---|---|
| Tabela | Cálculos acumulados, múltiplos vínculos, despesas vs. renda |
| Linha do tempo | Prescrição, decadência, sequência de fatos |
| Gráfico | Desproporcionalidade (renda vs. despesas; valor vs. salário) |
| Organograma | Redes societárias, cadeia de responsabilidade |
| Print screen recortado | Prova digital de fato específico |

### 7.3 Print Screens — Protocolo de Qualidade

1. Recortar **somente a área de interesse** — nunca tela inteira
2. Borda fina cinza (0.5 pt) ao redor
3. Setas em **laranja (#E86522) ou vermelho vivo (#CC0000)** apontando o dado vital
4. Layout "Em frente ao texto"
5. Documento original **íntegro nos anexos** — o corpo ilustra, não produz a prova
6. Nunca redimensionar a ponto de tornar ilegível

### 7.4 Prova de Páginas Web

1. No navegador: `Ctrl+P → Salvar como PDF`
2. Ativar obrigatoriamente **"Cabeçalhos e rodapés"** → grava URL + data + hora (blindagem probatória)
3. Nunca QR Code em documentos judiciais (exige celular do juiz, péssima usabilidade)
4. Hyperlinks limpos aceitáveis: `https://...` clicável — nunca "clique aqui" sem URL visível

---

## MÓDULO 8 — TIPOGRAFIA DE CONTRATOS

*(Contexto diferente das petições — aplicar somente a contratos)*

### 8.1 Estrutura de Página
- Layout de **2 colunas** — leitura vertical mais rápida para o cliente leigo
- Margens reduzidas para acomodar colunas
- Logomarca **horizontal discreta** no cabeçalho, ou apenas o tipo de contrato alinhado à direita — nunca logo vertical grande competindo com as colunas

### 8.2 Cláusulas e Numeração
- **Estilos Word automatizados** (`Tópico`/`Subtópico`) para numerar cláusulas — nunca digitar "Cláusula Primeira" manualmente
- Com estilos, o texto flui entre colunas sem quebrar formatação ao inserir/remover cláusulas

### 8.3 Tipografia do Contrato
- Títulos de cláusulas: fonte **pesada / bold**
- Corpo: sans-serif de **peso leve** (Montserrat Light, Calibri Light) — documento "arejado"
- Linhas divisórias: apenas tons muito escuros (azul marinho) ou muito claros — nunca tons médios

### 8.4 Assinaturas
| Tipo | Regra |
|---|---|
| Digital | Imagem PNG com **fundo transparente** sobre o Word |
| Física | Remover todo design/fundo do campo antes de imprimir — **espaço totalmente branco** |
| Proibido | Imprimir, assinar à mão e escanear — destrói a qualidade tipográfica |

---

## MÓDULO 9 — PDF E PROTOCOLAÇÃO ELETRÔNICA

### 9.1 Geração Nativa
**Regra absoluta:** exportar nativamente do processador (Word → Salvar Como → PDF). Nunca imprimir → assinar → escanear → enviar (destrói qualidade, infla arquivo, elimina seleção de texto).

### 9.2 Incorporação de Fontes
Ao exportar, ativar **incorporação de fontes** para o documento chegar ao sistema judicial exatamente como produzido.

### 9.3 Otimização de Tamanho
- Imagens: só a área recortada de interesse
- Sem páginas de capa sem valor processual
- JPEG 80–90% para fotos; PNG para documentos/contratos que exigem nitidez

### 9.4 Navegação em Documentos Longos (+20 páginas)
- **Estilos Word** em todos os títulos → sumário automático + bookmarks no PDF
- Sumário automático na página 2 (após cabeçalho processual)
- Numeração de páginas com indicação de seção no rodapé

---

## MÓDULO 10 — PROCURAÇÃO E DOCUMENTOS AUXILIARES

Para evitar quebras erráticas em endereços longos na qualificação/procuração:
1. Inserir uma **tabela invisível** (Nome, CPF, Endereço, Cidade, Estado)
2. Selecionar a tabela → Design da Tabela → Bordas → **Sem Borda**
3. Manter apenas "Exibir linhas de grade" para edição
4. Resultado: layout impecável, alinhado, indestrutível ao editar

---

## MÓDULO 11 — CREDIBILIDADE DOCUMENTAL E PADRÃO PREMIUM

### 11.1 Efeito Halo Tipográfico
Peça limpa, hierarquizada e consistente transfere atributos positivos ao advogado nos primeiros 3 segundos. O juiz percebe inconscientemente: se a apresentação é excelente, a tese provavelmente também é.

### 11.2 Sinais de Credibilidade Visual
**Alto padrão:** consistência tipográfica total · espaço branco generoso · alinhamento preciso · imagens proporcionais e nítidas · cabeçalho/rodapé discretos.

**Amador (eliminar):** múltiplas fontes · mistura de técnicas de parágrafo · texto colorido fora de hyperlink · destaque em excesso · tabelas com bordas grossas/sombras · imagens pixeladas.

### 11.3 Paleta de Cores (uso restrito)
- Linhas divisórias: cinza claro (#D0D0D0) ou azul marinho (#1A2D5A)
- Setas em evidências: laranja (#E86522) ou vermelho (#CC0000)
- Texto: sempre preto (#000000) ou cinza escuro (#1A1A1A)
- Fundo: sempre branco (#FFFFFF) — nunca fundo colorido em texto jurídico

---

## MÓDULO 12 — TUTELA DE URGÊNCIA (ESTRUTURAÇÃO DA FUNDAMENTAÇÃO)

*Atuação estrutural apenas — o mérito da medida é da skill jurídica.*

Nunca apresentar o Art. 300 genericamente. Estruturar em bullets:
- Valor bloqueado vs. renda mensal (em meses de salário)
- Risco de dispersão dos ativos
- Por que a medida não onera o réu (porte, liquidez, reversibilidade via SISBAJUD)

---

## MÓDULO 13 — INTEGRAÇÃO COM LEGAL-ORCHESTRATOR

### 13.1 Protocolo de Acionamento
Chamada no **Estágio 2**, após a geração do conteúdo jurídico e antes da exportação. Verifica e ajusta apenas parâmetros visuais e tipográficos.
- **Input esperado:** texto estruturado com tipo de peça identificado
- **Output:** parâmetros tipográficos a aplicar e/ou diagnóstico visual

### 13.2 Seleção de Módulos por Tipo de Peça

| Tipo de peça | Módulos aplicáveis |
|---|---|
| Petição inicial / Contestação | 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13 |
| Recurso / Apelação | 1, 2, 3, 4, 5, 6, 7, 9, 11, 13 |
| Contrato | 1, 2, 4, 8, 9, 11, 13 |
| Parecer | 1, 2, 3, 4, 5, 6, 11, 13 |
| Procuração | 1, 2, 10, 11, 13 |

### 13.3 Sinais de Conflito com Outras Skills

| Conteúdo detectado | Encaminhar para |
|---|---|
| Estratégia de pedidos | [FORA DO ESCOPO TIPOGRAFIA] → `argumentação`/`redação` |
| Teses jurídicas | [FORA DO ESCOPO TIPOGRAFIA] → `juridica`/`argumentação` |
| Revisão gramatical | [FORA DO ESCOPO TIPOGRAFIA] → `revisão` |
| Estrutura processual | [FORA DO ESCOPO TIPOGRAFIA] → `estruturação` |

Esta skill não emite parecer sobre essas matérias — apenas sinaliza e encaminha.

---

## CRIMES TIPOGRÁFICOS — VEDAÇÕES ABSOLUTAS

| # | Proibição | Consequência |
|---|---|---|
| 1 | Recuo + espaçamento de parágrafo juntos | Pleonasmo tipográfico — buracos, páginas perdidas |
| 2 | Texto justificado sem hifenização automática | Buracos brancos irregulares ("rios") |
| 3 | Numeração de parágrafos | Poluição visual, inutilidade prática |
| 4 | Sublinhado · marca-texto · CAIXA ALTA prolongada | Aspecto de rascunho amador |
| 5 | Citação em bloco com aspas + itálico + recuo de 5 cm | Erro técnico brutal |
| 6 | QR Codes em petições | Vedado — substituir por hiperlinks discretos |
| 7 | Rodapé duplo (notas + rodapé institucional) | Referências → Notas de Fim |
| 8 | Marcas d'água | Poluem, cansam a leitura |
| 9 | Print screen gigante sem tratamento no corpo | Ver Módulo 7.3 |
| 10 | Timbrado fora do modelo canônico (banner antigo, logo no rodapé) | Ver Módulo 2 — padrão único desde 2026-07-16 |
| 11 | Fundamentação genérica (copiar Art. 300/Art. 186 cru) | Elimina chances de deferimento |
| 12 | Vírgula entre sujeito e verbo | Destrói credibilidade imediata |
| 13 | Montserrat Light no corpo do texto | Some após compressão do PDF judicial |

---

## INSTRUÇÃO PARA GERAÇÃO DE .docx

> **Partir sempre do modelo canônico:** `assets/PETICAO_MODELO.docx` (relativo a esta skill). Ele já traz margens 3 cm, entrelinha 312/1,3 e as fontes Montserrat embutidas — não recriar do zero.

1. Use a skill **peca-pma-builder** (`md2docx.js` para prosa; API JS para layouts especiais) — ela já aplica timbrado, margens e fontes
2. **Cabeçalho e rodapé:** padrão único do Módulo 2 (PETICAO_MODELO_FORMATACAO.docx) — o builder aplica sozinho
3. Fonte Montserrat 12 pt para corpo; títulos Montserrat 12 pt **MAIÚSCULO + bold**
4. Margens **3 cm** (topo, base, laterais); header/footer a 708 twips
5. Entrelinhas **312 DXA (1,3)**; 12 pt após parágrafo; justificado + hifenização automática
6. Citações em bloco: Montserrat Light 11 pt, recuo 3 cm, sem aspas/itálico
7. Tabelas com `WidthType.DXA` — nunca `PERCENTAGE`
8. Verificar dimensões EMU da imagem do cabeçalho no .docx gerado (`cx="NaN"` = bug de `transformation`)
9. Incorporar fontes ao exportar o PDF

---

## HUMAN READABILITY

- A estrutura visual revela o argumento — nunca compete com ele
- Nunca fragmente parágrafo argumentativo para criar subtópico artificial
- Se a padronização criar fragmentação → preserve o original e sinalize ao orchestrator

---

## REFERÊNCIAS DO NOTEBOOKLM

Baseado em 33 fontes especializadas: petições reais tipografadas (PDFs), transcrições de workshops de tipografia jurídica, análises de peças processuais (iniciais, réplicas, contestações), guias de design de informação jurídica e material sobre contratos, procurações e convencimento judicial.

---
name: inicial-rescisao-lote
version: 1.0.0
description: |
  Orquestra a produção completa da petição inicial de rescisão de compromisso
  de compra e venda de LOTE urbano (Lei 6.766/79), do dossiê ao .docx
  protocolável no padrão PMA. Amarra, em ordem, as skills existentes: pdfmd →
  ficha-rescisao-lote → leitura do bundle imobiliário → template → humanizer-forense
  → md2docx, com os portões de validação. Use quando o pedido for "fazer a
  inicial de rescisão de lote do cliente X".
---

# inicial-rescisao-lote — Orquestração da inicial de rescisão de lote

## Quando usar

Pedido do tipo "fazer a petição de rescisão de contrato de compra e venda de lote do cliente X". Esta skill é o **roteiro que amarra as demais** — não reimplementa nada; chama cada skill na ordem certa, com os portões que impedem erros já observados.

## Pré-requisitos na pasta do caso

Contrato de compra e venda (PDF) e extrato de pagamento (PDF). Procuração, quando houver. Regime de conhecimento: bundle `D:\GITHUB\bundles\direito\imobiliario`.

## Pipeline (com portões)

### Etapa 1 — Conversão (skill `pdfmd`)
Converter contrato e extrato para `.md`. **Nunca** ler o PDF direto se falta o `.md` (regra dura do CLAUDE.md). PORTÃO: `.md` < 1KB → refazer com `--ocr tesseract`.

### Etapa 2 — Apuração e cálculo (skill `ficha-rescisao-lote`)
Apurar do extrato: `data_contrato`, `valor_original`, `valor_atualizado`, `total_pago`, `lote_edificado`. Conferir os **números de cláusula no contrato assinado** (não no OCR). Montar `dados_caso.json` e rodar `calc.js` → `FICHA_CASO.md`.
PORTÃO: a `data_contrato` define o regime (pré/pós 28/12/2018) — sem ela, não prosseguir.

### Etapa 3 — Perguntas de estratégia (Socratic Gate)
Confirmar com a titular o que os autos não revelam: **motivo da rescisão** (desistência do comprador × culpa da loteadora × onerosidade), **uso do lote** (afasta ou não a fruição), **dados de gratuidade** (renda). PORTÃO: se faltar mais de um, perguntar antes de redigir (usar `AskUserQuestion`).

### Etapa 4 — Fundamentação (leitura obrigatória do bundle)
Ler, conforme o regime apurado na Etapa 2:
- **Pós-2018:** `teses/cdc-prevalece-lei-distrato-contratos-pos-2018.md` + `jurisprudencia/resp-2106548-sp.md`.
- **Pré-2018:** `teses/irretroatividade-lei-distrato-contratos-anteriores-2018.md` + Súmula 543 + Tema 577.
- Sempre: `playbooks/playbook-peticao-inicial-rescisao-imovel.md`, teses de fruição, bis in idem, restituição imediata; `jurisprudencia/tjmt-ai-1017433-56-2019-iptu-tutela.md` (IPTU na tutela).
PORTÃO: toda tese empregada deve ter fundamento no bundle; jurisprudência de fora, só por citação indireta e sinalizada.

### Etapa 5 — Redação (template + FICHA)
Clonar `material_padrao_escritorio/TEMPLATE_INICIAL_RESCISAO_LOTE.md` para a pasta do caso e preencher com os números da `FICHA_CASO.md` e as cláusulas conferidas (conferidas **no contrato assinado**, nunca no OCR).

**Forma e valores: ler `perfil/definicoes.md`** — endereçamento e estrutura (§5), gratuidade (§2), valor da causa (§1 — cai no art. 292, II, CPC: valor do contrato) e assinatura (§4). Não reproduzir essas regras aqui: o arquivo é a fonte única.

### Etapa 6 — Humanização (skill `humanizer-forense`)
Rodar `lint-ia.js` e corrigir cacoetes de IA sem tocar em transcrições. (O `md2docx.js` roda o lint automaticamente como portão.)

### Etapa 7 — Compilação (skill `peca-pma-builder`)
```powershell
node d:/WORK/advocacia/skills/peca-pma-builder/scripts/md2docx.js clientes/<caso>/INICIAL_RESCISAO.md
```
PORTÃO: os dois lints (remissões + anti-IA) e a validação de timbrado precisam passar — falhou, não compila.

### Etapa 8 — Peças acessórias
Declaração de hipossuficiência **só se a titular pedir** (para pessoa natural a alegação na inicial basta — art. 99, §3º, CPC). Conferir necessidade de justiça gratuita com a skill `pedido_justica_gratuita` se a renda for de faixa sensível.

## Depois do desfecho (retroalimentação)

Quando a titular revisar o `.docx`, rodar a skill `diff-peca` (docx editado × md-fonte) e triar as mudanças: preferência durável → bundle/memória; conteúdo jurídico → bundle; específico do caso → só ali. É assim que o padrão melhora a cada peça.

## Limites

- Cobre **loteamento** (Lei 6.766/79). Apartamento/incorporação (Lei 4.591/64) tem regime distinto.
- Não substitui o julgamento jurídico — orquestra as skills e impõe os portões; as decisões de mérito, percentuais e valor da causa são da advogada.
- Não decide sozinha o motivo da rescisão nem inventa fatos — Etapa 3 é obrigatória.

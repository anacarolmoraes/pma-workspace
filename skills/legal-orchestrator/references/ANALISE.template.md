---
caso: <slug da pasta em clientes/>
bundle: direito/<tema>
atualizada: AAAA-MM-DD
lado: consumidor
processos:
  - NNNNNNN-DD.AAAA.J.TR.OOOO
prazos:
  - AAAA-MM-DD | <ato: réplica, apelação, EDcl…> | <como foi contado e o que depende dele>
---

<!--
ANALISE.md é o ÚNICO arquivo de estado do caso. Tudo o que outra sessão precisa saber sobre
o caso mora aqui: dados das partes (bloco `json caso`), cronologia, prazos, teses, provas,
ataques, documentos, radar de jurisprudência, decisões da titular. Não se cria
ANALISE_<data>.md, cronologia.md, DOCUMENTOS.md, caso.json nem radar-jurisprudencia_<data>.md:
atualiza-se este arquivo e a data em `atualizada:`.

Frontmatter: não usar `tipo:`, `pipeline:` nem `titulo:` + `processo:` — fazem os hooks
tratarem o arquivo como peça. `prazos:` é uma linha por prazo, `AAAA-MM-DD | ato | nota`;
`node scripts/caso.js <slug>` lê daqui e mostra o painel.
-->

# Análise do caso — <Autor> x <Réu> (<processo>, <vara e comarca>)

Peça atual: **<tipo>**. Fatal: <data> (ver `prazos:`).

**Inventário (Estágio 0).** O que a pasta tem, o que falta, de onde veio cada informação.

## 0. Dados do caso

Qualificação das partes (art. 319, II, CPC), juízo e ação. O preâmbulo da inicial sai de
`node skills/legal-orchestrator/scripts/qualificacao.js clientes/<caso>/ANALISE.md`
(schema em `skills/legal-orchestrator/references/caso.schema.json`; `--checar` lista o que falta).

```json caso
{
  "acao": "",
  "subtitulo": "",
  "autor": {
    "nome": "",
    "nacionalidade": "",
    "estado_civil": "",
    "uniao_estavel": false,
    "profissao": "",
    "cpf": "",
    "email": "",
    "endereco": "",
    "nascimento": "",
    "renda_mensal": null
  },
  "reus": [
    { "nome": "", "cnpj": "", "natureza": "", "endereco": "", "email": "" }
  ],
  "juizo": { "comarca": "", "uf_extenso": "", "vara": "__ª", "competencia": "CÍVEL" },
  "advogadas": [],
  "docs_pessoais": "Doc. 2",
  "terceiros": []
}
```

## 1. Cronologia

| Data | Fato | Fonte |
|---|---|---|
| | | `Doc. N`, p. X |

Prescrição e decadência: para cada pretensão, termo inicial, prazo, norma, data-limite.

## 2. Teses candidatas

Regime (CDC ou CC) · regime temporal (lei vigente na data do contrato ou do fato, com `Doc. N`) ·
responsabilidade · ônus da prova · tutela provisória · audiência do art. 334. Depois, cada tese
com página no bundle: requisitos, fatos que os preenchem, fragilidade, risco. Escolha e motivo.

## 3. Mapa probatório

| Fato | Estado (comprovado / frágil / a produzir) | Prova |
|---|---|---|

## 4. Ataques previstos

Os três melhores argumentos da parte contrária, a prova que atacariam, a resposta disponível.

## 5. Impugnação especificada

(só em contestação; tabela da heurística do acervo)

## 6. Mapa da contestação

(só em réplica; cinco eixos, espelho do art. 341, espelho dos pedidos, confissões)

## 7. Documentos

| Doc. | Descrição | Estado (presente / pendente / dispensado) | Arquivo |
|---|---|---|---|

## 8. Radar de jurisprudência

Uma subseção por rodada (`### Radar — AAAA-MM-DD — <tese>`), no formato da skill
`radar-jurisprudencia`. Amostra do DJEN, não censo: nada entra em peça sem o inteiro teor conferido.

## 9. Decisões da titular

| Data | Decisão | Motivo |
|---|---|---|

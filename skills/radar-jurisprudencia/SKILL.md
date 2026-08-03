---
name: radar-jurisprudencia
description: Busca no DJEN jurisprudência recente e favorável à tese do cliente — 5 decisões por tese (mínimo 2 do STJ quando houver), priorizando o tribunal onde a peça será protocolada. Usar sempre que o usuário pedir jurisprudência, precedentes, julgados ou "decisões favoráveis" para sustentar uma peça; quando perguntar "o que os tribunais têm decidido sobre X"; ou quando uma peça em produção precisar de jurisprudência que não está no bundle do tema. Só liminares, sentenças, acórdãos e votos contam; STF fica fora (não publica no DJEN).
---

# Radar de Jurisprudência (DJEN)

Radar de decisões **recentes e locais** que sustentam a tese do cliente. Não substitui a
pesquisa oficial de jurisprudência (para precedente qualificado do STJ/STF, o bundle do tema
e as fontes oficiais são melhores) — o valor daqui é descobrir **o que o tribunal da peça e o
STJ estão decidindo agora** sobre o assunto.

Divisão de trabalho, para não queimar token:

| Etapa | Quem faz | Custo |
|---|---|---|
| Busca, filtro, dedupe, recorte | `scripts/buscar.js` | zero LLM |
| Triagem favorável/contrário | subagente **Haiku** em lote | baixo |
| Leitura integral + dossiê | modelo principal, **só os finalistas** | controlado |

## 1. Definir tese(s) e lado do cliente

Sem tese declarada não existe "favorável" — esse é o insumo obrigatório.

- Se o pedido já traz a tese, usar como está.
- Se não traz, **ler os documentos do caso** (ficha, minuta, inicial/contestação, pasta do
  cliente) e extrair. Enunciar cada tese em uma frase com o lado do cliente, por exemplo:
  _"Comprador inadimplente de lote tem direito à resolução com retenção limitada a 25% do
  pago (representamos o autor/comprador)"_.
- Havendo **mais de uma tese**, rodar o fluxo inteiro para cada uma: 5 jurisprudências por tese.
- Informar ao usuário quais teses foram identificadas antes de buscar — custa uma linha e
  evita uma rodada inteira na direção errada.

Lembrar o que "favorável" significa: **decisão que serve à tese, não decisão provida**.
Improcedência é vitória quando defendemos o réu; um agravo desprovido pode conter exatamente
o fundamento que sustenta o nosso pedido. Julgar pelo conteúdo, nunca pelo resultado formal.

## 2. Ordem de tribunais e período

- Prioridade: **tribunal da peça → STJ → TJRS → TJSP → TJCE** → outros que façam sentido para
  a matéria. O tribunal da peça vem do caso; se não estiver claro, perguntar não — inferir do
  processo/comarca nos documentos.
- **STF fica fora** (não publica no DJEN; o script já ignora a sigla).
- Período: o que o usuário pedir; sem pedido, **2024-01-01 até hoje** (default do script).

## 3. Construir os termos de busca

A busca do DJEN é **literal**, e termo com mais de uma palavra é tratado como **frase
exata** (testado na API: `rescisão contratual` acha; `rescisão loteamento` dá zero porque
as palavras não aparecem adjacentes). **Quando o tema tem bundle, minerar os termos de lá primeiro**: os documentos de tese do
bundle já contêm o vocabulário exato que aparece em decisões reais ("fruição indevida",
"lote não edificado", "32-A") — melhor fonte que inventar do zero. Regras práticas, por
tese, 2 a 4 termos:

- preferir **uma palavra distintiva** (`distrato`, `loteamento`) — mas palavra comum demais
  afoga a triagem (`loteamento` sozinho = centenas de editais);
- multi-palavra **só se for expressão que ocorre literalmente** em decisões
  (`rescisão contratual`, `falso advogado`, `Tema 577`);
- o dispositivo de lei âncora da tese vale como termo (`32-A`);
- se o primeiro conjunto vier seco ou largo demais, reformular e rodar de novo — a rodada
  determinística é grátis.

## 4. Coletar (determinístico)

```bash
node scripts/buscar.js --termos "termo1;termo2;termo3" --tribunais TJTO,STJ,TJRS,TJSP,TJCE \
  --inicio 2024-01-01 --saida <pasta-do-caso>/radar-djen
```

O script filtra o que não decide nada (edital, mero expediente), deduplica por processo,
para cedo quando já tem candidato de sobra, e grava:

- `candidatos.json` — metadados + **trecho** (abertura + dispositivo) de cada candidato
- `textos/<id>.txt` — texto integral, um por arquivo

**Não dar `Read` no `candidatos.json`** — ele carrega todos os trechos (dezenas de milhares
de tokens que você não precisa ver). As contagens vêm do resumo do console; os trechos vão
direto do disco para os triadores via `scripts/lotes.js`. E **nunca** ler a pasta `textos/`
inteira.

Interpretar o resumo do console:

- `countApi` alto (milhares) → termo largo demais; a triagem vai se afogar. Estreitar.
- Poucos ou zero candidatos → reformular os termos (sinônimos, termo mais amplo, sem número
  de artigo) e rodar de novo. Até 3 rodadas; se seguir seco, reportar honestamente que o
  DJEN não tem material para essa tese no período, em vez de forçar resultado.

## 5. Triagem barata (Haiku)

Gerar os lotes com o fatiador (zero LLM — corta o top-60 por score e grava os arquivos):

```bash
node scripts/lotes.js --entrada <pasta-do-caso>/radar-djen/candidatos.json --top 60 --tamanho 25
```

Lotes de **25–30, não menos**: cada subagente paga um custo fixo alto só por existir
(prompt de sistema), então lote pequeno é o jeito mais caro de triar — 6 lotes de 12 custam
o dobro de 2 lotes de 30 para o mesmo trabalho. Haiku classifica 30 itens tão bem quanto 12.
No buscar.js, `--relevantes` (palavras da tese que não servem de busca mas indicam aderência,
ex. `32-A`) melhora o ranking que define o corte. O que ficar fora do top-60 segue no JSON
para segunda passada se a triagem vier seca.

Disparar os triadores `model: haiku` **todos numa única mensagem, em paralelo e aguardando
o resultado (nunca em background)** — orquestrador que devolve o turno precisa ser retomado
depois, e cada retomada recarrega o contexto inteiro dele, além de deixar as notificações
órfãs. Cada triador **lê o seu arquivo de lote**. Prompt do triador:

```text
Você é triador de jurisprudência. Tese do cliente: "<tese>" (representamos <lado>).
"Favorável" = o conteúdo da decisão sustenta essa tese, independentemente de quem ganhou
ou de a decisão ter sido provida ou improvida.
Para cada item abaixo (id + trecho), responda UMA linha: id | F, C ou I | motivo em até 15
palavras. F=favorável, C=contrário, I=irrelevante/não dá para saber. Não use ferramentas.
Item com "so_ementa": true traz apenas a ementa publicada — resumo oficial, não a razão de
decidir. Pode ser F, mas exige leitura do inteiro teor antes de virar citação.
```

O lote só carrega os candidatos marcados **`natureza: principal`**. Julgados repetidos do
mesmo órgão com o mesmo conteúdo entram como `similar` e apontam para o principal — é o
fluxo da Seção de Triagem de Acórdãos do STJ, e evita pagar triagem N vezes pela mesma tese.
O `lotes.js` **informa quantos ficaram de fora** por similaridade; para triá-los (quando o
que se procura é divergência dentro de um grupo aparentemente uniforme), usar
`--incluir-similares`.

Descartar os I. **Guardar os C** — decisão contrária recente no tribunal da peça é
inteligência de graça (a triagem já pagou por ela) e vira a seção "radar de risco" do
dossiê, para a peça distinguir o entendimento adverso antes que a parte contrária o cite.
Se sobrarem menos de 5 F por tese, **a rodada de reformulação de termos (etapa 3) tem
precedência sobre fechar o dossiê incompleto** — a busca determinística é grátis; o que
custa é a triagem, e um lote extra de 12 para os candidatos novos é barato. Só reportar
"a amostra veio curta" depois de pelo menos uma reformulação.

## 6. Selecionar os 5 finalistas (por tese)

- **Cota: mínimo 2 do STJ**, se a triagem achou STJ favorável. Se não achou, dizer isso
  explicitamente no dossiê — não preencher a cota com material fraco.
- As demais vagas: primeiro o tribunal da peça, depois os outros.
- Peso por natureza: **acórdão > decisão colegiada > monocrática/liminar > sentença**.
  Sentença de 1º grau só completa vaga quando faltar coisa melhor — e o dossiê deve
  apontar o peso persuasivo menor.
- Empate: mais recente vence.

## 7. Ler os finalistas por inteiro e montar o dossiê

Ler `textos/<id>.txt` **apenas dos finalistas**. Confirmar a favorabilidade (a triagem viu
só um recorte) e extrair o trecho citável. Se um finalista cair na leitura integral, promover
o próximo da fila.

Antes de fechar o dossiê, rodar o semáforo de reforma nos finalistas (determinístico,
metade barata da verificação — detecta decisão já derrubada):

```bash
node scripts/verificar.js --itens "tjto:<processo>:<dataDecisao>,stj:<processo>:<data>"
```

VERDE = sem movimento de reforma após a decisão; AMARELO = há movimento suspeito, ler antes
de citar; CINZA = DataJud não achou (processo recente/segredo) — verificação manual.
O semáforo entra no campo Status de cada item. VERDE **não dispensa** a conferência do
inteiro teor — só elimina o risco mais barato de detectar.

Gravar `radar-jurisprudencia_<AAAA-MM-DD>.md` na pasta do caso, neste formato:

```markdown
# Radar de jurisprudência — <caso> — <data>
> Fonte: DJEN (texto de publicação, não inteiro teor oficial). Isto é AMOSTRA, não censo:
> o DJEN só enxerga decisões cujo texto foi publicado na intimação, e cada tribunal migrou
> para o DJEN em data própria — ausência de resultado NÃO significa ausência de
> jurisprudência, e 5 achados não autorizam escrever "jurisprudência dominante/pacífica".
> ⚠️ Antes de citar em peça: conferir inteiro teor no tribunal e o semáforo abaixo.

## Cobertura da busca
- Termos: <lista> | Período: <inicio>–<fim> | Tribunais: <lista com counts da API>

## Tese: <enunciado> (representamos <lado>)
### 1. <TRIBUNAL> — <processo> — <tipo>, disp. <data>
- **Órgão:** <órgão> | **Classe:** <classe> | **Relator:** <relator, se identificado>
- **Por que sustenta a tese:** <1–2 frases suas, não da decisão>
- **Trecho-chave:** > "<citação literal do dispositivo/fundamento>"
- **Status:** <semáforo do verificar.js> — inteiro teor NÃO conferido
- **Similares:** <ids agrupados sob este principal, se houver — mesma tese, não conferem reforço independente>

## Radar de risco — entendimento contrário encontrado
- <TRIBUNAL> — <processo> (<data>): <uma linha: o que decidiu contra a tese>
(se nenhum: "Nenhuma decisão contrária localizada na amostra — o que não prova que não exista.")
```

## Regras duras

1. **Nada do dossiê entra em peça sem verificação**: semáforo do `scripts/verificar.js` +
   conferência do inteiro teor oficial. O dossiê é radar, não fonte.
2. Achado que se confirmar bom é candidato a **subir para o bundle do tema** — sugerir isso
   ao usuário no fim; é o que torna a próxima busca de graça.
3. Economia de token é requisito, não preferência: triagem sempre em Haiku, leitura integral
   só de finalista, e nenhum `Read` em `textos/` fora disso.
4. Console Windows corrompe acento na exibição — o conteúdo confiável está nos arquivos
   gravados, não no stdout.

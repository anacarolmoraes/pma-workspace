> **ADENDO 04/09/2026.** Análise seguinte em [`clientes/jonathan/PONTOS-DE-DEFESA.md`](../clientes/jonathan/PONTOS-DE-DEFESA.md).
> Cinco premissas deste handoff caíram: a executada das ações 2 e 3 é **empresário individual** (a tese de
> "responsabilidade de sócio" não se aplica); na ação 3 houve **confissão de dívida e parcelamento em 25/06/2017**
> (o enquadramento no item 3.05 está fechado pelo Tema 375/STJ); a interrupção da prescrição **retroage ao
> ajuizamento** (Tema 383/STJ), o que muda o corte da ação 2 para 12/08/2015; a "outra execução" do IPTU 2016 é
> de outros imóveis; e há uma hipótese nova de **prescrição do IPTU da ação 1** pelo Tema 980/STJ. Ler o novo
> arquivo antes deste.

# Handoff — três execuções fiscais de Johnathan Ferreira Pires

> **Aviso de nome de arquivo.** Este documento foi gravado no caminho pedido
> (`docs/HANDOFF-channel-sync.md`), mas "channel-sync" não descreve nada do conteúdo.
> O assunto é jurídico, não de sincronização de canal. Renomear para
> `docs/HANDOFF-jonathan-execucoes-fiscais.md` se o nome importar.

Escrito em 04/09/2026 para um agente que não viu a conversa anterior.

---

## O objetivo, em uma frase

Apurar, nas três execuções contra Johnathan Ferreira Pires em
[`clientes/jonathan/`](../clientes/jonathan/), se cabe alegar prescrição — inclusive
intercorrente — ou a extinção por baixo valor do entendimento do CNJ, e construir a
cronologia que sustente a alegação.

---

## O que já está feito e não precisa ser refeito

Os três PDFs estão convertidos (`.md`, `.index.md`, `.pdfmd.json`, `_assets/` em cada pasta)
e a cronologia datada das três, com número de evento e página, está em
[`clientes/jonathan/CRONOLOGIA-PRESCRICAO.md`](../clientes/jonathan/CRONOLOGIA-PRESCRICAO.md).
Esse arquivo é o produto útil da sessão. Leia-o antes de qualquer coisa.

---

## O achado que reorganiza tudo

**As três são execuções fiscais.** Isso não estava na pergunta e muda o regime inteiro.

- Prescrição intercorrente aqui é **art. 40 da LEF + Temas 566 a 571/STJ**
  (REsp 1.340.553/RS), **não** o art. 921 do CPC. Os marcos são opostos: no CPC conta-se da
  ciência da primeira tentativa infrutífera; na LEF, da ciência da Fazenda sobre a não
  localização, seguida de um ano de suspensão **antes** de o quinquênio começar.
- Invocar o art. 921 do CPC numa execução fiscal entrega ao juízo o argumento de que se
  aplicou norma errada. O bundle `defesa-executado` avisa isso explicitamente.

Segundo achado: **as ações 2 e 3 têm a mesma executada** — J. F. PIRES, CNPJ
05.603.948/0001-55 — e nelas o Johnathan responde como **sócio coobrigado nomeado na
própria CDA**. Só a ação 1 é contra ele como pessoa física. Isso significa que a defesa
dele nas ações 2 e 3 é de responsabilidade de sócio, não de contribuinte.

---

## Resultado por ação

| | Processo | Tributo | Valor | Prescrição do crédito | Intercorrente | Baixo valor |
|---|---|---|---|---|---|---|
| 1 | 0012006-17.2021.8.27.2737 (Porto Nacional) | IPTU 2016 | R$ 1.079,65 | não, por 31 dias | não, 06/10/2028 | **SIM** |
| 2 | 0031136-51.2020.8.27.2729 (Estado TO) | ICMS, AI 2015/2988 | R$ 44.804,25 | **a apurar — tese viva** | não, 19/05/2028 | não |
| 3 | 5026818-18.2012.8.27.2729 (Palmas) | ISS, AI 437/2011 | R$ 548.594,23 | não | não, reiniciada em 02/2026 | não |

**Ação 1 é a única madura.** R$ 1.079,65 contra piso de R$ 10.000, e o **evento 95
(23/10/2025) é a notificação do Programa Nacional de Governança Diferenciada das Execuções
Fiscais do CNJ** — mutirão de 03 a 07/11/2025. Ou seja, a tentativa de conciliação prévia
que o Tema 1.184/STF exige como condição da extinção **já está nos autos, produzida pela
própria exequente**. É pedido de extinção por falta de interesse de agir, e é servido de
bandeja.

---

## Becos sem saída — não repita

1. **Prescrição intercorrente: zero de três.** Foi a hipótese que originou o trabalho e não
   se confirmou em nenhuma. As contas estão feitas e datadas na cronologia. Não refaça.
   - Ação 1: marco 06/10/2022 (ciência do SISBAJUD negativo, ev. 47) → 06/10/2028.
   - Ação 2: marco 19/05/2022 (ev. 27) → 19/05/2028. A **citação por edital publicada em
     21/01/2021 interrompeu** e reiniciou o relógio (tese 4.3 do repetitivo).
   - Ação 3: interrompida três vezes por constrição efetiva — R$ 11.463,29 em 12/2014,
     R$ 77,38 em 03/2020, **R$ 97,94 em 02/2026**. Nem perto de madura.
2. **Baixo valor nas ações 2 e 3.** São R$ 44,8 mil e R$ 548 mil. O piso é R$ 10 mil. Não
   force.
3. **Ler o §4º do art. 40 na letra** ("a prescrição corre da decisão que ordena o
   arquivamento") **é pior para nós**, não melhor. Sob essa leitura, na ação 1 a prescrição
   sequer teria começado (nunca houve arquivamento, só suspensão em 22/05/2024) e na ação 2
   correria de 07/02/2024. A leitura automática dos Temas 566/567 é a vinculante **e** a que
   antecipa o marco. Já foi aplicada. Não "corrija" para a letra da lei.
4. **Divergência de endereço no AR da ação 1.** Levantei e verifiquei: era ruído de OCR
   confundindo 5 com 6. A imagem (`_assets/img_032_01.png`) mostra "QD ASR SE 115, AL 08,
   QI F, LT 15", idêntico ao mandado. Não existe divergência. Não persiga.
5. **Atacar a citação por edital da ação 2** para remover a interrupção: o oficial tentou
   a citação pessoal antes (mandado de 01/12/2020, devolvido em 15/12/2020) e houve consulta
   ao RENAJUD para achar endereço. A Súmula 414/STJ parece satisfeita. Fraco.
6. **Sustentar que R$ 77,38 e R$ 97,94 são irrisórios demais para interromper.** É um
   argumento real, mas **não há precedente conferido no acervo** e o próprio juízo chamou o
   bloqueio de 2020 de "frutífero" (p. 292 da ação 3). Serve como reforço, nunca como
   fundamento principal.

---

## O que me disseram no início e que se revelou errado ou incompleto

- **"as 3 ações dessa pasta"**, sem qualificar. São todas fiscais. Se o próximo agente
  assumir execução civil comum e aplicar o art. 921 do CPC, erra tudo.
- **"o entendimento do CNJ sobre o valor de alçada de execução menor de 10 mil"** — trata-se
  da **Resolução CNJ 547/2024**, que operacionaliza o **Tema 1.184/STF (RE 1.355.208)**, e é
  regra de execução **fiscal**, não de execução civil em geral. Aplicou-se a uma das três.
- **A premissa da prescrição intercorrente** não se confirmou em nenhuma ação. O trabalho
  útil acabou sendo outro: baixo valor na 1, prescrição do crédito na 2, excesso e
  preclusão iminente na 3.
- Os PDFs baixados são todos **"PARTE_1"**. Não confirmei se existe Parte 2 no eproc. Se
  existir, a cronologia pode ter atos que não vi.

---

## Armadilhas técnicas do pdfmd nestes arquivos

O caminho canônico falha nestes três. Isto é o que funciona:

```bash
# Não use converter-caso.js aqui: acao2 quebra no portão --strict (p. 93,
# reading_order_ambiguous) e acao3 estoura memória do OpenBLAS.
cd d:/WORK/advocacia
export CLAUDE_INVOKED_BY=claude PYTHONUTF8=1 \
       OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1
node skills/pdfmd/scripts/executar-pdfmd.js "<arquivo.PDF>" \
     --ocr off --page-breaks --export-images --no-progress
```

- **`--ocr never` não existe.** As opções são `off`, `auto`, `tesseract`, `ocrmypdf`.
  Perdi um ciclo nisso.
- **`--ocr off` é seguro nestes autos.** O eproc gera texto nativo para o conteúdo
  substantivo; só as páginas de separação são imagem, e elas se repetem em texto nativo
  logo abaixo. O OCR de imagem é justamente o que derruba a conversão (Tesseract/Leptonica
  estouram memória; a ação 3 dá crash de acesso, código 3221225477).
- **`Read` em PDF não funciona nesta máquina** — falta poppler/`pdftoppm`. Para conferir
  uma página visualmente, leia o PNG correspondente em `<nome>_assets/`. Foi assim que
  confirmei o AR e a notificação do CNJ.
- **Fonte corrompida** na inicial da ação 3 (p. 5) e na CDA da ação 2 (p. 7): o texto sai
  como cifra de substituição. A CDA da ação 3 saiu legível porque veio como tabela. A da
  ação 2 é decifrável por padrão, com paciência.

Extração de cronologia que funcionou bem:

```bash
F=$(ls *_PARTE_1.md)
grep -oE "Evento [0-9]+ \*\*Evento: \*\*|^# [A-ZÇÃÕÉÍÓÚÂÊÔÀ0-9][^|]*\*\*Data: \*\* [0-9]{2}/[0-9]{2}/[0-9]{4} [0-9:]+" "$F" \
  | sed 's/\*\*//g' | paste - - | awk '!seen[$0]++'
```

---

## O que eu faria primeiro, começando agora

1. **Conferir no eproc a ação 3.** É o único item com risco de preclusão. O SISBAJUD
   "teimosinha" de 18/02/2026 bloqueou R$ 97,94 nas contas **pessoais** do Johnathan
   (Nubank, PicPay, Mercado Pago, Inter, Bradesco, Itaú). Se ele foi intimado, o art. 854,
   §3º, dá cinco dias e, pelo **Tema 1.235/STJ**, a impenhorabilidade dos 40 salários
   mínimos **preclui**. Nos autos convertidos eu não achei intimação dele sobre esse
   bloqueio — mas o PDF é só a Parte 1.
2. **Pedir três documentos**, que decidem mais do que qualquer pesquisa:
   - PA **2015/6040/503484** (ICMS, ação 2) — a **data da constituição definitiva** é o que
     define se o crédito prescreveu. AI de 2015, despacho citatório em 30/09/2020: se a
     decisão administrativa ficou definitiva antes de 30/09/2015, prescreveu.
   - PA **2011038719** (ISS, ação 3) e o **Mapa de Apuração Fiscal** citado na CDA.
   - Nos dois: **se o Johnathan foi notificado do auto de infração**. Se entrou na CDA sem
     participar do processo administrativo, é vício de constituição, não questão de ônus da
     prova — e vira exceção de pré-executividade nas duas ações.
3. **Depositar no arsenal** o que falta, antes de redigir (o `lint-citacoes` bloqueia, e com
   razão).
4. **Só então** redigir a extinção da ação 1. É a única pronta.

---

## Teses vivas que não são prescrição

Levantadas e ainda não trabalhadas:

- **Ação 3 — excesso.** A CDA declara a forma de cálculo, o que é raro: **multa de 100%
  sobre o valor atualizado** (art. 40, I, "b", da LC 107/2005 de Palmas) e **juros de 1% a
  cada 30 dias**, com correção pela UFIP. Dois ataques: multa punitiva incidindo sobre base
  já corrigida ultrapassa o teto de 100% do tributo; e ente municipal não pode fixar juros e
  correção acima do padrão federal. Não extingue, mas ataca o salto de R$ 46.511,01 para
  R$ 548.594,23.
- **Ação 3 — enquadramento.** O AI enquadrou no **item 3.05** da lista ("cessão de andaimes,
  palcos, coberturas e outras estruturas de uso temporário") uma empresa chamada **Fogos &
  Fogos – Shows Pirotécnicos**. Se a atividade real é espetáculo, o enquadramento está
  errado e contamina o lançamento. Depende do Mapa de Apuração Fiscal.
- **Ações 2 e 3 — responsabilidade do sócio.** Súmula 430/STJ (inadimplemento não gera
  responsabilidade do sócio-gerente), contra a presunção do nome na CDA. Na ação 2 há
  agravante: certidão do oficial de 15/12/2020 dizendo que a empresa "encerrou suas
  atividades comerciais no local" — gatilho da Súmula 435/STJ. Apurar **quando** encerrou e
  **se ele era administrador na data**.
- **Ação 2 — vício da CDA.** A inicial diz que a CDA C-2102/2017 é "datada de 19/10/2017";
  o edital de citação diz "inscrita em 05/08/2019". Duas datas de inscrição para a mesma
  certidão, e a data de inscrição é requisito do art. 2º, §5º, III, da LEF.
- **Ação 1 — encargos.** Principal de R$ 398,89 contra R$ 400,08 de multa e juros. Os
  encargos superaram o tributo. Mesma lógica da ação 3, em escala menor. Falta a lei
  municipal de Porto Nacional, que não está nos autos.
- **Ação 1 — AR sem recebedor.** O AR (ev. 11) volta com carimbo do CDD-Palmas de
  07/12/2021 e rubrica do carteiro, mas **sem motivo de devolução assinalado e com
  assinatura e nome do recebedor em branco**. Tese fraca, porque o art. 8º, II, da LEF se
  contenta com a entrega no endereço. Segunda linha, não fundamento.

---

## Lacunas do acervo (bloqueiam o `lint-citacoes`)

O bundle [`defesa-executado`](../../../GITHUB/arsenal-juridico/direito/execucao/defesa-executado/index.md)
cobre e tem conferidos: CPC 921, LEF 40, Temas 566-571, Tema 1.235, bem de família, salário,
pequena propriedade rural. **Não cobre**, e precisa ser baixado da fonte oficial e
depositado em `raw/` antes de citar:

1. Resolução CNJ 547/2024
2. Tema 1.184/STF (RE 1.355.208)
3. Súmula 430/STJ
4. Tema 108/STJ (REsp 1.104.900) — ônus do sócio nomeado na CDA
5. Teto de multa confiscatória (Tema 863/STF e RE 582.461)
6. Limite de juros e correção de ente subnacional (Tema 1.062/STF)

---

## Uma nota sobre o veredito de não-convergência

Registro sem discutir, porque a leitura é da titular: a sessão foi encerrada por não estar
convergindo. O que efetivamente saiu dela foram as três cronologias datadas, o descarte
fundamentado da hipótese de prescrição intercorrente nas três ações, e a identificação da
ação 1 como a única com pedido pronto. Se isso é convergência ou não, quem decide é ela — o
próximo agente que herde este arquivo não precisa refazer nada do que está acima.

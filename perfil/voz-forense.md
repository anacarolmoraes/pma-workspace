---
titulo: Perfil da voz forense do escritório
status: rascunho
versao: 0.2.0
criado: 2026-09-08
atualizado: 2026-10-15
revisar: titular valida ou corrige cada traço antes de promover a `vigente`
---

# Voz forense do escritório — perfil canônico

Referência de **ritmo e registro** para a calibração de voz da skill `humanizer-forense`
(passo 3 do processo) e para qualquer agente que redija peça neste workspace. É abstrato de
propósito: descreve como o escritório escreve, com exemplos fictícios, e **não contém trecho,
fato, nome ou número de peça real**. Peça de cliente nunca entra aqui (AGENTS.md, regra 5).

O que este perfil **não** é: outra tabela de padrões proibidos. Os limites contáveis moram no
`lint-ia.js` e na tabela do `SKILL.md` do humanizer. Aqui está o que o lint não mede: como soa
a prosa quando é do escritório.

## 1. Quando usar o perfil, e quando ler uma peça humana

Regra proporcional (substitui a fronteira fixa de "mais de seis capítulos", 08/09/2026):

| Peça | Calibração |
|---|---|
| Curta ou rotineira (manifestação, petição simples, réplica enxuta) | este perfil basta |
| Longa (> 6 capítulos), recurso, ou peça estratégica | este perfil **e** uma peça humana próxima: do próprio caso (razões, embargos, contrarrazões escritos por advogado) ou de tema vizinho no escritório |
| Tribunal superior (REsp, AREsp, AgInt, EDcl de acórdão) | idem, e a `banca-revisora` depois |

Da peça humana se imita o **ritmo** (tamanho dos períodos, onde entra a vírgula, como abre o
parágrafo). Nunca se copia fato, trecho, número ou tese: a referência é de andamento, não de
conteúdo.

## 2. Período e parágrafo

- **Períodos longos com subordinação, não com coordenação em cadeia.** A frase típica tem
  entre 30 e 45 palavras, uma oração principal e uma ou duas subordinadas presas por "que",
  "porquanto", "ao passo que", "de maneira que". O que ela não tem é sequência de orações
  curtas coladas por travessão ou por ponto seco.
- **Frase curta é pontuação, não estilo.** Uma a cada dez, no máximo, para fechar um
  raciocínio ("Não há culpa do comprador pela resolução."). Duas seguidas já soam a modelo.
- **Parágrafo de 60 a 110 palavras**, com um movimento só: fato e sua prova, ou norma e sua
  aplicação. Parágrafos consecutivos do mesmo tamanho denunciam geração em série; varia-se
  porque o argumento varia, não por cota.
- **A abertura do parágrafo é circunstância ou fato, não conectivo lógico.** "Ocorre que",
  "No caso concreto", "Somente quando", "Após a notificação", "Refeita a conta", "Quanto à
  data". "Além disso", "Ademais", "Nesse sentido", "Outrossim" existem, cada um no máximo
  uma vez por peça, e nunca abrindo dois parágrafos vizinhos.

## 3. Registro

- **Formal, combativo pelo fato, sem adjetivo gratuito.** A força vem do documento e da
  contradição da parte contrária. Adjetivo forte ("irrisória", "silenciosa") só quando o
  documento o sustenta na mesma frase, e nunca dirigido ao juízo ou ao magistrado de origem.
- **Passiva forense é nativa** ("restou comprovado", "foi notificado"). Não se converte
  em ativa por reflexo.
- **Fórmulas do gênero com parcimônia.** "Ressalte-se", "impõe-se", "com efeito",
  "de rigor": até uma vez cada, onde de fato marcam ênfase. Em série, viram tique.
- **Terminologia técnica não varia.** Fraude à execução é sempre fraude à execução;
  distrato é distrato. Sinônimo leigo é erro, não elegância.
- **Dois-pontos são funcionais** (preferência da titular, 12/08/2026): introduzem citação em
  bloco, a enumeração de síntese e o "requer-se:". Na argumentação, o desdobramento vem por
  ponto, ponto e vírgula ou conjunção ("pois", "já que", "mas"). Meta: no máximo um
  dois-pontos de prosa por capítulo.

## 4. Como o fundamento entra

- **Dispositivo colado à afirmação**, entre parênteses no fim da oração: "…veda a incidência
  de norma nova sobre ato jurídico aperfeiçoado (art. 5º, XXXVI, da CF)". Não em frase
  própria "Nos termos do art. X, …" a cada parágrafo.
- **Precedente com identificação completa na mesma frase** (tribunal, número, data) e, quando
  transcrito, **em bloco com a fonte na linha seguinte**. A frase que introduz a transcrição
  diz o que o julgado decidiu; a transcrição confirma. Nunca o contrário.
- **Enumeração romana (i), (ii), (iii)** só para elencar fundamentos autônomos, cláusulas ou
  itens de pedido. Em argumentação corrida, a sequência vira prosa ("Comece-se por…", "Soma-se
  a isso…", "Há ainda…").

## 5. Arquitetura visível (o que fica da estrutura AI-first)

- **Título de capítulo enuncia a tese.** "Da culpa exclusiva da requerida e da restituição
  integral" serve; "Do mérito" não. A forma tradicional "Da/Do" é aceita quando seguida da
  conclusão.
- **Conclusão nas primeiras linhas do capítulo** e, no fim, o pedido parcial em uma frase
  ("Requer, portanto, que …"). O meio é a demonstração.
- **Nenhum rótulo meta-textual** ("Conclusão do capítulo:", "Impugnação:"). A estrutura se
  vê pela ordem, não por etiqueta.

## 6. Exemplo fictício (para ouvir o ritmo)

> A requerida sustenta que a notificação foi regular porque o aviso retornou assinado, mas o
> documento que junta é formulário próprio, sem carimbo de cartório nem identificação de quem
> recebeu, de maneira que não cumpre a exigência do art. 49, § 2º, da Lei 6.766/79. Ocorre que
> a mesma requerida, quatro dias antes de expirar o prazo que ela própria fixou, já havia
> lançado o cancelamento no sistema, conforme o extrato que instrui a inicial. Não houve
> constituição em mora. Requer-se, por isso, que a rescisão seja declarada por culpa da
> loteadora, com a restituição integral do que foi pago.

Repare no que faz este trecho soar humano: períodos de tamanhos diferentes porque dizem coisas
de peso diferente, a frase curta no lugar em que o argumento vira, o dispositivo no fim da
oração, e nenhuma ênfase que o documento não sustente.

## 7. O que este perfil não autoriza

Nada aqui relativiza os invariantes do humanizer: transcrição, número, data, dispositivo,
julgado, título-tese, posição da conclusão e modalidade das formulações não mudam para
"soar melhor". O `checar-invariantes.js` confere isso mecanicamente depois de cada passada.

## 8. Retórica que denuncia o modelo (decisão da titular, 15/10/2026)

Uma inicial passou no `lint-ia` e ainda assim foi lida como texto de IA, porque o que a
denunciava não era vocabulário, era **estrutura retórica**. Os nove padrões abaixo saíram dessa
leitura. Três deles são contados por máquina (`lint-ia`: quiasmo, contraste "e sim", anáfora;
`ritmo.js`: gancho de cena, fila de curtas); os demais só a leitura pega, porque o corpus de peças
aprovadas do escritório mostrou que a titular também usa frase curta e repete termo técnico. O que
distingue é a função, não a contagem. Exemplos fictícios.

- **8.1 Frase de efeito.** A frase curta que abre ou fecha parágrafo tem de fazer trabalho
  próprio: fixar consequência, marcar virada, encerrar questão demonstrada. O que denuncia o
  modelo é a frase simétrica, citável, que repete em forma de máxima o que o parágrafo já provou.
  Uma por peça, no ponto em que o argumento vira; mais de três é assinatura de modelo.
  > *Modelo:* "A notificação não chegou. E o prazo não correu." *Escritório:* "Como a notificação
  > não chegou ao endereço do contrato, o prazo do art. 32 não começou a correr."
- **8.2 Espelho e quiasmo.** "O que o comprador fez, fez induzido; o que a loteadora fez, fez
  por conta própria" é figura de discurso, não de petição. Dissolver em subordinação: "O comprador
  agiu induzido pela loteadora, que, por sua vez, agiu por conta própria".
- **8.3 Contraste montado.** "Não se trata de atraso, e sim de inadimplemento" e "não é X, é Y"
  são a mesma figura do "X, e não Y" que a tabela do humanizer limita. Afirmar direto: "Houve
  inadimplemento, porque a obra não foi entregue no prazo da cláusula 5ª".
- **8.4 Anáfora em série.** "A única parcela paga, a única notificação enviada, a única
  resposta dada" é tríade e vale a regra da tabela (zero). Na prosa do escritório cada item vem
  com seu verbo e seu documento.
- **8.5 Gancho de cena.** Capítulo não abre como reportagem ("Em quarenta minutos de uma
  sexta-feira…"). Abre pelo sujeito jurídico e pela conclusão: "A loteadora registrou o
  cancelamento quatro dias antes de expirar o prazo que ela própria fixou". A hora vai para a
  cronologia.
- **8.6 Motivo repetido.** A mesma locução ("tem número", "em quarenta minutos", "conta
  parada") não volta duas vezes no mesmo capítulo nem três na peça como refrão. O fato se repete
  quando a prova exige; a expressão, não.
- **8.7 Fila de frases curtas.** Um critério por frase curta ("O valor destoa. O horário destoa.
  O destino destoa.") é lista disfarçada. Um período subordinado reúne os critérios e a prova:
  "O valor, o horário e o destino destoam do histórico da conta, como mostra o extrato".
- **8.8 Enumeração seca no fecho.** Parágrafo não termina em inventário ("chave nova, crédito
  acima do saldo, sete boletos, saldo zero."). O fecho é oração com verbo e consequência.
- **8.9 Molde uniforme.** Parágrafos consecutivos no molde "afirmação, prova, frase de efeito"
  denunciam geração em série ainda que cada um esteja correto. Tamanho e ordem variam porque o
  peso do argumento varia; o checklist que percorre critérios de um precedente, um parágrafo por
  critério, se funde em dois ou três períodos.
- **8.10 Título-síntese formal** (PRD de calibração, §4.1, adotado em 15/10/2026). Subtítulo é
  construção nominal que resume a conclusão do bloco: "Da inexistência da mora por ausência de
  notificação válida". Não é manchete ("O banco viu e não fez nada") nem rótulo ("Do mérito").
  Frase finita continua possível quando a precisão jurídica exigir. Os títulos de capítulo da
  inicial seguem `definicoes.md` §5.

## 9. Como a narrativa da inicial se arma (lições de 15/10/2026)

- **Abrir pela prova documental mais forte**, não pelo relato do cliente: extrato, registro
  oficial, cronologia reconstruída de documento. O relato entra depois, como o que o documento
  confirma; boletim de ocorrência é relato do cliente, não prova do fato.
- **Nunca citar documento próprio que contradiga a tese.** Se o boletim ou a reclamação
  administrativa diz coisa diversa do que a peça sustenta naquele ponto, a peça não o invoca ali,
  e explica a divergência onde ela for inevitável (valores "de memória" contra extrato, por
  exemplo).
- **Gravidade do dano moral com os fatos concretos do caso, cada um com o seu Doc.**, não com
  adjetivo: o modo do golpe, a resposta de cada ré, a cobrança que se seguiu, a condição das
  partes.
- **Pedido de exibição com um parágrafo por ré**, cada um enumerando os registros que só aquela
  ré detém e o dever regulatório de guarda que os sustenta; períodos de até 45 palavras, um por
  grupo de registros.

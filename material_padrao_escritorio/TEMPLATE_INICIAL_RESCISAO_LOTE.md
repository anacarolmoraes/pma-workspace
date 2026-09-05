---
titulo: Ação de Rescisão Contratual c/c Restituição de Valores — [[NOME DO AUTOR]]
processo: a distribuir
out: INICIAL_RESCISAO_[[SLUG]].docx
bundle: direito/imobiliario
---

<!--
TEMPLATE — inicial de rescisão de compromisso de compra e venda de LOTE urbano.
Padrão do escritório validado em caso real de jul/2026. Antes de redigir, LER:
  <bundles>/direito\imobiliario\playbooks\playbook-peticao-inicial-rescisao-imovel.md
  + teses do regime aplicável (ver bifurcação pela data do contrato abaixo).

BIFURCAÇÃO PELA DATA DO CONTRATO:
  • Contrato ANTERIOR a 28/12/2018 → irretroatividade da Lei do Distrato (art. 32-A afastado);
    regime STJ anterior (retenção 10-25%, Súmula 543/Tema 577).
  • Contrato POSTERIOR a 28/12/2018 → prevalência do CDC (REsp 2.106.548/SP): art. 32-A como
    teto, retenção ≤ 25% DO PAGO, fruição indevida em lote não edificado, restituição imediata.
  Ajustar o capítulo VI e a jurisprudência transcrita conforme a data.

CHECAGENS OBRIGATÓRIAS:
  • Números de cláusula: conferir no contrato ASSINADO (não confiar em OCR).
  • Base da retenção: 10-25% incidem sobre os VALORES PAGOS, não sobre o valor do contrato.
  • Valor da causa = valor do contrato (conferir no documento).
  • Assinatura: quem efetivamente subscreve (perfil/definicoes.md §4 e perfil/advogados.json).
  • `bundle:` acima aponta o acervo que sustenta a peça; o hook require-leitura exige que ele
    tenha sido lido nesta sessão. `pipeline: legal-orchestrator` só entra depois do ciclo cumprido.
Remover este comentário antes de compilar.
-->

::endereco
AO JUÍZO DA __ª VARA CÍVEL DA
COMARCA DE [[COMARCA]], ESTADO DE [[UF POR EXTENSO]]
::

::br

**[[NOME DO AUTOR EM MAIÚSCULAS]]**, [[nacionalidade, estado civil, profissão]], inscrito no CPF sob o nº [[CPF]], residente e domiciliado na [[endereço completo]], com endereço eletrônico [[e-mail]], por [[sua advogada que esta subscreve / suas advogadas que esta subscrevem]], conforme procuração anexa, vem respeitosamente perante Vossa Excelência propor a presente

::center AÇÃO DE RESCISÃO CONTRATUAL C/C RESTITUIÇÃO DE VALORES PAGOS

::center (com pedido de tutela provisória de urgência)

em face de **[[RÉ EM MAIÚSCULAS]]**, pessoa jurídica de direito privado inscrita no CNPJ sob o nº [[CNPJ]], com sede na [[endereço da ré]], pelos fatos e fundamentos a seguir expostos.

# I. Da síntese da lide

[[BLUF: o autor comprou um lote em [mês/ano], pagou [descrição], e não pode mais suportar a prestação, que subiu de R$ [x] para R$ [y]. Já pagou à ré R$ [total], correspondentes a [%] do preço.]]

A parte autora requer a declaração de rescisão do contrato e a devolução do que foi pago, retidos os [[10]]% de cláusula penal que a própria Lei 6.766/79 autoriza, o que resulta em **R$ [[valor a restituir]]** a restituir de imediato e em parcela única.

Antecipa-se desde já a resistência previsível da ré, ancorada no quadro-resumo do contrato: a taxa de fruição, a retenção da corretagem e a devolução parcelada com carência, questões que contrariam o Código de Defesa do Consumidor.

# II. Dos fatos

[[Data e identificação do contrato; objeto (lote/quadra/loteamento/matrícula); preço, sinal, número e valor das parcelas, vencimento final; índice de reajuste. Total pago conforme extrato da ré, com data. Motivo do desinteresse (dificuldade financeira). Afirmar o NÃO USO do lote quando for o caso: nunca construiu, residiu, cercou, alugou ou explorou; lote vazio e à disposição da ré. Descrever as deduções que o contrato prevê para o desfazimento.]]

# III. Da gratuidade da justiça

O autor não tem condições de arcar com as custas do processo sem prejuízo do próprio sustento. [[Sua declaração de ajuste anual do imposto de renda, anexa, aponta rendimento tributável de R$ [x] no exercício (renda mensal média de R$ [y]).]] Trata-se de renda que atrai a presunção de veracidade do art. 99, § 3º, do Código de Processo Civil, e o Superior Tribunal de Justiça, ao julgar o Tema 1.178, fixou que a gratuidade não pode ser indeferida por critério automático de renda, nem sem que o juízo aponte, de forma fundamentada, o elemento concreto capaz de infirmar a declaração.

Requer, portanto, a concessão do benefício.

# IV. Da competência da Comarca de [[COMARCA]] e da nulidade da cláusula de eleição de foro

A cláusula [[nº]] do contrato elege o foro de [[foro eleito]]. Essa eleição não prevalece. O art. 101, inciso I, do Código de Defesa do Consumidor assegura ao consumidor o ajuizamento da ação no foro de seu domicílio, regra de competência instituída em favor da parte vulnerável que se sobrepõe à eleição feita em contrato de adesão.

Firma-se, assim, a competência desta Vara Cível da Comarca de [[COMARCA]].

# V. Da incidência do Código de Defesa do Consumidor e do direito do comprador de rescindir o contrato

A relação é de consumo. A ré declara no próprio instrumento (cláusula [[nº]]) ter como atividade econômica a compra, venda e loteamento de imóveis, o que a qualifica como fornecedora (art. 3º da Lei 8.078/90); o autor adquiriu um único lote, como destinatário final (art. 2º). O contrato é de adesão e reconhece a submissão ao Código de Defesa do Consumidor (cláusula [[nº]]).

O art. 32-A da Lei 6.766/79 fixa **tetos** para as deduções na resolução por fato imputável ao adquirente, e nada nele afasta o controle de abusividade do art. 51 da Lei 8.078/90. O comprador que não deseja mais manter o vínculo pode pedir sua rescisão, ainda que em mora, e a Súmula 543 do Superior Tribunal de Justiça parte dessa premissa.

# VI. Da retenção: o limite incide sobre os valores efetivamente pagos

[[Fazer a conta na peça. Valor atualizado do contrato = R$ [x]; 10% disso = R$ [y], que corresponde a [%] de tudo o que o autor pagou (acima do teto de 25% do STJ). A leitura que compatibiliza o dispositivo com o sistema faz o percentual incidir sobre os valores pagos: retidos 10% de R$ [pago] = R$ [z], o autor recupera R$ [restituição].]]

[[Se contrato PÓS-2018: transcrever a ementa do REsp 2.106.548/SP (Nancy Andrighi, 3ª T., 02/09/2025) — prevalência do CDC, retenção ≤ 25% do pago, fruição indevida em lote não edificado, restituição imediata. Fonte: jurisprudencia/resp-2106548-sp.md.]]

[[Se contrato PRÉ-2018: fundamentar na irretroatividade da Lei do Distrato + Súmula 543 + Tema 577 (retenção escalonada 10-25%).]]

Subsidiariamente, caso Vossa Excelência entenda que a base de cálculo é o valor atualizado do contrato, requer que a retenção seja reduzida ao teto de 25% dos valores pagos, na forma do art. 413 do Código Civil e do art. 51, § 2º, do Código de Defesa do Consumidor.

# VII. Da inexigibilidade da taxa de fruição sobre lote nunca utilizado

O quadro-resumo e a cláusula [[nº]] preveem indenização de 0,75% ao mês sobre o valor atualizado do contrato. [[Demonstrar o resultado absurdo da conta: 0,75% de R$ [x] = R$ [y] por mês × [meses] = R$ [total], que zeraria a devolução.]]

Fruição é o proveito econômico efetivamente extraído da coisa, não a titularidade formal da posse. O art. 32-A, inciso I, da Lei 6.766/79 fala em valores correspondentes à **eventual** fruição, adjetivo que só faz sentido se a hipótese depender de demonstração. O autor nunca construiu, residiu, cercou, alugou ou explorou o lote, e o ônus de provar o contrário é de quem alega o desconto (art. 373, II, CPC; art. 6º, VIII, CDC). Requer-se a declaração de inexigibilidade de qualquer valor a título de fruição.

# VIII. Da corretagem: o próprio contrato exclui a dedução que a ré pretende

O art. 32-A, inciso V, da Lei 6.766/79 permite deduzir a corretagem **desde que integrada ao preço do lote**. A cláusula [[nº]] do contrato dispõe que em hipótese alguma será considerada parte do preço a despesa com corretagem — logo, a corretagem não preenche o requisito legal para ser retida. A cláusula [[nº]] que afasta sua restituição é nula na parte em que contraria norma cogente (art. 51, XV, CDC).

# IX. Da vedação de bis in idem entre a retenção percentual e os encargos moratórios

A cláusula [[nº]] autoriza a ré a descontar, além da retenção percentual, os encargos moratórios das prestações pagas em atraso, já embutidos nos boletos e pagos pelo autor. A retenção percentual global já compensa a vendedora pela resolução; cobrar de novo os encargos moratórios sobre o mesmo inadimplemento é punir duas vezes o mesmo fato (art. 884 do Código Civil; art. 51, IV, do CDC).

# X. Da restituição imediata e em parcela única

A cláusula [[nº]] reproduz o art. 32-A, § 1º, da Lei 6.766/79 e prevê devolução em 12 parcelas com carência. O Superior Tribunal de Justiça qualificou esse diferimento como abusivo no Tema 577 (REsp 1.300.418/SC, Rel. Min. Luis Felipe Salomão):

> Em contratos submetidos ao Código de Defesa do Consumidor, é abusiva a cláusula contratual que determine a restituição dos valores devidos somente ao término da obra ou de forma parcelada, na hipótese de resolução de contrato de promessa de compra e venda de imóvel submetido ao Código de Defesa do Consumidor, por culpa de quaisquer contratantes. Em tais avenças deve ocorrer a imediata restituição das parcelas pagas pelo promitente comprador, integralmente, em caso de culpa exclusiva do promitente vendedor/construtor, ou parcialmente, caso tenha sido o comprador quem deu causa ao desfazimento.

No mesmo sentido, a Súmula 543 do Superior Tribunal de Justiça:

> Na hipótese de resolução de contrato de promessa de compra e venda de imóvel submetido ao Código de Defesa do Consumidor, deve ocorrer a imediata restituição das parcelas pagas pelo promitente comprador — integralmente, em caso de culpa exclusiva do promitente vendedor/construtor, ou parcialmente, caso tenha sido o comprador quem deu causa ao desfazimento.

Requer, portanto, a restituição em parcela única, atualizada pelo IGPM desde cada desembolso e acrescida de juros de mora de 1% ao mês desde a citação.

# XI. Da tutela provisória de urgência

Enquanto a ação tramita, o autor continua obrigado a pagar prestações de um contrato cuja rescisão pede, sob pena de negativação e protesto (cláusulas [[nº]]). A probabilidade do direito decorre do exposto e do caráter potestativo da rescisão; o perigo de dano é atual, a cada mês de tramitação. A manutenção da exigência de IPTU sobre o bem que se pretende devolver agrava a situação.

O Tribunal de Justiça do Mato Grosso reconheceu que a suspensão alcança os encargos acessórios:

> [[Transcrever a ementa do TJMT, AI 1017433-56.2019.8.11.0000, se aplicável — fonte: jurisprudencia/tjmt-ai-1017433-56-2019-iptu-tutela.md.]]

Requer, com fundamento no art. 300 do Código de Processo Civil, a suspensão da exigibilidade das parcelas vencidas e vincendas, a abstenção de inscrição do nome do autor em cadastros restritivos e de protesto, a suspensão da exigibilidade do IPTU e demais encargos incidentes sobre o imóvel enquanto pendente a demanda, e a rescisão contratual de plano, sob pena de multa. A medida é reversível, sujeitas as parcelas ao acerto de contas ao final.

# XII. Dos pedidos

Diante do exposto, requer:

**a)** a concessão da gratuidade da justiça, na extensão do art. 98, § 1º, do Código de Processo Civil;

**b)** o reconhecimento da competência desta Comarca de [[COMARCA]], com a declaração de ineficácia da cláusula [[nº]] de eleição de foro, nos termos do art. 101, inciso I, do Código de Defesa do Consumidor;

**c)** a concessão da tutela provisória de urgência, para suspender as cobranças, protestos e negativações das parcelas vencidas e vincendas, suspender a exigibilidade do IPTU e demais encargos sobre o imóvel enquanto pendente a demanda, e declarar de imediato a rescisão do contrato;

**d)** a citação da ré para, querendo, contestar;

**e)** no mérito, a declaração de rescisão do [[identificação do contrato]], com a extinção das obrigações vencidas e vincendas e a devolução do lote à ré, que dele nunca foi privada;

**f)** a condenação da ré a restituir ao autor **R$ [[valor]]**, correspondentes a [[%]] dos R$ [[pago]] efetivamente pagos, em parcela única, corrigidos pelo IGPM desde cada desembolso e acrescidos de juros de mora de 1% ao mês;

**g)** subsidiariamente, caso se entenda que a retenção incide sobre o valor atualizado do contrato, que seja reduzida ao teto de 25% dos valores pagos (art. 413 do Código Civil; art. 51, § 2º, do Código de Defesa do Consumidor);

**h)** a declaração de nulidade e inexigibilidade das cláusulas que preveem indenização por fruição, retenção da corretagem e dedução autônoma de encargos moratórios;

**i)** a inversão do ônus da prova (art. 6º, inciso VIII, do Código de Defesa do Consumidor), quanto ao proveito econômico do lote e ao estágio das obras de infraestrutura;

**j)** a condenação da ré ao pagamento das custas e de honorários advocatícios de sucumbência.

Protesta provar o alegado por todos os meios admitidos e manifesta interesse na audiência de conciliação do art. 334 do Código de Processo Civil. Requer que as intimações sejam feitas exclusivamente em nome da[[s]] advogada[[s]] subscritora[[s]], e opta pelo Juízo 100% Digital, caso a comarca o disponibilize.

Dá-se à causa o valor de **R$ [[valor do contrato]]**.

::assinatura
[[NOME DA ADVOGADA]] | OAB/TO [[nº]]
local: Palmas — TO, data certificada pelo sistema.
::

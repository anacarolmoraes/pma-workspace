---
titulo: Ação de Indenização por Danos Materiais e Morais c/c Declaratória de Inexistência de Débito — [[NOME DO AUTOR]]
processo: a distribuir
tipo: inicial
out: INICIAL_GOLPE_[[SLUG]].docx
bundle: direito/bancario/golpes
estrutura: template
documentos:
  - n: 1
    descricao: "[[Procuração]]"
  - n: 2
    descricao: "[[Documento de identidade e comprovante de residência]]"
  - n: 3
    descricao: "[[Extrato da conta de origem, período do golpe]]"
  - n: 4
    descricao: "[[Comprovantes das transações e protocolos de reclamação]]"
---

<!--
TEMPLATE — inicial de GOLPE BANCÁRIO (falsa central, Pix induzido, empréstimo contratado
pelo golpista) e, com ajustes, de NEGATIVAÇÃO INDEVIDA. Materializa o esqueleto único de
<bundles>/direito/pecas/peticao-inicial/playbooks/playbook-peticao-inicial.md com as variáveis
fixadas para o tema: preliminar = gratuidade (pessoa natural, enxuta); TUTELA LOGO APÓS OS
FATOS (o desconto ou a negativação em curso é o destaque); capítulo de danos = sim;
competência = não (só se houver cláusula de eleição em contrato que o autor reconheça);
autocomposição = decisão da ANALISE.md.

Antes de redigir, LER: <bundles>/direito/bancario/golpes/index.md (+ jurisprudencia/,
contra-ataques/, heuristicas/repertorio-de-defesas-do-banco.md), e, para consignado,
<bundles>/direito/bancario/emprestimo-nao-realizado/playbooks/playbook-peticao-inicial-fraude-consignado.md.

NÚMEROS: todos vêm da FICHA_CASO.md gerada pela skill ficha-golpe-bancario. Nenhum R$ entra
na peça sem estar na ficha (o --conferir da ficha acusa). Transações apuradas no extrato
convertido pelo pdfmd, nunca em print.

JURISPRUDÊNCIA: só transcrita da página do bundle, com a fonte adjacente. Os slots abaixo
dizem qual página; se a página não existe ou está em_teste, a peça diz que o acervo não
cobre (AGENTS.md, regra dura 3) ou declara cita_em_teste: sim.

`estrutura: template` dispensa o <PECA>.estrutura.md (playbook: "peça com template segue sem
parar e lista só os desvios"). Remover este comentário antes de compilar.
-->

::endereco
AO JUÍZO DA __ª VARA CÍVEL DA
COMARCA DE [[COMARCA]], ESTADO DE [[UF POR EXTENSO]]
::

::br

**[[NOME DO AUTOR EM MAIÚSCULAS]]**, [[nacionalidade, estado civil, profissão]], inscrito no CPF sob o nº [[CPF]], residente e domiciliado na [[endereço completo]], com endereço eletrônico [[e-mail]], por [[sua advogada que esta subscreve / suas advogadas que esta subscrevem]], conforme procuração anexa (Doc. 1), vem respeitosamente perante Vossa Excelência propor a presente

::center AÇÃO DE INDENIZAÇÃO POR DANOS MATERIAIS E MORAIS C/C DECLARATÓRIA DE INEXISTÊNCIA DE DÉBITO

::center (com pedido de tutela provisória de urgência)

em face de **[[RÉ EM MAIÚSCULAS]]**, instituição financeira inscrita no CNPJ sob o nº [[CNPJ]], com sede na [[endereço da ré]], endereço eletrônico [[e-mail da ré, se conhecido]], pelos fatos e fundamentos a seguir expostos.

# I. Da síntese da lide

[[BLUF em um parágrafo denso: em [data], o autor, cliente da ré desde [ano], foi induzido por [alavanca do golpe: falsa central, falso funcionário, link] a [ato]; em [minutos/horas] saíram da conta R$ [material líquido da ficha], em [n] transações [atípicas: valor, horário, destinatário novo] que o sistema da ré não bloqueou nem confirmou. A reclamação de [data] foi respondida com [negativa/silêncio]. Pede-se a restituição de R$ [material], a declaração de inexistência do [débito/contrato gerado pelo golpe] e indenização por dano moral de R$ [moral], somando R$ [valor da causa].]]

Antecipa-se a objeção previsível: a ré dirá que as operações foram feitas com senha e dispositivo do próprio autor. [[Uma frase que desmonta: a autenticação regular não afasta o defeito quando a operação foge do perfil do cliente e o sistema não reage; é o que decide o REsp 2.222.059/SP, transcrito adiante.]]

# II. Dos fatos

[[Cronologia da ANALISE.md, cada fato com o Doc. N. Perfil de uso da conta antes do golpe (valores médios, destinatários habituais) — é o que torna as operações atípicas. A abordagem: canal, horário, o que o golpista sabia do autor (dado que só o banco tinha?). As transações uma a uma com hora e destinatário (tabela da ficha vira prosa). O que o autor fez ao perceber: bloqueio, MED, boletim de ocorrência, reclamação com protocolo e resposta. O que sobrou: débito, negativação, parcelas de empréstimo que não contratou.]]

[[Fato frágil narrado como relato ("segundo relata o autor, a ligação partiu de número que exibia o nome da ré"); fato a produzir anunciado ("os registros de acesso e geolocalização, em poder da ré, mostrarão…") e levado à seção VII.]]

# III. Da gratuidade da justiça

O autor não tem condições de arcar com as custas do processo sem prejuízo do próprio sustento. [[Forma A ou B pela faixa de R$ 5.000,00 da ADC 80 e regra do perfil/definicoes.md §2: renda mensal de R$ [x] conforme [contracheque/DIRPF] (Doc. N).]] A declaração da pessoa natural goza da presunção do art. 99, § 3º, do Código de Processo Civil, e o Superior Tribunal de Justiça fixou, no Tema 1.178, que o benefício não se indefere de plano por critério objetivo de renda.

Requer a concessão do benefício, na extensão do art. 98, § 1º, do Código de Processo Civil.

# IV. Da tutela provisória de urgência

[[Perigo em reais, meses e impacto: a parcela de R$ [x] que continua sendo descontada em [dia] de cada mês; a negativação que barra [fato concreto]; o saldo negativo que gera juros de [x]% ao mês. A probabilidade decorre da atipicidade documentada nos fatos e da inversão do ônus (CDC 6º, VIII). Reversibilidade: a suspensão da cobrança se desfaz sem prejuízo à ré; caução dispensada (CPC 300, § 1º).]]

Requer, com fundamento no art. 300 do Código de Processo Civil, que a ré seja compelida a [[suspender a exigibilidade do contrato nº [x] e das parcelas vincendas / retirar o nome do autor dos cadastros restritivos em 5 dias / abster-se de nova inscrição]], sob pena de multa diária de R$ [[valor]].

# V. Do direito

## V.1. [[Título-tese: a relação é de consumo e a responsabilidade da ré é objetiva]]

[[Fato concreto → o que significa → norma → consequência. CDC 2º, 3º, § 2º, e 14. Fortuito interno: a fraude praticada por terceiro no ambiente do serviço bancário é risco do empreendimento. Transcrever a Súmula 479 do STJ da página sumula-479-stj.md do bundle bancario/emprestimo-nao-realizado.]]

## V.2. [[Título-tese: operações fora do perfil do cliente sem reação do sistema configuram defeito do serviço]]

[[Confrontar o perfil de uso (fatos) com as operações do golpe. Transcrever o trecho-chave do REsp 2.222.059/SP da página resp-2222059-sp-falsa-central-perfil-consumo.md do bundle golpes, com a fonte adjacente. Nomear a alavanca de engenharia social (lgpd/heuristicas/engenharia-social-as-alavancas.md): consumidor induzido, não descuidado.]]

## V.3. [[Título-tese: a inversão do ônus e a exibição dos registros que só a ré tem]]

[[CDC 6º, VIII: hipossuficiência técnica evidente. Registros de acesso, IP, geolocalização, gravação da central, análise antifraude: em poder da ré. O que o autor pede que se presuma se ela não exibir (CPC 400). Se a ré invocou "dispositivo autorizado" na resposta administrativa, é ela quem prova a autorização.]]

## V.4. [[Título-tese, só se houver: o contrato gerado pelo golpe não vincula o autor]]

[[Declaratória de inexistência do empréstimo ou do débito; parcelas cobradas indevidamente (ficha, seção 2) e o dobro do art. 42, p.ú., do CDC, na modulação do EAREsp 600.663/RS (página earesp-600663-rs.md): cobranças posteriores a 30/03/2021 independem de má-fé.]]

# VI. Dos danos

## VI.1. [[Título: o dano material é a soma das transações não estornadas]]

[[Itemizado com documento por item, conforme a ficha, seção 1: R$ [a] em [data] (Doc. 3, p. 2); … Estornos deduzidos. Total líquido R$ [material]. Correção pelo IPCA desde cada desembolso (Súmula 43) e juros pela taxa legal desde [a citação / cada evento, conforme a responsabilidade decidida na ANALISE.md].]]

## VI.2. [[Título: o dano moral pelo método bifásico]]

[[Primeira fase: interesse lesado em uma frase (verba alimentar, sossego, crédito); grupo de casos do tribunal competente com os valores fixados (ficha, seção 3), transcritos ou referidos pela página do acervo; valor básico R$ [mediana]. Segunda fase: cada circunstância com Doc. N (verba alimentar comprometida, resposta administrativa, tempo de exposição, porte da ré). Conclusão: R$ [pedido], com correção desde o arbitramento (Súmula 362) e juros pela taxa legal desde [termo]. Sem "caráter pedagógico", sem adjetivo.]]

# VII. Das provas

Protesta provar o alegado por todos os meios admitidos, em especial pela prova documental já produzida (Docs. 1 a [[N]]) e por [[meio nomeado para cada fato a produzir: ofício ao banco de destino para identificar o titular da conta beneficiária; depoimento pessoal do representante da ré; perícia nos registros de acesso, se controvertidos]].

Requer, com fundamento nos arts. 396 a 400 do Código de Processo Civil, a exibição pela ré de: **(a)** [[registros de acesso, IP e geolocalização das operações de [data]]]; **(b)** [[gravação ou log do atendimento de [data]]]; **(c)** [[relatório da análise antifraude e regras de bloqueio aplicáveis à conta]]; **(d)** [[contrato e trilha de contratação do empréstimo nº [x]]]. Cada documento é referido individualmente (art. 397, I), a finalidade é provar a atipicidade das operações e a ausência de reação do sistema (art. 397, II), e a existência decorre do dever regulatório de guarda (art. 397, III). A recusa injustificada faz presumir verdadeiros os fatos que o autor pretendia provar (art. 400).

# VIII. Da autocomposição

[[Decisão da ANALISE.md, seção 2: "O autor manifesta interesse na audiência de conciliação do art. 334 do Código de Processo Civil" ou "O autor declara desinteresse na autocomposição (art. 334, § 5º), diante da negativa administrativa expressa de [data]", em dois períodos.]]

# IX. Dos pedidos

Diante do exposto, requer:

**a)** a concessão da gratuidade da justiça (art. 98, § 1º, do Código de Processo Civil);

**b)** a concessão da tutela provisória de urgência, para [[suspender a exigibilidade do contrato nº [x] e das parcelas vincendas / excluir o nome do autor dos cadastros restritivos]], sob pena de multa diária de R$ [[valor]];

**c)** a citação da ré para, querendo, contestar;

**d)** [[se houver: a declaração de inexistência do contrato nº [x] / do débito de R$ [x], com a baixa definitiva da negativação;]]

**e)** a condenação da ré a restituir ao autor **R$ [[material líquido da ficha]]** a título de danos materiais, corrigidos pelo IPCA desde cada desembolso e acrescidos de juros pela taxa legal desde [[termo]];

**f)** [[se houver cobrança indevida: a repetição em dobro de R$ [base] indevidamente cobrados, no total de R$ [2 × base] (art. 42, parágrafo único, do CDC); subsidiariamente, o dobro apenas das cobranças posteriores a 30/03/2021;]]

**g)** a condenação da ré ao pagamento de **R$ [[moral pedido]]** a título de danos morais, corrigidos desde o arbitramento e com juros pela taxa legal desde [[termo]];

**h)** a inversão do ônus da prova (art. 6º, inciso VIII, do Código de Defesa do Consumidor) e a exibição dos documentos indicados na seção VII, sob a presunção do art. 400 do Código de Processo Civil;

**i)** a condenação da ré ao pagamento das custas e de honorários advocatícios de sucumbência.

Requer que as intimações sejam feitas exclusivamente em nome da[[s]] advogada[[s]] subscritora[[s]] (art. 272, § 5º, do Código de Processo Civil), e opta pelo Juízo 100% Digital, caso a comarca o disponibilize.

# X. Do valor da causa

Dá-se à causa o valor de **R$ [[valor da causa da ficha]]**, correspondente à soma do dano material (R$ [[material]]), [[do acréscimo do dobro (R$ [x]),]] e do dano moral pretendido (R$ [[moral]]), na forma do art. 292, incisos V e VI, do Código de Processo Civil.

::assinatura
[[NOME DA ADVOGADA]] | OAB/TO [[nº]]
local: [[Palmas]] — TO, data certificada pelo sistema.
::

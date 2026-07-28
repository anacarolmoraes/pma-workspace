from docx import Document
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
import re

doc = Document()

section = doc.sections[0]
section.top_margin = Cm(3)
section.bottom_margin = Cm(2)
section.left_margin = Cm(3)
section.right_margin = Cm(2)

style = doc.styles['Normal']
style.font.name = 'Arial'
style.font.size = Pt(12)
style.paragraph_format.space_after = Pt(0)
style.paragraph_format.line_spacing = Pt(18)

def add_heading(doc, text, level=1):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run = p.add_run(text)
    run.bold = True
    run.font.size = Pt(13) if level == 1 else Pt(12)
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(6)
    return p

def add_para(doc, text, quote=False):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    if quote:
        p.paragraph_format.left_indent = Cm(3)
        p.paragraph_format.right_indent = Cm(1)
        p.paragraph_format.first_line_indent = Cm(0)
    else:
        p.paragraph_format.first_line_indent = Cm(1.25)
    p.paragraph_format.space_after = Pt(6)
    parts = re.split(r'(\*\*[^*]+\*\*|\*[^*]+\*)', text)
    for part in parts:
        if part.startswith('**') and part.endswith('**'):
            run = p.add_run(part[2:-2])
            run.bold = True
        elif part.startswith('*') and part.endswith('*'):
            run = p.add_run(part[1:-1])
            run.italic = True
        else:
            p.add_run(part)
    return p

def add_quote(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(3)
    p.paragraph_format.right_indent = Cm(1)
    p.paragraph_format.space_after = Pt(6)
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    r = p.add_run(text)
    r.italic = True
    r.font.size = Pt(11)
    return p

# TÍTULO
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('RECURSO ESPECIAL')
r.bold = True
r.font.size = Pt(14)
p.paragraph_format.space_after = Pt(4)

for linha in ['Processo de origem: AI 0014893-46.2025.8.27.2700/TO',
              'Processo originário: 0040371-47.2017.8.27.2729 — Cumprimento de Sentença — TJTO']:
    p2 = doc.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p2.add_run(linha).font.size = Pt(11)

doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('AO SUPERIOR TRIBUNAL DE JUSTIÇA')
r.bold = True

doc.add_paragraph()

# Qualificação
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
p.paragraph_format.space_after = Pt(6)
nomes = [
    ('FLÁVIA PAULO DOS SANTOS OLIVEIRA RIBEIRO', True),
    (', ', False),
    ('ANA CAROLINA RIBEIRO DE MORAES PAULO', True),
    (', ', False),
    ('PAULO MORAES ADVOCACIA', True),
    (' (CNPJ 26.911.419/0001-99) e ', False),
    ('ACF TECNOLOGIAS NO CERRADO LTDA', True),
    (' (CNPJ 42.825.793/0001-28), por seus advogados (procuração em anexo), '
     'vêm, com fundamento no art. 105, inciso III, alínea "a", da Constituição '
     'Federal, e nos arts. 1.029 e seguintes do Código de Processo Civil, interpor', False),
]
for texto, bold in nomes:
    r = p.add_run(texto)
    r.bold = bold

doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('RECURSO ESPECIAL')
r.bold = True
r.font.size = Pt(13)

doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
p.paragraph_format.space_after = Pt(6)
p.add_run('contra o acórdão proferido pela 1ª Câmara Cível do Tribunal de Justiça do Estado do Tocantins nos autos do Agravo de Instrumento n.º 0014893-46.2025.8.27.2700/TO (julgamento: 03/12/2025, Rel.ª Des.ª Jacqueline Adorno de La Cruz Barbosa), mantido pelos Embargos de Declaração julgados em 04/02/2026 (Rel.ª Des.ª Etelvina Maria Sampaio Felipe), pelos fundamentos e razões a seguir expostos.')

# I
add_heading(doc, 'I — DO CABIMENTO')
add_para(doc, 'O recurso é cabível nos termos do art. 105, inciso III, alínea "a", da Constituição Federal, pois o acórdão recorrido, proferido por órgão colegiado do Tribunal de Justiça do Estado do Tocantins, contraria os arts. 50, §§ 1º e 2º, do Código Civil de 2002; 792, inciso IV; 373, inciso I; 77, § 2º, inciso IV; e 774 do Código de Processo Civil de 2015; e o art. 1º da Lei n.º 8.009/1990.')
add_para(doc, 'Os dispositivos legais foram expressamente invocados, debatidos e decididos pelo tribunal de origem no voto condutor do acórdão de mérito, e reafirmados nos Embargos de Declaração opostos pelas recorrentes e rejeitados por unanimidade. Nos termos do art. 1.025 do CPC, consideram-se também prequestionados os dispositivos cujo enfrentamento foi suscitado e não atendido, o que configura o prequestionamento ficto.')
add_para(doc, 'As instâncias ordinárias foram integralmente esgotadas. Não há fundamento constitucional autônomo no acórdão recorrido que exigisse interposição simultânea de Recurso Extraordinário (Súmula 126/STJ não incide).')

# II
add_heading(doc, 'II — DOS FATOS FIXADOS PELO TRIBUNAL DE ORIGEM')
add_para(doc, 'As recorrentes não pretendem rediscutir os fatos — tarefa vedada nesta instância especial. Para os fins deste recurso, tomam-se como dados imutáveis as seguintes premissas fáticas estabelecidas pelo próprio acórdão recorrido.')
add_para(doc, '**Quanto à desconsideração inversa da personalidade jurídica:**')
add_para(doc, 'O acórdão registrou que: *"o escritório de advocacia das ora agravantes é utilizado para recebimento de valores, inclusive da própria parte exequente do processo originário, e a empresa fora constituída no curso da execução originária, havendo indícios de desvio de patrimônio"*.')
add_para(doc, 'Esses são, conforme o próprio voto condutor, os únicos fatos específicos indicados para fundamentar a desconsideração inversa de ambas as empresas.')
add_para(doc, '**Quanto à fraude à execução:**')
add_para(doc, 'O acórdão registrou que a executada *"constava como proprietária do bem até o ano de 2023, quando iniciaram as investigações criminais em seu desfavor, havendo prova robusta de que a retirada de seu nome decorreu de tentativa de salvar o patrimônio de investigações criminais"*.')
add_para(doc, 'Não há registro de penhora ou averbação premonitória na matrícula do imóvel na data da alienação — circunstância não controvertida no acórdão.')

# III
add_heading(doc, 'III — DO PEDIDO PRINCIPAL: VIOLAÇÃO AO ART. 50, §§ 1º E 2º, DO CÓDIGO CIVIL')
add_heading(doc, 'III.1 — O comando normativo violado', level=2)
add_para(doc, 'O art. 50 do Código Civil, com a redação dada pela Lei 13.874/2019, estabelece:')
add_quote(doc, '"Art. 50. Em caso de abuso da personalidade jurídica, caracterizado pelo desvio de finalidade ou pela confusão patrimonial, pode o juiz, a requerimento da parte, ou do Ministério Público quando lhe couber intervir no processo, desconsiderá-la para que os efeitos de certas e determinadas relações de obrigações sejam estendidos aos bens particulares de administradores ou de sócios da pessoa jurídica beneficiados direta ou indiretamente pelo abuso. § 1º Para os fins do disposto neste artigo, desvio de finalidade é a utilização dolosa da pessoa jurídica com o propósito de lesar credores e para a prática de atos ilícitos de qualquer natureza. § 2º Entende-se por confusão patrimonial a ausência de separação de fato entre os patrimônios, caracterizada por: I — cumprimento repetitivo pela sociedade de obrigações do sócio ou do administrador ou vice-versa; II — transferência de ativos ou de passivos sem efetivas contraprestações (...)"')

add_heading(doc, 'III.2 — Como o tribunal de origem aplicou o dispositivo', level=2)
add_para(doc, 'O TJTO decretou a desconsideração inversa de ambas as empresas reconhecendo, nas palavras do próprio voto, a existência de *"indícios de desvio de patrimônio"* e *"indícios de desvio de finalidade ou confusão patrimonial"*. Para tanto, fundou-se em dois fatos: (a) recebimento de valores pela Paulo Moraes Advocacia, inclusive da própria exequente; (b) constituição da ACF Tecnologias no Cerrado no curso da execução originária.')

add_heading(doc, 'III.3 — Por que essa aplicação viola o art. 50, §§ 1º e 2º, CC', level=2)
add_para(doc, 'A violação é direta e decorre da aplicação de um standard jurídico menos rigoroso do que o exigido pela lei.')
add_para(doc, '**Primeiro:** o art. 50, § 2º, inciso I, do Código Civil exige, para a caracterização da confusão patrimonial, o *cumprimento repetitivo* pela sociedade de obrigações do sócio. A simples prestação de serviços advocatícios e o recebimento da remuneração correspondente — ainda que a cliente seja a própria exequente — não equivale ao cumprimento de obrigações pessoais da sócia pela pessoa jurídica. O escritório de advocacia recebe honorários pelo trabalho prestado: isso é o funcionamento regular e lícito de uma sociedade profissional, não confusão patrimonial.')
add_para(doc, '**Segundo:** o art. 50, § 1º, exige, para o desvio de finalidade, a utilização *dolosa* da pessoa jurídica com o *propósito de lesar credores*. A ACF Tecnologias ter sido constituída no curso da execução origina um "indício" — nas palavras do próprio tribunal. Mas indício não é prova. E a lei exige prova de dolo, não indício de má intenção. O STJ é categórico ao decidir que o mero inadimplemento, a inexistência de bens e a simples existência de grupo empresarial familiar não configuram abuso de personalidade jurídica para fins de desconsideração.')
add_para(doc, '**Terceiro:** o art. 50, caput, exige o *abuso* da personalidade jurídica — conceito que pressupõe o uso da pessoa jurídica como instrumento de fraude, não apenas a manutenção de relação empresarial por sócias que também enfrentam dívidas pessoais. A desconsideração inversa é medida excepcional justamente porque rompe com a autonomia patrimonial garantida pelo ordenamento. Exceções legais devem ser interpretadas restritivamente.')
add_para(doc, '**Conclusão:** o tribunal de origem aplicou o art. 50, §§ 1º e 2º, com standard inferior ao previsto na lei — substituindo a exigência de prova robusta de abuso por "indícios" e tratando o funcionamento regular das empresas como confusão patrimonial. Isso configura violação direta ao dispositivo.')

add_heading(doc, 'III.4 — O pedido quanto a este capítulo', level=2)
add_para(doc, 'Requer-se o provimento do Recurso Especial para reformar o acórdão no capítulo da desconsideração inversa da personalidade jurídica das empresas Paulo Moraes Advocacia e ACF Tecnologias no Cerrado Ltda, cassando a medida por ausência dos requisitos do art. 50, §§ 1º e 2º, do Código Civil, determinando-se, se necessário, o retorno dos autos ao tribunal de origem para novo julgamento em conformidade com o standard legal correto.')

# IV
add_heading(doc, 'IV — DO PEDIDO SUBSIDIÁRIO: VIOLAÇÃO AO ART. 792, INCISO IV, DO CPC E À SÚMULA 375/STJ')
add_heading(doc, 'IV.1 — O comando normativo', level=2)
add_para(doc, 'O art. 792, inciso IV, do CPC dispõe que é em fraude à execução a alienação ou oneração de bens ocorrida quando, ao tempo da alienação ou oneração, tramitava contra o devedor ação capaz de reduzi-lo à insolvência. A Súmula 375/STJ — cuja aplicação o próprio acórdão reconheceu — determina que o reconhecimento da fraude à execução depende do registro da penhora do bem alienado ou da prova de má-fé do terceiro adquirente.')

add_heading(doc, 'IV.2 — A questão jurídica pura', level=2)
add_para(doc, 'A questão que se submete ao STJ não é fática. Não se pede que o Tribunal reavalie se Ana Carolina agiu ou não de boa-fé — isso está fora do alcance do Recurso Especial. A questão é estritamente jurídica:')
add_para(doc, '**Investigação criminal em curso, sem qualquer registro ou averbação na matrícula do imóvel, equivale legalmente à prova de ciência do adquirente sobre a insolvência do alienante, para os fins do art. 792, IV, do CPC e da Súmula 375/STJ?**')
add_para(doc, 'A resposta correta é negativa. A Súmula 375/STJ estabelece que, na ausência de registro de penhora, cabe ao credor comprovar que o adquirente tinha *ciência* de demanda capaz de levar o alienante à insolvência — não de investigação criminal, não de processo penal, não de qualquer circunstância que não seja especificamente aquela execução capaz de causar insolvência. Investigação criminal e execução civil são institutos distintos, com regimes jurídicos distintos e publicidade distinta.')
add_para(doc, 'O acórdão presume a má-fé a partir da concomitância temporal entre a alienação e as investigações criminais. Essa presunção não tem suporte no art. 792, IV, do CPC nem na Súmula 375/STJ, que exige prova específica — não presunção por proximidade temporal com evento de natureza diversa.')

add_heading(doc, 'IV.3 — O pedido quanto a este capítulo', level=2)
add_para(doc, 'Requer-se, subsidiariamente, o provimento do Recurso Especial para reformar o acórdão no capítulo do reconhecimento da fraude à execução, com a cassação da penhora do imóvel, determinando-se que o tribunal de origem verifique, nos termos do art. 792, IV, do CPC e da Súmula 375/STJ, se houve efetiva prova de ciência de Ana Carolina sobre a insolvência da alienante, à luz do critério legal correto.')

# V
add_heading(doc, 'V — DA VIOLAÇÃO AO ART. 373, INCISO I, DO CPC E AO ART. 1º DA LEI 8.009/1990')
add_para(doc, 'O acórdão afastou a proteção do bem de família sob o fundamento de que as recorrentes não provaram a destinação residencial do terreno. Com isso, o tribunal atribuiu às recorrentes o ônus de provar a impenhorabilidade — invertendo o ônus legal.')
add_para(doc, 'O art. 373, inciso I, do CPC impõe ao autor (exequente) o ônus de provar os fatos constitutivos do seu direito. A penhorabilidade do bem é pressuposto da constrição — fato constitutivo do direito da exequente à penhora. Cabia à exequente demonstrar que o bem não goza de proteção legal, não às recorrentes demonstrar que goza.')
add_para(doc, 'O art. 1º da Lei n.º 8.009/1990 é norma de caráter protetivo e interpretação extensiva, vocacionada à tutela do direito fundamental à moradia. A carga probatória de afastar sua incidência deve recair sobre quem pretende a penhora — jamais sobre quem a resiste.')
add_para(doc, 'O acórdão violou os arts. 373, I, do CPC e 1º da Lei 8.009/1990 ao exigir das recorrentes a prova negativa da penhorabilidade, quando a lei impõe ao credor a prova positiva da ausência de proteção.')

# VI
add_heading(doc, 'VI — DA VIOLAÇÃO AOS ARTS. 77, § 2º, INCISO IV, E 774 DO CPC')
add_para(doc, 'O acórdão manteve a multa de 5% por ato atentatório à dignidade da justiça com base na duração da execução desde 2019 e na alegação de que as recorrentes adotaram "subterfúgios" para frustrar o cumprimento.')
add_para(doc, 'Os arts. 77, § 2º, inciso IV, e 774 do CPC exigem, para a imposição da multa sancionatória, a prática de conduta específica e ativa de frustração da execução — ocultação de bens, resistência injustificada a ordens judiciais, condutas protelatórias dolosas. A mera duração do processo executivo e a insatisfação da obrigação ao longo do tempo não configuram, por si sós, o tipo infracional dos arts. 77 e 774 do CPC.')
add_para(doc, 'A norma sancionatória processual deve ser interpretada restritivamente. A imposição da multa sem a identificação de conduta específica prevista no tipo legal viola os arts. 77, § 2º, IV, e 774 do CPC, pois pune o devedor pela insolvência, e não pela prática de ato atentatório.')

# VII
add_heading(doc, 'VII — DO PEDIDO FINAL')
add_para(doc, 'Diante do exposto, requerem as recorrentes:')

pedidos = [
    ('a) ', 'Conhecimento do presente Recurso Especial', ', com fundamento no art. 105, III, "a", da Constituição Federal, por violação aos arts. 50, §§ 1º e 2º, CC; 792, IV, CPC; 373, I, CPC; 77, § 2º, IV, e 774, CPC; e 1º da Lei 8.009/1990;'),
    ('b) ', 'Provimento do recurso quanto ao pedido principal', ', para reformar o acórdão recorrido no capítulo da desconsideração inversa da personalidade jurídica das empresas Paulo Moraes Advocacia e ACF Tecnologias no Cerrado Ltda, cassando a medida por ausência dos requisitos legais do art. 50, §§ 1º e 2º, do Código Civil;'),
    ('c) ', 'Provimento do recurso quanto ao pedido subsidiário', ', para reformar o acórdão recorrido no capítulo do reconhecimento da frauda à execução e da penhora do imóvel, por violação ao art. 792, IV, do CPC e à Súmula 375/STJ;'),
    ('d) ', 'Provimento do recurso quanto aos pedidos dos Capítulos V e VI', ', para reformar o acórdão no capítulo do bem de família e da multa atentatória, por violação aos arts. 373, I, CPC; 1º, Lei 8.009/1990; e arts. 77, § 2º, IV e 774, CPC.'),
]

for letra, bold_text, rest in pedidos:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p.paragraph_format.left_indent = Cm(1.25)
    p.paragraph_format.space_after = Pt(6)
    p.add_run(letra)
    p.add_run(bold_text).bold = True
    p.add_run(rest)

doc.add_paragraph()
add_para(doc, 'Termos em que,')
add_para(doc, 'Pede deferimento.')

for _ in range(3):
    doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.add_run('[Local], [data].')

for _ in range(2):
    doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.add_run('_____________________________________________')

p2 = doc.add_paragraph()
p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
p2.add_run('[Advogado(a)]').bold = True

p3 = doc.add_paragraph()
p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
p3.add_run('OAB n.º [___]')

output = 'C:/Users/anaca/Documents/advocacia/resp-stj-pipeline/outputs/RESP_FINAL.docx'
doc.save(output)
print('OK:', output)

# Trabalho manual no Word: contrato, procuração, PDF

> Saiu do `SKILL.md` em 03/10/2026 (antigos módulos 1.3, 1.4, 4.2, 4.4, 4.5, 8, 9, 10 e 11).
> Peça processual não passa por aqui: o `peca-pma-builder` aplica o padrão sozinho. Isto serve
> quando alguém formata **à mão** no Word um contrato, uma procuração ou exporta um PDF.
> Origem: 33 fontes de tipografia jurídica consolidadas no NotebookLM (petições tipografadas,
> workshops, guias de design de informação jurídica).

## 1. Fonte ausente e exportação

Montserrat é Google Fonts: sem ela instalada na máquina de quem abre, o Word substitui e o
layout quebra. Ao exportar PDF, incorporar fontes (Arquivo → Opções → Avançado →
Compartilhamento → **Incorporar fontes no arquivo**).

Fallback se Montserrat estiver indisponível: Calibri, Gill Sans, Trebuchet MS (sem serifa);
Georgia, Garamond, Book Antiqua (peça formal impressa). Fonte "Thin" ou "Light" no corpo some
depois da compressão do PDF judicial.

**CDC, art. 54:** contrato de consumo exige corpo 12. "12" varia por família (Arial 12 é bem
maior que Garamond 12); a régua é legibilidade equivalente à do Arial 12, medida pelo
x-height.

## 2. Parágrafo e alinhamento

Uma técnica de parágrafo, nunca duas. Recuo de primeira linha **e** espaçamento entre
parágrafos juntos é pleonasmo tipográfico: afrouxa o texto e infla páginas.

| Técnica | Configuração | Quando |
|---|---|---|
| Americana (padrão PMA) | sem recuo; 12 pt depois do parágrafo | sempre, salvo pedido |
| Tradicional | recuo 1,5 cm na 1ª linha; sem espaço extra | tom clássico |

Recuo se faz por estilo, espaçamento por estilo: Tab e Enter duplo não simulam nenhum dos dois.

Justificado exige hifenização automática (Layout → Hifenização → Automática); sem ela, "rios
brancos". Alinhamento à esquerda é aceitável em contrato de duas colunas. Linha acima de ~75
caracteres vira paredão.

| Contexto | Família | Por quê |
|---|---|---|
| Petição digital (tela) | sans-serif (Montserrat) | renderização limpa |
| Petição impressa formal | serif (Garamond, Georgia) | a serifa guia o olho no papel |
| Contrato | sans-serif leve + bold nos títulos | contraste alto, leitura vertical |
| Parecer | serif ou sans-serif formal | tom acadêmico |

## 3. Contrato

- **Duas colunas**, margens reduzidas: leitura vertical é mais rápida para o cliente leigo.
- Logomarca horizontal discreta no cabeçalho, ou só o tipo de contrato alinhado à direita.
- Cláusulas numeradas por **estilos do Word** (`Tópico`/`Subtópico`), nunca "Cláusula
  Primeira" digitada: com estilo, o texto flui entre colunas ao inserir ou remover cláusula.
- Título de cláusula em bold; corpo sans-serif de peso leve (Montserrat Light, Calibri Light).
- Linha divisória só muito escura (azul marinho `#1A2D5A`) ou muito clara (cinza `#D0D0D0`).

| Assinatura | Regra |
|---|---|
| Digital | PNG de fundo transparente sobre o Word |
| Física | campo de assinatura totalmente branco antes de imprimir |
| Nunca | imprimir, assinar à mão e escanear |

## 4. Procuração e qualificação

Endereço longo quebra de forma errática. Usar tabela invisível (Nome, CPF, Endereço, Cidade,
Estado): Design da Tabela → Bordas → Sem Borda, mantendo "Exibir linhas de grade" para editar.

## 5. PDF e protocolo

- Exportar nativamente (Word → Salvar Como → PDF). Imprimir, assinar e escanear destrói a
  qualidade, infla o arquivo e elimina a seleção de texto.
- Imagens: só a área recortada de interesse. JPEG 80–90% para foto; PNG para documento que
  exige nitidez. Sem capa sem valor processual.
- Documento com mais de 20 páginas: estilos do Word em todos os títulos (sumário automático e
  bookmarks no PDF), sumário na página 2.

## 6. Sinais de credibilidade visual

A peça limpa e consistente transfere atributo positivo ao advogado nos primeiros segundos de
leitura. **Alto padrão:** consistência tipográfica total, espaço branco generoso, alinhamento
preciso, imagens proporcionais e nítidas, cabeçalho e rodapé discretos. **Amador:** múltiplas
fontes, técnicas de parágrafo misturadas, texto colorido fora de hyperlink, destaque em
excesso, tabela de borda grossa ou sombra, imagem pixelada, marca d'água.

Texto sempre preto (`#000000`) ou cinza escuro (`#1A1A1A`) sobre fundo branco.

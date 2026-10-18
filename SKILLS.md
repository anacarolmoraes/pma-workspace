# Skills do workspace

> Gerado por `npm run registro` (`scripts/registro-skills.js`) a partir do frontmatter de cada
> `skills/*/SKILL.md`. Não editar à mão: rode o comando depois de criar, mover ou renomear
> skill. O Claude Code descobre as skills sozinho pela `description`; esta tabela existe
> para humanos e para outros agentes.

| Skill | Motor | Para quê |
|---|---|---|
| [`analise-perfil`](skills/analise-perfil/SKILL.md) | sim | Gera relatório judicial de PERFIL DE CONSUMO em casos de fraude bancária, contrastando o padrão habitual do correntista (baseline real dos extratos) com o cluster de operações frau |
| [`banca-revisora`](skills/banca-revisora/SKILL.md) | sim | Banca simulada de revisão de peças processuais de alto valor: 5 assentos jurídicos (assessor de gabinete, advogado da parte contrária, relator pragmático, processualista, estrategi |
| [`buscar-jurisprudencia-tjsp`](skills/buscar-jurisprudencia-tjsp/SKILL.md) | sim | Pesquisa jurisprudência do TJSP na Consulta Completa do e-SAJ (CJSG: acórdãos, decisões monocráticas e homologações de 2º grau e Colégio Recursal), por tema ou pelo número do proce |
| [`conselheiros`](skills/conselheiros/SKILL.md) | sim | Run any question, idea, or decision through a council of 5 AI advisors who independently analyze it, peer-review each other anonymously, and synthesize a final verdict. |
| [`consumir-canal-youtube`](skills/consumir-canal-youtube/SKILL.md) | sim | Consome canal jurídico do YouTube e monta uma KB de canal (camada de consumo) em D:\GITHUB\kb-youtube\<canal>, com curadoria anti-repetição — um conceito = uma página sintetizando  |
| [`desmonetizacao-plataforma`](skills/desmonetizacao-plataforma/SKILL.md) | sim | Playbook para ações contra plataformas digitais (YouTube/Google, Meta/Facebook/Instagram, TikTok) por desmonetização, bloqueio ou suspensão de canais/contas/páginas usados como fon |
| [`diff-peca`](skills/diff-peca/SKILL.md) | sim | Compara o texto de uma peça .docx editada manualmente pela titular com o .md-fonte que a gerou, e imprime um diff estruturado em nível de parágrafo (removido / adicionado / alterad |
| [`ficha-golpe-bancario`](skills/ficha-golpe-bancario/SKILL.md) | sim | Apura os números de um caso de GOLPE BANCÁRIO (falsa central, Pix, empréstimo contratado pelo golpista) ou de NEGATIVAÇÃO INDEVIDA a partir dos extratos já convertidos pelo pdfmd,  |
| [`ficha-rescisao-lote`](skills/ficha-rescisao-lote/SKILL.md) | sim | Apura os fatos numéricos de um caso de rescisão de compromisso de compra e venda de LOTE urbano (contrato + extrato de pagamento) e calcula, de forma determinística, os cenários de |
| [`gerador-cumprimento-sentenca`](skills/gerador-cumprimento-sentenca/SKILL.md) | sim | Lê sentença, acórdão (apelação/monocrática) e acórdão em embargos de declaração da pasta do caso, extrai os trechos que fixam índice de correção, montante de devolução e percentual |
| [`humanizer-forense`](skills/humanizer-forense/SKILL.md) | sim | Remove sinais de escrita de IA de peças processuais em português jurídico brasileiro, SEM tocar na estrutura AI-first invisível (BLUF, títulos-conclusão, transcrições). |
| [`inicial-rescisao-lote`](skills/inicial-rescisao-lote/SKILL.md) | sim | Orquestra a produção completa da petição inicial de rescisão de compromisso de compra e venda de LOTE urbano (Lei 6.766/79), do dossiê ao .docx protocolável no padrão PMA. |
| [`legal-consistency-validator`](skills/legal-consistency-validator/SKILL.md) | sim | Valida estruturalmente textos jurídicos simulando escrutínio judicial adversarial: detecta contradições, saltos lógicos, inconsistências numéricas, citações fabricadas e pedidos se |
| [`legal-orchestrator`](skills/legal-orchestrator/SKILL.md) | sim | Orquestra o pipeline completo de uma peça jurídica: inventário das fontes e do acervo, análise do caso (ANALISE.md), estrutura aprovada pela titular, redação, padronização, validaç |
| [`legal-writer`](skills/legal-writer/SKILL.md) | sim | Redige o texto jurídico inicial de peças processuais (iniciais, recursos, contestações, manifestações) com raciocínio argumentativo contínuo, linguagem humana e precisão técnica. |
| [`onboarding-usuario`](skills/onboarding-usuario/SKILL.md) | sim | Entrevista de primeiro uso do workspace. |
| [`pdfmd`](skills/pdfmd/SKILL.md) | sim | Converter PDFs locais em Markdown auditável, com preservação de estrutura, tabelas, imagens, OCR por página, âncoras citáveis, manifesto de proveniência e índice para leitura selet |
| [`peca-pma-builder`](skills/peca-pma-builder/SKILL.md) | sim | Biblioteca Node compartilhada para geração de peças jurídicas .docx no padrão PMA. |
| [`pedido_justica_gratuita`](skills/pedido_justica_gratuita/SKILL.md) | sim | Analisa, avalia e elabora pedidos de gratuidade da justiça (CPC, arts. 98 a 102) e a resposta à impugnação. |
| [`pesquisa-djen`](skills/pesquisa-djen/SKILL.md) | sim | Consulta pública de comunicações processuais (DJEN — Diário de Justiça Eletrônico Nacional, via API Comunica/PJe) e de metadados/movimentos de processos (API Pública DataJud/CNJ). |
| [`pre-peticionamento`](skills/pre-peticionamento/SKILL.md) | sim | Investigação pré-peticionamento sobre um notebook do NotebookLM já populado: auditoria de risco da tese, perguntas cirúrgicas via `notebooklm ask`, dossiê salvo como nota no notebo |
| [`pre-peticionamento-drive`](skills/pre-peticionamento-drive/SKILL.md) | sim | Investigação jurídica pré-peticionamento sobre corpus LOCAL (provas baixadas do Drive + jurisprudência local), SEM NotebookLM. |
| [`radar-jurisprudencia`](skills/radar-jurisprudencia/SKILL.md) | sim | Busca no DJEN jurisprudência recente e favorável à tese do cliente — 5 decisões por tese (mínimo 2 do STJ quando houver), priorizando o tribunal onde a peça será protocolada. |
| [`radar-jurisprudencia-stj`](skills/radar-jurisprudencia-stj/SKILL.md) | sim | Pesquisa jurisprudência do STJ no SCON (acórdãos e decisões monocráticas) a partir de tema, tese ou julgado-semente, com os operadores oficiais, triagem pelo sentido, inteiro teor  |
| [`tipografia-pma`](skills/tipografia-pma/SKILL.md) | sim | Padronização estrutural e visual de peça já redigida: hierarquia de títulos, títulos-tese, ordem dos blocos, destaques, citação em bloco e elementos visuais. |
| [`validador-extrato-pdf-excel`](skills/validador-extrato-pdf-excel/SKILL.md) | sim | Valida e corrige arquivos Excel gerados a partir de PDFs de extratos bancários. |

`local` = existe só nesta máquina (gitignorada); não faz parte do motor distribuído.

Comando fora de `skills/`: `/relatorio` (`.claude/commands/relatorio.md`) — relatório jurídico em dois arquivos.

# Plano — estado do caso ligado à fila do DJEN (02/10/2026)

Origem: auditoria de 01/10/2026 (achado 15, "memória do Claude virou CRM") e triagem dos
quinze embargos vencidos, em que a fila dizia o número do processo e não o caso. Decisão da
titular em 02/10/2026: registrar para execução posterior. Nota de impacto 9.

Depende do que já existe: `ANALISE.md` como único arquivo de estado da pasta do caso, com
`processos:` e `prazos:` no frontmatter (74dcd70), e `scripts/caso.js` como painel. Este plano
não cria estado novo; liga o que existe ao monitor, ao hook de abertura e à memória.

## Problema

O que a conversa descobre sobre um caso vai para a memória do Claude Code. Três defeitos:
só o Claude lê (não viaja para outro agente nem para a equipe); nada consulta (monitor, fila
e hook não enxergam a memória); envelhece calada (ninguém expira "fatal 18/08" em outubro).
Na fila, 100 de 105 linhas abertas estavam com `caso = ?` em 01/10 porque a fonte era
`clientes/_processos.json`, gerado em 18/08 e nunca mais.

## As quatro peças

| # | Peça | Automático? | Esforço |
|---|---|---|---|
| 1 | **Portão de saída** `hooks/stop-analise-atualizada.js`: se a sessão gravou algo em `clientes/<caso>/` e a `ANALISE.md` dessa pasta não mudou, o turno não encerra (exit 2) e a mensagem manda registrar fase, última peça, próximo prazo e pendências. Mesmo molde do `stop-peca-compilada`. Escape: `estado: inalterado` declarado na própria ANALISE.md naquele dia não existe; a regra é dura, porque o objetivo é substituir a memória | sim (a verificação); a leitura do caso continua do modelo | baixo |
| 2 | **Fila lê o caso da `ANALISE.md`**: `carregarCatalogo()` do monitor varre os `processos:` de cada `clientes/*/ANALISE.md` a cada rodada, em vez de `clientes/_processos.json`. Coluna "caso" sai `NOME · pasta`. `mapear-processos.js` vira fallback para pasta sem ANALISE.md | sim | baixo |
| 3 | **Painel cruza fila e caso**: `caso.js` ganha os prazos da fila para os processos do caso; o `session-start` passa a dizer "João Batista x Ativa, sentença de 22/09, apelação até 15/10, última peça: réplica de 30/09". Só leitura: tarefa agendada nunca grava em arquivo de cliente | sim | médio |
| 4 | **Regra de memória** no `CLAUDE.md` §Memória: estado de caso mora na `ANALISE.md`; memória só aponta para ela. Sem isso o hábito antigo volta | regra | trivial |

Mais a **migração única**: os ~40 casos hoje na memória do Claude passam para as respectivas
`ANALISE.md` (`prazos:`, fase, pendências), e a memória fica com um ponteiro por caso.

## O que não se automatiza

Decidir o que é fase, pendência ou risco é leitura do caso. O hook garante que a leitura seja
gravada, não a faz. Tarefa agendada (monitor) não escreve em `ANALISE.md`: o cruzamento é
feito na leitura (peça 3), para que nenhum processo automático altere arquivo de cliente.

## Ordem

2 (retorno imediato na fila) → 1 → 4 → migração → 3. Uma tarde para 1, 2 e 4; a migração é
uma sessão própria, com a titular conferindo caso a caso o que a memória afirma.

## Teste de aceitação

- Monitor roda: toda linha nova cujo processo esteja em alguma `ANALISE.md` sai com `NOME · pasta`.
- Sessão edita peça em `clientes/x/` sem tocar `ANALISE.md`: Stop bloqueia com a instrução.
- `node scripts/caso.js x` mostra os prazos da fila do DJEN daquele caso.
- `MEMORY.md` não tem mais linha com "fatal" ou "prazo" de caso; só ponteiros.

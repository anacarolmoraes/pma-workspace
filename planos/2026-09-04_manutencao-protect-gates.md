# Manutenção — `protect-gates` bloqueia execução com `2>&1`

**Estado: aguardando sessão com `PMA_MANUTENCAO=1`.** Apagar este arquivo depois de aplicar.

## Problema

`RX_ESCRITA_SHELL` em `hooks/protect-gates.js` trata `>` como gravação. `2>&1` (duplicação de
descritor, não escrita em arquivo) casa com o padrão, e qualquer comando que **execute** um
portão com redirecionamento de stderr é bloqueado como se o editasse:

```
node scripts/lint-skills.js 2>&1 | tail -15     → BLOQUEADO (falso positivo, 04/09/2026)
```

## Correção (uma linha)

Em `hooks/protect-gates.js`, na constante `RX_ESCRITA_SHELL`, trocar

```
(^|[^>])>{1,2}\s*["']?\S
```

por

```
(^|[^>])>{1,2}(?!&)\s*["']?\S
```

O lookahead `(?!&)` exclui `>&1`, `2>&1`, `>>&`. Redirecionamento para arquivo (`> x.md`,
`>> x.js`) continua casando.

## Teste

Acrescentar em `hooks/_teste-portoes.js`, no bloco `protect-gates`, um caso que deve **passar**:

```js
['protect-gates', P, 'execução de lint com 2>&1', bash('node scripts/lint-skills.js 2>&1 | tail -5')],
```

Depois, `npm test`.

## Na mesma sessão, portões novos a considerar

- **Placeholder não compila.** Nada barra `[VERIFICAR]`, `[NOME]`, `[...]` no texto da peça; só o
  checklist do Estágio 6 (prosa). Regex simples no `md2docx`, fora de citação em bloco.
- **`lint-inicial`.** O checklist de saída da petição inicial
  (`<bundles>/direito/pecas/peticao-inicial/index.md`, "Checklist de saída", 04/09/2026) é
  conferível por lint quando `tipo: inicial`: endereçamento no padrão do §5, capítulo I "DA SÍNTESE
  DA LIDE", seção de valor da causa, protesto por provas, manifestação sobre o art. 334, assinatura.
  Hoje é prosa; vira portão quando o checklist tiver rodado em algumas peças sem mudar.

---
title: PRD — Motor PMA como produto white-label
data: 2026-07-26
autor: Ana Carolina Ribeiro de Moraes Paulo / Claude
status: planejamento — execução adiada por decisão da titular (executar depois do PRD de operação)
escopo: extrair de D:\WORK\advocacia um motor genérico, distribuível em .zip, sem marca e sem acervo tático
---

# PRD — Motor PMA como produto white-label

> **Documento irmão:** [`2026-07-26_prd-infra-agente.md`](2026-07-26_prd-infra-agente.md) trata de corrigir e robustecer a operação atual. **Este documento depende daquele.** A recíproca não é verdadeira — a operação melhora sem que nenhuma linha deste PRD seja executada.

---

## Pré-requisito inegociável

**Não empacote antes da camada de verificação existir.**

Um motor white-label é uma máquina de produzir peças jurídicas entregue a alguém que não conhece as convenções que a fizeram funcionar. Sem `lint-citacoes`, `lint-bundle` e `lint-skills`, o comprador recebe um sistema capaz de gerar peça com ementa fabricada — usando o seu motor, com o nome dele, e com a sua responsabilidade técnica implícita no desenho.

Frentes do documento de operação que precisam estar **prontas e verdes** antes do empacotamento (P4):

| Pré-requisito | Frente na operação | Por quê |
|---|---|---|
| `lint-citacoes` operante | F2.2 | Sem isso o produto pode fabricar ementa. Inegociável. |
| `lint-bundle` com zero erros | F2.1 | O pacote leva jurisprudência; ela não pode ir `em_teste` sem aviso. |
| `lint-skills` com zero erros | F3.1 | Não se empacota skill quebrada. Hoje há duas. |
| `perfil/definicoes.md` existindo | F1.1 | É o plugue que o comprador preenche. Sem ele não há o que parametrizar. |
| `perfil/advogados.json` | F1.2 | Idem, e alimenta o monitor do DJEN. |
| Caminhos absolutos removidos | F7 | 17 arquivos hoje só funcionam em `D:\WORK\advocacia`. |
| Hooks funcionando | F4 | Vão no pacote; hook quebrado derruba a sessão do comprador. |

---

## Decisões de produto (2026-07-26)

| Decisão | Escolha |
|---|---|
| **Unidade do produto** | **Motor sem conteúdo.** O comprador leva skills, builder, lints, hooks, schema e workflows. Marca, definições e acervo tático são plugues vazios. |
| **Nunca sai no pacote** | Marca PMA · heurísticas, estratégias e casos decididos · templates de peça · dados de cliente (C1). |
| **Pode sair** | **Jurisprudência e teses** dos bundles — público em origem, com a curadoria e a verificação como valor agregado. |
| **Comprador** | Advogado que já usa Claude Code. O instalador configura; não precisa ensinar. |
| **Entrega** | Pacote `.zip` com instalador. Sem exigir git nem conta no GitHub. |

**Racional da fronteira:** não distribuir heurísticas, estratégias e casos decididos preserva o diferencial competitivo — são as táticas validadas e os precedentes próprios do escritório. Distribuir jurisprudência entrega valor percebido alto (curadoria com `status` verificado contra fonte oficial, que ninguém tem ao buscar no site do STJ) sem revelar nada tático.

---

## Arquitetura alvo: quatro camadas e uma regra

```
D:\WORK\advocacia\                    (continua sendo a INSTÂNCIA do escritório)

  ┌─ M ── MOTOR ──────────── o produto. Genérico, sem marca, sem acervo.
  │   skills/ (as de motor)   builder, lints, pdfmd, djen, orquestração
  │   scripts/                md2docx, lint-*, empacotar
  │   hooks/                  session-start, block-secrets, pre-compact
  │   schema/                 SCHEMA_BUNDLE.md + lint do bundle
  │   evals/                  suíte de comportamento
  │   setup/                  instalador + entrevista
  │   engine.manifest.json    o que é motor — a fronteira, declarada
  │
  ├─ P ── PERFIL ─────────── identidade do escritório. Privado, plugável.
  │   perfil.json             nome, comarca, tribunal padrão
  │   advogados.json          OAB, assinaturas, quem assina por padrão
  │   definicoes.md           regras canônicas
  │   marca/                  logo, banner, cores, fontes, PETICAO_MODELO
  │   templates/              TEMPLATE_INICIAL_* e equivalentes
  │
  ├─ K ── CONHECIMENTO ───── os bundles. Distribuição parcial.
  │   jurisprudencia/ teses/          → PODEM ir no pacote
  │   heuristicas/ estrategias/       → NUNCA
  │   casos_decididos/ playbooks/     → NUNCA
  │   perfis/ (de julgadores)         → NUNCA
  │
  └─ C ── CASOS ──────────── C1. Nunca versionado, nunca distribuído.
      clientes/<nome>/
```

**A regra de dependência (única, inviolável, lintável):**

> **M não conhece P, K nem C. P não conhece K nem C. K não conhece C.**

Toda dependência aponta para baixo. O motor recebe a identidade por parâmetro — nunca a lê de um caminho fixo. É essa regra, e só ela, que torna o motor extraível.

### Por que a fronteira é declarada, e não física

A tentação é mover `skills/` para `engine/skills/`. **Não faça isso.**

A operação está viva: 16 pastas de cliente, peças em andamento, descoberta de skills dependente da localização atual. Reorganizar o disco de um sistema em produção é onde projetos morrem — e o ganho é zero, porque modularidade real vem da **ausência de dependência**, não da posição do arquivo.

A fronteira vive em `engine.manifest.json`: a lista de caminhos que pertencem ao motor. O empacotador lê o manifesto; o linter verifica a regra de dependência. Nada se move, e a fronteira passa a ser **testável** — o que uma reorganização de pastas jamais daria.

---

## P1 — Fronteira declarada e verificada

### Distância medida até o motor extraível (2026-07-26)

```
16 de 46 skills têm identidade PMA embutida no SKILL.md
   (PMA, Pinheiro Moraes, OAB 6573/6951, Montserrat)
17 arquivos carregam caminho absoluto D:\WORK\advocacia
```

Entre as 16 há skills que são inequivocamente **motor**: `peca-pma-builder`, `tipografia-pma`, `pesquisa-djen`, `legal-writer`, `orquestrador-loop`. Nenhuma é extraível hoje.

*(Os 17 caminhos absolutos são tratados no F7 do documento de operação — são fragilidade independentemente de produto.)*

### O que construir

**P1.1 — `engine.manifest.json`.** Cada caminho classificado como `motor`, `perfil`, `conhecimento` ou `caso`. Skill não classificada é **erro**, não "outros" — nada fica implícito.

**P1.2 — `lint-whitelabel.js`.** Sobre todo arquivo marcado `motor`:

- nenhuma ocorrência de `PMA`, `Pinheiro Moraes`, `Paulo Moraes`, número de OAB, nome de advogado;
- nenhum caminho absoluto (`D:\`, `C:\Users\`);
- nenhuma referência a fonte, cor ou asset de marca;
- nenhum `require`/import que resolva para dentro de `P`, `K` ou `C`.

Três níveis de severidade: `error` trava o empacotamento, `warning` registra, `suggestion` indica auto-correção.

**P1.3 — Resolvedor de perfil.** Função única, `carregarPerfil()`, que o motor chama para obter marca, advogados e definições. Caminho vindo de variável de ambiente ou de `perfil.json` na raiz da instância. **Único ponto de contato entre M e P.**

**P1.4 — Parametrização das 16 skills.** Substituir literal por consulta ao perfil. `tipografia-pma` deixa de dizer "Montserrat 12 pt" e passa a dizer "a fonte declarada em `perfil.marca.fonte`", com os valores PMA vivendo em `perfil/marca/marca.json`.

### Critério de aceite

`lint-whitelabel` retorna **zero erros**. Um `.zip` do motor, descompactado em máquina limpa com um `perfil/` diferente, produz peça com outra identidade visual **sem editar uma linha de skill**.

---

## P2 — Parametrização da marca

Depende de `perfil/` existir (F1.4 da operação), que já reaproveita `material_padrao_escritorio/`.

**P2.1 — `perfil/marca/marca.json`.** Fontes, corpo, entrelinha, margens, cores, dimensões de banner e logo — tudo que hoje está literal na `tipografia-pma` e no `peca-pma-builder`.

**P2.2 — Assets como referência, não como caminho.** O builder recebe `perfil.marca.banner` e `perfil.marca.logo`; não conhece `banner.png` nem sua posição no disco.

**P2.3 — Esqueleto de marca no pacote.** O `.zip` leva `perfil/marca/` **vazio, com README** explicando dimensões esperadas (banner 794×59 px, logo 202×87 px) e um `marca.json.exemplo` comentado.

### Critério de aceite

Trocar `marca.json` + os dois PNG gera peça com identidade completamente diferente, sem tocar em skill nem em script.

---

## P3 — Filtro de distribuição do conhecimento

**P3.1 — Classificação por diretório**, declarada no `SCHEMA_BUNDLE.md`:

| Pasta | Distribuível | Racional |
|---|---|---|
| `jurisprudencia/` | ✅ | Público em origem; a curadoria e o `status` verificado são o valor. |
| `teses/` | ✅ | Idem. |
| `raw/` | ✅ | São os PDF oficiais que sustentam o E4. Sem eles a jurisprudência distribuída perde a prova. |
| `heuristicas/` | ❌ | Táticas validadas — diferencial competitivo. |
| `estrategias/` | ❌ | Idem. |
| `casos_decididos/` | ❌ | Precedentes do próprio escritório. |
| `playbooks/` | ❌ *(a confirmar)* | Tática executável. |
| `perfis/` | ❌ *(a confirmar)* | Inteligência sobre órgãos julgadores. |

**P3.2 — Esqueleto instrutivo.** As pastas não distribuíveis vão no pacote **vazias, com README** explicando o que colocar e como (formato, frontmatter, `status`). O comprador recebe a estrutura e o método, não o conteúdo.

**P3.3 — Verificação de vazamento.** O empacotador confere que nenhum arquivo distribuído referencia arquivo não distribuído — um link de tese apontando para uma heurística privada quebraria no pacote e revelaria o nome do arquivo.

---

## P4 — Empacotamento, instalação e atualização

**P4.1 — `empacotar.ps1`.** Lê `engine.manifest.json`, roda `lint-whitelabel` + `lint-skills` + `lint-bundle` + suíte de evals, e **só então** produz o `.zip`. Lint falhou = não empacota.

Esse portão é o que mantém o produto limpo **para sempre**: no dia em que alguém embutir "PMA" numa skill de motor, o empacotamento falha em vez de vazar a marca para um comprador.

**P4.2 — `instalar.ps1`.** Verifica Node e Python, cria o ambiente virtual, instala dependências, mescla os hooks no `.claude/settings.json` existente, registra a tarefa do DJEN e chama a entrevista. Um arquivo, um comando.

**P4.3 — Skill `setup-escritorio`.** Entrevista uma pergunta por vez — nome do escritório, comarca, tribunal padrão, advogados e OABs, cores e logo, definições que divergem do padrão. Escreve `perfil.json`, `advogados.json`, `marca.json` e um `definicoes.md` a partir do template comentado. Ao final **se autodeleta** e roda os lints para provar que a instalação está íntegra.

**P4.4 — Versionamento.** `engine.json` com semver + `CHANGELOG.md`. O `SCHEMA_BUNDLE.md` carrega sua própria versão e o lint recusa bundle de versão incompatível — resolvendo o drift v0.2/v0.4/v0.5 que existe hoje.

**P4.5 — `atualizar.ps1`.** `.zip` não tem `git pull`. O atualizador substitui **apenas** os caminhos marcados `motor` no manifesto, preservando `perfil/`, `clientes/` e as pastas privadas do bundle. Sem isso, cada atualização exige que o comprador refaça a configuração — e ele para de atualizar.

### Critério de aceite

`.zip` descompactado em máquina limpa com Claude Code instalado → `instalar.ps1` → entrevista → primeira peça gerada com a identidade do comprador, sem uma linha editada à mão, sem nenhum vestígio de PMA no resultado. Depois: `atualizar.ps1` com uma versão nova do motor preserva integralmente o perfil configurado.

---

## Ordem de execução

```
[pré-requisitos do PRD de operação: F1, F2.1, F2.2, F3.1, F4, F7]
        │
        ▼
P1 (fronteira + manifesto + lint-whitelabel)
        │
        ├──► P1.4 (parametrizar as 16 skills)  ──┐
        ├──► P2 (marca parametrizada)  ──────────┤
        └──► P3 (filtro de distribuição)  ───────┤
                                                 ▼
                                        P4 (empacotar, instalar, atualizar)
```

`P1.1` e `P1.2` primeiro, porque o linter é o instrumento que mede o progresso de todo o resto: ele começa reprovando 16 skills e o trabalho está feito quando chega a zero.

---

## Questões abertas — precisam de decisão sua

1. **`playbooks/` e `perfis/` (de órgãos julgadores) são distribuíveis?** Assumido **privado** neste PRD — playbook é tática executável e perfil de julgador é inteligência do escritório. Se forem distribuíveis, o valor do pacote sobe bastante e o diferencial cai na mesma proporção.

2. **A jurisprudência sai com `status` e data de verificação?** Recomendo **sim**: é exatamente o que diferencia o pacote de uma busca no site do STJ, e não revela nada tático.

3. **O pacote leva os bundles preenchidos ou só a estrutura?** Este PRD assume `jurisprudencia/`, `teses/` e `raw/` preenchidos. A alternativa (estrutura vazia) reduz o valor percebido a quase nada — vira "um monte de pastas".

4. **Modelo comercial e licença.** Não tratado aqui, mas afeta P4: pacote único vitalício, assinatura com atualizações, ou por vertical? A resposta determina se `atualizar.ps1` precisa de algum controle de versão autorizada.

5. **Responsabilidade técnica.** Um advogado usando o seu motor para gerar peça com erro — qual o desenho de disclaimer/licença? Não é questão de engenharia, mas precisa estar resolvida antes da primeira venda.

---

## Decisões negativas de produto

| Rejeitado | Por quê |
|---|---|
| **Workspace completo como produto** | Entregaria jurisprudência **e** heurísticas, estratégias e casos decididos — o acervo tático que o escritório levou anos montando. |
| **Kits fechados por vertical** | Vende resultado em vez de plataforma; menor alcance e maior custo de manutenção (um kit por nicho). Reavaliável depois, sobre o mesmo motor. |
| **Mover `skills/` para `engine/skills/`** | Operação viva; descoberta de skills depende da localização. Modularidade vem da ausência de dependência, não da posição do arquivo. |
| **Distribuição por repositório git** | Exigiria git e conta no GitHub do comprador. Decisão: `.zip`. |
| **Plugin/marketplace do Claude Code** | Limitaria o que vai junto (hooks, scripts, tarefa agendada). Reavaliável se o formato de plugin evoluir. |
| **Instalador para leigo em terminal** | O comprador definido já usa Claude Code. Instalador configura, não ensina. |

---
name: onboarding-usuario
description: Entrevista de primeiro uso do workspace. Aciona quando perfil/usuario.md não existe, quando o hook de início de sessão avisa que o usuário não está identificado, ou quando alguém pede para configurar/atualizar o próprio perfil, trocar a assinatura, corrigir OAB ou comarca. Gera perfil/usuario.md, registra a pessoa em perfil/advogados.json e configura a identidade do git.
---

# Onboarding do usuário

Identifica quem está usando esta cópia do workspace. Sem isso, a peça sai assinada com a
OAB errada, endereçada à comarca errada e com tratamento que não é o da pessoa.

**Quem usa o workspace é advogado, não técnico.** A entrevista é conversa, não formulário:
uma pergunta por vez, linguagem comum, nada de jargão de informática.

---

## Quando acionar

- `perfil/usuario.md` não existe (o hook `session-start` avisa na abertura da sessão).
- A pessoa pede para configurar, corrigir ou atualizar o próprio perfil.
- A assinatura, a OAB ou a comarca saíram erradas em uma peça.

Não acionar para trocar o **escritório** (isso é `perfil/perfil.json`) nem para cadastrar
um colega que não está presente — cada pessoa responde por si.

---

## Antes de perguntar

1. Ler [`perfil/perfil.json`](../../perfil/perfil.json) — nome do escritório, comarcas e UF
   padrão. Servem de sugestão nas respostas, para a pessoa só confirmar.
2. Ler [`perfil/advogados.json`](../../perfil/advogados.json) — se já houver alguém com o
   mesmo nome ou OAB, é atualização de cadastro, não inclusão.
3. Se `perfil/ambiente.json` não existir, avisar que a instalação não terminou e oferecer
   rodar `node scripts/setup.js` antes de seguir.

---

## A entrevista

Uma pergunta por vez, aceitando resposta curta. Ofereça o padrão do escritório entre
parênteses para a pessoa apenas confirmar.

1. **Nome completo**, como consta na OAB.
2. **Como assinar as peças** — sugerir a forma curta a partir do nome completo
   (ex.: "Ana Carolina Ribeiro de Moraes Paulo" → `ANA MORAES`) e pedir confirmação.
3. **Número e seccional da OAB** (sugerir a UF do escritório).
4. **Comarcas onde atua** (sugerir as do `perfil.json`).
5. **Áreas de atuação** (sugerir as do `perfil.json`; aceitar acréscimo).
6. **Assina as peças por padrão?** — só quem atua no processo assina; ver
   [`perfil/definicoes.md`](../../perfil/definicoes.md) §4.
7. **Quer receber a vigilância de prazos do DJEN nesta OAB?** — é o que define *quem* o monitor
   procura. Grava em `monitorar_djen`; o monitor não tem OAB no código, por decisão de
   arquitetura.
8. **Como prefere que eu escreva** — direto e sem rodeio, ou mais explicativo. Se a pessoa
   é nova em tecnologia, registrar isso: muda o tom de tudo que o agente responde.

**Não perguntar em quais tribunais a pessoa atua.** A busca do DJEN é nacional por OAB e não
se restringe a tribunal nenhum — perguntar induziria a criar um filtro, e intimação de
tribunal fora do filtro sumiria sem aviso. Feriado local é assunto separado: o monitor relata
sozinho, a cada execução, de quais tribunais chegou intimação sem calendário.

Também não perguntar sobre prazos, janela de busca ou limiares de alerta: os padrões de
[`perfil/monitor-djen.json`](../../perfil/monitor-djen.json) servem, e o arquivo é comentado
para quem quiser mexer depois. Entrevista longa é entrevista abandonada.

Se a pessoa não souber responder algo, gravar o que ela disse e seguir. Perfil incompleto
é melhor que entrevista abandonada — pode completar depois.

---

## O que gravar

### 1. `perfil/usuario.md` — fora do versionamento, é desta máquina

```markdown
# Perfil do usuário — <Nome Completo>

<Cargo/relação com o escritório>, <Escritório>. Atua em <comarcas>.
Áreas: <áreas>. <Uma frase sobre o perfil de trabalho e o tom preferido.>

## Assinatura
`<NOME ASSINATURA> | OAB/<UF> <número>`

## Preferências de comunicação
- <como a pessoa quer ser respondida>

_Gerado pela skill `onboarding-usuario` em <data>. Para alterar, peça ao Claude._
```

### 2. `perfil/advogados.json` — vai para o repositório

Acrescentar ao array `advogados`, sem mexer em quem já está lá:

```json
{
  "id": "<primeiro nome em minúsculas>",
  "nome_completo": "<...>",
  "nome_assinatura": "<...>",
  "oab_numero": "<...>",
  "oab_uf": "<...>",
  "titular": false,
  "assina_por_padrao": <resposta 6>,
  "monitorar_djen": <resposta 7>
}
```

`titular: true` é só de quem responde pelo escritório — nunca marcar por conta própria.

`monitorar_djen` é o que faz o vigia de prazos passar a procurar por esta OAB — em **todos** os
tribunais do país, sem filtro. Depois de gravar, rodar
`node skills/pesquisa-djen/scripts/monitor.js` uma vez e relatar o que apareceu: a pessoa vê o
sistema funcionando no primeiro dia, e o comando já informa de quais tribunais falta calendário
de feriado local.

### 3. Identidade do git

Se `git config user.name` ou `user.email` estiver vazio, configurar com os dados da pessoa:

```
git config --global user.name "<Nome Completo>"
git config --global user.email "<email>"
```

Serve para o histórico registrar quem fez cada alteração.

---

## Ao terminar

Confirmar em uma frase o que foi gravado e dizer o que muda na prática: as peças passam a
sair com a assinatura correta e o agente passa a responder no tom escolhido.

Se `perfil/advogados.json` foi alterado, lembrar que essa mudança **é do escritório** e
precisa ser enviada à equipe (`git add`, `git commit`, `git push`) — oferecer fazer isso.

Nunca gravar em `perfil/usuario.md` dado de cliente, número de processo ou credencial: o
arquivo descreve quem opera o sistema, nada além disso.

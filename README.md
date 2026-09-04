# Advocacia PMA — Guia da Equipe

Bem-vindo(a)! Este é o **espaço de trabalho digital do escritório Paulo Moraes Advocacia**.
Aqui ficam os modelos de peças, as ferramentas de inteligência artificial (Claude) que redigem
minutas no padrão do escritório, e o acervo de teses e jurisprudência.

Este guia foi escrito para **advogados sem experiência com informática**. Siga os passos na
ordem. Se algo der errado, não tente consertar no susto: pare e chame a Ana — o sistema guarda
o histórico de tudo, nada se perde de verdade.

> ## ⚠️ Sigilo — leia antes de tudo
>
> **Documento de cliente não entra neste repositório. Nunca.**
>
> O motivo é técnico e definitivo: o sistema de versionamento guarda **todas** as versões de
> tudo, para sempre. Apagar um arquivo depois **não** o apaga do histórico. Se um cliente pedir
> a exclusão dos dados dele (direito garantido pela LGPD), não haveria como cumprir.
>
> Por isso, o projeto já vem configurado para **bloquear automaticamente** o envio de pastas de
> clientes, relatórios e senhas. Não desative essa proteção.
>
> - Os repositórios são **privados**. Nunca os torne públicos.
> - Documento de cliente fica no seu computador e, quando compartilhado, **no Google Drive do
>   escritório** — onde o acesso pode ser revogado e o arquivo, apagado de verdade.

---

## 1. O que significa "versionar" (em 30 segundos)

Usamos o **Git**, que funciona como um histórico de versões compartilhado:

- Cada pessoa tem uma cópia completa do projeto no seu computador.
- Quando termina um trabalho, você **salva um ponto na linha do tempo** (*commit*) e **envia
  para a nuvem da equipe** (*push*).
- Antes de começar, você **baixa o que os colegas enviaram** (*pull*).

É como um autos eletrônico do escritório: fica registrado quem alterou, quando e o quê.

### São dois repositórios

| Repositório | O que guarda |
|---|---|
| **pma-workspace** | as ferramentas: skills, modelos, tipografia, geradores de peça |
| **arsenal-juridico** | o conhecimento: teses, jurisprudência, precedentes do escritório |

Ferramenta e conhecimento evoluem em ritmos diferentes — por isso ficam separados. Você vai
baixar os dois.

---

## 2. O que instalar (só na primeira vez)

Instale nesta ordem, aceitando as opções padrão. **No Windows, ao instalar o Python, marque a
caixa "Add Python to PATH"** — é o único detalhe que costuma dar problema depois.

| Ordem | Programa | Onde baixar |
|---|---|---|
| 1º | **Git** | <https://git-scm.com/downloads> |
| 2º | **Node.js** (versão LTS) | <https://nodejs.org> |
| 3º | **Python** (3.10 ou maior) | <https://python.org/downloads> |
| 4º | **Visual Studio Code** | <https://code.visualstudio.com> |
| 5º | **Claude Code** | no VS Code: aba *Extensions*, buscar "Claude Code" |
| 6º | **Conta no GitHub** | <https://github.com/signup> — use o e-mail profissional |

No **macOS**, se você usa o [Homebrew](https://brew.sh), os três primeiros saem de uma vez:

```
brew install git node python@3.11
```

Depois de criar a conta no GitHub, **envie seu nome de usuário para a Ana** para ser convidado
aos repositórios privados. Você receberá um convite por e-mail — aceite-o.

---

## 3. Como receber o projeto (uma vez só)

Abra o **Git Bash** (Windows) ou o **Terminal** (macOS) e cole os comandos abaixo. Os dois
repositórios são privados: só funcionam depois que você aceitar o convite da Ana.

```
git clone https://github.com/anacarolmoraes/pma-workspace.git advocacia
git clone https://github.com/anacarolmoraes/arsenal-juridico.git arsenal-juridico
```

Deixe as duas pastas **lado a lado**, na mesma pasta-mãe: o instalador encontra o acervo
sozinho quando elas estão vizinhas.

Depois, entre na pasta do projeto e rode o instalador:

```
cd advocacia
node scripts/setup.js
```

Ele monta tudo sozinho: ambiente Python, bibliotecas, conversor de PDF e o gerador de `.docx`.
Demora alguns minutos na primeira vez. Ao final, ele diz **"Tudo pronto"** ou lista o que ficou
faltando, com a instrução de como resolver cada ponto.

Pode rodar o instalador quantas vezes quiser — o que já está pronto ele pula.

### A entrevista de primeiro uso

Abra a pasta no VS Code (*File* → *Open Folder*) e inicie o Claude Code. Na primeira conversa,
ele vai **te entrevistar**: nome completo, número da OAB, comarcas onde atua, áreas e como você
prefere que ele escreva. Isso é o que faz suas peças saírem com a assinatura e a comarca
corretas. Leva dois minutos e acontece uma única vez.

---

## 4. Sua rotina de trabalho

Três momentos: **baixar → trabalhar → enviar**.

### Antes de começar

No VS Code, abra o terminal (*Terminal* → *New Terminal*) e digite:

```
git pull
```

Traz o que os colegas enviaram. Faça sempre, para não trabalhar em cima de versão velha.

### Trabalhe normalmente

Edite documentos, peça peças ao Claude, salve arquivos.

### Ao terminar

```
git add .
git commit -m "descreva em uma frase o que você fez"
git push
```

Exemplo: `git commit -m "nova tese sobre retenção em rescisão de lote"`.

> **Se os comandos intimidarem**, peça ao Claude: *"envie meu trabalho de hoje para a equipe
> com uma mensagem adequada"*. Ele executa os três passos.

### Se aparecer "conflict"

Você e um colega mexeram no mesmo trecho do mesmo arquivo. Não é grave, mas **pare e chame a
Ana** — ou peça ao Claude: *"me ajude a resolver este conflito, explicando as duas versões"*.
Nunca escolha uma versão às cegas.

---

## 5. Como pedir peças ao Claude

Peça em português normal:

- *"Elabore a contestação do caso Fulano, os documentos estão em clientes/fulano/"*
- *"Revise a apelação da cliente X"*
- *"Converta este PDF para texto"*
- *"Monte o dossiê estratégico antes de peticionar"*

O Claude segue automaticamente o padrão do escritório — papel timbrado, Montserrat 12pt,
margens de 3cm, estrutura da peça — e consulta o acervo de teses antes de escrever. As regras
que ele obedece estão no [AGENTS.md](AGENTS.md); você não precisa decorá-las.

**Regra de ouro:** o Claude produz **minuta**. A revisão de mérito e a conferência de prazo no
eproc/DJEN oficial são sempre do advogado, antes de protocolar.

---

## 6. Onde ficam as coisas

| Pasta | O que tem |
|---|---|
| `skills/` | as habilidades da IA (gerar peça, tipografia, prazos, conversão de PDF) |
| `material_padrao_escritorio/` | marca, timbrado, modelos de formatação |
| `perfil/` | identidade do escritório, definições canônicas e o seu perfil pessoal |
| `scripts/` | o instalador e as verificações automáticas |
| `clientes/` | documentos de trabalho — **só no seu computador**, nunca enviados |

O acervo de teses e jurisprudência fica no **outro** repositório, o `arsenal-juridico`.

---

## 7. O que NUNCA fazer

1. **Nunca** tornar os repositórios públicos.
2. **Nunca** desativar as proteções do arquivo `.gitignore` para "conseguir enviar" algo.
3. **Nunca** enviar senha, chave ou o arquivo `.env`.
4. **Nunca** usar `git push --force` (se alguém sugerir, chame a Ana antes).
5. **Nunca** protocolar peça gerada pela IA sem revisão humana e conferência de prazo.

---

## 8. Problemas comuns

| Sintoma | O que fazer |
|---|---|
| O instalador diz que não achou o Python | reinstale o Python marcando **"Add Python to PATH"** |
| O instalador diz que falta o Tesseract | siga o link que ele mostra; sem isso, PDF escaneado não é convertido |
| "Permission denied" no `git push` | você ainda não aceitou o convite do GitHub — chame a Ana |
| "conflict" depois do `git pull` | seção 4 — pare e peça ajuda |
| Apaguei um arquivo sem querer | peça ao Claude: *"recupere o arquivo X da versão anterior"* |
| O Claude não acha um documento em PDF | peça antes: *"converta o PDF X para markdown"* |
| O Claude usou a OAB errada | peça: *"corrija meu perfil de usuário"* |

---

## 9. Para quem quiser ir além

- Dialeto das peças e API do gerador de `.docx`: [skills/peca-pma-builder/SKILL.md](skills/peca-pma-builder/SKILL.md)
- Registro das skills: [SKILLS.md](SKILLS.md)
- Regras canônicas que a IA obedece: [AGENTS.md](AGENTS.md)
- Definições jurídicas do escritório: [perfil/definicoes.md](perfil/definicoes.md)

*Dúvidas: Ana Moraes — responsável pelo projeto.*

# Advocacia PMA — Guia da Equipe

Bem-vindo(a)! Este é o **espaço de trabalho digital do escritório Paulo Moraes Advocacia**.
Aqui ficam os modelos de peças, as teses e jurisprudências organizadas por tema, as
ferramentas de inteligência artificial (Claude) que redigem minutas no padrão do escritório,
e os documentos de trabalho dos casos.

Este guia foi escrito para **advogados sem experiência com informática**. Siga os passos na
ordem e copie os comandos exatamente como estão. Se algo der errado, não tente "consertar no
susto": pare e chame a responsável pelo projeto (Ana Moraes) — nada aqui se perde de verdade,
o sistema guarda o histórico de tudo.

> ⚠️ **SIGILO — leia antes de tudo**
>
> Este projeto contém documentos de clientes protegidos por sigilo profissional e pela LGPD.
>
> 1. O repositório no GitHub deve ser **sempre PRIVADO**. Nunca o torne público.
> 2. Só pessoas do escritório podem ser convidadas a acessar.
> 3. Nunca copie conteúdo daqui para ferramentas externas não autorizadas.
> 4. O arquivo `.env` (senhas e chaves) **nunca** sai do seu computador — o sistema já está
>    configurado para bloqueá-lo, não tente contornar isso.

---

## 1. O que significa "versionar" (em 30 segundos)

Usamos uma ferramenta chamada **Git**, que funciona como um "histórico de versões
compartilhado":

- Cada pessoa tem uma **cópia completa** do projeto no seu computador.
- Quando você termina um trabalho, você **"salva um ponto na linha do tempo"** (isso se chama
  *commit*) e **envia para a nuvem da equipe** (isso se chama *push*).
- Antes de começar a trabalhar, você **baixa o que os colegas enviaram** (isso se chama
  *pull*).

É como um autos eletrônico do próprio escritório: tudo que entrou fica registrado — quem
alterou, quando e o quê. Nada se perde por engano.

---

## 2. O que instalar no seu computador (só na primeira vez)

Instale nesta ordem. Em todos, pode aceitar as opções padrão ("Avançar, Avançar, Concluir").

| Ordem | Programa | Para quê | Onde baixar |
|---|---|---|---|
| 1º | **Git** | o "histórico compartilhado" | <https://git-scm.com/download/win> |
| 2º | **Node.js (versão LTS)** | gera os `.docx` das peças | <https://nodejs.org> |
| 3º | **Visual Studio Code** | programa onde você abre o projeto | <https://code.visualstudio.com> |
| 4º | **Claude Code** | a IA que redige as minutas | dentro do VS Code: aba *Extensions*, buscar "Claude Code" e instalar |
| 5º | **Conta no GitHub** | seu acesso à nuvem da equipe | <https://github.com/signup> — crie com seu e-mail profissional |

Depois de criar sua conta no GitHub, **avise a Ana** o seu nome de usuário, para ela te
convidar ao repositório privado. Você receberá um convite por e-mail — aceite-o.

### Diga ao Git quem é você (uma vez só)

Abra o programa **"Git Bash"** (foi instalado junto com o Git — procure no menu Iniciar) e
cole as duas linhas abaixo, trocando pelo seu nome e e-mail, apertando Enter após cada uma:

```
git config --global user.name "Seu Nome Completo"
git config --global user.email "seuemail@exemplo.com"
```

Isso serve apenas para que o histórico registre que foi **você** quem fez cada alteração.

---

## 3. Como receber o projeto no seu computador (uma vez só)

1. Abra o **Git Bash**.
2. Cole o comando abaixo e aperte Enter (a Ana te passa o endereço exato do repositório —
   troque a parte entre `<...>`):

```
git clone <endereço-do-repositório> "D:/WORK/advocacia"
```

3. Pronto: a pasta `D:\WORK\advocacia` foi criada com o projeto inteiro.
4. Abra o **VS Code** → menu *File* → *Open Folder* → escolha `D:\WORK\advocacia`.

> **Ambiente técnico (Python, conversor de PDF etc.):** não se preocupe em configurar isso à
> mão. Com o projeto aberto no VS Code, abra o Claude Code e peça:
> *"Configure meu ambiente de trabalho conforme o AGENTS.md e me avise o que faltou."*

---

## 4. Sua rotina de trabalho (o dia a dia)

Pense em três momentos: **baixar → trabalhar → enviar**.

### Antes de começar: baixe as novidades da equipe

No VS Code, abra o terminal (menu *Terminal* → *New Terminal*) e digite:

```
git pull
```

Isso traz para o seu computador tudo o que os colegas enviaram. **Faça sempre**, para não
trabalhar em cima de versão velha.

### Trabalhe normalmente

Edite documentos, peça peças ao Claude, salve arquivos — como você já faz.

### Ao terminar: envie o seu trabalho para a equipe

No mesmo terminal, três comandos, nesta ordem:

```
git add .
git commit -m "descreva aqui o que você fez"
git push
```

Exemplo real de mensagem: `git commit -m "minuta de contestação do caso Marly"`.
A mensagem é como a "certidão" daquele envio — descreva em uma frase o que foi feito.

> **Dica:** se os comandos parecerem intimidadores, peça ao próprio Claude Code:
> *"Envie meu trabalho de hoje para a equipe com uma mensagem adequada."* Ele executa os
> três passos para você.

### Se aparecer "conflict" (conflito)

Significa que você e um colega alteraram **o mesmo trecho do mesmo arquivo**. Não é grave,
mas exige atenção: **pare e chame a Ana** (ou peça ao Claude: *"me ajude a resolver este
conflito do git, explicando as duas versões"*). Nunca escolha uma versão às cegas.

---

## 5. Como pedir peças ao Claude

Com o projeto aberto no VS Code, abra o Claude Code e peça em português normal. Exemplos:

- *"Elabore a contestação do caso Fulano, os documentos estão em clientes/fulano/"*
- *"Revise a apelação da Marly em direito_bancario/emprestimo_nao_realizado/marly/"*
- *"Converta este PDF para texto"* (ele usa o conversor interno `pdfmd`)
- *"Monte o dossiê estratégico antes de peticionar"*

O Claude segue automaticamente o padrão do escritório: papel timbrado, Montserrat 12pt,
margens de 3cm, estrutura de peça e teses da pasta do tema. As regras que ele obedece estão
em [AGENTS.md](AGENTS.md) — você não precisa decorá-las.

**Regra de ouro:** o Claude produz **minuta**. A revisão de mérito e a conferência de prazos
no eproc/DJEN oficial são sempre do advogado, antes de qualquer protocolo.

---

## 6. Onde ficam as coisas

| Pasta | O que tem |
|---|---|
| `clientes/` | documentos de trabalho de cada cliente (uma pasta por cliente) |
| `direito_bancario/`, `direito_digital/`, `rescisao_contrato_imovel/` | conhecimento por tema: jurisprudência, estratégias, casos decididos — e os casos concretos daquele tema |
| `material_padrao_escritorio/` | modelos, timbrado, papel padrão |
| `skills/` | as "habilidades" da IA (geração de peça, tipografia, prazos DJEN etc.) |
| `perfil/definicoes.md` | definições canônicas do escritório (ex.: como calcular valor da causa) |
| `relatorios/` | relatórios e pareceres gerados |

O que **não** está aqui (de propósito): áudios, backups, rascunhos temporários e senhas —
o arquivo `.gitignore` impede que subam para a nuvem. Áudios e arquivos muito pesados ficam
no Google Drive do escritório.

---

## 7. O que NUNCA fazer

1. **Nunca** tornar o repositório público no GitHub.
2. **Nunca** enviar o arquivo `.env`, senhas ou chaves (o sistema bloqueia, não contorne).
3. **Nunca** usar `git push --force` (se alguém sugerir isso, chame a Ana antes).
4. **Nunca** apagar pastas de colegas para "organizar" — combine antes.
5. **Nunca** protocolar peça gerada pela IA sem revisão humana e conferência de prazo.

---

## 8. Problemas comuns

| Sintoma | O que fazer |
|---|---|
| "Permission denied" ao dar `git push` | você ainda não aceitou o convite do GitHub, ou não está logado — chame a Ana |
| "conflict" após `git pull` | veja a seção 4 — pare e peça ajuda, não escolha às cegas |
| Esqueci de dar `git pull` antes de trabalhar | sem pânico: rode `git pull` agora; se der conflito, seção 4 |
| Apaguei um arquivo sem querer | o git guarda tudo: peça ao Claude *"recupere o arquivo X da versão anterior"* |
| O Claude não acha um documento em PDF | peça primeiro: *"converta o PDF X para markdown"* |

---

## 9. Para quem quiser ir além

- Fluxos técnicos completos (arquitetura, skills, geração de .docx): [GUIA_TECNICO.md](GUIA_TECNICO.md)
- Regras canônicas que a IA obedece: [AGENTS.md](AGENTS.md)
- Definições do escritório: [perfil/definicoes.md](perfil/definicoes.md)

*Dúvidas: Ana Moraes — responsável pelo projeto.*

#!/usr/bin/env node
/**
 * setup.js — instalador do workspace (Windows e macOS)
 *
 * Roda com:  node scripts/setup.js
 *
 * Monta tudo o que o projeto precisa nesta máquina: ambiente Python,
 * bibliotecas, conversor de PDF e as dependências do gerador de .docx.
 * Pode ser executado quantas vezes quiser — o que já está pronto é pulado.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const RAIZ = path.resolve(__dirname, '..');
const WIN = process.platform === 'win32';
const MAC = process.platform === 'darwin';
const VENV = path.join(RAIZ, 'adv_env');
const PY_VENV = WIN
  ? path.join(VENV, 'Scripts', 'python.exe')
  : path.join(VENV, 'bin', 'python');

const PY_MINIMO = [3, 10];
const avisos = [];
let passo = 0;

// ---------------------------------------------------------------- utilidades

const c = {
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  erro: (s) => `\x1b[31m${s}\x1b[0m`,
  aviso: (s) => `\x1b[33m${s}\x1b[0m`,
  forte: (s) => `\x1b[1m${s}\x1b[0m`,
  fraco: (s) => `\x1b[90m${s}\x1b[0m`,
};

function titulo(txt) {
  passo += 1;
  console.log(`\n${c.forte(`[${passo}] ${txt}`)}`);
}

function ok(txt) {
  console.log(`    ${c.ok('OK')}  ${txt}`);
}

function pular(txt) {
  console.log(`    ${c.fraco('--')}  ${txt}`);
}

function alertar(txt, comoResolver) {
  console.log(`    ${c.aviso('!!')}  ${txt}`);
  avisos.push({ txt, comoResolver });
}

function abortar(txt, comoResolver) {
  console.log(`\n    ${c.erro('PAROU AQUI')}  ${txt}\n`);
  if (comoResolver) console.log(`    Como resolver: ${comoResolver}\n`);
  process.exit(1);
}

function rodar(cmd, args, opcoes = {}) {
  return spawnSync(cmd, args, {
    cwd: RAIZ,
    encoding: 'utf8',
    shell: false,
    ...opcoes,
  });
}

function rodarMostrando(cmd, args) {
  return spawnSync(cmd, args, { cwd: RAIZ, stdio: 'inherit', shell: false });
}

// O npm do Windows é um arquivo .cmd, e o Node 20+ recusa executá-lo direto.
// Vai pelo shell, como linha única — passar argumentos separados com shell
// ligado dispara aviso de depreciação.
function rodarPeloShell(linha) {
  return spawnSync(linha, [], { cwd: RAIZ, stdio: 'inherit', shell: true });
}

function existe(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------- 1. sistema e Node

function verificarSistema() {
  titulo('Conferindo o computador');

  if (!WIN && !MAC) {
    alertar(
      `sistema "${process.platform}" não é testado (o escritório usa Windows e macOS)`,
      'o instalador vai tentar seguir mesmo assim'
    );
  }
  ok(`sistema: ${WIN ? 'Windows' : MAC ? 'macOS' : process.platform} (${os.arch()})`);

  const nodeMaior = Number(process.versions.node.split('.')[0]);
  if (nodeMaior < 18) {
    abortar(
      `Node.js ${process.versions.node} é antigo demais (precisa ser 18 ou maior)`,
      'instale a versão LTS em https://nodejs.org e rode este comando de novo'
    );
  }
  ok(`Node.js ${process.versions.node}`);
}

// ------------------------------------------------------------- 2. Python

function acharPython() {
  titulo('Procurando o Python');

  const candidatos = WIN
    ? [['py', ['-3']], ['python', []], ['python3', []]]
    : [['python3', []], ['python', []]];

  for (const [cmd, prefixo] of candidatos) {
    const r = rodar(cmd, [...prefixo, '-c', 'import sys; print(sys.version_info[0], sys.version_info[1])']);
    if (r.status !== 0 || !r.stdout) continue;

    const [maior, menor] = r.stdout.trim().split(/\s+/).map(Number);
    if (maior > PY_MINIMO[0] || (maior === PY_MINIMO[0] && menor >= PY_MINIMO[1])) {
      ok(`Python ${maior}.${menor} encontrado (comando: ${[cmd, ...prefixo].join(' ')})`);
      return { cmd, prefixo };
    }
    pular(`Python ${maior}.${menor} é antigo demais, procurando outro`);
  }

  abortar(
    `não encontrei Python ${PY_MINIMO.join('.')} ou superior neste computador`,
    MAC
      ? 'instale com "brew install python@3.11" ou baixe em https://python.org/downloads'
      : 'baixe em https://python.org/downloads e MARQUE a opção "Add Python to PATH" durante a instalação'
  );
  return null;
}

// --------------------------------------------------- 3. ambiente adv_env

function montarAmbiente(python) {
  titulo('Montando o ambiente Python do projeto (adv_env)');

  if (existe(PY_VENV)) {
    pular('adv_env já existe — reaproveitando');
  } else {
    console.log('    criando... (pode levar um minuto)');
    const r = rodarMostrando(python.cmd, [...python.prefixo, '-m', 'venv', VENV]);
    if (r.status !== 0 || !existe(PY_VENV)) {
      abortar(
        'não consegui criar o ambiente adv_env',
        WIN
          ? 'confira se o Python foi instalado com "Add Python to PATH" marcado'
          : 'confira se o módulo venv está disponível: python3 -m venv --help'
      );
    }
    ok('adv_env criado');
  }

  console.log('    atualizando o instalador de pacotes...');
  rodar(PY_VENV, ['-m', 'pip', 'install', '--quiet', '--upgrade', 'pip']);
  ok('pip atualizado');
}

// ------------------------------------------------------- 4. bibliotecas

function instalarBibliotecas() {
  titulo('Instalando as bibliotecas Python');

  const req = path.join(RAIZ, 'requirements.txt');
  if (!existe(req)) {
    abortar('requirements.txt não encontrado', 'o projeto pode ter sido baixado incompleto');
  }

  console.log('    instalando... (a primeira vez demora, é normal)');
  const r = rodarMostrando(PY_VENV, ['-m', 'pip', 'install', '-r', req]);
  if (r.status !== 0) {
    abortar(
      'a instalação das bibliotecas falhou',
      'confira sua conexão com a internet e rode o comando de novo'
    );
  }
  ok('bibliotecas instaladas');
}

// O radar-jurisprudencia-stj usa o Scrapling, que dirige um Chromium do Playwright.
// O navegador não vem pelo pip: baixa à parte (idempotente; ~150 MB na primeira vez).
function instalarNavegador() {
  titulo('Instalando o navegador da pesquisa no STJ (Chromium)');

  const r = rodar(PY_VENV, ['-m', 'playwright', 'install', 'chromium']);
  if (r.status === 0) ok('Chromium pronto');
  else alertar('não consegui baixar o Chromium', 'confira a internet e rode o setup de novo');
}

// ---------------------------------------------------------- 5. conversor

function instalarPdfmd() {
  titulo('Instalando o conversor de PDF (pdfmd)');

  const fonte = path.join(RAIZ, 'vendor', 'pdfmd');
  if (!existe(path.join(fonte, 'pyproject.toml'))) {
    alertar('o código do pdfmd não veio junto', 'baixe o projeto novamente');
    return;
  }

  const r = rodar(PY_VENV, ['-m', 'pip', 'install', '--quiet', '-e', fonte]);
  if (r.status !== 0) {
    alertar('não consegui instalar o pdfmd', 'rode o setup de novo; se insistir, avise a responsável');
    return;
  }

  const teste = rodar(PY_VENV, ['-c', 'import pdfmd; print(pdfmd.__name__)']);
  if (teste.status === 0) ok('pdfmd instalado e funcionando');
  else alertar('pdfmd instalou mas não respondeu ao teste', 'avise a responsável pelo projeto');
}

function conferirTesseract() {
  titulo('Conferindo o leitor de PDF digitalizado (Tesseract)');

  const r = rodar(WIN ? 'where' : 'which', ['tesseract']);
  if (r.status === 0 && r.stdout.trim()) {
    ok('Tesseract encontrado');
    return;
  }

  alertar(
    'Tesseract não está instalado — PDF escaneado (foto de documento) não será convertido',
    MAC
      ? 'instale com: brew install tesseract tesseract-lang'
      : 'baixe em https://github.com/UB-Mannheim/tesseract/wiki e instale o idioma português'
  );
}

// -------------------------------------------------------------- 6. Node

function instalarNode() {
  titulo('Instalando as bibliotecas do gerador de peças (.docx)');

  if (existe(path.join(RAIZ, 'node_modules', 'docx'))) {
    pular('já instaladas — reaproveitando');
    return;
  }

  console.log('    instalando...');
  const r = rodarPeloShell('npm install --no-audit --no-fund');
  if (r.status !== 0) {
    alertar('a instalação com npm falhou', 'confira a internet e rode: npm install');
    return;
  }
  ok('bibliotecas do gerador instaladas');
}

// ------------------------------------------------- 7. ambiente.json

function gravarAmbiente() {
  titulo('Registrando as configurações desta máquina');

  const bundles = descobrirBundles();

  const ambiente = {
    _comentario:
      'Gerado pelo scripts/setup.js. É desta máquina — não vai para o repositório. ' +
      'Para regerar, apague este arquivo e rode: node scripts/setup.js',
    sistema: WIN ? 'windows' : MAC ? 'macos' : process.platform,
    raiz: RAIZ.replace(/\\/g, '/'),
    python: PY_VENV.replace(/\\/g, '/'),
    bundles: bundles ? bundles.replace(/\\/g, '/') : null,
    gerado_em: new Date().toISOString().slice(0, 10),
  };

  const destino = path.join(RAIZ, 'perfil', 'ambiente.json');
  fs.writeFileSync(destino, JSON.stringify(ambiente, null, 2) + '\n', 'utf8');
  ok('perfil/ambiente.json gravado');

  if (!bundles) {
    alertar(
      'não encontrei o acervo jurídico (arsenal-juridico) neste computador',
      'peça o endereço à responsável e baixe-o; depois rode este setup de novo'
    );
  } else {
    ok(`acervo jurídico encontrado em ${bundles}`);
  }
}

function descobrirBundles() {
  // O acervo é o arsenal-juridico, e só ele. A pasta "bundles" (estrutura antiga,
  // um repositório por bundle) foi arquivada em 31/07/2026 e REMOVIDA daqui de
  // propósito: a comparação mostrou que o arsenal a contém por inteiro, e que a
  // cópia velha ainda carregava o nome de cliente e o dado de terceiro que a
  // auditoria LGPD de 28/07 tinha removido. Fallback para ela reintroduziria o
  // vazamento numa máquina nova, em silêncio.
  const candidatos = [
    path.resolve(RAIZ, '..', 'arsenal-juridico'),
    WIN ? 'D:/GITHUB/arsenal-juridico' : null,
    path.join(os.homedir(), 'arsenal-juridico'),
  ].filter(Boolean);

  for (const p of candidatos) if (existe(p)) return p;
  return null;
}

// ------------------------------------------------------ 8. identidade

function conferirIdentidade() {
  titulo('Conferindo sua identificação');

  const g = rodar('git', ['config', 'user.name']);
  const e = rodar('git', ['config', 'user.email']);
  const temNome = g.status === 0 && g.stdout.trim();
  const temEmail = e.status === 0 && e.stdout.trim();

  if (temNome && temEmail) {
    ok(`git configurado como ${g.stdout.trim()} <${e.stdout.trim()}>`);
  } else {
    alertar(
      'o git ainda não sabe quem é você',
      'rode, trocando pelos seus dados:\n         git config --global user.name "Seu Nome"\n         git config --global user.email "seu@email.com"'
    );
  }

  if (existe(path.join(RAIZ, 'perfil', 'usuario.md'))) {
    ok('seu perfil de usuário já existe');
  } else {
    console.log(
      `    ${c.fraco('--')}  seu perfil ainda não existe — o Claude vai te entrevistar na primeira conversa`
    );
  }
}

// ------------------------------------------------------------- resumo

function resumo() {
  console.log(`\n${c.forte('─'.repeat(64))}`);

  if (avisos.length === 0) {
    console.log(`\n  ${c.ok('Tudo pronto.')} Pode abrir o projeto no VS Code e usar o Claude Code.\n`);
    return;
  }

  console.log(`\n  ${c.aviso(`Instalação concluída, com ${avisos.length} ponto(s) para resolver:`)}\n`);
  avisos.forEach((a, i) => {
    console.log(`  ${i + 1}. ${a.txt}`);
    if (a.comoResolver) console.log(`     ${c.fraco('→ ' + a.comoResolver)}`);
  });
  console.log(
    `\n  ${c.fraco('Nenhum deles impede de começar a trabalhar — mas resolva quando puder.')}\n`
  );
}

// --------------------------------------------------------------- início

console.log(c.forte('\nInstalador do workspace — Paulo Moraes Advocacia'));
console.log(c.fraco('Vai instalar o que o projeto precisa nesta máquina. Pode demorar alguns minutos.'));

verificarSistema();
const python = acharPython();
montarAmbiente(python);
instalarBibliotecas();
instalarNavegador();
instalarPdfmd();
conferirTesseract();
instalarNode();
gravarAmbiente();
conferirIdentidade();
resumo();

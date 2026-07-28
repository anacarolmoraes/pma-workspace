#!/usr/bin/env python
"""Indexador de corpus juridico local para a skill pre-peticionamento-drive.

Gera <case_dir>/_indice.md (compacto) e atualiza <case_dir>/_pipeline.json com o
hash do corpus (idempotencia). Zero dependencia externa (stdlib apenas), de modo
que roda com qualquer Python do adv_env independentemente de libs instaladas.

Nunca despeja o conteudo dos documentos no stdout: imprime apenas uma linha de
resumo. O indice e' lido depois pelo agente; os documentos completos nunca entram
no contexto nesta fase.

Uso:
    python indexar_corpus.py <case_dir> <dir_corpus1> [<dir_corpus2> ...]
"""
import sys
import os
import re
import json
import hashlib
import datetime

VAL_RE = re.compile(r'R\$\s?[\d.  ]+,\d{2}')
DATE_RE = re.compile(r'\b\d{1,2}/\d{1,2}/\d{2,4}\b')
ART_RE = re.compile(
    r'\bart(?:igo)?\.?\s?\d+[º°]?'
    r'(?:[,\-\s]*(?:inc|§|alinea|alínea|caput)[^\n]{0,18})?',
    re.IGNORECASE,
)
DOC_RE = re.compile(
    r'\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b'          # CPF
    r'|\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b'  # CNPJ
)


def find_md(dirs):
    files = []
    for d in dirs:
        if not d or not os.path.isdir(d):
            continue
        for root, _, names in os.walk(d):
            for n in names:
                if n.lower().endswith('.md') and not n.startswith('_indice'):
                    files.append(os.path.join(root, n))
    return sorted(set(files))


def top(text, regex, limit):
    seen = []
    for m in regex.findall(text):
        v = m.strip()
        if v and v not in seen:
            seen.append(v)
        if len(seen) >= limit:
            break
    return seen


def headings(text, limit=12):
    hs = [l.strip() for l in text.splitlines() if l.lstrip().startswith('#')]
    return hs[:limit]


def opening(text, limit=6):
    lines = [
        l.strip() for l in text.splitlines()
        if l.strip() and not l.lstrip().startswith('#')
    ]
    return lines[:limit]


def main():
    if len(sys.argv) < 3:
        print('uso: indexar_corpus.py <case_dir> <dir_corpus1> [dir_corpus2 ...]')
        return 2

    case_dir = sys.argv[1]
    corpus_dirs = sys.argv[2:]
    md_files = find_md(corpus_dirs)

    h = hashlib.sha256()
    out = [
        '# INDICE DO CORPUS - pre-peticionamento-drive',
        '',
        '> Gerado automaticamente. Use para escopar grep/leitura. NAO substitui a '
        'leitura dos trechos citados.',
        '',
        'Docs indexados: %d' % len(md_files),
        '',
    ]

    for fp in md_files:
        try:
            with open(fp, 'r', encoding='utf-8', errors='replace') as fh:
                txt = fh.read()
        except OSError:
            continue
        h.update(fp.encode('utf-8'))
        try:
            h.update(('%d' % os.path.getmtime(fp)).encode('utf-8'))
        except OSError:
            pass

        out.append('## ' + os.path.basename(fp))
        out.append('`%s` - %d chars' % (fp, len(txt)))
        hs = headings(txt)
        if hs:
            out.append('**Secoes:** ' + ' / '.join(
                s.lstrip('#').strip() for s in hs))
        vals = top(txt, VAL_RE, 15)
        if vals:
            out.append('**Valores:** ' + ', '.join(vals))
        dates = top(txt, DATE_RE, 15)
        if dates:
            out.append('**Datas:** ' + ', '.join(dates))
        arts = top(txt, ART_RE, 12)
        if arts:
            out.append('**Dispositivos:** ' + ', '.join(arts))
        docs = top(txt, DOC_RE, 6)
        if docs:
            out.append('**CPF/CNPJ:** ' + ', '.join(docs))
        op = opening(txt)
        if op:
            out.append('**Abertura:** ' + (' '.join(op))[:600])
        out.append('')

    indice_path = os.path.join(case_dir, '_indice.md')
    with open(indice_path, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(out))

    corpus_hash = h.hexdigest()[:16]
    pipe_path = os.path.join(case_dir, '_pipeline.json')
    pipe = {}
    if os.path.isfile(pipe_path):
        try:
            with open(pipe_path, 'r', encoding='utf-8') as fh:
                pipe = json.load(fh)
        except (OSError, ValueError):
            pipe = {}

    pipe.setdefault('caso', os.path.basename(os.path.normpath(case_dir)))
    pipe['indice'] = {
        'arquivo': indice_path,
        'n_docs': len(md_files),
        'corpus_hash': corpus_hash,
        'gerado_em': datetime.datetime.now().isoformat(timespec='seconds'),
        'corpus_dirs': corpus_dirs,
    }
    with open(pipe_path, 'w', encoding='utf-8') as fh:
        json.dump(pipe, fh, ensure_ascii=False, indent=2)

    print('OK indice: %s | docs=%d | hash=%s'
          % (indice_path, len(md_files), corpus_hash))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
diff_peca.py - Compara o texto de uma peca .docx (editada manualmente pela
titular) com o .md-fonte que a gerou, e imprime um diff estruturado em nivel
de paragrafo. A parte mecanica (extrair, normalizar, alinhar) fica pronta; o
julgamento sobre o que e "preferencia duravel" x "especifico do caso" continua
sendo do agente/advogada.

Uso:
    python diff_peca.py caminho/PECA_EDITADA.docx caminho/PECA_FONTE.md

Sem dependencias externas (zipfile + re + difflib da stdlib).
"""
import sys
import re
import zipfile
import difflib


def texto_docx(path):
    """Extrai paragrafos de um .docx (word/document.xml)."""
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml").decode("utf-8", "replace")
    # cada <w:p> vira um paragrafo; <w:tab/> vira espaco
    xml = xml.replace("<w:tab/>", " ")
    xml = re.sub(r"</w:p>", "\n", xml)
    txt = re.sub(r"<[^>]+>", "", xml)
    # desescapa entidades XML basicas
    for a, b in (("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"),
                 ("&quot;", '"'), ("&apos;", "'")):
        txt = txt.replace(a, b)
    return [normaliza(l) for l in txt.split("\n") if normaliza(l)]


def texto_md(path):
    """Extrai paragrafos de um .md no dialeto PMA, removendo marcacao."""
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    # remove frontmatter YAML
    raw = re.sub(r"^---\n.*?\n---\n", "", raw, count=1, flags=re.DOTALL)
    # remove comentarios HTML
    raw = re.sub(r"<!--.*?-->", "", raw, flags=re.DOTALL)
    paras = []
    for bloco in re.split(r"\n\s*\n", raw):
        linha = bloco.strip()
        if not linha:
            continue
        # diretivas de bloco do dialeto
        if linha.startswith("::endereco") or linha == "::" or linha.startswith("::assinatura"):
            # pega o conteudo interno das diretivas multi-linha depois
            pass
        # remove marcadores de diretiva inline (::center, ::left, ::right, ::br, ::pagebreak)
        linha = re.sub(r"^::(center|left|right|br|pagebreak|endereco|assinatura|local:)\s?", "", linha, flags=re.MULTILINE)
        linha = linha.replace("::", "")
        # remove marcacao markdown
        linha = re.sub(r"^#{1,6}\s*", "", linha, flags=re.MULTILINE)  # titulos
        linha = re.sub(r"^>\s?", "", linha, flags=re.MULTILINE)       # citacoes
        linha = linha.replace("**", "").replace("*", "")
        # une linhas contiguas do mesmo paragrafo
        linha = re.sub(r"\s*\n\s*", " ", linha)
        linha = normaliza(linha)
        if linha:
            paras.append(linha)
    return paras


def normaliza(s):
    return re.sub(r"\s+", " ", s).strip()


def similar(a, b):
    return difflib.SequenceMatcher(None, a, b).ratio()


def main():
    if len(sys.argv) != 3:
        print("Uso: python diff_peca.py PECA_EDITADA.docx PECA_FONTE.md")
        sys.exit(1)
    docx_path, md_path = sys.argv[1], sys.argv[2]
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    a = texto_md(md_path)      # fonte (o que eu gerei)
    b = texto_docx(docx_path)  # editado (versao da titular)

    sm = difflib.SequenceMatcher(None, a, b)
    add, rem, mod = 0, 0, 0
    print("=" * 70)
    print("DIFF  fonte(.md) -> editado(.docx)")
    print("  - REMOVIDO = estava no meu texto e a titular tirou")
    print("  + ADICIONADO = a titular incluiu")
    print("  ~ ALTERADO = mesma posicao, texto trocado (com similaridade)")
    print("=" * 70)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            continue
        if tag == "replace":
            # tenta parear linha a linha por similaridade
            bloco_a = a[i1:i2]
            bloco_b = b[j1:j2]
            for k in range(max(len(bloco_a), len(bloco_b))):
                ta = bloco_a[k] if k < len(bloco_a) else None
                tb = bloco_b[k] if k < len(bloco_b) else None
                if ta and tb:
                    mod += 1
                    print(f"\n~ ALTERADO (sim {similar(ta, tb):.0%}):")
                    print(f"  - {ta}")
                    print(f"  + {tb}")
                elif ta:
                    rem += 1
                    print(f"\n- REMOVIDO:\n  - {ta}")
                elif tb:
                    add += 1
                    print(f"\n+ ADICIONADO:\n  + {tb}")
        elif tag == "delete":
            for ta in a[i1:i2]:
                rem += 1
                print(f"\n- REMOVIDO:\n  - {ta}")
        elif tag == "insert":
            for tb in b[j1:j2]:
                add += 1
                print(f"\n+ ADICIONADO:\n  + {tb}")

    print("\n" + "=" * 70)
    print(f"RESUMO: {add} adicionados, {rem} removidos, {mod} alterados "
          f"(fonte {len(a)} paragrafos, editado {len(b)}).")
    print("Triagem: quais sao PREFERENCIA DURAVEL (-> bundle/memoria) x")
    print("         ESPECIFICO deste caso (-> so aqui)?")


if __name__ == "__main__":
    main()

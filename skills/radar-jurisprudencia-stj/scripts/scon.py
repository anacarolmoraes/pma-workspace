"""Pesquisa de jurisprudência no SCON/STJ (scon.stj.jus.br) — motor da skill radar-jurisprudencia-stj.

Não chamar direto: usar scripts/scon.js, que acha o Python do adv_env e converte o inteiro teor.

    buscar    <consultas.json> <pasta_saida> [por_pagina] [retomar]
    teor      <itens.json>
    processo  <itens.json>

O SCON fica atrás de desafio da Cloudflare; o Scrapling (StealthySession) passa como navegador
comum. Ritmo deliberadamente baixo: uma requisição a cada PAUSA segundos, numa sessão só.

Cada consulta aceita, além de `livre` e dos campos avançados: `base` ("acordaos", padrão, ou
"monocraticas") e `paginas` (quantas páginas de `por_pagina` trazer; padrão 1). O resultado é
gravado consulta a consulta, para a queda da sessão não perder o que já veio; `retomar` pula
as consultas que já estão no resultados.json da pasta.
"""
import io
import json
import logging
import os
import re
import sys
import time
import urllib.parse

from scrapling.fetchers import StealthySession

logging.getLogger("scrapling").setLevel(logging.WARNING)

BASE = "https://scon.stj.jus.br/SCON/"
PAUSA = 6
TIMEOUT = 90000
BASES = {"acordaos": "ACOR", "monocraticas": "DTXT"}

ROTULOS = {
    "Processo": "processo", "Relator": "relator", "Relatora": "relator", "Relator(a)": "relator",
    "Órgão Julgador": "orgao", "Data do Julgamento": "julgamento",
    "Data da Publicação/Fonte": "publicacao", "Data da Publicação": "publicacao",
    "Ementa": "ementa", "Acórdão": "acordao", "Acórdãos Similares": "similares", "Decisão": "decisao",
    "Notas": "notas", "Informações Complementares à Ementa": "info_compl",
    "Referência Legislativa": "ref_leg", "Jurisprudência Citada": "jurisp_citada",
}
# Campos do formulário que a consulta pode preencher além da pesquisa livre.
CAMPOS_TEXTO = ("ementa", "classe", "uf", "processo", "dtpb1", "dtpb2", "dtde1", "dtde2")


def limpar(t):
    return re.sub(r"\s+", " ", t or "").strip()


def rotulo_de(titulo):
    """O `.docTitulo` traz o nome do campo e, às vezes, o texto de ajuda do ícone (?).
    Fica o rótulo que começa o texto; o mais longo primeiro ("Data da Publicação/Fonte")."""
    nome = limpar(titulo)
    for k in sorted(ROTULOS, key=len, reverse=True):
        if nome.startswith(k):
            return ROTULOS[k]
    return None


def enviar_form(c, por_pagina, inicio=1):
    """O SCON só aceita a busca vinda do formulário da home; GET direto em pesquisar.jsp
    volta para ela (307). `l` não existe no formulário: é injetado para vir N por página.
    `b` escolhe a base (ACOR acórdãos, DTXT monocráticas) e `i` o primeiro documento da página."""
    def acao(page):
        page.fill("#pesquisaLivre", c.get("livre", ""))
        # Os campos da pesquisa avançada ficam numa seção recolhida: `fill` esperaria que
        # ficassem visíveis. O valor vai direto no elemento.
        campos = {k: c[k] for k in CAMPOS_TEXTO if c.get(k)}
        ocultos = {"l": str(por_pagina), "i": str(inicio), "b": BASES.get(c.get("base", "acordaos"), "ACOR")}
        page.evaluate("""([campos, ocultos]) => {
            const f = document.getElementById('frmConsulta');
            for (const [k, v] of Object.entries(campos)) {
                const el = f.querySelector('[name="' + k + '"]');
                if (el) { el.value = v; el.dispatchEvent(new Event('change', {bubbles: true})); }
            }
            for (const [k, v] of Object.entries(ocultos)) {
                let e = f.querySelector('[name="' + k + '"]');
                if (!e) { e = document.createElement('input'); e.type = 'hidden'; e.name = k; f.appendChild(e); }
                e.value = v;
            }
        }""", [campos, ocultos])
        with page.expect_navigation(timeout=60000):
            page.focus("#pesquisaLivre")
            page.keyboard.press("Enter")
        page.wait_for_load_state("networkidle", timeout=60000)
    return acao


# Começa por dígito: com `[\d.]+`, um ponto solto antes de "acórdãos" virava int('') e derrubava a busca.
RX_TOTAL = re.compile(r"(\d[\d.]*)\s+(?:acórdãos?|decis(?:ão|ões) monocráticas?)", re.I)
RX_TEOR = re.compile(r"GetInteiroTeorDoAcordao\?num_registro=(\d+)&(?:amp;)?dt_publicacao=([\d/]+)")
RX_MONO = re.compile(r"monocraticas/decisoes/\?num_registro=(\d+)&(?:amp;)?dt_publicacao=([\d/]+)")
# Bloco "Acórdãos Similares": um <pre> por acórdão ("REsp 2209868 SP 2025/0146481-2 Decisão:16/06/2026
# DJEN DATA:24/06/2026") seguido do link de inteiro teor DELE, não do principal.
RX_SIMILAR = re.compile(r"<pre>(.*?)</pre>.*?" + RX_TEOR.pattern, re.S)
RX_SIMILAR_TXT = re.compile(
    r"^(.+?\d+)\s+([A-Z]{2})\s+(\d{4}/\d+-\d)\s+Decisão:\s*([\d/]+)\s+(\S+)\s+DATA:\s*([\d/]+)")


def similares_de(html):
    """Acórdãos similares, cada um com o próprio registro e link. `processo` no formato do campo
    "Processo" ("REsp 2209868 / SP ..."), para citação e nome de arquivo saírem iguais."""
    lista = []
    for m in RX_SIMILAR.finditer(html):
        t = RX_SIMILAR_TXT.match(limpar(re.sub(r"<[^>]+>", " ", m.group(1))))
        if t:
            lista.append({"processo": f"{t.group(1)} / {t.group(2)} {t.group(3)}", "julgamento": t.group(4),
                          "publicacao": f"{t.group(5)} {t.group(6)}", "num_registro": m.group(2),
                          "dt_publicacao": m.group(3), "tipo": "acordao"})
    return lista


def extrair(page):
    total = RX_TOTAL.search(page.get_all_text())
    docs = []
    for d in page.css("div.documento"):
        reg = {}
        html = d.html_content
        for t in d.css(".docTitulo"):
            campo = rotulo_de(t.get_all_text())
            irmao = t.xpath("following-sibling::*[1]")
            if campo == "similares" and irmao:
                reg["similares"] = similares_de(irmao[0].html_content)
                # O link do similar não é o do principal: sem tirar o bloco, principal sem inteiro
                # teor herdava o registro do primeiro similar (REsp 2.263.178 → 2.209.868, 20/10/2026).
                html = html.replace(irmao[0].html_content, "")
            elif campo and irmao:
                reg[campo] = limpar(irmao[0].get_all_text())
        m = RX_TEOR.search(html)
        if m:
            reg["num_registro"], reg["dt_publicacao"], reg["tipo"] = m.group(1), m.group(2), "acordao"
        else:
            m = RX_MONO.search(html)
            if m:
                reg["num_registro"], reg["dt_publicacao"], reg["tipo"] = m.group(1), m.group(2), "monocratica"
                reg.setdefault("ementa", reg.get("decisao", "")[:2600])
        if reg:
            docs.append(reg)
    return int(total.group(1).replace(".", "")) if total else 0, docs


def citacao_curta(d):
    """'REsp 2084975 / MT RECURSO ESPECIAL 2023/...' -> 'REsp 2084975/MT'."""
    m = re.match(r"(.+?\d+)\s*/\s*([A-Z]{2})", d.get("processo", ""))
    return f"{m.group(1)}/{m.group(2)}" if m else d.get("processo", "")[:40]


def gravar_triagem(resultados, arq):
    vistos = {}
    for q in resultados:
        for d in q["docs"]:
            k = d.get("num_registro") or d.get("processo")
            vistos.setdefault(k, [d, []])[1].append(q["id"])
    with io.open(arq, "w", encoding="utf-8") as f:
        f.write(f"# Triagem SCON — {len(vistos)} documentos distintos\n\n")
        f.write("Ementa recortada em 700 caracteres. É resumo oficial, não razão de decidir: "
                "nada aqui vira citação sem o inteiro teor.\n\n")
        for k, (d, qs) in vistos.items():
            tipo = " — DECISÃO MONOCRÁTICA" if d.get("tipo") == "monocratica" else ""
            f.write(f"## {citacao_curta(d)}{tipo} — {d.get('orgao', '')} — j. {d.get('julgamento', '')}"
                    f" — {d.get('publicacao', '')}\n")
            f.write(f"registro `{k}` · dt_publicacao `{d.get('dt_publicacao', '')}` · "
                    f"{d.get('relator', '')} · consultas: {', '.join(dict.fromkeys(qs))}\n\n")
            f.write(f"> {d.get('ementa', '')[:700]}\n\n")
    return len(vistos)


def gravar_resultados(resultados, pasta):
    io.open(f"{pasta}/resultados.json", "w", encoding="utf-8").write(
        json.dumps(resultados, ensure_ascii=False, indent=1))


def buscar(arq, pasta, por_pagina=50, retomar=False):
    consultas = json.load(io.open(arq, encoding="utf-8"))
    arq_res = f"{pasta}/resultados.json"
    anteriores = {}
    if retomar and os.path.exists(arq_res):
        anteriores = {q["id"]: q for q in json.load(io.open(arq_res, encoding="utf-8"))}
    resultados = []
    with StealthySession(headless=True, solve_cloudflare=True, network_idle=True) as s:
        s.fetch(BASE, timeout=TIMEOUT)
        for c in consultas:
            if c["id"] in anteriores:
                resultados.append(anteriores[c["id"]])
                print(f"{c['id']}: retomado ({anteriores[c['id']]['total']} docs já gravados)", flush=True)
                continue
            paginas = max(1, int(c.get("paginas") or 1))
            docs, total = [], 0
            for n in range(paginas):
                time.sleep(PAUSA)
                p = s.fetch(BASE, page_action=enviar_form(c, por_pagina, n * por_pagina + 1), timeout=TIMEOUT)
                total, pagina = extrair(p)
                docs.extend(pagina)
                if not pagina or len(docs) >= total:
                    break
            if total == 0:
                aviso = "SECA: reformular (variantes com ou, $, operador mais frouxo)"
            elif total > len(docs):
                aviso = f"LARGA: só os {len(docs)} mais recentes vieram; estreitar ou `paginas`"
            else:
                aviso = ""
            print(f"{c['id']}: {total} documentos, {len(docs)} lidos  {aviso}", flush=True)
            resultados.append({**c, "total": total, "docs": docs})
            gravar_resultados(resultados, pasta)  # consulta a consulta: queda não perde o feito
    gravar_resultados(resultados, pasta)
    n = gravar_triagem(resultados, f"{pasta}/triagem.md")
    print(f"\n{n} documentos distintos -> {pasta}/triagem.md", flush=True)


def teor(arq):
    """Cada item traz nome, num_registro, dt_publicacao e a pasta de destino. Acórdão vem como
    PDF (navegar até ele só mostraria o visualizador do Chromium; os bytes saem por
    page.request, que herda os cookies). Monocrática não tem PDF: o texto já veio no espelho
    (`decisao`) e o scon.js o grava; aqui só o acórdão é baixado."""
    itens = json.load(io.open(arq, encoding="utf-8"))
    falhas = []

    def baixar(page):
        for it in itens:
            page.wait_for_timeout(PAUSA * 1000)
            url = BASE + "GetInteiroTeorDoAcordao?" + urllib.parse.urlencode(
                {"num_registro": it["num_registro"], "dt_publicacao": it["dt_publicacao"]})
            r = page.request.get(url, timeout=TIMEOUT)
            corpo = r.body()
            if corpo[:4] != b"%PDF":
                falhas.append(it["nome"])
                print(f"{it['nome']}: FALHOU (status {r.status}, não veio PDF)", flush=True)
                continue
            os.makedirs(it["pasta"], exist_ok=True)
            io.open(os.path.join(it["pasta"], f"{it['nome']}.pdf"), "wb").write(corpo)
            print(f"{it['nome']}.pdf  {len(corpo) // 1024} KB", flush=True)

    with StealthySession(headless=True, solve_cloudflare=True, network_idle=True) as s:
        s.fetch(BASE, page_action=baixar, timeout=PAUSA * 1000 * (len(itens) + 1) + 10 * TIMEOUT)
    sys.exit(1 if falhas else 0)


PROCESSO = ("https://processo.stj.jus.br/processo/pesquisa/?aplicacao=processos.ea"
            "&tipoPesquisa=tipoPesquisaNumeroRegistro&termo=")


def processo(arq):
    """Acompanhamento processual pelo número de registro: partes e advogados (aba Detalhes,
    que alimenta a pseudonimização do depósito) e fases (que acendem o semáforo de alteração
    posterior). O DataJud não serve aqui: indexa o STJ pelo número CNJ, não pelo registro."""
    itens = json.load(io.open(arq, encoding="utf-8"))
    falhas = 0
    with StealthySession(headless=True, solve_cloudflare=True, network_idle=True) as s:
        for it in itens:
            time.sleep(PAUSA)
            p = s.fetch(PROCESSO + it["num_registro"], timeout=TIMEOUT)
            detalhes = []
            for lin in p.css("div.classDivLinhaDetalhes"):
                rot = lin.css(".classSpanDetalhesLabel")
                val = lin.css(".classSpanDetalhesTexto")
                if rot and val:
                    detalhes.append({"rotulo": limpar(rot[0].get_all_text()).rstrip(":"),
                                     "valor": limpar(val[0].get_all_text())})
            fases = []
            for f in p.css("div.classDivFaseLinha"):
                pega = lambda c: limpar(f.css(c)[0].get_all_text()) if f.css(c) else ""
                fases.append({"data": pega(".classSpanFaseData"), "hora": pega(".classSpanFaseHora"),
                              "texto": pega(".classSpanFaseTexto")})
            if not detalhes and not fases:
                falhas += 1
                print(f"{it['nome']}: FALHOU (acompanhamento sem Detalhes nem Fases)", flush=True)
                continue
            os.makedirs(it["pasta"], exist_ok=True)
            io.open(os.path.join(it["pasta"], f"{it['nome']}.processo.json"), "w", encoding="utf-8").write(json.dumps(
                {"registro": it["num_registro"], "url": PROCESSO + it["num_registro"],
                 "lido_em": time.strftime("%Y-%m-%d"), "detalhes": detalhes, "fases": fases},
                ensure_ascii=False, indent=1))
            print(f"{it['nome']}: {len(detalhes)} detalhes, {len(fases)} fases", flush=True)
    sys.exit(1 if falhas else 0)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "buscar":
        buscar(sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 50,
               len(sys.argv) > 5 and sys.argv[5] == "retomar")
    elif cmd == "teor":
        teor(sys.argv[2])
    elif cmd == "processo":
        processo(sys.argv[2])
    else:
        print(__doc__)
        sys.exit(2)

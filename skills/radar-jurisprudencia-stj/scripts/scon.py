"""Pesquisa de jurisprudência no SCON/STJ (scon.stj.jus.br) — motor da skill radar-jurisprudencia-stj.

Não chamar direto: usar scripts/scon.js, que acha o Python do adv_env e converte o inteiro teor.

    buscar  <consultas.json> <pasta_saida> [por_pagina]
    teor    <itens.json> <pasta_saida>

O SCON fica atrás de desafio da Cloudflare; o Scrapling (StealthySession) passa como navegador
comum. Ritmo deliberadamente baixo: uma requisição a cada PAUSA segundos, numa sessão só.
"""
import io
import json
import logging
import re
import sys
import time
import urllib.parse

from scrapling.fetchers import StealthySession

logging.getLogger("scrapling").setLevel(logging.WARNING)

BASE = "https://scon.stj.jus.br/SCON/"
PAUSA = 6
TIMEOUT = 90000

ROTULOS = {
    "Processo": "processo", "Relator": "relator", "Relatora": "relator",
    "Órgão Julgador": "orgao", "Data do Julgamento": "julgamento",
    "Data da Publicação/Fonte": "publicacao", "Ementa": "ementa", "Acórdão": "acordao",
    "Notas": "notas", "Informações Complementares à Ementa": "info_compl",
    "Referência Legislativa": "ref_leg", "Jurisprudência Citada": "jurisp_citada",
}
# Campos do formulário que a consulta pode preencher além da pesquisa livre.
CAMPOS_TEXTO = ("ementa", "classe", "uf", "processo", "dtpb1", "dtpb2", "dtde1", "dtde2")


def limpar(t):
    return re.sub(r"\s+", " ", t or "").strip()


def enviar_form(c, por_pagina):
    """O SCON só aceita a busca vinda do formulário da home; GET direto em pesquisar.jsp
    volta para ela (307). `l` não existe no formulário: é injetado para vir N por página."""
    def acao(page):
        page.fill("#pesquisaLivre", c.get("livre", ""))
        # Os campos da pesquisa avançada ficam numa seção recolhida: `fill` esperaria que
        # ficassem visíveis. O valor vai direto no elemento.
        campos = {k: c[k] for k in CAMPOS_TEXTO if c.get(k)}
        page.evaluate("""([campos, l]) => {
            const f = document.getElementById('frmConsulta');
            for (const [k, v] of Object.entries(campos)) {
                const el = f.querySelector('[name="' + k + '"]');
                if (el) { el.value = v; el.dispatchEvent(new Event('change', {bubbles: true})); }
            }
            let e = f.querySelector('[name="l"]');
            if (!e) { e = document.createElement('input'); e.type = 'hidden'; e.name = 'l'; f.appendChild(e); }
            e.value = l;
        }""", [campos, str(por_pagina)])
        with page.expect_navigation(timeout=60000):
            page.focus("#pesquisaLivre")
            page.keyboard.press("Enter")
        page.wait_for_load_state("networkidle", timeout=60000)
    return acao


def extrair(page):
    total = re.search(r"([\d.]+)\s+acórdãos", page.get_all_text())
    docs = []
    for d in page.css("div.documento"):
        reg = {}
        for t in d.css(".docTitulo"):
            nome = limpar(t.get_all_text())
            irmao = t.xpath("following-sibling::*[1]")
            if nome in ROTULOS and irmao:
                reg[ROTULOS[nome]] = limpar(irmao[0].get_all_text())
        m = re.search(r"GetInteiroTeorDoAcordao\?num_registro=(\d+)&(?:amp;)?dt_publicacao=([\d/]+)",
                      d.html_content)
        if m:
            reg["num_registro"], reg["dt_publicacao"] = m.group(1), m.group(2)
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
        f.write(f"# Triagem SCON — {len(vistos)} acórdãos distintos\n\n")
        f.write("Ementa recortada em 700 caracteres. É resumo oficial, não razão de decidir: "
                "nada aqui vira citação sem o inteiro teor.\n\n")
        for k, (d, qs) in vistos.items():
            f.write(f"## {citacao_curta(d)} — {d.get('orgao', '')} — j. {d.get('julgamento', '')}"
                    f" — {d.get('publicacao', '')}\n")
            f.write(f"registro `{k}` · dt_publicacao `{d.get('dt_publicacao', '')}` · "
                    f"{d.get('relator', '')} · consultas: {', '.join(dict.fromkeys(qs))}\n\n")
            f.write(f"> {d.get('ementa', '')[:700]}\n\n")
    return len(vistos)


def buscar(arq, pasta, por_pagina=50):
    consultas = json.load(io.open(arq, encoding="utf-8"))
    resultados = []
    with StealthySession(headless=True, solve_cloudflare=True, network_idle=True) as s:
        s.fetch(BASE, timeout=TIMEOUT)
        for c in consultas:
            time.sleep(PAUSA)
            p = s.fetch(BASE, page_action=enviar_form(c, por_pagina), timeout=TIMEOUT)
            total, docs = extrair(p)
            if total == 0:
                aviso = "SECA: reformular (variantes com ou, $, operador mais frouxo)"
            elif total > len(docs):
                aviso = f"LARGA: só os {len(docs)} mais recentes vieram; estreitar"
            else:
                aviso = ""
            print(f"{c['id']}: {total} acórdãos, {len(docs)} lidos  {aviso}", flush=True)
            resultados.append({**c, "total": total, "docs": docs})
    io.open(f"{pasta}/resultados.json", "w", encoding="utf-8").write(
        json.dumps(resultados, ensure_ascii=False, indent=1))
    n = gravar_triagem(resultados, f"{pasta}/triagem.md")
    print(f"\n{n} acórdãos distintos -> {pasta}/triagem.md", flush=True)


def teor(arq, pasta):
    """O inteiro teor vem como PDF; navegar até ele só mostraria o visualizador do Chromium,
    então os bytes saem por page.request, que herda os cookies da sessão."""
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
            io.open(f"{pasta}/{it['nome']}.pdf", "wb").write(corpo)
            print(f"{it['nome']}.pdf  {len(corpo) // 1024} KB", flush=True)

    with StealthySession(headless=True, solve_cloudflare=True, network_idle=True) as s:
        s.fetch(BASE, page_action=baixar, timeout=PAUSA * 1000 * (len(itens) + 1) + 10 * TIMEOUT)
    sys.exit(1 if falhas else 0)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "buscar":
        buscar(sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 50)
    elif cmd == "teor":
        teor(sys.argv[2], sys.argv[3])
    else:
        print(__doc__)
        sys.exit(2)

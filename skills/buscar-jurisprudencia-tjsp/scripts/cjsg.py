"""Pesquisa de jurisprudência no CJSG/TJSP (esaj.tjsp.jus.br/cjsg) — motor da skill buscar-jurisprudencia-tjsp.

Não chamar direto: usar scripts/cjsg.js, que acha o Python do adv_env e converte o inteiro teor.

    buscar   <consultas.json> <pasta_saida> [retomar]
    teor     <itens.json>
    extrair  <pagina.html> [tipo]          (teste do parser, sem rede)
    periodos <consulta-json>               (teste da divisão do período, sem rede)

O formulário da consulta completa leva um token reCAPTCHA v3 invisível: POST sem ele volta
para o formulário. O token nasce sozinho num navegador comum, por isso a busca roda numa
StealthySession do Scrapling e se envia clicando em "Pesquisar". Ritmo baixo: uma requisição a
cada PAUSA segundos, numa sessão só.

Paginação: 20 por página, fixo. As páginas seguintes vêm por GET em trocaDePagina.do na
mesma sessão (o servidor guarda a consulta). Inteiro teor: getArquivo.do com
casChecked=true devolve o PDF direto; sem o parâmetro, devolve uma página que redireciona.
"""
import io
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timedelta

from scrapling.fetchers import StealthySession
from scrapling.parser import Selector

logging.getLogger("scrapling").setLevel(logging.WARNING)

RAIZ = "https://esaj.tjsp.jus.br/cjsg/"
FORM = RAIZ + "consultaCompleta.do"
PAUSA = 5
TIMEOUT = 90000
TENTATIVAS = 2
POR_PAGINA = 20
TIPOS = {"acordaos": "A", "monocraticas": "D", "homologacoes": "H"}
ORIGENS = {"2grau": "T", "recursal": "R"}

# Campo da consulta (JSON) -> name do formulário.
CAMPOS = {
    "livre": "dados.buscaInteiroTeor", "ementa": "dados.buscaEmenta",
    "processo": "dados.nuProcOrigem", "registro": "dados.nuRegistro",
    "dtj1": "dados.dtJulgamentoInicio", "dtj2": "dados.dtJulgamentoFim",
    "dtp1": "dados.dtPublicacaoInicio", "dtp2": "dados.dtPublicacaoFim",
}
ROTULOS = {
    "Classe/Assunto": "classe_assunto", "Relator(a)": "relator", "Comarca": "comarca",
    "Órgão julgador": "orgao", "Data do julgamento": "julgamento",
    "Data de publicação": "publicacao", "Data de registro": "registro_data",
}


def limpar(t):
    return re.sub(r"\s+", " ", t or "").strip()


def enviar_form(c):
    """Preenche o formulário pelo `name` (os ids do e-SAJ mudam entre versões), marca o tipo
    de decisão e a origem, espera o token do reCAPTCHA e clica em Pesquisar."""
    tipo = TIPOS.get(c.get("tipo", "acordaos"), "A")

    def acao(page):
        page.wait_for_function(
            "document.getElementById('id_recaptcha_response_token').value.length > 20", timeout=45000)
        campos = {CAMPOS[k]: c[k] for k in CAMPOS if c.get(k)}
        page.evaluate("""([campos, tipo, origem, sinonimos]) => {
            const f = document.querySelector('form[name="consultaCompletaForm"]') || document.forms[0];
            for (const [k, v] of Object.entries(campos)) {
                const el = f.querySelector('[name="' + k + '"]');
                if (el) el.value = v;
            }
            for (const el of f.querySelectorAll('[name="tipoDecisaoSelecionados"]')) el.checked = el.value === tipo;
            for (const el of f.querySelectorAll('input[type=checkbox][name="dados.origensSelecionadas"]'))
                el.checked = origem ? el.value === origem : el.checked;
            const sin = document.getElementById('checkBoxSinonimos');
            if (sin && sin.checked !== sinonimos) sin.click();
        }""", [campos, tipo, ORIGENS.get(c.get("origem", "")), c.get("sinonimos", True) is not False])
        with page.expect_navigation(timeout=60000):
            page.click("#pbSubmit")
        page.wait_for_load_state("networkidle", timeout=60000)
    return acao


RX_CITACAO = re.compile(r"\(TJSP;.*\)\s*$", re.S)


def mensagens_retorno(html):
    """Aviso de validação que o CJSG devolve no lugar do resultado (ex.: "A faixa entre data de
    inicio e data de fim deve ser de no máximo 1 ano."). Sem lê-lo, a recusa parecia SECA."""
    return [limpar(li.get_all_text()) for li in Selector(html).css("#spwTabelaMensagem #mensagemRetorno li")]


def extrair(html, tipo="A"):
    """Total da aba e linhas da página. A ementa inteira e a linha de citação oficial vêm na
    div oculta do botão "ementa sem formatação" (#textAreaDados_<cdAcordao>); o espelho
    visível corta a ementa."""
    s = Selector(html)
    total = 0
    m = re.search(r'id="totalResultadoAba(?:RetornoFiltro)?-' + tipo + r'"[^>]*value="(\d+)"', html)
    if m:
        total = int(m.group(1))
    escopo = s.css(f"#divDadosResultado-{tipo}") or [s]
    docs = []
    for tr in escopo[0].css("tr.fundocinza1"):
        link = tr.css("a.esajLinkLogin.downloadEmenta") or tr.css("a.downloadEmenta")
        if not link:
            continue
        cd = link[0].attrib.get("cdacordao", "")
        reg = {"cdacordao": cd, "cdforo": link[0].attrib.get("cdforo", "0"),
               "numero": limpar(link[0].get_all_text()), "tipo": tipo}
        for lin in tr.css("tr.ementaClass2"):
            rot = lin.css("strong")
            if not rot:
                continue
            nome = limpar(rot[0].get_all_text()).rstrip(":")
            campo = ROTULOS.get(nome)
            if campo:
                reg[campo] = limpar(lin.get_all_text())[len(limpar(rot[0].get_all_text())):].strip()
        bruto = tr.css(f"#textAreaDados_{cd}")
        if bruto:
            texto = limpar(bruto[0].get_all_text())
            cit = RX_CITACAO.search(texto)
            reg["citacao"] = cit.group(0).strip("() ") if cit else ""
            reg["ementa"] = texto[:cit.start()].strip() if cit else texto
        docs.append(reg)
    return total, docs


def gravar(resultados, pasta):
    io.open(f"{pasta}/resultados.json", "w", encoding="utf-8").write(
        json.dumps(resultados, ensure_ascii=False, indent=1))


def gravar_triagem(resultados, arq):
    vistos = {}
    for q in resultados:
        for d in q["docs"]:
            vistos.setdefault(d["cdacordao"], [d, []])[1].append(q["id"])
    with io.open(arq, "w", encoding="utf-8") as f:
        f.write(f"# Triagem CJSG/TJSP — {len(vistos)} documentos distintos\n\n")
        f.write("Ementa recortada em 700 caracteres. É resumo, não razão de decidir: "
                "nada aqui vira citação sem o inteiro teor.\n\n")
        for cd, (d, qs) in vistos.items():
            mono = " — DECISÃO MONOCRÁTICA" if d.get("tipo") == "D" else ""
            f.write(f"## {d.get('classe_assunto', '').split(' / ')[0]} {d['numero']}{mono} — "
                    f"{d.get('orgao', '')} — j. {d.get('julgamento', '')}\n")
            f.write(f"cdAcordao `{cd}` · {d.get('relator', '')} · {d.get('comarca', '')} · "
                    f"consultas: {', '.join(dict.fromkeys(qs))}\n\n")
            f.write(f"> {d.get('ementa', '')[:700]}\n\n")
    return len(vistos)


def completar_periodos(c):
    """O CJSG só aplica o período com início E fim: só com o início, devolve zero sem aviso
    (testado em 18/10/2026). Início sem fim ganha hoje como fim; fim sem início é recusado."""
    c = dict(c)
    for ini, fim in (("dtj1", "dtj2"), ("dtp1", "dtp2")):
        if c.get(fim) and not c.get(ini):
            sys.exit(f"{c['id']}: `{fim}` sem `{ini}` — o CJSG exige as duas pontas do período")
        if c.get(ini) and not c.get(fim):
            c[fim] = time.strftime("%d/%m/%Y")
    return c


def _data(s):
    return datetime.strptime(s, "%d/%m/%Y").date()


def _mais_um_ano(d):
    try:
        return d.replace(year=d.year + 1)
    except ValueError:  # 29/02
        return d.replace(year=d.year + 1, day=28)


def janelas(ini, fim):
    """Fatia [ini, fim] em janelas de até um ano. O CJSG recusa faixa maior com o aviso "A faixa
    entre data de inicio e data de fim deve ser de no máximo 1 ano" (testado em 18/10/2026:
    01/01/2026–18/10/2026 traz 876; 01/01/2025–18/10/2026 traz o aviso e zero)."""
    a, b = _data(ini), _data(fim)
    if a > b:
        sys.exit(f"período invertido: {ini} depois de {fim}")
    saida = []
    while True:
        limite = _mais_um_ano(a) - timedelta(days=1)
        if b <= limite:
            saida.append((a, b))
            return saida
        saida.append((a, limite))
        a = limite + timedelta(days=1)


def expandir_periodos(c):
    """Completa as pontas e divide o período longo em consultas de até um ano, com id
    `<id>@<n>`. A triagem junta as janelas por cdAcordao; o BUSCAS.md registra cada uma."""
    subs = [completar_periodos(c)]
    for ini, fim in (("dtj1", "dtj2"), ("dtp1", "dtp2")):
        novas = []
        for s in subs:
            js = janelas(s[ini], s[fim]) if s.get(ini) else []
            if len(js) <= 1:
                novas.append(s)
                continue
            print(f"{s['id']}: {ini} {s[ini]} a {s[fim]} dividido em {len(js)} janelas de até 1 ano "
                  "(limite do CJSG)", file=sys.stderr, flush=True)
            for n, (a, b) in enumerate(js, 1):
                novas.append({**s, "id": f"{s['id']}@{n}", ini: a.strftime("%d/%m/%Y"), fim: b.strftime("%d/%m/%Y")})
        subs = novas
    return subs


def buscar(arq, pasta, retomar=False):
    consultas = [x for c in json.load(io.open(arq, encoding="utf-8")) for x in expandir_periodos(c)]
    arq_res = f"{pasta}/resultados.json"
    anteriores = {}
    if retomar and os.path.exists(arq_res):
        anteriores = {q["id"]: q for q in json.load(io.open(arq_res, encoding="utf-8"))}
    resultados, erros = [], []
    with StealthySession(headless=True, network_idle=True) as s:
        for c in consultas:
            if c["id"] in anteriores:
                resultados.append(anteriores[c["id"]])
                print(f"{c['id']}: retomado ({anteriores[c['id']]['total']} docs já gravados)", flush=True)
                continue
            tipo = TIPOS.get(c.get("tipo", "acordaos"), "A")
            paginas = max(1, int(c.get("paginas") or 1))
            estado = {}

            def pesquisar(page, c=c, tipo=tipo, paginas=paginas, estado=estado):
                enviar_form(c)(page)
                html = page.content()
                msgs = mensagens_retorno(html)
                if msgs:
                    estado.update(total=0, docs=[], mensagens=msgs)
                    return
                total, docs = extrair(html, tipo)
                for n in range(2, paginas + 1):
                    if len(docs) >= total:
                        break
                    page.wait_for_timeout(PAUSA * 1000)
                    r = page.request.get(f"{RAIZ}trocaDePagina.do?tipoDeDecisao={tipo}&pagina={n}&conversationId=",
                                         timeout=TIMEOUT)
                    _, mais = extrair(r.text(), tipo)
                    if not mais:
                        break
                    docs.extend(mais)
                estado.update(total=total, docs=docs)

            # O Scrapling engole a exceção do page_action: sem `estado`, a consulta não rodou
            # (token do reCAPTCHA que não veio, queda de rede). Não é SECA; tenta de novo.
            for _ in range(TENTATIVAS):
                time.sleep(PAUSA)
                s.fetch(FORM, page_action=pesquisar, timeout=TIMEOUT + paginas * (PAUSA * 1000 + TIMEOUT))
                if estado:
                    break
            if not estado:
                erros.append(c["id"])
                print(f"{c['id']}: ERRO, a consulta não rodou ({TENTATIVAS} tentativas). "
                      "Fica fora do resultados.json; rodar de novo com --retomar", flush=True)
                continue
            if estado.get("mensagens"):
                erros.append(c["id"])
                print(f"{c['id']}: ERRO, o CJSG recusou a consulta: {'; '.join(estado['mensagens'])}", flush=True)
                continue
            total, docs = estado["total"], estado["docs"]
            if total == 0:
                aviso = "SECA: reformular (OU entre variantes, ? no meio da palavra, menos termos)"
            elif total > len(docs):
                aviso = f"LARGA: só os {len(docs)} mais recentes vieram; estreitar ou `paginas`"
            else:
                aviso = ""
            print(f"{c['id']}: {total} documentos, {len(docs)} lidos  {aviso}", flush=True)
            resultados.append({**c, "total": total, "docs": docs})
            gravar(resultados, pasta)  # consulta a consulta: queda não perde o feito
    gravar(resultados, pasta)
    n = gravar_triagem(resultados, f"{pasta}/triagem.md")
    print(f"\n{n} documentos distintos -> {pasta}/triagem.md", flush=True)
    if erros:
        print(f"ERRO em {len(erros)} consulta(s): {', '.join(erros)}", flush=True)
        sys.exit(1)


def teor(arq):
    """Cada item traz nome, cdacordao, cdforo e a pasta de destino. O PDF sai por
    page.request, que herda os cookies da sessão aberta no formulário."""
    itens = json.load(io.open(arq, encoding="utf-8"))
    falhas = []

    def baixar(page):
        for it in itens:
            page.wait_for_timeout(PAUSA * 1000)
            url = (f"{RAIZ}getArquivo.do?cdAcordao={it['cdacordao']}&cdForo={it.get('cdforo', '0')}"
                   "&casChecked=true")
            r = page.request.get(url, timeout=TIMEOUT)
            corpo = r.body()
            if corpo[:4] != b"%PDF":
                falhas.append(it["nome"])
                print(f"{it['nome']}: FALHOU (status {r.status}, não veio PDF)", flush=True)
                continue
            os.makedirs(it["pasta"], exist_ok=True)
            io.open(os.path.join(it["pasta"], f"{it['nome']}.pdf"), "wb").write(corpo)
            print(f"{it['nome']}.pdf  {len(corpo) // 1024} KB", flush=True)

    with StealthySession(headless=True, network_idle=True) as s:
        s.fetch(FORM, page_action=baixar, timeout=PAUSA * 1000 * (len(itens) + 1) + 10 * TIMEOUT)
    sys.exit(1 if falhas else 0)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "buscar":
        buscar(sys.argv[2], sys.argv[3], len(sys.argv) > 4 and sys.argv[4] == "retomar")
    elif cmd == "teor":
        teor(sys.argv[2])
    elif cmd == "extrair":
        html = io.open(sys.argv[2], encoding="utf-8").read()
        total, docs = extrair(html, sys.argv[3] if len(sys.argv) > 3 else "A")
        print(json.dumps({"total": total, "docs": docs, "mensagens": mensagens_retorno(html)}, ensure_ascii=False))
    elif cmd == "periodos":
        print(json.dumps(expandir_periodos(json.loads(sys.argv[2])), ensure_ascii=False))
    else:
        print(__doc__)
        sys.exit(2)

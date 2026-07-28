# -*- coding: utf-8 -*-
"""Processa o extrato de pagamentos e gera a planilha de upload + a petição de
cumprimento de sentença.

Diferenças em relação à versão legada (lições de um caso real):
- Parsing por LINHA (pdfplumber.extract_text), sem depender de coordenadas x0 de um
  layout específico.
- Filtra PROJEÇÕES FUTURAS: só considera parcelas com Dt. Receb. <= data em que o
  demonstrativo foi calculado ("Dados a pagar calculados na data: dd/mm/aaaa",
  autodetectada; pode ser forçada com --cutoff).
- Filtra ANTECIPAÇÕES de R$ 0,01 (valor pago <= 1).
- Usa a coluna "Valor da Parc." (nominal) como valor restituível — é a coluna que a
  sentença normalmente soma.
- Reconcilia com o total fixado na sentença (--total-sentenca): a diferença vira uma
  linha de ENTRADA/SINAL sinalizada para confirmação.
- Ao preencher o modelo, REMOVE os blocos de trecho não informados (ex.: embargos de
  declaração / STJ inexistentes) junto do separador "***" que os antecede.

Uso:
  python processar_extrato.py "PASTA_DO_CASO" \
      --dados '{"[NOME_EXEQUENTE]": "...", "[ÍNDICE_CORREÇÃO_MONETÁRIA]": "IGP-M", ...}' \
      --total-sentenca 26098.58
"""
import os, glob, re, json, datetime

try:
    import pdfplumber
except ImportError:
    pdfplumber = None
from docx import Document

# Placeholders de trecho que são OPCIONAIS: se não vierem em --dados, o parágrafo
# (e o separador "***" anterior) é removido do documento.
BLOCOS_OPCIONAIS = [
    "[TRECHO_ACORDAO_APELACAO]",
    "[TRECHO_ACORDAO_EMBARGOS]",
    "[TRECHO_DECISAO_STJ]",
]

DATE_RE = re.compile(r"\d{2}/\d{2}/\d{4}")
NUM_RE = re.compile(r"\d[\d.]*,\d{2}")
PARCELA_RE = re.compile(r"^([A-Za-z]{1,3})\s+(\d+/\d+)\s+(.*)$")


def _to_float(s):
    return float(s.replace(".", "").replace(",", "."))


def _texto_extrato(pdf_path):
    with pdfplumber.open(pdf_path) as pdf:
        return "\n".join((pg.extract_text() or "") for pg in pdf.pages)


def _detectar_cutoff(texto):
    m = re.search(r"calculados na data[:\s]*?(\d{2}/\d{2}/\d{4})", texto, re.IGNORECASE)
    if m:
        return datetime.datetime.strptime(m.group(1), "%d/%m/%Y").date()
    return None


def extrair_parcelas(pdf_path, cutoff):
    """Retorna lista de (descricao, dt_receb 'dd/mm/aaaa', valor_nominal)."""
    texto = _texto_extrato(pdf_path)
    if cutoff is None:
        cutoff = _detectar_cutoff(texto)
    parcelas = []
    for linha in texto.split("\n"):
        m = PARCELA_RE.match(linha.strip())
        if not m:
            continue
        tipo, num, resto = m.group(1), m.group(2), m.group(3)
        datas = DATE_RE.findall(resto)
        nums = NUM_RE.findall(resto)
        if len(datas) < 2 or len(nums) < 2:
            continue
        receb = datas[-1]               # última data da linha = Dt. Receb.
        valor_nominal = _to_float(nums[0])   # "Valor da Parc." (nominal)
        valor_pago = _to_float(nums[1])      # "Valor Parc." (pago c/ encargos)
        d = datetime.datetime.strptime(receb, "%d/%m/%Y").date()
        if valor_pago <= 1.0:                       # antecipação de R$ 0,01
            continue
        if cutoff and d > cutoff:                   # projeção futura
            continue
        parcelas.append((f"Parcela {tipo} {num}", receb, valor_nominal))
    return parcelas, cutoff


def montar_linhas(parcelas, total_sentenca):
    linhas = []
    soma = round(sum(p[2] for p in parcelas), 2)
    if total_sentenca:
        entrada = round(total_sentenca - soma, 2)
        if abs(entrada) >= 0.01:
            data_ent = parcelas[0][1] if parcelas else ""  # 1ª data conhecida
            mm_aaaa = "/".join(data_ent.split("/")[1:]) if data_ent else ""
            linhas.append({
                "descricao": "ENTRADA/SINAL (valor por diferenca - CONFIRMAR)",
                "data_correcao": mm_aaaa, "data_juros_mora": "", "valor": entrada,
            })
    for desc, receb, val in parcelas:
        partes = receb.split("/")
        linhas.append({
            "descricao": desc, "data_correcao": f"{partes[1]}/{partes[2]}",
            "data_juros_mora": "", "valor": val,
        })
    return linhas


def salvar_planilha(linhas, destino):
    cols = ["descricao", "data_correcao", "data_juros_mora", "valor"]
    try:
        from openpyxl import Workbook
        wb = Workbook(); ws = wb.active; ws.title = "Upload"
        ws.append(cols)
        for ln in linhas:
            ws.append([ln[c] for c in cols])
        wb.save(destino)
    except ImportError:
        # fallback: CSV ao lado, se openpyxl não estiver instalado
        destino = os.path.splitext(destino)[0] + ".csv"
        import csv
        with open(destino, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=cols)
            w.writeheader(); w.writerows(linhas)
    return destino


def brl(v):
    return ("R$ " + f"{v:,.2f}").replace(",", "X").replace(".", ",").replace("X", ".")


def _substituir_par(par, dados):
    txt = par.text
    novo = txt
    for ph, val in dados.items():
        if ph in novo:
            novo = novo.replace(ph, val)
    if novo != txt:
        for r in par.runs:
            r.text = ""
        if par.runs:
            par.runs[0].text = novo
        else:
            par.add_run(novo)


def preencher_modelo(modelo, destino, dados, valor_fallback):
    doc = Document(modelo)

    # 1) remove blocos opcionais não informados + separador "***" anterior
    ausentes = [b for b in BLOCOS_OPCIONAIS if not dados.get(b)]
    remover = []
    paras = doc.paragraphs
    for i, p in enumerate(paras):
        if any(b in p.text for b in ausentes):
            remover.append(p)
            if i > 0 and paras[i - 1].text.strip() == "***":
                remover.append(paras[i - 1])
    for p in remover:
        p._element.getparent().remove(p._element)

    # 2) defaults amigáveis
    dados.setdefault("[...]", "(...)")
    dados.setdefault("[VALOR_ATUALIZADO]", valor_fallback)

    # 3) substitui placeholders em parágrafos e tabelas
    for p in doc.paragraphs:
        _substituir_par(p, dados)
    for t in doc.tables:
        for row in t.rows:
            for c in row.cells:
                for p in c.paragraphs:
                    _substituir_par(p, dados)

    doc.save(destino)
    restantes = sorted(set(re.findall(r"\[[^\]]+\]", "\n".join(p.text for p in Document(destino).paragraphs))))
    return restantes


def processar_caso(pasta_caso, dados=None, total_sentenca=None, cutoff=None):
    dados = dict(dados or {})
    if pdfplumber is None:
        print("Erro: pdfplumber não instalado no ambiente. Rode: pip install pdfplumber")
        return False

    pasta_extratos = os.path.join(pasta_caso, "extrato_pagamento")
    pdfs = glob.glob(os.path.join(pasta_extratos, "*.pdf"))
    if not pdfs:
        print(f"Nenhum PDF de extrato em {pasta_extratos}")
        return False

    parcelas = []
    cut_usado = cutoff
    for pdf in pdfs:
        ps, cut_usado = extrair_parcelas(pdf, cutoff)
        parcelas.extend(ps)
    if not parcelas:
        print("Nenhuma parcela paga (após filtros) extraída.")
        return False

    soma = round(sum(p[2] for p in parcelas), 2)
    linhas = montar_linhas(parcelas, total_sentenca)
    total_planilha = round(sum(l["valor"] for l in linhas), 2)

    xls = salvar_planilha(linhas, os.path.join(pasta_caso, "Planilha_Upload_Gerada.xlsx"))

    print(f"Data de corte (cálculo do demonstrativo): {cut_usado or 'não detectada'}")
    print(f"Parcelas pagas itemizadas: {len(parcelas)} | soma itemizada: {brl(soma)}")
    if total_sentenca:
        print(f"Total fixado na sentença: {brl(total_sentenca)} | "
              f"diferença lançada como entrada: {brl(round(total_sentenca - soma, 2))}")
    print(f"Total na planilha: {brl(total_planilha)}")
    print(f"Planilha: {xls}")

    modelo = os.path.join(os.path.dirname(pasta_caso), "CUMPR_SENTENCA_MODELO.docx")
    if os.path.exists(modelo):
        destino = os.path.join(pasta_caso, "Cumprimento_Sentenca_Gerado.docx")
        restantes = preencher_modelo(modelo, destino, dados, valor_fallback=brl(total_planilha))
        print(f"Petição: {destino}")
        print(f"Placeholders remanescentes: {restantes or 'nenhum'}")
        if restantes:
            print("  -> informe-os via --dados ou preencha manualmente.")
    else:
        print(f"Aviso: modelo não encontrado em {modelo}.")
    return True


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Gera planilha + petição de cumprimento de sentença")
    parser.add_argument("pasta", help="Caminho da pasta do caso")
    parser.add_argument("--dados", default="{}", help="JSON com os placeholders do modelo")
    parser.add_argument("--total-sentenca", type=float, default=None,
                        help="Total de valores pagos fixado na sentença (para reconciliar a entrada)")
    parser.add_argument("--cutoff", default=None,
                        help="Data de corte dd/mm/aaaa (sobrepõe a autodetecção)")
    args = parser.parse_args()

    try:
        dados = json.loads(args.dados)
    except Exception as e:
        print(f"Erro ao ler --dados: {e}")
        dados = {}

    cutoff = None
    if args.cutoff:
        cutoff = datetime.datetime.strptime(args.cutoff, "%d/%m/%Y").date()

    processar_caso(args.pasta, dados, total_sentenca=args.total_sentenca, cutoff=cutoff)

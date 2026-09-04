# -*- coding: utf-8 -*-
"""
analise-perfil — motor determinístico de perfil de consumo bancário.

Dado um diretório de extratos CSV já normalizados (saída do
validador-extrato-pdf-excel), fixa o BASELINE de saídas do correntista
(excluída a janela do golpe) e isola o CLUSTER fraudulento de um dia,
com os múltiplos de divergência. Reproduzível: mesmo input -> mesmo output.

Ambiente OBRIGATÓRIO: o Python de perfil/ambiente.json (adv_env), nunca o do sistema.

Uso:
  python analise_perfil.py \
    --extratos  "<dir com *_corrigido.csv>" \
    --janela    "12/12,13/12,14/12,15/12,16/12,17/12,18/12" \
    --conta-fraude "<csv da conta de onde partiram os PIX>" \
    --dia-fraude "16/12" \
    --saida     "<dir>/analise_perfil_consumo.json"

Esquemas de CSV suportados (detecção automática):
  PAN : data,numero_operacao,tipo_operacao,descricao,valor,saldo
  BB  : data,historico,valor,tipo,lote,documento     (historico = nome do favorecido)
  BRB : data,historico,valor,tipo
"""
import argparse, csv, glob, json, os, statistics as st
from collections import defaultdict


def brl(v):
    """'1.234,56' / '5000,00' -> 1234.56 (valor absoluto)."""
    v = (v or "").strip().replace(".", "").replace(",", ".")
    try:
        return abs(float(v))
    except ValueError:
        return None


def banco(fn):
    u = fn.upper()
    if "PAN" in u:    return "PAN"
    if "BRASIL" in u: return "BB"
    if "BRB" in u:    return "BRB"
    return os.path.splitext(os.path.basename(fn))[0]


def ler(path):
    """-> lista de dicts {data, direcao(OUT|IN), valor, descricao}."""
    rows = None
    for enc in ("utf-8-sig", "latin-1"):
        try:
            with open(path, encoding=enc, newline="") as f:
                rows = list(csv.DictReader(f))
            break
        except (UnicodeDecodeError, UnicodeError):
            continue
    out = []
    for r in rows or []:
        r = {(k or "").strip(): (v or "").strip() for k, v in r.items()}
        data = (r.get("data") or "")[:5]
        if "tipo_operacao" in r:                       # PAN
            t = r.get("tipo_operacao", "").upper()
            desc = r.get("descricao", "")
            direc = "OUT" if t.startswith("DEBITO") else "IN"
        elif "historico" in r:                         # BB / BRB
            desc = r.get("historico", "")
            if desc.lower().startswith("saldo anterior"):
                continue
            direc = "OUT" if r.get("tipo", "") == "-" else "IN"
        else:
            continue
        val = brl(r.get("valor"))
        if val is None:
            continue
        out.append({"data": data, "direcao": direc,
                    "valor": val, "descricao": desc.upper(),
                    "saldo": brl(r.get("saldo"))})
    return out


def e_consumo(desc):
    """Exclui linhas técnicas que não exprimem consumo."""
    return not any(x in desc for x in (
        "RENDIMENTO SALDO", "RECOMPRA CDB", "JUROS LIQUIDO",
        "DEVOLU", "SALDO ANTERIOR"))


def resumo(vals):
    vals = sorted(vals)
    n = len(vals)
    return {"n": n,
            "mediana": round(st.median(vals), 2),
            "media": round(st.mean(vals), 2),
            "p95": round(vals[min(int(n * 0.95), n - 1)], 2),
            "max": round(max(vals), 2)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--extratos", required=True)
    ap.add_argument("--janela", required=True,
                    help="datas DD/MM da janela do golpe, separadas por vírgula")
    ap.add_argument("--conta-fraude", required=True,
                    help="CSV da conta de onde partiram os PIX fraudulentos")
    ap.add_argument("--dia-fraude", required=True, help="DD/MM do cluster")
    ap.add_argument("--ordem", default="auto",
                    choices=["auto", "file", "reverse"],
                    help="ordenação cronológica do cluster")
    ap.add_argument("--saida", required=True)
    a = ap.parse_args()

    janela = {d.strip() for d in a.janela.split(",") if d.strip()}
    arquivos = sorted(glob.glob(os.path.join(a.extratos, "*.csv")))

    # ---- Baseline (saídas habituais, fora da janela do golpe) ----
    saidas, saidas_pix = defaultdict(list), defaultdict(list)
    for p in arquivos:
        b = banco(p)
        for ln in ler(p):
            if ln["direcao"] != "OUT" or not e_consumo(ln["descricao"]):
                continue
            if ln["data"] in janela:
                continue
            saidas[b].append(ln["valor"])
            d = ln["descricao"]
            if "PIX" in d or "TRANSFER" in d or "/" in d:
                saidas_pix[b].append(ln["valor"])

    baseline = {b: resumo(v) for b, v in saidas.items() if v}
    baseline_pix = {b: resumo(v) for b, v in saidas_pix.items() if v}

    # ---- Cluster do dia da fraude ----
    linhas = ler(a.conta_fraude)
    dia = [l for l in linhas if l["data"] == a.dia_fraude]

    def consistencia_saldo(seq):
        """Quantos elos saldo[i] ≈ saldo[i-1] ± valor batem (verdade factual)."""
        ok = 0
        for prev, cur in zip(seq, seq[1:]):
            if prev["saldo"] is None or cur["saldo"] is None:
                return -1                      # sem coluna saldo: indecidível
            sinal = -1 if cur["direcao"] == "OUT" else 1
            if abs((prev["saldo"] + sinal * cur["valor"]) - cur["saldo"]) <= 0.01:
                ok += 1
        return ok

    ordem = a.ordem
    if ordem == "auto":
        cf, cr = consistencia_saldo(dia), consistencia_saldo(list(reversed(dia)))
        if cf < 0:                             # sem saldo: cai p/ heurística de data
            datas = [l["data"] for l in linhas if l["data"]]
            ordem = "reverse" if datas and datas[0] > datas[-1] else "file"
        else:
            ordem = "reverse" if cr > cf else "file"
    cluster = list(reversed(dia)) if ordem == "reverse" else dia

    pix_fraude = [c for c in cluster
                  if c["direcao"] == "OUT" and "PIX ENVIADO" in c["descricao"]]
    total = round(sum(c["valor"] for c in pix_fraude), 2)

    # ---- Múltiplos de divergência (PIX fraudulento vs PIX habitual da conta) ----
    bf = banco(a.conta_fraude)
    base = baseline_pix.get(bf) or baseline.get(bf) or {}
    med, p95 = base.get("mediana"), base.get("p95")
    divergencia = []
    for c in pix_fraude:
        divergencia.append({
            "valor": c["valor"],
            "x_mediana": round(c["valor"] / med, 1) if med else None,
            "x_p95": round(c["valor"] / p95, 1) if p95 else None,
        })

    result = {
        "parametros": {"janela": sorted(janela),
                       "conta_fraude": os.path.basename(a.conta_fraude),
                       "dia_fraude": a.dia_fraude, "ordem": ordem},
        "baseline_saidas_por_banco": baseline,
        "baseline_pix_enviados_por_banco": baseline_pix,
        "cluster_dia_fraude": cluster,
        "pix_fraudulentos": pix_fraude,
        "total_desviado_pix": total,
        "divergencia_vs_habitual": divergencia,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    with open(a.saida, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()

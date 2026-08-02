#!/usr/bin/env python
"""lint-kb.py - checagem deterministica de saude de uma KB de canal (camada de consumo).

Adaptado do lint.py do cole-medin-knowledge-base. Sem dependencias (stdlib).

Uso (da raiz da KB, ou passando a raiz):
    python lint-kb.py                # usa o diretorio corrente
    python lint-kb.py D:/GITHUB/kb-youtube/canal
    python lint-kb.py --quiet

Checa:
  E1  todo .md nao-reservado tem frontmatter com `type` nao vazio
  E2  todo link markdown relativo resolve para arquivo/pasta da KB
  E3  toda pagina de concepts/entities/sources aparece em algum index.md
  E4  paridade sources/<slug>.md <-> raw/<slug>.md
  E5  citacao legal (sumula/REsp/art./tema) em concepts/ ou sources/ sem ancora na
      transcricao em raw/ — anti-invencao; sao isentas as linhas de blockquote (>) e as
      secoes cujo titulo contem "curadoria" (conhecimento externo rotulado) ou
      "verifica" (citacao ja conferida em fonte oficial, registrada na secao)
  E6  vocabulo pt-PT em pagina (fora de raw/) — legenda contaminada vazou para a prosa
  E7  placeholder "0:XX" em pagina
  W1  paginas orfas (sem link de entrada vindo de pagina de conteudo)
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

args = [a for a in sys.argv[1:] if not a.startswith("--")]
ROOT = Path(args[0]).resolve() if args else Path.cwd().resolve()
RESERVED = {"index.md", "log.md"}

LINK_RE = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
TYPE_RE = re.compile(r"^type:\s*(.+?)\s*$", re.MULTILINE)
FENCE_RE = re.compile(r"```.*?```", re.DOTALL)
INLINE_CODE_RE = re.compile(r"`[^`]*`")


def strip_code(text: str) -> str:
    return INLINE_CODE_RE.sub("", FENCE_RE.sub("", text))


errors: list[str] = []
warnings: list[str] = []


def md_files() -> list[Path]:
    return [p for p in ROOT.rglob("*.md") if ".git" not in p.parts]


def frontmatter(text: str) -> str | None:
    if not text.startswith("---"):
        return None
    end = text.find("\n---", 3)
    return text[3:end] if end != -1 else None


def get_type(text: str) -> str | None:
    fm = frontmatter(text)
    if fm is None:
        return None
    m = TYPE_RE.search(fm)
    return m.group(1).strip().strip('"').strip("'") if m else None


def check_types(files: list[Path]) -> None:
    for p in files:
        if p.name in RESERVED:
            continue
        t = get_type(p.read_text(encoding="utf-8"))
        if not t:
            errors.append(f"E1 frontmatter sem `type`: {p.relative_to(ROOT)}")


def check_links(files: list[Path]) -> dict[Path, set[Path]]:
    inbound: dict[Path, set[Path]] = {}
    for p in files:
        text = strip_code(p.read_text(encoding="utf-8"))
        for raw in LINK_RE.findall(text):
            link = raw.split()[0]
            if link.startswith(("http://", "https://", "mailto:", "#")):
                continue
            target = link.split("#", 1)[0]
            if not target:
                continue
            dest = (p.parent / target).resolve()
            if not dest.exists():
                errors.append(f"E2 link quebrado `{link}` em {p.relative_to(ROOT)}")
                continue
            if dest.suffix == ".md":
                inbound.setdefault(dest, set()).add(p)
    return inbound


def dir_index_targets(index: Path) -> set[Path]:
    if not index.exists():
        return set()
    targets: set[Path] = set()
    for raw in LINK_RE.findall(index.read_text(encoding="utf-8")):
        link = raw.split()[0].split("#", 1)[0]
        if link.startswith(("http://", "https://", "mailto:")) or not link:
            continue
        targets.add((index.parent / link).resolve())
    return targets


def check_index_coverage() -> None:
    groups = {
        "concepts": list((ROOT / "concepts").glob("*.md")),
        "entities": list((ROOT / "entities").rglob("*.md")),
        "sources": list((ROOT / "sources").glob("*.md")),
    }
    all_index_targets: set[Path] = set()
    for idx in ROOT.rglob("index.md"):
        all_index_targets |= dir_index_targets(idx)
    for _group, files in groups.items():
        for p in files:
            if p.name in RESERVED:
                continue
            if p.resolve() not in all_index_targets:
                errors.append(f"E3 fora de qualquer index.md: {p.relative_to(ROOT)}")


def check_source_raw_parity() -> None:
    src = {p.stem for p in (ROOT / "sources").glob("*.md") if p.name not in RESERVED}
    raw = {p.stem for p in (ROOT / "raw").glob("*.md") if p.name not in RESERVED}
    for slug in sorted(src - raw):
        errors.append(f"E4 sources/{slug}.md sem raw/{slug}.md correspondente")
    for slug in sorted(raw - src):
        warnings.append(f"E4 raw/{slug}.md ainda nao ingerido (sem sources/{slug}.md)")


CITE_RES = [
    ("Sumula", re.compile(r"s[úu]mula\s*(?:n[ºo°.]*\s*)?(\d+)", re.IGNORECASE)),
    ("REsp", re.compile(r"\ba?resp\s*(?:n[ºo°.]*\s*)?([\d][\d.\s]{4,}\d)", re.IGNORECASE)),
    ("Tema", re.compile(r"\btema\s*(?:n[ºo°.]*\s*)?(\d{3,4})\b", re.IGNORECASE)),
    ("art.", re.compile(r"\bart(?:igo)?s?\.?\s*(\d+(?:\.\d+)*(?:\s*-\s*[A-Za-z])?)", re.IGNORECASE)),
]

PTPT_RE = re.compile(
    r"\b(aceder|acede[mr]?|comprovativos?|contabilisticamente|c[êe]ntimos?|bili[ãa]o|"
    r"bili[õo]es|utilizador(?:es)?|telem[óo]vel|ecr[ãa]|registos?|connosco|ficheiros?|"
    r"gui[ãa]o|casa de banho|autocarro)\b",
    re.IGNORECASE,
)


CONFERIDAS_RE = re.compile(
    r"^citacoes_conferidas:\s*$(.*?)(?=^\S|\Z)", re.MULTILINE | re.DOTALL
)


def norm_token(s: str) -> str:
    return re.sub(r"[^0-9a-z]", "", s.lower())


def conferidas(p: Path) -> set[str]:
    """Numeros declarados em `citacoes_conferidas:` no frontmatter.

    Declarar ali e um ato deliberado: significa que a fonte oficial foi lida e esta
    registrada na propria pagina (secao de verificacao). Isenta o numero do E5.
    """
    fm = frontmatter(p.read_text(encoding="utf-8"))
    if not fm:
        return set()
    m = CONFERIDAS_RE.search(fm)
    if not m:
        return set()
    out: set[str] = set()
    for line in m.group(1).splitlines():
        line = line.strip()
        if not line.startswith("-"):
            continue
        for num in re.findall(r"\d[\d.\s]*\d|\d", line.lstrip("- ").strip()):
            tok = norm_token(num)
            if tok:
                out.add(tok)
    return out


def raw_corpus_norm() -> str:
    parts = []
    for p in (ROOT / "raw").glob("*.md"):
        parts.append(p.read_text(encoding="utf-8").lower())
    return re.sub(r"[^0-9a-zçáàâãéêíóôõúü]", "", "".join(parts))


def content_lines(p: Path):
    """Linhas auditaveis pelo E5.

    Isentas: fence, blockquote (`>`) e secao cujo titulo contenha 'curadoria'
    (conhecimento externo rotulado) ou 'verifica' (citacao conferida em fonte oficial,
    com a fonte registrada na propria secao).
    """
    in_fence = False
    in_isento = False
    for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), start=1):
        stripped = line.strip()
        if stripped.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        if stripped.startswith("#"):
            low = stripped.lower()
            in_isento = "curadoria" in low or "verifica" in low
            continue
        if in_isento or stripped.startswith(">"):
            continue
        yield i, INLINE_CODE_RE.sub("", line)


def check_content() -> None:
    corpus = raw_corpus_norm()
    e5_pages = list((ROOT / "concepts").glob("*.md")) + list((ROOT / "sources").glob("*.md"))
    all_pages = [
        p for p in md_files()
        if (ROOT / "raw") not in p.parents and p.name != "log.md"
    ]
    for p in all_pages:
        audit_e5 = p in e5_pages
        ok_nums = conferidas(p) if audit_e5 else set()
        for n, line in content_lines(p):
            if audit_e5:
                for label, rx in CITE_RES:
                    for m in rx.finditer(line):
                        num = norm_token(m.group(1))
                        if not num or num in ok_nums:
                            continue
                        prefix = {"Sumula": "s[úu]?mula", "REsp": "resp|recursoespecial",
                                  "Tema": "tema", "art.": "art[a-z]{0,6}"}[label]
                        if not re.search(rf"(?:{prefix})[0-9a-zçáàâãéêíóôõúü]{{0,20}}?{num}", corpus):
                            errors.append(
                                f"E5 {label} {m.group(1).strip()} sem ancora no raw/: "
                                f"{p.relative_to(ROOT)}:{n} (rotular como nota de curadoria, "
                                f"declarar em `citacoes_conferidas:` se o inteiro teor foi lido, ou remover)"
                            )
            for m in PTPT_RE.finditer(line):
                errors.append(f"E6 vocabulo pt-PT `{m.group(0)}`: {p.relative_to(ROOT)}:{n}")
            if "0:XX" in line:
                errors.append(f"E7 placeholder `0:XX`: {p.relative_to(ROOT)}:{n}")


def check_orphans(inbound: dict[Path, set[Path]]) -> None:
    pages = list((ROOT / "concepts").glob("*.md")) + list((ROOT / "entities").rglob("*.md"))
    for p in pages:
        if p.name in RESERVED:
            continue
        srcs = {s for s in inbound.get(p.resolve(), set()) if s.name != "index.md"}
        if not srcs:
            warnings.append(f"W1 orfa (nenhum link de entrada de pagina de conteudo): {p.relative_to(ROOT)}")


def main() -> int:
    quiet = "--quiet" in sys.argv
    files = md_files()
    check_types(files)
    inbound = check_links(files)
    check_index_coverage()
    check_source_raw_parity()
    check_content()
    check_orphans(inbound)

    if not quiet:
        print(f"Varridos {len(files)} arquivos markdown em {ROOT}")
    for w in warnings:
        print(f"  WARN  {w}")
    for e in errors:
        print(f"  ERRO  {e}")
    print(f"\n{len(errors)} erro(s), {len(warnings)} aviso(s).")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())

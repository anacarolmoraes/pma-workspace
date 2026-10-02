'use strict';
// cliente-djen — descobre QUEM é o cliente numa comunicação do DJEN.
//
// A API não diz de que lado o escritório está: `destinatarios` lista todas as
// partes intimadas. Mas o cabeçalho do `texto` traz, para cada parte, os seus
// advogados — e o escritório sabe as próprias OABs (perfil/advogados.json). A
// parte cujo bloco de advogados contém uma OAB nossa é o cliente.
//
//   AUTOR : FULANO DE TAL ADVOGADO(A) : ANA ... (OAB TO006573) RÉU : EMPRESA LTDA ADVOGADO(A) : ...
//
// Sem `texto` (ou sem OAB nossa no cabeçalho) cai para a lista de destinatários,
// marcada com `?` para a titular conferir. Nunca inventa: devolve '' se não houver nada.

const PAPEIS =
  '(?:AUTOR(?:A)?|R[ÉE]U?|R[ÉE]|REQUERENTE|REQUERIDO(?:A)?|APELANTE|APELADO(?:A)?|AGRAVANTE|AGRAVADO(?:A)?|' +
  'EXEQUENTE|EXECUTADO(?:A)?|EMBARGANTE|EMBARGADO(?:A)?|RECORRENTE|RECORRIDO(?:A)?|IMPETRANTE|IMPETRADO(?:A)?|' +
  'RECLAMANTE|RECLAMADO(?:A)?|INTERESSADO(?:A)?|TERCEIRO(?: INTERESSADO)?|LITISCONSORTE|ASSISTENTE|' +
  'PARTE AUTORA|PARTE R[ÉE]|QUERELANTE|QUERELADO(?:A)?|DENUNCIADO(?:A)?|V[ÍI]TIMA|CREDOR(?:A)?|DEVEDOR(?:A)?|' +
  'PROMOVENTE|PROMOVIDO(?:A)?|DEMANDANTE|DEMANDADO(?:A)?|SUSCITANTE|SUSCITADO(?:A)?)';
const RX_BLOCO = new RegExp(`\\b(${PAPEIS})\\s*:\\s*(.+?)(?=\\s+(?:${PAPEIS})\\s*:|\\s+(?:MP|MINIST[ÉE]RIO P[ÚU]BLICO)\\b|\\s+(?:DESPACHO|DECIS[ÃA]O|SENTEN[ÇC]A|ACÓRD[ÃA]O|ACORD[ÃA]O|EMENTA|RELAT[ÓO]RIO|VISTOS)\\b|$)`, 'gi');
const RX_ADV = /\s*ADVOGADO\(A\)\s*:/i;

const ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', ccedil: 'ç', Ccedil: 'Ç', atilde: 'ã', Atilde: 'Ã', otilde: 'õ', Otilde: 'Õ', aacute: 'á', Aacute: 'Á', eacute: 'é', Eacute: 'É', iacute: 'í', Iacute: 'Í', oacute: 'ó', Oacute: 'Ó', uacute: 'ú', Uacute: 'Ú', acirc: 'â', Acirc: 'Â', ecirc: 'ê', Ecirc: 'Ê', ocirc: 'ô', Ocirc: 'Ô', agrave: 'à', Agrave: 'À', ordm: 'º', ordf: 'ª' };

function limparHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&([a-zA-Z]+);/g, (m, e) => ENT[e] ?? m)
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

// Normaliza "TO006573" / "TO 6573" / "6573" para comparar só os dígitos sem zeros à esquerda.
const oabKey = (uf, numero) => `${String(uf || '').toUpperCase()}:${String(numero || '').replace(/\D/g, '').replace(/^0+/, '')}`;

function partesDoCabecalho(texto, oabs) {
  const cab = limparHtml(texto).slice(0, 6000);
  const nossas = new Set(oabs.map((o) => oabKey(o.uf, o.numero)));
  const partes = [];
  for (const m of cab.matchAll(RX_BLOCO)) {
    const papel = m[1].toUpperCase();
    const [nomeBruto, ...advs] = m[2].split(RX_ADV);
    const nome = nomeBruto.replace(/\s*\((AUTOR|R[ÉE]U|APELANTE|APELADO|AGRAVANTE|AGRAVADO)[^)]*\)\s*$/i, '').trim();
    if (!nome || nome.length > 120) continue;
    const nosso = advs.some((a) => {
      const o = /\(OAB\s*([A-Z]{2})\s*0*(\d+)/i.exec(a);
      return o && nossas.has(oabKey(o[1], o[2]));
    });
    partes.push({ papel, nome, nosso });
  }
  return partes;
}

// → { cliente: 'NOME [e NOME]', papel: 'AUTOR', confiavel: true } ou, sem OAB nossa no
//   cabeçalho, { cliente: 'A; B', papel: '', confiavel: false } a partir dos destinatários.
function identificarCliente(item, oabs) {
  const partes = partesDoCabecalho(item.texto, oabs || []);
  const nossas = partes.filter((p) => p.nosso);
  if (nossas.length) {
    const nomes = [...new Set(nossas.map((p) => p.nome))];
    return { cliente: nomes.join(' e '), papel: nossas[0].papel, confiavel: true };
  }
  const dest = (item.destinatarios || []).map((d) => d.nome).filter(Boolean);
  if (dest.length) return { cliente: dest.join('; '), papel: '', confiavel: false };
  return { cliente: '', papel: '', confiavel: false };
}

// Forma curta para a fila: "FULANO DE TAL" ou "A; B ?" quando não se sabe o lado.
function rotuloCliente(info) {
  if (!info || !info.cliente) return '?';
  return info.confiavel ? info.cliente : `${info.cliente} ?`;
}

module.exports = { identificarCliente, partesDoCabecalho, rotuloCliente, limparHtml };

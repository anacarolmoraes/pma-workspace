#!/usr/bin/env python3
"""
Parser PDF Module - Extrai dados estruturados do texto do PDF
Suporta extração tanto de texto quanto de tabelas
"""
import re
import pandas as pd
from typing import List, Dict, Tuple, Optional, Any


# Padrões regex para cada banco
PADROES_BRB = {
    'data': r'^(\d{2}/\d{2}/\d{4})',
    'valor': r'(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*\(([+-])\)$',
}

PADROES_PAN = {
    'data': r'^(\d{2}/\d{2}/\d{4})',
    'operacao': r'^(\d+)\s+(.+?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})$',
}

PADROES_BB = {
    'linha_completa': r'^(\d{2}/\d{2}/\d{4})\s+(\d+)\s+(\d+)\s+(.+?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*\(([+-])\)$',
}


def _limpar_linha(linha: str) -> str:
    """Remove espaços extras e caracteres de controle."""
    linha = re.sub(r'\s+', ' ', linha)
    return linha.strip()


def _normalizar_valor(valor_str: str) -> str:
    """Normaliza string de valor para formato padrão."""
    if not valor_str:
        return ''
    
    # Remove R$ e espaços
    valor_str = str(valor_str).replace('R$', '').replace('r$', '').strip()
    
    # Normaliza: 1.234,56 -> 1234,56
    valor_str = valor_str.replace('.', '')
    valor_str = valor_str.replace(',', '.')
    
    try:
        return f"{float(valor_str):.2f}"
    except:
        return valor_str


def _eh_cabecalho(linha: str) -> bool:
    """Verifica se a linha é um cabeçalho."""
    padroes_cabecalho = [
        r'^data\s+lote\s+documento',
        r'^dia\s+lote\s+documento',
        r'^n\.º\s+operação',
        r'^tipo\s+operação',
        r'^saldo\s+anterior',
        r'^extrato\s+de\s+conta',
        r'^cliente\s+',
        r'^período\s+',
        r'^dia\s*$',
        r'^histórico\s*$',
        r'^valor\s*$',
    ]
    
    linha_lower = linha.lower()
    for padrao in padroes_cabecalho:
        if re.search(padrao, linha_lower):
            return True
    
    return False


def _eh_linha_valor(linha: str) -> bool:
    """Verifica se a linha parece ter um valor monetário."""
    return bool(re.search(r'\d{1,3}(?:\.\d{3})*,\d{2}', linha))


def parse_pdf_brb(texto: str) -> List[Dict[str, Any]]:
    """
    Parser específico para extratos BRB.
    Suporta múltiplos formatos:
    - DD/MM historico R$ +valor ou R$ -valor
    - Linha de historico na linha anterior à data
    
    Args:
        texto: Texto completo do PDF
        
    Returns:
        Lista de dicionários com dados extraídos
    """
    linhas = texto.split('\n')
    registros = []
    historico_anterior = ""
    
    for i, linha in enumerate(linhas):
        linha = _limpar_linha(linha)
        
        if not linha:
            continue
        
        # Pula cabeçalhos
        if _eh_cabecalho(linha):
            historico_anterior = ""
            continue
        
        # Pula linhas de saldo final
        if linha.startswith('Saldo'):
            continue
        
        # Formato: DEBITO PIX, CREDITO, etc - guarda para próxima linha
        if linha.startswith('DEBITO') or linha.startswith('CRED') or linha.startswith('TRANSF'):
            historico_anterior = linha
            continue
        
        # Tenta extrair data no formato DD/MM
        match_data = re.match(r'^(\d{2}/\d{2})\s+(.+)$', linha)
        
        if match_data:
            data = match_data.group(1)
            resto = match_data.group(2)
            
            # Procura por valor monetário no resto da linha
            # Formato: R$ +1.234,56 ou R$ -1.234,56 ou R$ 1.234,56
            # Primeiro acha onde começa o número
            valor_match = re.search(r'(\d{1,3}(?:\.\d{3})*,\d{2})', resto)
            
            if valor_match:
                valor_str = valor_match.group(1)
                valor_pos = valor_match.start()
                
                # Determina sinal pelo que vem antes do valor
                prefixo = resto[max(0, valor_pos-3):valor_pos]
                if '−' in prefixo or '-' in prefixo:
                    sinal = '-'
                elif '+' in prefixo:
                    sinal = '+'
                else:
                    sinal = '+'
                
                # O historico é o que sobra - remove R$ e sinal e tudo depois do valor
                historico = resto[:valor_pos].strip()
                historico = re.sub(r'R\$\s*[−\-]?\s*\+?\s*$', '', historico).strip()
                
                # Also check for the case where there's text after the value
                after_value = resto[valor_match.end():].strip()
                if after_value:
                    # There might be R$ at the start, remove it
                    historico = re.sub(r'R\$\s*[−\-]?\s*\+?\s*', '', historico).strip()
                
                if not historico and historico_anterior:
                    historico = historico_anterior
                
                try:
                    valor = float(valor_str.replace('.', '').replace(',', '.'))
                    if sinal == '-':
                        valor = -valor
                    
                    registros.append({
                        'data': data,
                        'historico': historico[:100] if historico else "",
                        'valor': f"{abs(valor):.2f}".replace('.', ','),
                        'tipo': '+' if valor >= 0 else '-',
                        'linha_original': linha,
                    })
                except:
                    pass
            
            historico_anterior = ""
        else:
            # Guarda linha como histórico para próximas linhas de data
            if len(linha) > 5 and not linha.startswith('R$'):
                historico_anterior = linha
    
    return registros


def parse_pdf_pan(texto: str) -> List[Dict[str, Any]]:
    """
    Parser específico para extratos Banco PAN.
    Suporta formato:
    - Tipo (DEBITO/CREDITO PIX) na linha anterior OU mesma linha
    - DD/MM nro descricao - R$ valor R$ saldo
    
    Args:
        texto: Texto completo do PDF
        
    Returns:
        Lista de dicionários com dados extraídos
    """
    linhas = texto.split('\n')
    registros = []
    tipo_anterior = ""
    
    for i, linha in enumerate(linhas):
        linha = _limpar_linha(linha)
        
        if not linha:
            continue
        
        # Pula cabeçalhos
        if _eh_cabecalho(linha):
            continue
        
        # Pula linhas de saldo/totais no início
        if linha.startswith('Olá') or linha.startswith('Esse') or linha.startswith('Período'):
            continue
        if linha.startswith('Saldo') or linha.startswith('Entrou') or linha.startswith('Saiu'):
            continue
        if linha.startswith('Pagamentos') or linha.startswith('Transferências'):
            continue
        if linha.startswith('Saques') or linha.startswith('Total'):
            continue
        if 'Suas movimentações' in linha or 'Julho' in linha or 'Setembro' in linha:
            continue
        if 'Suas moviment' in linha:
            continue
        if 'Agência' in linha or 'Conta' in linha:
            continue
        if 'Extrato de' in linha:
            continue
        if 'Extrato emitido' in linha:
            continue
        
        # Detecta tipo (DEBITO ou CREDITO) - pode estar em linha separada
        if linha.startswith('DEBITO') or linha.startswith('CREDITO'):
            tipo_anterior = linha
            continue
        
        # Tenta extrair data no formato DD/MM
        match_data = re.match(r'^(\d{2}/\d{2})\s+(.+)$', linha)
        
        if match_data:
            data = match_data.group(1)
            resto = match_data.group(2)
            
            # Simple approach: find all money values in the line
            valores = re.findall(r'(\d{1,3}(?:\.\d{3})*,\d{2})', resto)
            
            if len(valores) >= 2:
                valor_str = valores[0]
                saldo_str = valores[1]
                
                # Determine tipo from the sign
                tipo = 'DEBITO'
                if '+' in resto:
                    tipo = 'CREDITO PIX'
                elif tipo_anterior.startswith('CREDITO'):
                    tipo = 'CREDITO PIX'
                
                # Descricao is everything before the first value
                first_val_pos = resto.find(valor_str)
                descricao = resto[:first_val_pos].strip()
                descricao = re.sub(r'-\s*R\$\s*$', '', descricao).strip()
                descricao = re.sub(r'\+\s*R\$\s*$', '', descricao).strip()
                
                try:
                    valor = float(valor_str.replace('.', '').replace(',', '.'))
                    saldo = float(saldo_str.replace('.', '').replace(',', '.'))
                    
                    registros.append({
                        'data': data,
                        'numero_operacao': '',
                        'tipo_operacao': tipo,
                        'descricao': descricao[:80],
                        'valor': f"{abs(valor):.2f}".replace('.', ','),
                        'saldo': f"{abs(saldo):.2f}".replace('.', ','),
                        'linha_original': linha,
                    })
                except:
                    pass
            
            tipo_anterior = ""
        else:
            if linha.startswith('DEBITO') or linha.startswith('CREDITO'):
                tipo_anterior = linha
    
    return registros


def parse_pdf_bb(texto: str) -> List[Dict[str, Any]]:
    """
    Parser específico para extratos Banco do Brasil.
    
    Args:
        texto: Texto completo do PDF
        
    Returns:
        Lista de dicionários com dados extraídos
    """
    linhas = texto.split('\n')
    registros = []
    
    for linha in linhas:
        linha = _limpar_linha(linha)
        
        if not linha or _eh_cabecalho(linha):
            continue
        
        # Formato: DD/MM/YYYY Lote Documento Histórico Valor (+/-)
        match = re.search(
            r'^(\d{2}/\d{2}/\d{4})\s+(\d+)\s+(\d+)\s+(.+?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*\(([+-])\)$',
            linha
        )
        
        if match:
            data = match.group(1)
            lote = match.group(2)
            documento = match.group(3)
            historico = match.group(4).strip()
            valor_str = match.group(5).replace('.', '').replace(',', '.')
            sinal = match.group(6)
            
            try:
                valor = float(valor_str)
                if sinal == '-':
                    valor = -valor
                
                registros.append({
                    'data': data,
                    'lote': lote,
                    'documento': documento,
                    'historico': historico,
                    'valor': f"{abs(valor):.2f}".replace('.', ','),
                    'tipo': sinal,
                    'linha_original': linha,
                })
            except:
                pass
        else:
            # Tenta formato alternativo (saldo anterior)
            match2 = re.search(r'^(\d{2}/\d{2}/\d{4})\s+Saldo Anterior\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*\(([+])\)$', linha)
            if match2:
                data = match2.group(1)
                valor_str = match2.group(2).replace('.', '').replace(',', '.')
                
                try:
                    valor = float(valor_str)
                    registros.append({
                        'data': data,
                        'historico': 'Saldo Anterior',
                        'valor': f"{valor:.2f}".replace('.', ','),
                        'tipo': '+',
                        'linha_original': linha,
                    })
                except:
                    pass
    
    return registros


def parse_pdf(texto: str, banco: str) -> List[Dict[str, Any]]:
    """
    Parser genérico que direciona para o parser específico.
    
    Args:
        texto: Texto completo do PDF
        banco: Nome do banco (BRB, BANCO_PAN, BANCO_DO_BRASIL)
        
    Returns:
        Lista de dicionários com dados extraídos
    """
    banco_upper = banco.upper()
    
    if 'BRB' in banco_upper:
        return parse_pdf_brb(texto)
    elif 'PAN' in banco_upper:
        return parse_pdf_pan(texto)
    elif 'BRASIL' in banco_upper:
        return parse_pdf_bb(texto)
    else:
        # Tenta todos os parsers e retorna o que tiver mais resultados
        resultados = [
            ('BRB', parse_pdf_brb(texto)),
            ('PAN', parse_pdf_pan(texto)),
            ('BB', parse_pdf_bb(texto)),
        ]
        
        # Retorna o parser que encontrou mais registros
        resultados.sort(key=lambda x: len(x[1]), reverse=True)
        return resultados[0][1] if resultados else []


def extrair_todas_linhas_pdf(texto: str) -> List[str]:
    """
    Extrai todas as linhas do PDF, limpando e filtrando.
    
    Args:
        texto: Texto completo do PDF
        
    Returns:
        Lista de linhas limpas
    """
    linhas = texto.split('\n')
    linhas_limpas = []
    
    for linha in linhas:
        linha = _limpar_linha(linha)
        
        # Pula linhas vazias e cabeçalhos
        if linha and not _eh_cabecalho(linha) and len(linha) > 5:
            linhas_limpas.append(linha)
    
    return linhas_limpas


def criar_dataframe_pdf(registros: List[Dict[str, Any]]) -> pd.DataFrame:
    """
    Cria um DataFrame a partir dos registros extraídos do PDF.
    
    Args:
        registros: Lista de dicionários com dados
        
    Returns:
        DataFrame padronizado
    """
    if not registros:
        return pd.DataFrame()
    
    df = pd.DataFrame(registros)
    
    # Remove a coluna linha_original (era apenas para debug)
    if 'linha_original' in df.columns:
        df = df.drop(columns=['linha_original'])
    
    return df


def parse_tabelas_pdf(tabelas: List[pd.DataFrame], banco: str) -> List[Dict[str, Any]]:
    """
    Extrai registros das tabelas do PDF (para PDFs onde extração direta falha).
    
    Args:
        tabelas: Lista de DataFrames extraídos do PDF
        banco: Nome do banco
        
    Returns:
        Lista de dicionários com dados extraídos
    """
    registros = []
    
    for tabela_df in tabelas:
        if tabela_df.empty:
            continue
        
        # Mapeia colunas por índice em vez de nome
        # Assume ordem típica: data, historico, valor
        colunas = list(tabela_df.columns)
        
        # Itera pelas linhas da tabela
        for idx, row in tabela_df.iterrows():
            # Converte a linha em lista de valores
            valores = [v for v in row.values if pd.notna(v)]
            
            if not valores:
                continue
            
            # Detecta se é cabeçalho (primeira linha)
            row_str = ' | '.join(str(v).lower() for v in valores[:3])
            if any(kw in row_str for kw in ['dia', 'histórico', 'valor', 'data', 'descrição']):
                continue
            
            # Extrai campos baseada no banco
            if 'BRB' in banco.upper():
                registro = _parse_brb_from_columns(valores)
                if registro:
                    registros.append(registro)
                    
            elif 'PAN' in banco.upper():
                registro = _parse_pan_from_columns(valores)
                if registro:
                    registros.append(registro)
                    
            elif 'BB' in banco.upper() or 'BRASIL' in banco.upper():
                registro = _parse_bb_from_columns(valores)
                if registro:
                    registros.append(registro)
    
    return registros


def _parse_brb_from_columns(colunas: List[str]) -> Optional[Dict[str, Any]]:
    """Parseia uma linha de extrato BRB a partir de colunas."""
    if len(colunas) < 2:
        return None
    
    # Procura por data no formato DD/MM
    data = None
    historico = ""
    valor = ""
    tipo = "+"
    
    for col in colunas:
        col = str(col).strip()
        
        # Data no formato DD/MM/AAAA ou DD/MM
        if re.match(r'^\d{2}/\d{2}(/\d{4})?$', col):
            data = col
        # Valor monetário com sinal
        elif re.search(r'\d{1,3}(?:\.\d{3})*,\d{2}', col):
            valor_match = re.search(r'(-?\d{1,3}(?:\.\d{3})*,\d{2})', col)
            if valor_match:
                valor = valor_match.group(1)
                if '(' in col or col.startswith('-'):
                    tipo = "-"
        else:
            # É histórico
            if col and not data:
                historico += col + " "
    
    if not data or not valor:
        return None
    
    # Normaliza o valor
    try:
        valor_num = float(valor.replace('.', '').replace(',', '.'))
        valor_formatado = f"{abs(valor_num):.2f}".replace('.', ',')
    except:
        valor_formatado = valor
    
    return {
        'data': data,
        'historico': historico.strip()[:100],  # Limita tamanho
        'valor': valor_formatado,
        'tipo': tipo,
    }


def _parse_pan_from_columns(colunas: List[str]) -> Optional[Dict[str, Any]]:
    """Parseia uma linha de extrato PAN a partir de colunas."""
    if len(colunas) < 3:
        return None
    
    registro = {
        'data': '',
        'numero_operacao': '',
        'tipo_operacao': '',
        'valor': '',
        'saldo': '',
    }
    
    for col in colunas:
        col_str = str(col).strip()
        
        if re.match(r'^\d{2}/\d{2}(/\d{4})?$', col_str):
            registro['data'] = col_str
        elif col_str.isdigit() and len(col_str) >= 6:
            registro['numero_operacao'] = col_str
        elif col_str.upper() in ['CREDITO', 'DEBITO', 'C', 'D', 'TARIFA', 'PIX', 'TRANSFERENCIA']:
            registro['tipo_operacao'] = col_str.upper()
        elif re.search(r'\d{1,3}(?:\.\d{3})*,\d{2}', col_str):
            if not registro['valor']:
                valor_match = re.search(r'(\d{1,3}(?:\.\d{3})*,\d{2})', col_str)
                if valor_match:
                    registro['valor'] = valor_match.group(1)
            elif not registro['saldo']:
                saldo_match = re.search(r'(\d{1,3}(?:\.\d{3})*,\d{2})', col_str)
                if saldo_match:
                    registro['saldo'] = saldo_match.group(1)
        elif col_str and not registro['tipo_operacao']:
            registro['tipo_operacao'] = col_str
    
    if not registro['data'] or not registro['valor']:
        return None
    
    return registro


def _parse_bb_from_columns(colunas: List[str]) -> Optional[Dict[str, Any]]:
    """Parseia uma linha de extrato BB a partir de colunas."""
    if len(colunas) < 3:
        return None
    
    registro = {
        'data': '',
        'lote': '',
        'documento': '',
        'historico': '',
        'valor': '',
        'tipo': '+',
    }
    
    for col in colunas:
        col_str = str(col).strip()
        
        if re.match(r'^\d{2}/\d{2}(/\d{4})?$', col_str):
            registro['data'] = col_str
        elif col_str.isdigit() and len(col_str) <= 5:
            if not registro['lote']:
                registro['lote'] = col_str
            else:
                registro['documento'] = col_str
        elif re.search(r'\d{1,3}(?:\.\d{3})*,\d{2}', col_str):
            valor_match = re.search(r'(-?\d{1,3}(?:\.\d{3})*,\d{2})', col_str)
            if valor_match:
                registro['valor'] = valor_match.group(1)
                if col_str.startswith('-') or '(' in col_str:
                    registro['tipo'] = '-'
        elif col_str:
            if not registro['historico']:
                registro['historico'] = col_str
            else:
                registro['historico'] += ' ' + col_str
    
    if not registro['data'] or not registro['valor']:
        return None
    
    return registro


if __name__ == "__main__":
    print("Módulo parser_pdf carregado com sucesso")
    print("Funções disponíveis:")
    print("  - parse_pdf(texto, banco)")
    print("  - extrair_todas_linhas_pdf(texto)")
    print("  - criar_dataframe_pdf(registros)")
    print("\nParsers específicos:")
    print("  - parse_pdf_brb(texto)")
    print("  - parse_pdf_pan(texto)")
    print("  - parse_pdf_bb(texto)")
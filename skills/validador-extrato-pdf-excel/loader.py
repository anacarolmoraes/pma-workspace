#!/usr/bin/env python3
"""
Loader Module - Carrega PDF e Excel para processamento
Suporta extração direta e OCR para PDFs escaneados
"""
import os
import re
import pdfplumber
import pandas as pd
from typing import Dict, List, Tuple, Any

# Tenta importar OCR, mas não falha se não estiver disponível
try:
    from ocr import extrair_texto_flexivel
    OCR_DISPONIVEL = True
except ImportError:
    OCR_DISPONIVEL = False
    def extrair_texto_flexivel(pdf_path):
        return {'texto': '', 'metodo': 'none', 'confianca': 0.0}


def carregar_pdf(pdf_path: str, usar_ocr: bool = True) -> Dict[str, Any]:
    """
    Carrega o PDF usando pdfplumber e extrai texto de todas as páginas.
    Se o PDF for escaneado (sem texto), usa OCR se disponível.
    
    Args:
        pdf_path: Caminho do arquivo PDF
        usar_ocr: Se True, usa OCR para PDFs sem texto
        
    Returns:
        Dict com:
            - texto: str - texto completo de todas as páginas
            - paginas: List[str] - texto de cada página
            - num_paginas: int - número de páginas
            - tabelas: List[pd.DataFrame] - tabelas extraídas de cada página
            - qualidade_tabelas: float - score de 0-1 indicando se tabelas são válidas
            - texto_extraido_de_tabelas: bool - indica se texto veio das tabelas
            - metodo_extracao: str - 'direct', 'ocr', 'tables', 'none'
            - confianca: float - confiança da extração (0-1)
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF não encontrado: {pdf_path}")
    
    resultado = {
        'texto': '',
        'paginas': [],
        'num_paginas': 0,
        'tabelas': [],
        'qualidade_tabelas': 0.0,
        'texto_extraido_de_tabelas': False,
        'metodo_extracao': 'none',
        'confianca': 0.0,
    }
    
    # Primeiro tenta extração direta com pdfplumber
    with pdfplumber.open(pdf_path) as pdf:
        resultado['num_paginas'] = len(pdf.pages)
        
        texto_direto = ""
        for i, page in enumerate(pdf.pages):
            texto_page = page.extract_text() or ''
            resultado['paginas'].append(texto_page)
            texto_direto += texto_page
            
            # Extrai tabelas da página
            tabelas = page.extract_tables()
            for j, tabela in enumerate(tabelas):
                if tabela and len(tabela) > 1:
                    primeira_linha = [str(c).strip() for c in tabela[0]] if tabela else []
                    colunas_validas = True
                    for col in primeira_linha[:3]:
                        if col and re.match(r'^R\$\s*\d+', col):
                            colunas_validas = False
                            break
                        if col and re.match(r'^\d{1,3}(?:\.\d{3})*,\d{2}$', col.replace('R$ ', '').replace('R$', '')):
                            colunas_validas = False
                            break
                        if col and len(col) > 50:
                            colunas_validas = False
                            break
                    
                    # Gera nomes de colunas automáticos se forem inválidos
                    if not colunas_validas or any(c is None for c in tabela[0]):
                        cols = [f"col_{i}" for i in range(len(tabela[0]))]
                    else:
                        cols = [str(c).strip() if c else f"col_{i}" for i, c in enumerate(tabela[0])]
                    
                    df = pd.DataFrame(tabela[1:], columns=cols) if len(tabela) > 1 else pd.DataFrame(tabela)
                    df.attrs['page'] = i + 1
                    df.attrs['table_idx'] = j
                    df.attrs['valida'] = colunas_validas
                    resultado['tabelas'].append(df)
    
    # Calcula qualidade das tabelas
    if resultado['tabelas']:
        validas = sum(1 for t in resultado['tabelas'] if t.attrs.get('valida', True))
        resultado['qualidade_tabelas'] = validas / len(resultado['tabelas'])
    
    # Decide qual método usar
    texto_valido = texto_direto.strip() and len(texto_direto.strip()) > 50
    
    if texto_valido:
        # Usa texto direto
        resultado['texto'] = texto_direto
        resultado['metodo_extracao'] = 'direct'
        resultado['confianca'] = 1.0
    elif resultado['tabelas']:
        # Constrói texto a partir das tabelas
        texto_from_tables = []
        for tabela in resultado['tabelas']:
            linhas = tabela.values.tolist()
            for linha in linhas:
                if linha and any(cell for cell in linha if cell):
                    linha_str = ' | '.join(str(cell) for cell in linha if cell)
                    texto_from_tables.append(linha_str)
        
        resultado['texto'] = '\n'.join(texto_from_tables)
        resultado['texto_extraido_de_tabelas'] = True
        resultado['metodo_extracao'] = 'tables'
        resultado['confianca'] = 0.5 if texto_from_tables else 0.0
    elif usar_ocr and OCR_DISPONIVEL:
        # Tenta OCR
        print("  PDF parece ser escaneado, tentando OCR...")
        ocr_result = extrair_texto_flexivel(pdf_path)
        resultado['texto'] = ocr_result['texto']
        resultado['metodo_extracao'] = ocr_result['metodo']
        resultado['confianca'] = ocr_result['confianca']
    else:
        resultado['metodo_extracao'] = 'none'
        resultado['confianca'] = 0.0
    
    # Debug: mostra método usado
    print(f"  PDF: método={resultado['metodo_extracao']}, tabelas={len(resultado['tabelas'])}, conf={resultado['confianca']}")
    
    return resultado


def carregar_excel(excel_path: str) -> Dict[str, pd.DataFrame]:
    """
    Carrega todas as abas do Excel em um dicionário.
    
    Args:
        excel_path: Caminho do arquivo Excel
        
    Returns:
        Dict com nome_da_aba -> DataFrame
    """
    if not os.path.exists(excel_path):
        raise FileNotFoundError(f"Excel não encontrado: {excel_path}")
    
    # Lê todas as abas
    abas = pd.ExcelFile(excel_path)
    resultado = {}
    
    for nome_aba in abas.sheet_names:
        df = pd.read_excel(excel_path, sheet_name=nome_aba)
        # Limpa o DataFrame - remove linhas vazias e reseta índice
        df = df.dropna(how='all').reset_index(drop=True)
        resultado[nome_aba] = df
    
    return resultado


def obter_info_arquivos(pdf_path: str, excel_path: str) -> Dict[str, Any]:
    """
    Obtém informações básicas sobre os arquivos para debug.
    """
    info = {
        'pdf_existe': os.path.exists(pdf_path),
        'excel_existe': os.path.exists(excel_path),
    }
    
    if info['pdf_existe']:
        with pdfplumber.open(pdf_path) as pdf:
            info['pdf_paginas'] = len(pdf.pages)
    
    if info['excel_existe']:
        abas = pd.ExcelFile(excel_path)
        info['excel_abas'] = abas.sheet_names
        info['excel_num_abas'] = len(abas.sheet_names)
    
    return info


if __name__ == "__main__":
    # Teste rápido
    print("Módulo loader carregado com sucesso")
    print("Funções disponíveis:")
    print("  - carregar_pdf(pdf_path)")
    print("  - carregar_excel(excel_path)")
    print("  - obter_info_arquivos(pdf_path, excel_path)")
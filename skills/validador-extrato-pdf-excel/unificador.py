#!/usr/bin/env python3
"""
Unificador Module - Une múltiplas abas do Excel em um único DataFrame
"""
import pandas as pd
from typing import Dict, List, Tuple
import re


def _identificar_cabecalhos(df: pd.DataFrame) -> List[int]:
    """
    Identifica linhas que são cabeçalhos repetidos.
    
    Args:
        df: DataFrame a ser analisado
        
    Returns:
        Lista de índices que são cabeçalhos
    """
    indices_cabecalho = []
    
    # Padrões comuns de cabeçalho em extratos bancários
    padroes_cabecalho = [
        r'^data\s*$',
        r'^histórico\s*$',
        r'^hist\.\s*$',
        r'^valor\s*$',
        r'^saldo\s*$',
        r'^n\.º\s+operação\s*$',
        r'^tipo\s+operação\s*$',
        r'^documento\s*$',
        r'^lote\s*$',
        r'^dia\s*$',
        r'^data\s+lote\s+documento\s+histórico\s+valor',
    ]
    
    for idx, row in df.iterrows():
        row_str = ' '.join(str(v).lower().strip() for v in row if pd.notna(v))
        
        for padrao in padroes_cabecalho:
            if re.match(padrao, row_str):
                indices_cabecalho.append(idx)
                break
    
    return indices_cabecalho


def unificar_abas(abas: Dict[str, pd.DataFrame], remover_cabecalhos: bool = True) -> pd.DataFrame:
    """
    Unifica múltiplas abas do Excel em um único DataFrame.
    
    Args:
        abas: Dicionário com nome_aba -> DataFrame
        remover_cabecalhos: Se True, remove linhas de cabeçalho repetidas
        
    Returns:
        DataFrame único com todas as linhas
    """
    if not abas:
        raise ValueError("Nenhuma aba fornecida para unificar")
    
    dfs = []
    
    for nome_aba, df in abas.items():
        if df.empty:
            continue
        
        # Verifica se a tabela tem estrutura válida
        colunas = list(df.columns)
        
        # Uma tabela válida deve ter:
        # 1. Mais de uma coluna (não é tabela de uma única coluna)
        # 2. Colunas com nomes válidos (não "Unnamed" e não valores monetários)
        # 3. A primeira coluna não pode ser um texto longo de cabeçalho
        
        # Remove prefixos de página do nome da aba
        nome_limpo = nome_aba.replace('Page_', '').replace('_Table_', '_')
        
        # Verifica estrutura
        tem_colunas_validas = False
        for col in colunas:
            col_str = str(col).strip()
            # Coluna válida se não for Unnamed e não for um valor monetário
            if not col_str.startswith('Unnamed'):
                if not re.match(r'^R\$\s*\d+', col_str):
                    # Não é um valor monetário no nome da coluna
                    # Verifica se não é um texto de cabeçalho muito longo
                    if len(col_str) < 100:  # Nomes de colunas normais são curtos
                        tem_colunas_validas = True
                        break
        
        # Se tem apenas 1 coluna ou nenhuma coluna válida, é extração ruim
        if len(colunas) == 1 or not tem_colunas_validas:
            print(f"  AVISO: Aba '{nome_limpo}' com {len(colunas)} coluna(s) - estrutura inválida")
            continue
        
        # Adiciona coluna de origem para debug
        df_copy = df.copy()
        df_copy.attrs['aba_original'] = nome_limpo
        
        # Remove linhas de cabeçalho duplicadas
        if remover_cabecalhos:
            indices_cab = _identificar_cabecalhos(df_copy)
            if indices_cab:
                df_copy = df_copy.drop(indices_cab).reset_index(drop=True)
        
        dfs.append(df_copy)
    
    if not dfs:
        raise ValueError("Todas as abas tinham estrutura inválida. Use o texto do PDF como fallback.")
    
    # Concatena todos os DataFrames
    df_unificado = pd.concat(dfs, ignore_index=True)
    
    return df_unificado


def detectar_colunas(df: pd.DataFrame) -> Dict[str, List[str]]:
    """
    Detecta as colunas presentes no DataFrame.
    
    Args:
        df: DataFrame a ser analisado
        
    Returns:
        Dicionário com informações sobre as colunas
    """
    colunas = {}
    
    for col in df.columns:
        col_lower = str(col).lower().strip()
        
        # Mapeia nomes de coluna para tipo
        if any(p in col_lower for p in ['data', 'dia', 'date']):
            colunas[col] = 'data'
        elif any(p in col_lower for p in ['historico', 'hist', 'descri', 'memo']):
            colunas[col] = 'historico'
        elif any(p in col_lower for p in ['valor', 'quantia', 'amount']):
            colunas[col] = 'valor'
        elif any(p in col_lower for p in ['saldo', 'balance']):
            colunas[col] = 'saldo'
        elif any(p in col_lower for p in ['operacao', 'operação', 'número']):
            colunas[col] = 'numero_operacao'
        elif any(p in col_lower for p in ['tipo', 'type']):
            colunas[col] = 'tipo_operacao'
        elif any(p in col_lower for p in ['doc', 'documento']):
            colunas[col] = 'documento'
        elif any(p in col_lower for p in ['lote']):
            colunas[col] = 'lote'
        else:
            colunas[col] = 'desconhecido'
    
    return colunas


def limpar_celulas_vazias(df: pd.DataFrame) -> pd.DataFrame:
    """
    Limpa células vazias e valores NaN que representam cabeçalhos.
    
    Args:
        df: DataFrame a ser limpo
        
    Returns:
        DataFrame limpo
    """
    df_limpo = df.copy()
    
    # Remove linhas que estão completamente vazias
    df_limpo = df_limpo.dropna(how='all').reset_index(drop=True)
    
    # Remove linhas onde todas as células são strings vazias ou None
    for idx in df_limpo.index:
        row = df_limpo.loc[idx]
        if all(pd.isna(v) or str(v).strip() == '' for v in row):
            df_limpo = df_limpo.drop(idx)
    
    return df_limpo.reset_index(drop=True)


if __name__ == "__main__":
    print("Módulo unificador carregado com sucesso")
    print("Funções disponíveis:")
    print("  - unificar_abas(abas)")
    print("  - detectar_colunas(df)")
    print("  - limpar_celulas_vazias(df)")
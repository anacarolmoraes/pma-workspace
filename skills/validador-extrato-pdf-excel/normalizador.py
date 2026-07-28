#!/usr/bin/env python3
"""
Normalizador Module - Normaliza dados para formato padrão
"""
import pandas as pd
import re
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime


def normalizar_data(valor: Any) -> Optional[str]:
    """
    Normaliza diferentes formatos de data para DD/MM/AAAA.
    
    Args:
        valor: Valor da célula (pode ser string, datetime, etc.)
        
    Returns:
        String no formato DD/MM/AAAA ou None se inválido
    """
    if pd.isna(valor):
        return None
    
    valor_str = str(valor).strip()
    
    # Se já é datetime
    if isinstance(valor, datetime):
        return valor.strftime('%d/%m/%Y')
    
    # Tenta diferentes padrões
    padroes = [
        (r'(\d{2})/(\d{2})/(\d{4})', r'\1/\2/\3'),  # DD/MM/AAAA
        (r'(\d{2})/(\d{2})/(\d{2})', r'\1/20\3'),    # DD/MM/AA -> DD/MM/20AA
        (r'(\d{2})-(\d{2})-(\d{4})', r'\1/\2/\3'),  # DD-MM-AAAA
        (r'(\d{4})-(\d{2})-(\d{2})', r'\3/\2/\1'),  # AAAA-MM-DD
    ]
    
    for padrao, substituicao in padroes:
        match = re.match(padrao, valor_str)
        if match:
            return re.sub(padrao, substituicao, valor_str)
    
    return None


def normalizar_valor(valor: Any) -> Optional[float]:
    """
    Normaliza diferentes formatos de valor para float.
    
    Args:
        valor: Valor da célula (pode ser string, int, float)
        
    Returns:
        Float ou None se inválido
    """
    if pd.isna(valor):
        return None
    
    # Se já é numérico
    if isinstance(valor, (int, float)):
        return float(valor)
    
    valor_str = str(valor).strip()
    
    # Remove espaços e símbolos não necessários
    valor_str = valor_str.replace(' ', '')
    
    # Detecta sinal
    negativo = False
    if valor_str.startswith('-') or valor_str.startswith('('):
        negativo = True
        valor_str = valor_str.replace('-', '').replace('(', '').replace(')', '')
    elif valor_str.endswith('-'):
        negativo = True
        valor_str = valor_str[:-1]
    
    # Detecta separadores
    # Formato brasileiro: 1.234,56
    # Formato americano: 1,234.56
    
    if ',' in valor_str and '.' in valor_str:
        if valor_str.rfind(',') > valor_str.rfind('.'):
            # Formato brasileiro: 1.234,56
            valor_str = valor_str.replace('.', '').replace(',', '.')
        else:
            # Formato americano: 1,234.56
            valor_str = valor_str.replace(',', '')
    elif ',' in valor_str:
        # Pode ser brasileiro ou americano
        # Se tem mais de 3 dígitos após a vírgula, provavelmente americano
        parte_decimal = valor_str.split(',')[1] if ',' in valor_str else ''
        if len(parte_decimal) > 3:
            # Americano
            valor_str = valor_str.replace(',', '')
        else:
            # Brasileiro
            valor_str = valor_str.replace('.', '').replace(',', '.')
    elif '.' in valor_str:
        # Americano ou decimal
        valor_str = valor_str.replace(',', '')
    
    try:
        resultado = float(valor_str)
        return -resultado if negativo else resultado
    except:
        return None


def normalizar_historico(valor: Any) -> str:
    """
    Normaliza o campo histórico/descrição.
    
    Args:
        valor: Valor da célula
        
    Returns:
        String normalizada ou vazia
    """
    if pd.isna(valor):
        return ''
    
    valor_str = str(valor).strip()
    
    # Remove múltiplos espaços
    valor_str = re.sub(r'\s+', ' ', valor_str)
    
    return valor_str


def detectar_sinal(valor: Any) -> str:
    """
    Detecta se o valor é positivo ou negativo.
    
    Args:
        valor: Valor da célula
        
    Returns:
        '+' ou '-'
    """
    if pd.isna(valor):
        return '+'
    
    valor_str = str(valor).strip().lower()
    
    # Verifica indicadores de negativo
    if valor_str.startswith('-') or valor_str.startswith('('):
        return '-'
    if '(-)' in valor_str or '( - )' in valor_str:
        return '-'
    
    return '+'


def normalizar_dataframe(
    df: pd.DataFrame,
    banco: str,
    colunas_normalizadas: Dict[str, str]
) -> pd.DataFrame:
    """
    Normaliza o DataFrame para o formato padrão.
    
    Args:
        df: DataFrame original
        banco: Nome do banco detectado
        colunas_normalizadas: Mapeamento de colunas originais para normalizadas
        
    Returns:
        DataFrame normalizado
    """
    df_normalizado = pd.DataFrame()
    
    # Colunas padrão que sempre devem existir
    colunas_padrao = ['data', 'historico', 'valor', 'saldo', 'tipo', 'documento']
    
    # Mapeia as colunas do DataFrame original para as normalizadas
    mapeamento = {}
    for col_original, tipo in colunas_normalizadas.items():
        if tipo in mapeamento:
            # Já existe, pode ser conflito
            # Usa a primeira ocorrência
            continue
        mapeamento[tipo] = col_original
    
    # Processa cada coluna padrão
    for col_padrao in colunas_padrao:
        col_original = mapeamento.get(col_padrao)
        
        if col_original and col_original in df.columns:
            if col_padrao == 'data':
                df_normalizado[col_padrao] = df[col_original].apply(normalizar_data)
            elif col_padrao == 'valor':
                # Para Banco do Brasil, mantém sinal
                if banco == 'BANCO_DO_BRASIL':
                    df_normalizado[col_padrao] = df[col_original].apply(
                        lambda x: str(x).strip() if pd.notna(x) else ''
                    )
                else:
                    df_normalizado[col_padrao] = df[col_original].apply(normalizar_valor)
            elif col_padrao == 'historico':
                df_normalizado[col_padrao] = df[col_original].apply(normalizar_historico)
            else:
                df_normalizado[col_padrao] = df[col_original]
        else:
            # Coluna não existe, cria vazia
            df_normalizado[col_padrao] = None
    
    # Adiciona coluna de banco para referência
    df_normalizado['banco_origem'] = banco
    
    return df_normalizado


def aplicar_normalizacao_completa(
    df: pd.DataFrame,
    banco: str,
    colunas_normalizadas: Dict[str, str]
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Aplica normalização completa e retorna métricas.
    
    Args:
        df: DataFrame original
        banco: Nome do banco detectado
        colunas_normalizadas: Mapeamento de colunas
        
    Returns:
        Tupla com (DataFrame normalizado, métricas)
    """
    metricas = {
        'total_linhas': len(df),
        'datas_normalizadas': 0,
        'valores_normalizados': 0,
        'historicos_normalizados': 0,
        'valores_nulos': 0,
    }
    
    df_normalizado = normalizar_dataframe(df, banco, colunas_normalizadas)
    
    # Conta métricas
    if 'data' in df_normalizado.columns:
        metricas['datas_normalizadas'] = df_normalizado['data'].notna().sum()
    
    if 'valor' in df_normalizado.columns:
        metricas['valores_normalizados'] = df_normalizado['valor'].notna().sum()
        metricas['valores_nulos'] = df_normalizado['valor'].isna().sum()
    
    if 'historico' in df_normalizado.columns:
        historicos_validos = df_normalizado['historico'].apply(
            lambda x: bool(x and str(x).strip())
        )
        metricas['historicos_normalizados'] = historicos_validos.sum()
    
    return df_normalizado, metricas


if __name__ == "__main__":
    print("Módulo normalizador carregado com sucesso")
    print("Funções disponíveis:")
    print("  - normalizar_data(valor)")
    print("  - normalizar_valor(valor)")
    print("  - normalizar_historico(valor)")
    print("  - normalizar_dataframe(df, banco, colunas)")
    print("  - aplicar_normalizacao_completa(df, banco, colunas)")
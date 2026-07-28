#!/usr/bin/env python3
"""
Detector Banco Module - Identifica automaticamente o tipo de banco
"""
import pandas as pd
from typing import Dict, List, Tuple, Optional
import re


# Padrões de colunas para cada banco
PADROES_BANCO = {
    'BRB': {
        'colunas_esperadas': ['data', 'historico', 'valor'],
        'colunas_opcionais': ['saldo', 'tipo'],
        'palavras_chave': ['brb', 'banco de brasília', 'correção monetária', 'tarifa'],
    },
    'BANCO_PAN': {
        'colunas_esperadas': ['data', 'numero_operacao', 'tipo_operacao', 'valor', 'saldo'],
        'colunas_opcionais': [],
        'palavras_chave': ['pan', 'banco pan', 'bmg', 'credito', 'parcela'],
    },
    'BANCO_DO_BRASIL': {
        'colunas_esperadas': ['data', 'lote', 'documento', 'historico', 'valor'],
        'colunas_opcionais': ['tipo'],
        'palavras_chave': ['banco do brasil', 'bb', 'gov.br', 'tribunal', 'lote'],
    },
    'GENERICO': {
        'colunas_esperadas': ['data', 'historico', 'valor', 'tipo'],
        'colunas_opcionais': [],
        'palavras_chave': [],
    },
}


def normalizar_nome_coluna(nome: str) -> str:
    """
    Normaliza o nome da coluna para comparação.
    
    Args:
        nome: Nome da coluna original
        
    Returns:
        Nome normalizado em minúsculas
    """
    nome_lower = nome.lower().strip()
    
    # Mapeia nomes comuns para nomes padrão
    mapeamentos = {
        'data': 'data',
        'dia': 'data',
        'date': 'data',
        'histórico': 'historico',
        'historico': 'historico',
        'hist': 'historico',
        'descrição': 'historico',
        'descri': 'historico',
        'memo': 'historico',
        'valor': 'valor',
        'quantia': 'valor',
        'amount': 'valor',
        'saldo': 'saldo',
        'balance': 'saldo',
        'n° operação': 'numero_operacao',
        'n. operação': 'numero_operacao',
        'numero operação': 'numero_operacao',
        'nro operação': 'numero_operacao',
        'operação': 'tipo_operacao',
        'tipo operação': 'tipo_operacao',
        'tipo': 'tipo_operacao',
        'documento': 'documento',
        'doc': 'documento',
        'lote': 'lote',
    }
    
    return mapeamentos.get(nome_lower, nome_lower)


def detectar_banco_por_colunas(df: pd.DataFrame) -> Dict[str, any]:
    """
    Detecta o banco com base nas colunas do DataFrame.
    
    Args:
        df: DataFrame do Excel
        
    Returns:
        Dicionário com:
            - banco: str - nome do banco detectado
            - confianca: float - pontuação de confiança (0-1)
            - colunas_normalizadas: Dict[str, str] - mapeamento de colunas originais para normalizadas
    """
    colunas_df = list(df.columns)
    colunas_normalizadas = {col: normalizar_nome_coluna(col) for col in colunas_df}
    
    # Conta quantas colunas de cada tipo existem
    tipos_encontrados = {}
    for col_normalizada in colunas_normalizadas.values():
        tipos_encontrados[col_normalizada] = tipos_encontrados.get(col_normalizada, 0) + 1
    
    # Verifica se tem 'lote' ou 'documento' que são típicos do BB
    tem_lote = 'lote' in colunas_normalizadas.values()
    tem_documento = 'documento' in colunas_normalizadas.values()
    tem_data = 'data' in colunas_normalizadas.values()
    tem_historico = 'historico' in colunas_normalizadas.values()
    tem_valor = 'valor' in colunas_normalizadas.values()
    tem_tipo = 'tipo_operacao' in colunas_normalizadas.values()
    
    # Se tem data + historico + valor + tipo, é provavelmente BB
    if tem_data and tem_valor and (tem_historico or tem_tipo):
        return {
            'banco': 'BANCO_DO_BRASIL',
            'confianca': 0.8,
            'colunas_normalizadas': colunas_normalizadas,
            'todas_opcoes': [('BANCO_DO_BRASIL', 8)],
        }
    
    # Otherwise use pattern matching
    melhores_matchs = []
    
    for nome_banco, padroes in PADROES_BANCO.items():
        pontuacao = 0
        
        # Verifica colunas obrigatórias
        for col_esp in padroes['colunas_esperadas']:
            if col_esp in colunas_normalizadas.values():
                pontuacao += 2
            else:
                pontuacao -= 1
        
        # Verifica colunas opcionais
        for col_opc in padroes['colunas_opcionais']:
            if col_opc in colunas_normalizadas.values():
                pontuacao += 1
        
        melhores_matchs.append((nome_banco, pontuacao))
    
    # Ordena por pontuação
    melhores_matchs.sort(key=lambda x: x[1], reverse=True)
    
    banco_detectado = melhores_matchs[0][0] if melhores_matchs else 'DESCONHECIDO'
    confianca = melhores_matchs[0][1] / 10 if melhores_matchs else 0  # Normaliza para 0-1
    
    return {
        'banco': banco_detectado,
        'confianca': min(confianca, 1.0),
        'colunas_normalizadas': colunas_normalizadas,
        'todas_opcoes': melhores_matchs,
    }


def detectar_banco_por_conteudo(df: pd.DataFrame) -> Dict[str, any]:
    """
    Detecta o banco com base no conteúdo das células.
    
    Args:
        df: DataFrame do Excel
        
    Returns:
        Dicionário com possíveis bancos identificados
    """
    resultados = {}
    
    # procura por palavras-chave no conteúdo
    for idx, row in df.head(20).iterrows():  # Verifica primeiras 20 linhas
        for valor in row:
            if pd.isna(valor):
                continue
            valor_str = str(valor).lower()
            
            for nome_banco, padroes in PADROES_BANCO.items():
                for palavra in padroes['palavras_chave']:
                    if palavra in valor_str:
                        resultados[nome_banco] = resultados.get(nome_banco, 0) + 1
    
    return resultados


def detectar_banco(df: pd.DataFrame) -> Dict[str, any]:
    """
    Detecta o banco usando múltiplas estratégias.
    
    Args:
        df: DataFrame do Excel
        
    Returns:
        Dicionário com resultado da detecção
    """
    # Estratégia 1: Por colunas
    resultado_colunas = detectar_banco_por_colunas(df)
    
    # Estratégia 2: Por conteúdo
    resultado_conteudo = detectar_banco_por_conteudo(df)
    
    # Combina os resultados
    banco_primario = resultado_colunas['banco']
    
    if resultado_conteudo:
        # Se o banco detectado por colunas também apareceu no conteúdo, aumenta confiança
        if banco_primario.lower() in [k.lower() for k in resultado_conteudo.keys()]:
            resultado_colunas['confianca'] = min(resultado_colunas['confianca'] * 1.5, 1.0)
    
    resultado_colunas['contagem_conteudo'] = resultado_conteudo
    
    return resultado_colunas


def get_colunas_esperadas(banco: str) -> Dict[str, List[str]]:
    """
    Retorna as colunas esperadas para um banco específico.
    
    Args:
        banco: Nome do banco
        
    Returns:
        Dicionário com colunas obrigatórias e opcionais
    """
    return PADROES_BANCO.get(banco.upper(), {
        'colunas_esperadas': ['data', 'historico', 'valor'],
        'colunas_opcionais': [],
    })


if __name__ == "__main__":
    print("Módulo detector_banco carregado com sucesso")
    print("Funções disponíveis:")
    print("  - detectar_banco(df)")
    print("  - get_colunas_esperadas(banco)")
    print("  - normalizar_nome_coluna(nome)")
    print("\nBancos suportados:", list(PADROES_BANCO.keys()))
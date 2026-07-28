#!/usr/bin/env python3
"""
Reconciliador Module - Substitui linhas corrigidas no DataFrame
"""
import pandas as pd
from typing import List, Dict, Tuple, Any


def reconciliar_dataframe(
    df_original: pd.DataFrame,
    correcoes: List[Dict[str, Any]],
    colunas: Dict[str, str]
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Aplica correções ao DataFrame original.
    
    Args:
        df_original: DataFrame original do Excel
        correcoes: Lista de correções (retorno do corretor_llm)
        colunas: Mapeamento de colunas
        
    Returns:
        Tupla com (DataFrame corrigido, métricas)
    """
    metricas = {
        'total_correcoes': len(correcoes),
        'linhas_corrigidas': 0,
        'campos_atualizados': {
            'data': 0,
            'historico': 0,
            'valor': 0,
            'saldo': 0,
        }
    }
    
    # Cria cópia para não modificar original
    df_corrigido = df_original.copy()
    
    # Aplica cada correção
    for item in correcoes:
        idx = item['indice']
        correcao = item['correcao']
        
        if idx >= len(df_corrigido):
            continue
        
        # Atualiza cada campo presente na correção
        for campo, valor in correcao.items():
            # Encontra a coluna correspondente no DataFrame
            col_encontrada = None
            for col_original, tipo in colunas.items():
                if tipo == campo and col_original in df_corrigido.columns:
                    col_encontrada = col_original
                    break
            
            if col_encontrada:
                df_corrigido.at[idx, col_encontrada] = valor
                metricas['campos_atualizados'][campo] = metricas['campos_atualizados'].get(campo, 0) + 1
                metricas['linhas_corrigidas'] += 1
    
    return df_corrigido, metricas


def mesclar_com_pdf(
    df_excel: pd.DataFrame,
    df_pdf: pd.DataFrame,
    colunas: Dict[str, str]
) -> pd.DataFrame:
    """
    Mescla dados do PDF com o Excel, preferindo PDF como fonte de verdade.
    
    Args:
        df_excel: DataFrame do Excel
        df_pdf: DataFrame do PDF
        colunas: Mapeamento de colunas
        
    Returns:
        DataFrame mesclado
    """
    # Se PDF está vazio, retorna Excel como está
    if df_pdf.empty:
        return df_excel.copy()
    
    # Cria cópia do Excel
    df_resultado = df_excel.copy()
    
    # Para cada linha,se tiver correspondente no PDF, substitui
    max_linhas = min(len(df_resultado), len(df_pdf))
    
    for idx in range(max_linhas):
        row_pdf = df_pdf.iloc[idx]
        
        # Atualiza cada coluna do PDF para o DataFrame
        for col_pdf, valor_pdf in row_pdf.items():
            if pd.isna(valor_pdf):
                continue
            
            # Encontra coluna correspondente no Excel
            for col_original, tipo in colunas.items():
                if tipo == col_pdf and col_original in df_resultado.columns:
                    # Substitui apenas se o valor no PDF for válido
                    df_resultado.at[idx, col_original] = valor_pdf
                    break
    
    return df_resultado


def gerar_log_correcoes(
    problemas: List[Any],
    correcoes: List[Dict[str, Any]],
    metricas: Dict[str, Any]
) -> str:
    """
    Gera log de auditoria das correções realizadas.
    
    Args:
        problemas: Lista de problemas detectados
        correcoes: Lista de correções aplicadas
        metricas: Métricas do processo
        
    Returns:
        String com log formatado
    """
    log_lines = []
    
    log_lines.append("=" * 60)
    log_lines.append("LOG DE CORREÇÕES - VALIDADOR EXTRATO PDF-EXCEL")
    log_lines.append("=" * 60)
    log_lines.append("")
    
    # Métricas gerais
    log_lines.append("MÉTRICAS GERAIS:")
    log_lines.append(f"  Total de problemas detectados: {len(problemas)}")
    log_lines.append(f"  Total de correções aplicadas: {len(correcoes)}")
    log_lines.append(f"  Linhas corrigidas: {metricas.get('linhas_corrigidas', 0)}")
    log_lines.append("")
    
    # Problemas por tipo
    log_lines.append("PROBLEMAS POR TIPO:")
    tipos = {}
    for prob in problemas:
        tipos[prob.tipo] = tipos.get(prob.tipo, 0) + 1
    
    for tipo, count in sorted(tipos.items(), key=lambda x: x[1], reverse=True):
        log_lines.append(f"  {tipo}: {count}")
    log_lines.append("")
    
    # Problemas por severidade
    log_lines.append("PROBLEMAS POR SEVERIDADE:")
    severidades = {'alta': 0, 'media': 0, 'baixa': 0}
    for prob in problemas:
        if prob.severidade in severidades:
            severidades[prob.severidade] += 1
    
    for sev, count in severidades.items():
        log_lines.append(f"  {sev}: {count}")
    log_lines.append("")
    
    # Detalhamento das correções
    log_lines.append("DETALHAMENTO DAS CORREÇÕES:")
    for item in correcoes[:50]:  # Limita a 50 para não poluir
        idx = item['indice']
        correcao = item['correcao']
        tipo_prob = item.get('problema_tipo', 'desconheido')
        
        log_lines.append(f"  Linha {idx} ({tipo_prob}):")
        for campo, valor in correcao.items():
            log_lines.append(f"    - {campo}: {valor}")
    
    if len(correcoes) > 50:
        log_lines.append(f"  ... e mais {len(correcoes) - 50} correções")
    
    log_lines.append("")
    log_lines.append("=" * 60)
    log_lines.append("FIM DO LOG")
    log_lines.append("=" * 60)
    
    return "\n".join(log_lines)


if __name__ == "__main__":
    print("Módulo reconciliador carregado com sucesso")
    print("Funções disponíveis:")
    print("  - reconciliar_dataframe(df_original, correcoes, colunas)")
    print("  - mesclar_com_pdf(df_excel, df_pdf, colunas)")
    print("  - gerar_log_correcoes(problemas, correcoes, metricas)")
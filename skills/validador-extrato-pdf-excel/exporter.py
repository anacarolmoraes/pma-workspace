#!/usr/bin/env python3
"""
Exporter Module - Salva Excel final e log de auditoria
"""
import pandas as pd
import os
from typing import Dict, Any, Optional, List
from datetime import datetime


def salvar_excel(
    df: pd.DataFrame,
    caminho_saida: str,
    nome_aba: str = 'Extrato'
) -> Dict[str, Any]:
    """
    Salva DataFrame como Excel com uma única aba.
    
    Args:
        df: DataFrame a ser salvo
        caminho_saida: Caminho do arquivo de saída
        nome_aba: Nome da aba (padrão: 'Extrato')
        
    Returns:
        Dicionário com métricas
    """
    metricas = {
        'linhas_salvas': len(df),
        'colunas_salvas': len(df.columns),
        'arquivo': caminho_saida,
        'sucesso': False
    }
    
    # Garante que o diretório existe
    dir_saida = os.path.dirname(caminho_saida)
    if dir_saida and not os.path.exists(dir_saida):
        os.makedirs(dir_saida)
    
    try:
        with pd.ExcelWriter(caminho_saida, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name=nome_aba, index=False)
        
        metricas['sucesso'] = True
        metricas['tamanho_bytes'] = os.path.getsize(caminho_saida)
        
    except Exception as e:
        metricas['erro'] = str(e)
    
    return metricas


def salvar_log(
    log_conteudo: str,
    caminho_saida: str
) -> Dict[str, Any]:
    """
    Salva log de auditoria em arquivo de texto.
    
    Args:
        log_conteudo: Conteúdo do log
        caminho_saida: Caminho do arquivo de log
        
    Returns:
        Dicionário com métricas
    """
    metricas = {
        'sucesso': False,
        'arquivo': caminho_saida
    }
    
    # Garante que o diretório existe
    dir_saida = os.path.dirname(caminho_saida)
    if dir_saida and not os.path.exists(dir_saida):
        os.makedirs(dir_saida)
    
    try:
        with open(caminho_saida, 'w', encoding='utf-8') as f:
            f.write(log_conteudo)
        
        metricas['sucesso'] = True
        metricas['tamanho_bytes'] = os.path.getsize(caminho_saida)
        
    except Exception as e:
        metricas['erro'] = str(e)
    
    return metricas


def gerar_relatorio_final(
    metricas: Dict[str, Any],
    problemas: List[Any],
    correcoes: List[Dict[str, Any]],
    caminho_saida: str
) -> str:
    """
    Gera relatório final com todas as métricas do processo.
    
    Args:
        metricas: Métricas do processo completo
        problemas: Lista de problemas encontrados
        correcoes: Lista de correções aplicadas
        caminho_saida: Caminho base para os arquivos de saída
        
    Returns:
        Caminho do relatório gerado
    """
    # Gera nome do arquivo de relatório
    caminho_relatorio = caminho_saida.replace('.xlsx', '_relatorio.txt')
    
    linhas = []
    linhas.append("=" * 70)
    linhas.append("RELATÓRIO FINAL - VALIDAÇÃO EXTRATO PDF-EXCEL")
    linhas.append(f"Gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    linhas.append("=" * 70)
    linhas.append("")
    
    # Resumo do processo
    linhas.append("RESUMO DO PROCESSO:")
    linhas.append(f"  Total de linhas processadas: {metricas.get('total_linhas', 0)}")
    linhas.append(f"  Problemas detectados: {len(problemas)}")
    linhas.append(f"  Correções aplicadas: {len(correcoes)}")
    linhas.append(f"  Score de confiança: {metricas.get('score_confianca', 0)}%")
    linhas.append("")
    
    # Métricas de validação
    if 'metricas_validacao' in metricas:
        linhas.append("MÉTRICAS DE VALIDAÇÃO:")
        mv = metricas['metricas_validacao']
        linhas.append(f"  Linhas verificadas: {mv.get('linhas_verificadas', 0)}")
        linhas.append(f"  Problemas por tipo: {mv.get('por_tipo', {})}")
        linhas.append(f"  Problemas por severidade: {mv.get('por_severidade', {})}")
        linhas.append("")
    
    # Métricas de normalização
    if 'metricas_normalizacao' in metricas:
        linhas.append("MÉTRICAS DE NORMALIZAÇÃO:")
        mn = metricas['metricas_normalizacao']
        linhas.append(f"  Datas normalizadas: {mn.get('datas_normalizadas', 0)}")
        linhas.append(f"  Valores normalizados: {mn.get('valores_normalizados', 0)}")
        linhas.append(f"  Valores nulos: {mn.get('valores_nulos', 0)}")
        linhas.append("")
    
    # Métricas de correção
    if 'metricas_correcao' in metricas:
        linhas.append("MÉTRICAS DE CORREÇÃO:")
        mc = metricas['metricas_correcao']
        linhas.append(f"  Correções via LLM: {mc.get('corrigidos_llm', 0)}")
        linhas.append(f"  Correções via heurística: {mc.get('corrigidos_heuristica', 0)}")
        linhas.append(f"  Chamadas ao LLM: {mc.get('chamadas_llm', 0)}")
        linhas.append("")
    
    # Métricas de exportação
    if 'metricas_exportacao' in metricas:
        linhas.append("MÉTRICAS DE EXPORTAÇÃO:")
        me = metricas['metricas_exportacao']
        linhas.append(f"  Linhas salvas: {me.get('linhas_salvas', 0)}")
        linhas.append(f"  Colunas salvas: {me.get('colunas_salvas', 0)}")
        linhas.append(f"  Arquivo Excel: {me.get('arquivo', 'N/A')}")
        linhas.append("")
    
    # Cache LLM
    if 'cache_estatisticas' in metricas:
        linhas.append("ESTATÍSTICAS DO CACHE LLM:")
        cc = metricas['cache_estatisticas']
        linhas.append(f"  Hits: {cc.get('hits', 0)}")
        linhas.append(f"  Misses: {cc.get('misses', 0)}")
        linhas.append(f"  Hit rate: {cc.get('hit_rate', 0)}%")
        linhas.append("")
    
    linhas.append("=" * 70)
    linhas.append("FIM DO RELATÓRIO")
    linhas.append("=" * 70)
    
    # Salva relatório
    with open(caminho_relatorio, 'w', encoding='utf-8') as f:
        f.write("\n".join(linhas))
    
    return caminho_relatorio


def normalizar_colunas_output(df: pd.DataFrame, banco: str) -> pd.DataFrame:
    """
    Normaliza colunas para o formato de saída final.
    
    Args:
        df: DataFrame a ser normalizado
        banco: Nome do banco
        
    Returns:
        DataFrame com colunas padronizadas
    """
    df_output = df.copy()
    
    # Remove colunas desnecessárias
    colunas_remover = [col for col in df_output.columns 
                       if col.lower() in ['unnamed', 'aba_original', 'banco_origem']]
    df_output = df_output.drop(columns=colunas_remover, errors='ignore')
    
    # Garante ordem das colunas
    colunas_ordenadas = ['data', 'historico', 'valor', 'saldo', 'tipo', 'documento']
    colunas_presentes = [c for c in colunas_ordenadas if c in df_output.columns]
    colunas_extras = [c for c in df_output.columns if c not in colunas_ordenadas]
    
    df_output = df_output[colunas_presentes + colunas_extras]
    
    return df_output


if __name__ == "__main__":
    print("Módulo exporter carregado com sucesso")
    print("Funções disponíveis:")
    print("  - salvar_excel(df, caminho_saida, nome_aba)")
    print("  - salvar_log(log_conteudo, caminho_saida)")
    print("  - gerar_relatorio_final(metricas, problemas, correcoes, caminho_saida)")
    print("  - normalizar_colunas_output(df, banco)")
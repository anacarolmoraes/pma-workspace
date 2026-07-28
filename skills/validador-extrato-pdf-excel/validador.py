#!/usr/bin/env python3
"""
Validador Module - Compara Excel com PDF e detecta inconsistências
"""
import pandas as pd
import re
from typing import List, Dict, Tuple, Optional, Any
from datetime import datetime


class ProblemaLinha:
    """Representa um problema detectado em uma linha."""
    
    def __init__(
        self,
        idx: int,
        tipo: str,
        descricao: str,
        valor_pdf: Any = None,
        valor_excel: Any = None,
        severidade: str = 'media'
    ):
        self.idx = idx
        self.tipo = tipo  # 'valor_nulo', 'data_invalida', 'divergencia', 'coluna_concatenada'
        self.descricao = descricao
        self.valor_pdf = valor_pdf
        self.valor_excel = valor_excel
        self.severidade = severidade  # 'baixa', 'media', 'alta'
    
    def __repr__(self):
        return f"ProblemaLinha(idx={self.idx}, tipo={self.tipo}, severidade={self.severidade})"


def validar_data(data_str: str) -> Tuple[bool, Optional[str]]:
    """
    Valida se uma string é uma data válida.
    
    Returns:
        Tupla (é_válida, erro_msg)
    """
    if pd.isna(data_str) or not data_str:
        return False, "Data vazia"
    
    # Tenta diferentes formatos
    formatos = ['%d/%m/%Y', '%d/%m/%y', '%Y-%m-%d', '%d-%m-%Y']
    
    for fmt in formatos:
        try:
            datetime.strptime(str(data_str).strip(), fmt)
            return True, None
        except:
            continue
    
    return False, f"Formato de data inválido: {data_str}"


def validar_valor(valor_str: str) -> Tuple[bool, Optional[str]]:
    """
    Valida se uma string é um valor monetário válido.
    
    Returns:
        Tupla (é_válido, erro_msg)
    """
    if pd.isna(valor_str) or str(valor_str).strip() == '':
        return False, "Valor vazio"
    
    valor_str = str(valor_str).strip()
    
    # Remove caracteres não numéricos, preservando sinal e decimais
    # Aceita: 1.234,56 | 1,234.56 | 1234.56 | 1234,56 | -1234,56 | (1234,56)
    
    # Verifica se tem formato válido
    if not re.match(r'^-?\(?\d{1,3}(?:\.\d{3})*,\d{2}\)?$', valor_str) and \
       not re.match(r'^-?\d{1,3}(?:\.\d{3})*\.?\d*$', valor_str):
        return False, f"Formato de valor inválido: {valor_str}"
    
    return True, None


def _comparar_valores(valor_pdf: Any, valor_excel: Any) -> bool:
    """
    Compara dois valores, considerando diferentes formatos.
    """
    # Normaliza ambos para string
    pdf_str = str(valor_pdf).strip() if pd.notna(valor_pdf) else ''
    excel_str = str(valor_excel).strip() if pd.notna(valor_excel) else ''
    
    if pdf_str == excel_str:
        return True
    
    # Tenta normalizar como números
    try:
        # Remove . e substitui , por . para formato brasileiro
        pdf_num = float(pdf_str.replace('.', '').replace(',', '.'))
        excel_num = float(excel_str.replace('.', '').replace(',', '.'))
        
        # Compara com tolerância
        return abs(pdf_num - excel_num) < 0.01
    except:
        pass
    
    return False


def validar_linha(
    idx: int,
    row_excel: pd.Series,
    row_pdf: Optional[Dict[str, Any]],
    banco: str,
    colunas: Dict[str, str]
) -> List[ProblemaLinha]:
    """
    Valida uma linha do Excel contra o PDF.
    
    Args:
        idx: Índice da linha
        row_excel: Linha do DataFrame Excel
        row_pdf: Linha correspondente do PDF (ou None se não encontrada)
        banco: Nome do banco
        colunas: Mapeamento de colunas
        
    Returns:
        Lista de problemas encontrados
    """
    problemas = []
    
    # Valida DATA
    if 'data' in colunas and colunas['data'] in row_excel.index:
        data_valor = row_excel[colunas['data']]
        valido, erro = validar_data(data_valor)
        if not valido:
            problemas.append(ProblemaLinha(
                idx=idx,
                tipo='data_invalida',
                descricao=erro,
                valor_excel=data_valor,
                severidade='alta'
            ))
    
    # Valida VALOR
    if 'valor' in colunas and colunas['valor'] in row_excel.index:
        valor_excel = row_excel[colunas['valor']]
        valido, erro = validar_valor(valor_excel)
        
        if not valido:
            # Se tem correspondente no PDF, verifica divergência
            if row_pdf and 'valor' in row_pdf:
                if not _comparar_valores(row_pdf['valor'], valor_excel):
                    problemas.append(ProblemaLinha(
                        idx=idx,
                        tipo='divergencia',
                        descricao=f"Valor diverge: PDF={row_pdf.get('valor')}, Excel={valor_excel}",
                        valor_pdf=row_pdf.get('valor'),
                        valor_excel=valor_excel,
                        severidade='alta'
                    ))
                else:
                    # Valor coincide, só é problema de formato
                    problemas.append(ProblemaLinha(
                        idx=idx,
                        tipo='valor_formato',
                        descricao=erro,
                        valor_excel=valor_excel,
                        severidade='baixa'
                    ))
            else:
                problemas.append(ProblemaLinha(
                    idx=idx,
                    tipo='valor_nulo',
                    descricao=erro,
                    valor_excel=valor_excel,
                    severidade='media'
                ))
    
    # Valida se histórico não está concatenado com outras colunas
    if 'historico' in colunas and colunas['historico'] in row_excel.index:
        historico = str(row_excel[colunas['historico']])
        
        # Verifica se tem padrão de dados concatenados
        # Ex: "10/01/2025 1234567 CREDITO" sem separador correto
        if re.search(r'\d{2}/\d{2}/\d{4}.+\d{1,3}', historico):
            problemas.append(ProblemaLinha(
                idx=idx,
                tipo='coluna_concatenada',
                descricao="Possível concatenação de colunas no histórico",
                valor_excel=historico[:50] + '...',
                severidade='media'
            ))
    
    return problemas


def validar_dataframe_completo(
    df_excel: pd.DataFrame,
    df_pdf: pd.DataFrame,
    banco: str,
    colunas: Dict[str, str]
) -> Tuple[List[ProblemaLinha], Dict[str, Any]]:
    """
    Valida todo o DataFrame do Excel contra o PDF.
    
    Args:
        df_excel: DataFrame do Excel
        df_pdf: DataFrame do PDF (pode ser vazio)
        banco: Nome do banco
        colunas: Mapeamento de colunas
        
    Returns:
        Tupla com (lista de problemas, métricas)
    """
    todos_problemas = []
    metricas = {
        'total_linhas': len(df_excel),
        'linhas_verificadas': 0,
        'problemas_encontrados': 0,
        'por_tipo': {},
        'por_severidade': {'alta': 0, 'media': 0, 'baixa': 0},
    }
    
    # Se PDF está vazio, não pode fazer validação detalhada
    if df_pdf.empty:
        # Marca todas as linhas como "não verificadas"
        for idx in range(len(df_excel)):
            todos_problemas.append(ProblemaLinha(
                idx=idx,
                tipo='pdf_nao_disponivel',
                descricao="PDF não pôde ser processado para validação",
                severidade='baixa'
            ))
            metricas['problemas_encontrados'] += 1
            metricas['por_severidade']['baixa'] += 1
        
        metricas['por_tipo']['pdf_nao_disponivel'] = metricas['problemas_encontrados']
        return todos_problemas, metricas
    
    # Faz o matching entre Excel e PDF
    # Parasimplificar, usa índice - assumesameordem
    max_linhas = min(len(df_excel), len(df_pdf))
    
    for idx in range(max_linhas):
        row_excel = df_excel.iloc[idx]
        row_pdf = df_pdf.iloc[idx].to_dict()
        
        problemas = validar_linha(idx, row_excel, row_pdf, banco, colunas)
        todos_problemas.extend(problemas)
        
        metricas['linhas_verificadas'] += 1
    
    # Se Excel tem mais linhas que PDF, marca como excedentes
    if len(df_excel) > len(df_pdf):
        for idx in range(len(df_pdf), len(df_excel)):
            todos_problemas.append(ProblemaLinha(
                idx=idx,
                tipo='linha_excedente',
                descricao="Linha não encontrada no PDF",
                severidade='media'
            ))
            metricas['problemas_encontrados'] += 1
            metricas['por_severidade']['media'] += 1
    
    # Agrega métricas
    metricas['problemas_encontrados'] = len(todos_problemas)
    
    for prob in todos_problemas:
        metricas['por_tipo'][prob.tipo] = metricas['por_tipo'].get(prob.tipo, 0) + 1
        metricas['por_severidade'][prob.severidade] += 1
    
    return todos_problemas, metricas


def calcular_score_confianca(problemas: List[ProblemaLinha], total_linhas: int) -> float:
    """
    Calcula score de confiança (0-100%) baseado nos problemas.
    """
    if total_linhas == 0:
        return 0.0
    
    # Peso por severidade
    pesos = {
        'alta': 10,
        'media': 3,
        'baixa': 1,
    }
    
    pontos_perda = sum(pesos[p.severidade] for p in problemas)
    max_pontos = total_linhas * pesos['alta']
    
    score = max(0, 100 - (pontos_perda / max_pontos * 100))
    
    return round(score, 2)


if __name__ == "__main__":
    print("Módulo validador carregado com sucesso")
    print("Funções disponíveis:")
    print("  - validar_data(data_str)")
    print("  - validar_valor(valor_str)")
    print("  - validar_linha(idx, row_excel, row_pdf, banco, colunas)")
    print("  - validar_dataframe_completo(df_excel, df_pdf, banco, colunas)")
    print("  - calcular_score_confianca(problemas, total_linhas)")
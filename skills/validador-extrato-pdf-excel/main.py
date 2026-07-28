#!/usr/bin/env python3
"""
Main Module - Orquestra todo o processo de validação
"""
import os
import sys
import json
import argparse
from typing import Dict, Tuple, Any, Optional
import pandas as pd

# Importa todos os módulos
from loader import carregar_pdf, carregar_excel, obter_info_arquivos
from unificador import unificar_abas, detectar_colunas, limpar_celulas_vazias
from detector_banco import detectar_banco, get_colunas_esperadas, normalizar_nome_coluna
from normalizador import normalizar_dataframe, aplicar_normalizacao_completa
from parser_pdf import parse_pdf, extrair_todas_linhas_pdf, criar_dataframe_pdf
from validador import validar_dataframe_completo, calcular_score_confianca, ProblemaLinha
from corretor_llm import CacheCorrecoes, corrigir_linhas, criar_cliente_llm
from reconciliador import reconciliar_dataframe, mesclar_com_pdf, gerar_log_correcoes
from exporter import salvar_excel, salvar_log, gerar_relatorio_final, normalizar_colunas_output


class ValidadorExtrato:
    """
    Classe principal que coordena todo o processo de validação.
    """
    
    def __init__(self, usar_llm: bool = False, api_key: str = None):
        self.usar_llm = usar_llm
        self.api_key = api_key
        self.cliente_llm = None
        self.cache = None
        
        # Métricas do processo
        self.metricas = {
            'total_linhas': 0,
            'banco_detectado': None,
            'score_confianca': 0,
            'problemas_encontrados': 0,
            'correcoes_aplicadas': 0,
            'chamadas_llm': 0,
        }
        
        # Inicializa LLM se solicitado
        if usar_llm:
            self.cliente_llm = criar_cliente_llm(api_key)
            self.cache = CacheCorrecoes('.cache_correcoes.json')
    
    def processar(self, pdf_path: str, excel_path: str, output_path: str) -> Dict[str, Any]:
        """
        Processa a validação completa.
        
        Args:
            pdf_path: Caminho do PDF original
            excel_path: Caminho do Excel extraído
            output_path: Caminho para salvar o resultado
            
        Returns:
            Dicionário com resultado e métricas
        """
        print(f"\n{'='*60}")
        print("INICIANDO VALIDAÇÃO EXTRATO PDF-EXCEL")
        print(f"{'='*60}\n")
        
        resultado = {
            'sucesso': False,
            'mensagem': '',
            'arquivo_saida': output_path,
            'metricas': {},
        }
        
        try:
            # ==========================================
            # ETAPA 1: Carregar arquivos
            # ==========================================
            print("ETAPA 1: Carregando arquivos...")
            
            info = obter_info_arquivos(pdf_path, excel_path)
            print(f"  PDF: {info['pdf_paginas']} páginas")
            print(f"  Excel: {info['excel_num_abas']} abas")
            
            dados_pdf = carregar_pdf(pdf_path)
            dados_excel = carregar_excel(excel_path)
            
            self.metricas['total_linhas'] = sum(len(df) for df in dados_excel.values())
            print(f"  Total de linhas no Excel: {self.metricas['total_linhas']}")
            
            # ==========================================
            # ETAPA 2: Unificar abas do Excel
            # ==========================================
            print("\nETAPA 2: Unificando abas do Excel...")
            
            try:
                df_unificado = unificar_abas(dados_excel)
                df_unificado = limpar_celulas_vazias(df_unificado)
                print(f"  Linhas após unificação: {len(df_unificado)}")
                
                # Verifica se o DataFrame tem colunas válidas
                colunas = list(df_unificado.columns)
                tem_estrutura_valida = any(
                    not col.startswith('Unnamed') for col in colunas
                ) and len(colunas) > 1
                
                if not tem_estrutura_valida:
                    print("  AVISO: Excel com estrutura inválida, usando PDF como fonte...")
                    df_unificado = pd.DataFrame()  # Força uso do PDF
                    
            except ValueError as e:
                print(f"  AVISO: {e}")
                print("  Usando PDF como fonte de verdade...")
                df_unificado = pd.DataFrame()
            
            # ==========================================
            # ETAPA 3: Detectar banco
            # ==========================================
            print("\nETAPA 3: Detectando banco...")
            
            # Se Excel está vazio, detecta pelo PDF
            if df_unificado.empty:
                texto_pdf = dados_pdf['texto'].lower()
                if 'brb' in texto_pdf or 'banco de brasília' in texto_pdf:
                    banco = 'BRB'
                    colunas_normalizadas = {'data': 'data', 'historico': 'historico', 'valor': 'valor'}
                elif 'banco pan' in texto_pdf or 'bmg' in texto_pdf:
                    banco = 'BANCO_PAN'
                    colunas_normalizadas = {'data': 'data', 'numero_operacao': 'numero_operacao', 
                                          'tipo_operacao': 'tipo_operacao', 'valor': 'valor', 'saldo': 'saldo'}
                elif 'banco do brasil' in texto_pdf or 'bb' in texto_pdf:
                    banco = 'BANCO_DO_BRASIL'
                    colunas_normalizadas = {'data': 'data', 'lote': 'lote', 'documento': 'documento',
                                          'historico': 'historico', 'valor': 'valor'}
                else:
                    banco = 'DESCONHECIDO'
                    colunas_normalizadas = {}
                confianca = 1.0  # 100% quando detectado pelo PDF
            else:
                resultado_banco = detectar_banco(df_unificado)
                banco = resultado_banco['banco']
                confianca = resultado_banco['confianca']
                colunas_normalizadas = resultado_banco['colunas_normalizadas']
            
            self.metricas['banco_detectado'] = banco
            print(f"  Banco detectado: {banco} (confiança: {confianca:.1%})")
            print(f"  Colunas: {list(colunas_normalizadas.keys())}")
            
            # ==========================================
            # ETAPA 4: Normalizar Excel (ou preparar fallback)
            # ==========================================
            print("\nETAPA 4: Normalizando dados...")
            
            if df_unificado.empty:
                print("  Excel vazio/inválido, usando PDF como fonte principal")
                df_normalizado = pd.DataFrame()
                metricas_norm = {'datas_normalizadas': 0, 'valores_normalizados': 0, 'valores_nulos': 0}
            else:
                df_normalizado, metricas_norm = aplicar_normalizacao_completa(
                    df_unificado, banco, colunas_normalizadas
                )
            
            self.metricas['metricas_normalizacao'] = metricas_norm
            print(f"  Datas normalizadas: {metricas_norm['datas_normalizadas']}")
            print(f"  Valores normalizados: {metricas_norm['valores_normalizados']}")
            
            # ==========================================
            # ETAPA 5: Parse do PDF
            # ==========================================
            print("\nETAPA 5: Processando PDF...")
            
            # Primeiro tenta extrair do texto
            registros_pdf = parse_pdf(dados_pdf['texto'], banco)
            df_pdf = criar_dataframe_pdf(registros_pdf)
            
            print(f"  Registros do texto: {len(df_pdf)}")
            
            # Se não encontrou registros no texto, tenta das tabelas
            if df_pdf.empty and dados_pdf.get('tabelas'):
                print("  Tentando extrair das tabelas...")
                from parser_pdf import parse_tabelas_pdf
                registros_tabela = parse_tabelas_pdf(dados_pdf['tabelas'], banco)
                df_pdf = criar_dataframe_pdf(registros_tabela)
                print(f"  Registros das tabelas: {len(df_pdf)}")
            
            print(f"  Total registros extraídos do PDF: {len(df_pdf)}")
            
            # Normaliza colunas do PDF
            if not df_pdf.empty:
                colunas_pdf = {}
                for col in df_pdf.columns:
                    colunas_pdf[col] = normalizar_nome_coluna(col)
                
                df_pdf_norm, _ = aplicar_normalizacao_completa(df_pdf, banco, colunas_pdf)
                df_pdf = df_pdf_norm
            
            # ==========================================
            # ETAPA 6: Validar
            # ==========================================
            print("\nETAPA 6: Validando dados...")
            
            # Se Excel está vazio, o PDF é a única fonte - não há o que validar
            if df_normalizado.empty:
                print("  Excel não disponível - usando PDF como fonte única")
                problemas = []
                metricas_val = {
                    'total_linhas': len(df_pdf),
                    'linhas_verificadas': len(df_pdf),
                    'problemas_encontrados': 0,
                    'por_tipo': {},
                    'por_severidade': {}
                }
                # Usa o PDF como resultado final
                df_corrigido = df_pdf.copy() if not df_pdf.empty else pd.DataFrame()
            else:
                problemas, metricas_val = validar_dataframe_completo(
                    df_normalizado, df_pdf, banco, colunas_normalizadas
                )
            
            self.metricas['metricas_validacao'] = metricas_val
            self.metricas['problemas_encontrados'] = len(problemas)
            self.metricas['score_confianca'] = calcular_score_confianca(
                problemas, len(df_normalizado)
            )
            
            print(f"  Problemas encontrados: {len(problemas)}")
            print(f"  Score de confiança: {self.metricas['score_confianca']:.1f}%")
            
            # ==========================================
            # ETAPA 7: Corrigir
            # ==========================================
            print("\nETAPA 7: Corrigindo problemas...")
            
            # Se Excel estava vazio, df_corrigido já foi definido acima (do PDF)
            if 'df_corrigido' not in locals():
                df_corrigido = df_normalizado.copy()
            
            if problemas and not df_normalizado.empty:
                # Faz merge com PDF para ter fonte de verdade
                df_corrigido = mesclar_com_pdf(df_corrigido, df_pdf, colunas_normalizadas)
                
                # Aplica correções via heurística (sem LLM por padrão)
                if self.usar_llm and self.cliente_llm:
                    correcoes, metricas_corr = corrigir_linhas(
                        problemas, df_corrigido, df_pdf, colunas_normalizadas,
                        self.cliente_llm, self.cache, usar_llm=True
                    )
                    df_corrigido, _ = reconciliar_dataframe(df_corrigido, correcoes, colunas_normalizadas)
                    self.metricas['correcoes_aplicadas'] = len(correcoes)
                    self.metricas['chamadas_llm'] = metricas_corr.get('chamadas_llm', 0)
                    self.metricas['metricas_correcao'] = metricas_corr
                else:
                    # Apenas merge com PDF (fonte de verdade)
                    self.metricas['correcoes_aplicadas'] = 0
            
            # ==========================================
            # ETAPA 8: Exportar
            # ==========================================
            print("\nETAPA 8: Exportando resultado...")
            
            # Normaliza colunas para saída
            df_saida = normalizar_colunas_output(df_corrigido, banco)
            
            # Salva Excel
            metricas_exp = salvar_excel(df_saida, output_path)
            self.metricas['metricas_exportacao'] = metricas_exp
            
            # Salva log
            log_path = output_path.replace('.xlsx', '_log.txt')
            log_correcoes = gerar_log_correcoes(problemas, [], self.metricas)
            salvar_log(log_correcoes, log_path)
            
            # Gera relatório final
            relatorio_path = gerar_relatorio_final(
                self.metricas, problemas, [], output_path
            )
            
            # ==========================================
            # RESULTADO FINAL
            # ==========================================
            resultado['sucesso'] = True
            resultado['mensagem'] = 'Processamento concluído com sucesso'
            resultado['metricas'] = self.metricas
            
            # Cache stats
            if self.cache:
                self.metricas['cache_estatisticas'] = self.cache.estatisticas()
            
            print(f"\n{'='*60}")
            print("RESULTADO FINAL")
            print(f"{'='*60}")
            print(f"  Banco: {banco}")
            print(f"  Linhas processadas: {self.metricas['total_linhas']}")
            print(f"  Score de confiança: {self.metricas['score_confianca']:.1f}%")
            print(f"  Problemas encontrados: {len(problemas)}")
            print(f"  Arquivo salvo: {output_path}")
            print(f"  Log salvo: {log_path}")
            print(f"  Relatório: {relatorio_path}")
            print(f"{'='*60}\n")
            
        except Exception as e:
            resultado['sucesso'] = False
            resultado['mensagem'] = f"Erro durante processamento: {str(e)}"
            resultado['metricas'] = self.metricas
            print(f"\nERRO: {str(e)}")
        
        return resultado


def main():
    """Função principal para execução via CLI."""
    
    parser = argparse.ArgumentParser(
        description='Validador e corretor de extratos bancários PDF -> Excel'
    )
    
    parser.add_argument('pdf_path', help='Caminho do arquivo PDF original')
    parser.add_argument('excel_path', help='Caminho do arquivo Excel extraído')
    parser.add_argument('output_path', help='Caminho para salvar o resultado')
    parser.add_argument('--llm', action='store_true', help='Usar LLM para correção')
    parser.add_argument('--api-key', help='API key para LLM (OpenAI)')
    
    args = parser.parse_args()
    
    # Valida arquivos
    if not os.path.exists(args.pdf_path):
        print(f"ERRO: PDF não encontrado: {args.pdf_path}")
        sys.exit(1)
    
    if not os.path.exists(args.excel_path):
        print(f"ERRO: Excel não encontrado: {args.excel_path}")
        sys.exit(1)
    
    # Cria diretório de saída se necessário
    dir_saida = os.path.dirname(args.output_path)
    if dir_saida and not os.path.exists(dir_saida):
        os.makedirs(dir_saida)
    
    # Executa validação
    validador = ValidadorExtrato(usar_llm=args.llm, api_key=args.api_key)
    resultado = validador.processar(args.pdf_path, args.excel_path, args.output_path)
    
    # Sai com código de erro se falhou
    sys.exit(0 if resultado['sucesso'] else 1)


# Função de conveniência para uso via código
def validar_extrato(
    pdf_path: str,
    excel_path: str,
    output_path: str,
    usar_llm: bool = False,
    api_key: str = None
) -> Dict[str, Any]:
    """
    Função de conveniência para validar um extrato.
    
    Args:
        pdf_path: Caminho do PDF original
        excel_path: Caminho do Excel extraído
        output_path: Caminho para salvar o resultado
        usar_llm: Se True, usa LLM para correções
        api_key: API key para OpenAI
        
    Returns:
        Dicionário com resultado e métricas
    """
    validador = ValidadorExtrato(usar_llm=usar_llm, api_key=api_key)
    return validador.processar(pdf_path, excel_path, output_path)


if __name__ == "__main__":
    main()
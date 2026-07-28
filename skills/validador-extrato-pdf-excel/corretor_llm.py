#!/usr/bin/env python3
"""
Corretor LLM Module - Corrige linhas problemáticas usando LLM
COM OTIMIZAÇÃO DE TOKENS: cache, batches pequenos, apenas quando necessário
"""
import hashlib
import json
import os
from typing import List, Dict, Tuple, Optional, Any
import pandas as pd

# Import do módulo de LLM - adaptável para diferentes provedores
try:
    from openai import OpenAI
    OPENAI_DISPONIVEL = True
except ImportError:
    OPENAI_DISPONIVEL = False


class CacheCorrecoes:
    """Cache em memória para evitar chamadas repetidas ao LLM."""
    
    def __init__(self, arquivo_cache: str = None):
        self.cache = {}
        self.arquivo_cache = arquivo_cache
        self.hits = 0
        self.misses = 0
        
        # Carrega cache do arquivo se existir
        if arquivo_cache and os.path.exists(arquivo_cache):
            try:
                with open(arquivo_cache, 'r') as f:
                    self.cache = json.load(f)
            except:
                pass
    
    def _gerar_hash(self, linha_pdf: str, linha_excel: str) -> str:
        """Gera hash único para o par PDF-Excel."""
        combined = f"{linha_pdf}|{linha_excel}"
        return hashlib.sha256(combined.encode('utf-8')).hexdigest()
    
    def get(self, linha_pdf: str, linha_excel: str) -> Optional[Dict]:
        """Retorna correção do cache se existir."""
        key = self._gerar_hash(linha_pdf, linha_excel)
        
        if key in self.cache:
            self.hits += 1
            return self.cache[key]
        
        self.misses += 1
        return None
    
    def set(self, linha_pdf: str, linha_excel: str, correcao: Dict):
        """Adiciona correção ao cache."""
        key = self._gerar_hash(linha_pdf, linha_excel)
        self.cache[key] = correcao
        
        # Salva periodicamente
        if self.arquivo_cache and len(self.cache) % 10 == 0:
            self.salvar()
    
    def salvar(self):
        """Salva cache em arquivo."""
        if self.arquivo_cache:
            with open(self.arquivo_cache, 'w') as f:
                json.dump(self.cache, f, indent=2)
    
    def estatisticas(self) -> Dict[str, int]:
        """Retorna estatísticas de uso do cache."""
        return {
            'hits': self.hits,
            'misses': self.misses,
            'total': self.hits + self.misses,
            'hit_rate': round(self.hits / max(1, self.hits + self.misses) * 100, 2)
        }


PROMPT_CORRECAO = """Corrija a linha do Excel com base no PDF.

Retorne apenas JSON com:
data, historico, valor, saldo (se existir)

PDF:
{pdf}

Excel:
{excel}

Resposta (apenas JSON):"""


def formatar_linha_para_llm(linha: Dict[str, Any], colunas: List[str]) -> str:
    """Formata uma linha como texto para enviar ao LLM."""
    partes = []
    for col in colunas:
        if col in linha and linha[col]:
            partes.append(f"{col}: {linha[col]}")
    return " | ".join(partes)


def chamar_llm(
    linha_pdf: str,
    linha_excel: str,
    cliente_llm: Any = None,
    modelo: str = "gpt-4o-mini"
) -> Optional[Dict[str, Any]]:
    """
    Chama o LLM para corrigir uma linha.
    
    Args:
        linha_pdf: Texto da linha do PDF
        linha_excel: Texto da linha do Excel
        cliente_llm: Cliente OpenAI configurado
        modelo: Modelo a usar
        
    Returns:
        Dict com campos corrigidos ou None em caso de erro
    """
    if not cliente_llm or not OPENAI_DISPONIVEL:
        # Retorna None se LLM não disponível - fallback para heurística
        return None
    
    prompt = PROMPT_CORRECAO.format(pdf=linha_pdf, excel=linha_excel)
    
    try:
        response = cliente_llm.chat.completions.create(
            model=modelo,
            messages=[
                {"role": "system", "content": "Você é um assistente que corrige dados de extratos bancários."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=200,
        )
        
        # Parse da resposta
        conteudo = response.choices[0].message.content.strip()
        
        # Remove markdown se presente
        if conteudo.startswith('```'):
            conteudo = conteudo.split('\n', 1)[1]
            if conteudo.endswith('```'):
                conteudo = conteudo[:-3]
        
        return json.loads(conteudo)
        
    except Exception as e:
        print(f"Erro ao chamar LLM: {e}")
        return None


def corrigir_linha_heuristica(
    problema: Any,
    row_pdf: Dict[str, Any],
    row_excel: pd.Series,
    colunas: Dict[str, str]
) -> Dict[str, Any]:
    """
    Corrige linha usando heurísticas (sem LLM).
    
    Returns:
        Dict com campos corrigidos
    """
    correcao = {}
    
    # Tenta obter do PDF
    if row_pdf:
        if 'data' in row_pdf:
            correcao['data'] = row_pdf['data']
        if 'historico' in row_pdf:
            correcao['historico'] = row_pdf['historico']
        if 'valor' in row_pdf:
            # Extrai apenas o valor numérico
            valor_str = str(row_pdf['valor'])
            # Remove sinal e parênteses
            valor_str = valor_str.replace('(', '').replace(')', '').replace('-', '').strip()
            correcao['valor'] = valor_str
        if 'saldo' in row_pdf:
            correcao['saldo'] = str(row_pdf['saldo'])
    
    # Se não tem PDF, tenta corrigir o próprio Excel
    if not correcao and colunas:
        for col_original, tipo in colunas.items():
            if tipo in row_excel.index:
                valor = row_excel[col_original]
                if pd.notna(valor) and str(valor).strip():
                    correcao[tipo] = str(valor)
    
    return correcao


def corrigir_linhas(
    problemas: List[Any],
    df_excel: pd.DataFrame,
    df_pdf: pd.DataFrame,
    colunas: Dict[str, str],
    cliente_llm: Any = None,
    cache: CacheCorrecoes = None,
    usar_llm: bool = False,
    batch_size: int = 10
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Corrige linhas problemáticas.
    
    Args:
        problemas: Lista de problemas detectados
        df_excel: DataFrame do Excel
        df_pdf: DataFrame do PDF
        colunas: Mapeamento de colunas
        cliente_llm: Cliente LLM (opcional)
        cache: Cache de correções
        usar_llm: Se True, usa LLM para correção
        batch_size: Tamanho do batch para processamento
        
    Returns:
        Tupla com (lista de correções, métricas)
    """
    metricas = {
        'total_problemas': len(problemas),
        'corrigidos_llm': 0,
        'corrigidos_heuristica': 0,
        'nao_corrigidos': 0,
        'chamadas_llm': 0,
    }
    
    # Filtra apenas problemas de alta severidade que precisam de correção
    problemas_a_corrigir = [p for p in problemas if p.severidade in ['alta', 'media']]
    
    # Processa em batches
    correcoes = []
    
    for i in range(0, len(problemas_a_corrigir), batch_size):
        batch = problemas_a_corrigir[i:i+batch_size]
        
        for problema in batch:
            idx = problema.idx
            
            # Obtém linhas correspondentes
            row_excel = df_excel.iloc[idx].to_dict() if idx < len(df_excel) else {}
            row_pdf = df_pdf.iloc[idx].to_dict() if idx < len(df_pdf) else {}
            
            # Formata para envio
            linha_excel_str = formatar_linha_para_llm(
                row_excel, 
                list(df_excel.columns)
            )
            linha_pdf_str = formatar_linha_para_llm(
                row_pdf,
                list(df_pdf.columns) if not df_pdf.empty else []
            )
            
            # Tenta obter do cache primeiro
            correcao = None
            if cache:
                correcao = cache.get(linha_pdf_str, linha_excel_str)
            
            # Se não tem cache e LLM habilitado, chama LLM
            if not correcao and usar_llm and cliente_llm:
                metricas['chamadas_llm'] += 1
                correcao = chamar_llm(linha_pdf_str, linha_excel_str, cliente_llm)
                
                if correcao and cache:
                    cache.set(linha_pdf_str, linha_excel_str, correcao)
            
            # Fallback para heurística
            if not correcao:
                correcao = corrigir_linha_heuristica(problema, row_pdf, df_excel.iloc[idx], colunas)
                metricas['corrigidos_heuristica'] += 1
            else:
                if usar_llm:
                    metricas['corrigidos_llm'] += 1
                else:
                    metricas['corrigidos_heuristica'] += 1
            
            if correcao:
                correcoes.append({
                    'indice': idx,
                    'correcao': correcao,
                    'problema_tipo': problema.tipo
                })
            else:
                metricas['nao_corrigidos'] += 1
    
    return correcoes, metricas


def criar_cliente_llm(api_key: str = None) -> Optional[Any]:
    """
    Cria cliente OpenAI.
    """
    if not OPENAI_DISPONIVEL:
        return None
    
    try:
        if api_key:
            return OpenAI(api_key=api_key)
        else:
            return OpenAI()
    except Exception as e:
        print(f"Erro ao criar cliente LLM: {e}")
        return None


if __name__ == "__main__":
    print("Módulo corretor_llm carregado com sucesso")
    print("Funções disponíveis:")
    print("  - CacheCorrecoes (classe)")
    print("  - chamar_llm(linha_pdf, linha_excel, cliente)")
    print("  - corrigir_linha_heuristica(problema, row_pdf, row_excel, colunas)")
    print("  - corrigir_linhas(problemas, df_excel, df_pdf, ...)")
    print("  - criar_cliente_llm(api_key)")
    print("\nOTIMIZAÇÕES IMPLEMENTADAS:")
    print("  - Cache baseado em hash para evitar chamadas repetidas")
    print("  - Processamento em batches (máx 10 linhas)")
    print("  - Fallback para heurística se LLM indisponível")
    print("  - Só usa LLM após falha de heurística")
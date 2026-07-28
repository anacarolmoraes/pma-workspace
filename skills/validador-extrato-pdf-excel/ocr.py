#!/usr/bin/env python3
"""
OCR Module - Extrai texto de PDFs escaneados usando Tesseract
"""
import os
import subprocess
from typing import Optional, List
import pdfplumber
from pdf2image import convert_from_path


def instalar_tesseract() -> bool:
    """
    Verifica se Tesseract está instalado no sistema.
    Retorna True se disponível.
    """
    try:
        result = subprocess.run(['tesseract', '--version'], 
                              capture_output=True, text=True)
        return result.returncode == 0
    except:
        return False


def ocr_pdf_para_texto(pdf_path: str, idioma: str = 'por') -> str:
    """
    Extrai texto de PDF escaneado usando OCR.
    
    Args:
        pdf_path: Caminho do arquivo PDF
        idioma: Código do idioma (padrão: 'por' para português)
        
    Returns:
        Texto extraído via OCR
    """
    import pytesseract
    from pdf2image import convert_from_path
    
    texto_total = []
    
    # Converte PDF em imagens
    try:
        imagens = convert_from_path(pdf_path)
        
        for i, img in enumerate(imagens):
            # OCR em cada página
            texto = pytesseract.image_to_string(img, lang=idioma)
            texto_total.append(f"--- PAGE {i+1} ---\n{texto}")
        
        return '\n'.join(texto_total)
    
    except Exception as e:
        print(f"Erro no OCR: {e}")
        return ""


def extrair_texto_flexivel(pdf_path: str) -> dict:
    """
    Tenta extrair texto do PDF, recorrendo a OCR se necessário.
    
    Args:
        pdf_path: Caminho do arquivo PDF
        
    Returns:
        Dict com:
            - texto: str - texto extraído
            - metodo: str - 'direct' (texto direto) ou 'ocr'
            - confianca: float - confiança da extração
    """
    resultado = {
        'texto': '',
        'metodo': 'none',
        'confianca': 0.0,
    }
    
    # Primeiro tenta extração direta
    with pdfplumber.open(pdf_path) as pdf:
        texto_direto = ""
        for page in pdf.pages:
            texto_direto += page.extract_text() or ""
    
    # Se tem texto direto significativo, usa ele
    if texto_direto.strip() and len(texto_direto.strip()) > 50:
        resultado['texto'] = texto_direto
        resultado['metodo'] = 'direct'
        resultado['confianca'] = 1.0
        return resultado
    
    # Se não tem texto, tenta OCR
    # Primeiro verifica se Tesseract está disponível
    if instalar_tesseract():
        texto_ocr = ocr_pdf_para_texto(pdf_path)
        if texto_ocr.strip():
            resultado['texto'] = texto_ocr
            resultado['metodo'] = 'ocr'
            resultado['confianca'] = 0.7  # OCR é menos confiável
            return resultado
    
    # Se OCR não está disponível, retorna o que conseguiu
    resultado['texto'] = texto_direto
    resultado['metodo'] = 'direct'
    resultado['confianca'] = 0.5 if texto_direto.strip() else 0.0
    
    return resultado


if __name__ == "__main__":
    print("Módulo OCR carregado")
    print("Funções disponíveis:")
    print("  - extrair_texto_flexivel(pdf_path)")
    print("  - ocr_pdf_para_texto(pdf_path, idioma)")
    print("  - instalar_tesseract()")
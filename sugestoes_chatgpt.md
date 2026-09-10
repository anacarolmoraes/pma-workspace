# Sugestões para o `humanizer-forense`

As notas consideram impacto jurídico, redução de risco, esforço de implementação e prioridade.

| Sugestão | Nota | Avaliação |
|---|---:|---|
| Guardião de invariantes antes/depois | **10/10** | Maior ganho. Impede que a humanização altere números, pedidos, negações, modalidade, precedentes ou transcrições. |
| Análise sempre obrigatória; alteração condicional | **9,5/10** | Resolve a divergência entre as instruções e evita tanto pular a revisão quanto modificar texto que já esteja bom. |
| Corrigir falsos positivos e diferenças entre regra e código | **9/10** | Ajuste pequeno, objetivo e necessário para aumentar a confiança no lint atual. |
| Separar bloqueios de avisos estilísticos | **8,5/10** | Evita que o redator escreva apenas para satisfazer contadores arbitrários. Exige boa classificação dos padrões. |
| Diagnóstico não bloqueante de ritmo | **8/10** | Ataca justamente o que o lint atual reconhece não detectar. É útil, mas necessariamente heurístico. |
| Perfil canônico da voz forense | **7,5/10** | Melhora a consistência e a identidade do escritório. Precisa ser construído cuidadosamente para não virar outro modelo mecânico. |
| Registrar a passagem do humanizer no `.validacao.md` | **7/10** | Bom para auditoria do pipeline, embora não melhore sozinho a qualidade da peça. |
| Acrescentar mais palavras ou expressões proibidas | **3/10** | Baixo retorno e grande risco de empobrecer a linguagem jurídica. Não recomendado neste momento. |

## 1. Criar um guardião de invariantes antes e depois da humanização

Esta é a melhoria prioritária. O `humanizer-forense` declara que não altera números, datas, dispositivos, julgados, transcrições, títulos-tese nem modalidade jurídica, mas atualmente essa proteção depende de disciplina.

Criar um script como `checar-invariantes.js`, que compare a versão anterior e posterior e bloqueie alterações em:

- valores monetários e percentuais;
- datas;
- artigos, incisos, alíneas e parágrafos;
- números de processos, Temas, Súmulas e precedentes;
- conteúdo de citações em bloco;
- nomes e identificação das partes;
- pedidos;
- expressões de modalidade, como “ainda que”, “caso”, “se”, “mesmo que” e “subsidiariamente”;
- negações juridicamente relevantes;
- títulos-tese e ordem dos capítulos.

Exemplo de saída:

```text
✔ transcrições preservadas
✔ números e datas preservados
✔ dispositivos preservados
✔ modalidade preservada
✘ pedido “condenar” foi alterado para “reconhecer”
```

Essa proteção reduz mais risco jurídico do que a simples inclusão de novos padrões estilísticos.

## 2. Tornar obrigatória a análise, não a alteração

Harmonizar o pipeline da seguinte forma:

```text
humanizer-forense: sempre executado
alteração da prosa: somente quando necessária
revalidação jurídica: obrigatória quando houver alteração
```

O resultado pode ser registrado no frontmatter de `<PECA>.validacao.md`:

```yaml
humanizer_analisado: sim
humanizer_alterou: nao
invariantes: preservados
```

Não é necessário criar outro artefato apenas para esse registro.

## 3. Separar bloqueios de avisos estilísticos

O excesso de limites rígidos pode induzir o redator a escrever para satisfazer o lint, produzindo texto artificial de outra maneira.

### Padrões que devem bloquear

- rótulo metatextual proibido;
- frase-clone idêntica;
- cadência mecânica repetida;
- parágrafo inteiro em negrito;
- alteração de transcrição ou de invariante jurídico.

### Padrões que devem gerar aviso para revisão

- mais de dois travessões no capítulo;
- conectivo repetido;
- frase curta isolada;
- ocorrência isolada de “impõe-se” ou fórmula semelhante;
- título possivelmente genérico;
- possível tríade retórica.

O bloqueio deve ficar reservado ao que represente erro claro. Frequência estilística é indício para revisão, não prova automática de redação ruim.

## 4. Corrigir comportamentos do `lint-ia.js`

Existem duas fragilidades relevantes:

1. O detector de título vazio pode advertir sobre título curto que já enuncie uma tese. Por exemplo, “A pretensão está prescrita” tem quatro palavras e é uma conclusão, mas pode ser tratado como título suspeito.
2. O preâmbulo é excluído da contagem por capítulo, mas entra em algumas contagens globais porque a variável de prosa reúne também o segmento de preâmbulo. Isso pode gerar falsos positivos fora da argumentação.

Também deve ser eliminada a diferença entre a documentação e a implementação: a skill declara detectar construções como “não é X, é Y”, enquanto a expressão regular atual cobre apenas formas mais específicas.

## 5. Acrescentar diagnóstico de ritmo sem bloqueio

O próprio `SKILL.md` reconhece que lint verde não significa prosa aprovada. Acrescentar avisos quantitativos para:

- comprimento excessivamente uniforme das frases;
- quatro ou mais parágrafos com tamanho semelhante;
- parágrafos consecutivos com a mesma arquitetura;
- repetição de aberturas, como “A parte autora...” em sequência;
- repetição de “Além disso”, “Nesse sentido” ou “Ademais”;
- sucessão rígida de norma, aplicação e conclusão;
- densidade excessiva de títulos em relação à quantidade de prosa.

Esses resultados devem servir como diagnóstico para a passada humana, sem reprovação automática.

## 6. Melhorar a calibração da voz do escritório

Substituir a fronteira rígida de seis capítulos por uma regra proporcional:

- peça curta: usar o perfil canônico de voz;
- peça longa ou estratégica: usar o perfil de voz e uma peça humana próxima;
- nunca copiar fatos ou trechos da peça usada como referência.

Uma possibilidade é criar `perfil/voz-forense.md`, contendo somente características abstratas e exemplos fictícios: extensão típica dos períodos, conectivos preferidos, grau de combatividade e formas usuais de transição. Nenhum documento ou dado de cliente deve ser incorporado ao perfil.

## 7. Ordem recomendada de implementação

1. Guardião de invariantes.
2. Correções no `lint-ia.js`.
3. Humanizer sempre analisando, mas alterando somente quando necessário.
4. Separação entre erros bloqueantes e avisos.
5. Diagnóstico de ritmo.
6. Perfil de voz do escritório.

Se apenas uma mudança puder ser executada, a recomendação é implementar o **guardião de invariantes**. Ele protege diretamente o mérito jurídico; as demais mudanças aprimoram principalmente a qualidade estilística e a auditabilidade do pipeline.

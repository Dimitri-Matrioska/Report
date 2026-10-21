# -*- coding: utf-8 -*-
"""
agregacoes.py
=============
Camada de AGREGACAO entre os dados brutos (/dados/*.json) e as paginas.

O `linkar_dados.py` garante que o JSON traga os registros crus da planilha.
Este modulo resolve a outra metade do problema: os visuais do PBIP apontam
para campos agregados (`Count(Desvios STMA.ID)`, `Sum(Medicoes.Aderencia)`,
`STMA.Resultado`...), que nao existem linha-a-linha.

Cada pagina declara, em `PAGINAS`, quais datasets precisa e quais campos
agregados (medidas DAX) usa. O `aplicar_agregacoes()` "materializa" esses
campos em cada registro, respeitando o contexto de filtro (contratada + mes),
e o `gerar.py` grava o catalogo em `dados/agregacoes.json`.

Formato de uma medida:
    {'campo': 'id_count', 'tipo': 'count', 'origem': 'id'}
    {'campo': 'aderencia_sum', 'tipo': 'sum', 'origem': 'aderencia'}
    {'campo': 'resultado_calc', 'tipo': 'expr', 'expr': 'resultado / 100'}
    {'campo': 'farol_de_dois', 'tipo': 'const', 'valor': 2}

Uso:
    from gerador.agregacoes import aplicar_agregacoes
    catalogo = montar_catalogo()     # {nome: {contexto, registros, medidas}}
"""
from __future__ import annotations

import json
import os
import re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASTA_DADOS = os.path.join(RAIZ, 'dados')

# --------------------------------------------------------------------
# Operacoes matematicas seguras para as medidas do tipo 'expr'
# --------------------------------------------------------------------
_OPS = {
    '+': lambda a, b: a + b,
    '-': lambda a, b: a - b,
    '*': lambda a, b: a * b,
    '/': lambda a, b: (a / b) if b else None,
}


def _num(v):
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).replace(',', '.'))
    except (TypeError, ValueError):
        return None


def _media(valores):
    return sum(valores) / len(valores) if valores else None


# tipo -> funcao(lista_de_valores) -> valor agregado
AGREGADORES = {
    'count': lambda vs: float(len(vs)),
    'counta': lambda vs: float(sum(1 for v in vs if v not in (None, ''))),
    'distinct': lambda vs: float(len(set(vs))),
    'sum': lambda vs: float(sum(vs)),
    'avg': _media,
    'min': lambda vs: float(min(vs)) if vs else None,
    'max': lambda vs: float(max(vs)) if vs else None,
}


def carregar(nome):
    """Le /dados/<nome>.json. Devolve [] se nao existir."""
    caminho = os.path.join(PASTA_DADOS, f'{nome}.json')
    if not os.path.isfile(caminho):
        return []
    with open(caminho, encoding='utf-8') as f:
        dados = json.load(f)
    return dados if isinstance(dados, list) else []


# --------------------------------------------------------------------
# Contexto de filtro (equivale aos "slicers" do Power BI)
# --------------------------------------------------------------------
# Campos que NAO contam como "conteudo" ao decidir se um mes tem dados:
# sao colunas estruturais (rotulos/datas) ou acumulados que a planilha ja
# preenche ate o fim do contrato mesmo em meses que ainda nao comecaram.
CAMPOS_ESTRUTURAIS = {
    'mes_referencia', 'mes', 'data', 'dia', 'data_medicao', 'data_acao',
    'semana', 'contratada', 'contratada_reduzida', 'id_contrato',
    'numero_medicao', 'historica_acum', 'historica_media_dia',
    # Acumulados/serie de contrato: o Excel preenche ate o fim do contrato
    'baseline_1_acum', 'real_acum', 'projetado_acum',
}

# Quantos campos de conteudo um mes precisa ter para ser considerado "o mes
# corrente". Totais semanais (baseline_1_acum/real_acum/projetado_acum) ficam
# de fora da contagem: eles ja vem preenchidos ate o fim do contrato.
MIN_CONTEUDO = 3

# Datas/meses aceitos como candidatos a "mes corrente".
RE_ISO = re.compile(r'^\d{4}-\d{2}-\d{2}')


def _mes_da_linha(reg):
    """Primeiro campo de data/mes preenchido do registro."""
    for campo in ('mes_referencia', 'mes', 'data'):
        valor = reg.get(campo)
        if isinstance(valor, str) and valor:
            return campo, valor
    return None, None


def _aplicar_filtros(dados, filtros):
    """
    Aplica os filtros do contexto. O filtro de mes aceita qualquer um dos
    tres campos de data, porque nem todo dataset tem `mes` preenchido.
    """
    if not filtros:
        return dados

    saida = list(dados)
    for campo, valor in filtros.items():
        if campo in ('mes_referencia', 'mes', 'data'):
            # Compara pelo primeiro campo de data que o registro tiver
            saida = [r for r in saida
                     if valor in (r.get('mes_referencia'), r.get('mes'),
                                  r.get('data'))]
        else:
            saida = [r for r in saida if r.get(campo) == valor]
    return saida


def _contexto_padrao(dados):
    """
    Contexto de filtro do site: contratada principal + ultimo mes COM DADOS.

    O PBIP filtra por 'Contratada', 'Ano/Mes' e 'SemanaDoProjeto'. Como o
    site carrega os JSONs completos, o filtro precisa ser aplicado aqui,
    senao as agregacoes somariam todos os contratos e todo o historico.

    Pegadinha: o Excel preenche o CALENDARIO ate o fim do contrato — os meses
    futuros ja tem data, semana e ate colunas de baseline preenchidas. Tomar
    o maior rotulo mes/ano daria um mes futuro vazio. Por isso:

      * um mes so e considerado "com dados" se tiver `MIN_CONTEUDO` campos
        de conteudo (o baseline nao conta — ver CAMPOS_ESTRUTURAIS);
      * os meses candidatos com pelo menos METADE do conteudo do mes mais
        completo formam a janela "em andamento" e o ultimo deles vence.
        Isso evita que um mes parcial (ex.: ainda em preenchimento) seja
        preterido por um mes posterior que tambem esta incompleto.

    Datasets sem nenhuma medida (ex.: calendarios) ficam sem filtro de mes.
    """
    filtros = {}

    contratadas = [r.get('contratada') for r in dados if r.get('contratada')]
    if contratadas:
        # a contratada "principal" e a que aparece mais vezes (TERRAM)
        filtros['contratada'] = max(set(contratadas), key=contratadas.count)

    for campo in ('mes_referencia', 'mes', 'data'):
        por_mes = {}
        for r in dados:
            mes = r.get(campo)
            # So datas ISO servem como "mes". Rotulos como "OLD" (Milestones)
            # ou strings soltas ficam de fora da escolha do mes corrente.
            if not isinstance(mes, str) or not RE_ISO.match(mes):
                continue
            preenchidos = sum(
                1 for k, v in r.items()
                if k not in CAMPOS_ESTRUTURAIS and v is not None and v != ''
            )
            # `real` = se a linha tem alguma medida REAL (nao prevista).
            # Meses do calendario em que o contrato ainda nao entrou em
            # execucao tem colunas preenchidas, mas nenhuma medida real.
            real = 1 if r.get('real') not in (None, '') else 0
            atual = por_mes.get(mes, (0, 0))
            por_mes[mes] = (max(atual[0], preenchidos), max(atual[1], real))

        # Meses sem nenhuma medida nao entram na escolha
        candidatos = {m: n for m, (n, _) in por_mes.items() if n > 0}
        if not candidatos:
            continue

        pico = max(candidatos.values())
        cheios = sorted(m for m, n in candidatos.items() if n >= MIN_CONTEUDO)
        if not cheios:
            cheios = sorted(candidatos)

        # Preferencia: mes completo E com medida real
        com_real = [m for m in cheios if por_mes[m][1]]
        em_curso = [m for m in (com_real or cheios) if candidatos[m] >= pico / 2]
        filtros[campo] = (em_curso or com_real or cheios)[-1]
        break

    return filtros


# --------------------------------------------------------------------
# Materializacao das medidas
# --------------------------------------------------------------------
def _avaliar_expr(expr, reg):
    """Avalia expressoes simples: 'a / 100', 'a * 2', 'a - b'."""
    expr = (expr or '').strip()
    m = re.fullmatch(r'([a-z0-9_]+)\s*([-+*/])\s*([a-z0-9_]+)', expr)
    if m:
        a, op, b = m.groups()
        va, vb = _num(reg.get(a)), _num(reg.get(b))
        if va is None or vb is None:
            return None
        return _OPS[op](va, vb)
    m = re.fullmatch(r'([a-z0-9_]+)\s*([-+*/])\s*(\d+(?:\.\d+)?)', expr)
    if m:
        a, op, b = m.groups()
        va, vb = _num(reg.get(a)), float(b)
        if va is None:
            return None
        return _OPS[op](va, vb)
    return None


def _calcular(tipo, origem, linhas):
    valores = []
    for r in linhas:
        v = _num(r.get(origem))
        if v is not None:
            valores.append(v)
    fn = AGREGADORES.get(tipo)
    if fn is None:
        return None
    try:
        return fn(valores)
    except (TypeError, ValueError):
        return None


def aplicar_agregacoes(dataset, medidas, filtros=None):
    """
    Devolve uma copia de `dataset` com as medidas materializadas.

    dataset : lista de registros (ex.: conteudo de dados/stma.json)
    medidas : lista de dicts descritos no cabecalho deste modulo
    filtros : dict {campo: valor}; None -> usa `_contexto_padrao`

    Cada medida agregada recebe o MESMO valor em todas as linhas (e o valor do
    contexto filtrado), reproduzindo o comportamento de slicer do Power BI.
    Medidas do tipo 'expr' sao calculadas linha a linha.
    """
    if not dataset:
        return []

    ctx = filtros if filtros is not None else _contexto_padrao(dataset)
    filtrado = _aplicar_filtros(dataset, ctx) or dataset

    agregados = {}
    for m in medidas:
        campo, tipo = m.get('campo'), m.get('tipo')
        if not campo or tipo == 'expr':
            continue
        if tipo == 'const':
            agregados[campo] = m.get('valor')
        else:
            agregados[campo] = _calcular(tipo, m.get('origem'), filtrado)

    saida = []
    for reg in dataset:
        novo = dict(reg)
        novo.update(agregados)
        for m in medidas:
            if m.get('tipo') == 'expr' and m.get('campo'):
                novo[m['campo']] = _avaliar_expr(m.get('expr'), reg)
        saida.append(novo)

    return saida


def contexto(dataset):
    """Expoe o contexto de filtro calculado (util para debug)."""
    return _contexto_padrao(dataset)


# --------------------------------------------------------------------
# CATALOGO POR PAGINA
# --------------------------------------------------------------------
# Cada entrada: {dataset: [medidas...]}
# Uma pagina pode depender de varios datasets; a primeira ocorrencia ganha.
# --------------------------------------------------------------------
PAGINAS = {
    'stma': {
        # KPI "CURVA FÍSICA SEMANA" -> STMA.Resultado (count)
        'stma': [
            {'campo': 'resultado_count', 'tipo': 'count', 'origem': 'resultado'},
            {'campo': 'resultado_sum', 'tipo': 'sum', 'origem': 'resultado'},
            {'campo': 'resultado_media', 'tipo': 'avg', 'origem': 'resultado'},
        ],
        # Graficos de desvios: Count(Desvios STMA.ID) x Potencial de Gravidade
        'desvios_stma': [
            {'campo': 'id_count', 'tipo': 'count', 'origem': 'id'},
            {'campo': 'id_distinct', 'tipo': 'distinct', 'origem': 'id'},
            {'campo': 'dias_media', 'tipo': 'avg', 'origem': 'dias_resolucao'},
            {'campo': 'id_max', 'tipo': 'max', 'origem': 'id'},
        ],
        # Grafico "AÇÕES DESVIOS GRAVES": Count(Ações Desvios.Ação)
        'acoes': [
            {'campo': 'acao_count', 'tipo': 'counta', 'origem': 'acao'},
            {'campo': 'acao_distinct', 'tipo': 'distinct', 'origem': 'acao'},
        ],
    },

    'pluviometria': {
        'pluviometria': [
            {'campo': 'mm_dia_media', 'tipo': 'avg', 'origem': 'mm_dia'},
            {'campo': 'mm_dia_min', 'tipo': 'min', 'origem': 'mm_dia'},
            {'campo': 'mm_acum_sum', 'tipo': 'sum', 'origem': 'mm_acum'},
            {'campo': 'historica_acum_sum', 'tipo': 'sum', 'origem': 'historica_acum'},
            {'campo': 'dias_paralisados', 'tipo': 'counta', 'origem': 'dia_paralisado'},
        ],
    },

    'performance-semanal': {
        'fisico_total': [
            {'campo': 'baseline_acum_sum', 'tipo': 'sum', 'origem': 'baseline_1_acum'},
            {'campo': 'real_acum_sum', 'tipo': 'sum', 'origem': 'real_acum'},
            {'campo': 'projetado_acum_sum', 'tipo': 'sum', 'origem': 'projetado_acum'},
            {'campo': 'aderencia_media', 'tipo': 'avg', 'origem': 'aderencia'},
        ],
        'status_semanal': [
            {'campo': 'item_count', 'tipo': 'count', 'origem': 'item'},
        ],
    },

    'one-page': {
        'medicoes': [
            {'campo': 'valor_medicao_sum', 'tipo': 'sum', 'origem': 'valor_medicao'},
            {'campo': 'valor_acumulado_sum', 'tipo': 'sum', 'origem': 'valor_acumulado'},
            {'campo': 'saldo_sum', 'tipo': 'sum', 'origem': 'valor_saldo'},
            {'campo': 'retencao_sum', 'tipo': 'sum', 'origem': 'valor_retencao'},
            {'campo': 'aderencia_sum', 'tipo': 'sum', 'origem': 'aderencia'},
            {'campo': 'desvio_sum', 'tipo': 'sum', 'origem': 'desvio_pct'},
        ],
        'dados_contrato': [
            {'campo': 'valor_total_sum', 'tipo': 'sum', 'origem': 'valor_total'},
            {'campo': 'medido_sum', 'tipo': 'sum', 'origem': 'medido'},
            {'campo': 'saldo_sum', 'tipo': 'sum', 'origem': 'saldo'},
            {'campo': 'contrato_count', 'tipo': 'count', 'origem': 'id_contrato'},
            {'campo': 'contrato_max', 'tipo': 'max', 'origem': 'id_contrato'},
        ],
        'fisico_total': [
            {'campo': 'baseline_acum_sum', 'tipo': 'sum', 'origem': 'baseline_1_acum'},
            {'campo': 'real_acum_sum', 'tipo': 'sum', 'origem': 'real_acum'},
            # medidas calculadas (colunas com "_" no PBIP)
            {'campo': 'desvio', 'tipo': 'expr', 'expr': 'real_acum - baseline_1_acum'},
            {'campo': 'desvio_acumulada',
             'tipo': 'expr', 'expr': 'real_acum - baseline_1_acum'},
        ],
    },

    'detalhe-one-page': {
        'medicoes': [
            {'campo': 'aderencia_sum', 'tipo': 'sum', 'origem': 'aderencia'},
            {'campo': 'valor_medicao_sum', 'tipo': 'sum', 'origem': 'valor_medicao'},
            {'campo': 'valor_acumulado_sum', 'tipo': 'sum', 'origem': 'valor_acumulado'},
        ],
        'fisico_total': [
            {'campo': 'baseline_acum_sum', 'tipo': 'sum', 'origem': 'baseline_1_acum'},
            {'campo': 'real_acum_sum', 'tipo': 'sum', 'origem': 'real_acum'},
        ],
    },

    'sla': {
        'sla': [
            {'campo': 'meta_media', 'tipo': 'avg', 'origem': 'meta'},
            {'campo': 'resultado_media', 'tipo': 'avg', 'origem': 'resultado'},
            {'campo': 'aplicacao_sla_sum', 'tipo': 'sum', 'origem': 'aplicacao_sla'},
            {'campo': 'indicador_count', 'tipo': 'counta', 'origem': 'indicador'},
            {'campo': 'indicador_distinct', 'tipo': 'distinct', 'origem': 'indicador'},
        ],
    },

    'igpp-gf': {
        'igpp_gf': [
            {'campo': 'peso_sum', 'tipo': 'sum', 'origem': 'peso'},
            {'campo': 'pontos_sum', 'tipo': 'sum', 'origem': 'pontos'},
            {'campo': 'qde_sum', 'tipo': 'sum', 'origem': 'qde'},
            {'campo': 'resultado_apuracao_sum', 'tipo': 'sum', 'origem': 'resultado_apuracao'},
            {'campo': 'resultado_igpp_media', 'tipo': 'avg', 'origem': 'resultado_igpp'},
            {'campo': 'meta_contrato_media', 'tipo': 'avg', 'origem': 'meta_contrato'},
        ],
    },

    'histograma': {
        'histograma': [
            {'campo': 'previsto_sum', 'tipo': 'sum', 'origem': 'previsto'},
            {'campo': 'real_sum', 'tipo': 'sum', 'origem': 'real'},
            {'campo': 'equipamento_distinct', 'tipo': 'distinct', 'origem': 'equipamento'},
        ],
    },

    'base-desvios': {
        'desvios_stma': [
            {'campo': 'id_count', 'tipo': 'count', 'origem': 'id'},
            {'campo': 'id_distinct', 'tipo': 'distinct', 'origem': 'id'},
            {'campo': 'dias_media', 'tipo': 'avg', 'origem': 'dias_resolucao'},
            {'campo': 'dias_max', 'tipo': 'max', 'origem': 'dias_resolucao'},
        ],
    },

    'stma-mes': {
        'stma': [
            {'campo': 'resultado_count', 'tipo': 'count', 'origem': 'resultado'},
            {'campo': 'resultado_sum', 'tipo': 'sum', 'origem': 'resultado'},
            {'campo': 'indicador_distinct', 'tipo': 'distinct', 'origem': 'indicador'},
        ],
    },

    'stma-recorrencias': {
        'stma': [
            {'campo': 'resultado_count', 'tipo': 'count', 'origem': 'resultado'},
            {'campo': 'resultado_sum', 'tipo': 'sum', 'origem': 'resultado'},
        ],
        'desvios_stma': [
            {'campo': 'id_count', 'tipo': 'count', 'origem': 'id'},
            {'campo': 'id_distinct', 'tipo': 'distinct', 'origem': 'id'},
        ],
    },

    'contratos': {
        'dados_contrato': [
            {'campo': 'valor_total_sum', 'tipo': 'sum', 'origem': 'valor_total'},
            {'campo': 'medido_sum', 'tipo': 'sum', 'origem': 'medido'},
            {'campo': 'saldo_sum', 'tipo': 'sum', 'origem': 'saldo'},
            {'campo': 'contrato_count', 'tipo': 'count', 'origem': 'id_contrato'},
        ],
    },

    'medicoes': {
        'medicoes': [
            {'campo': 'valor_medicao_sum', 'tipo': 'sum', 'origem': 'valor_medicao'},
            {'campo': 'valor_acumulado_sum', 'tipo': 'sum', 'origem': 'valor_acumulado'},
            {'campo': 'saldo_sum', 'tipo': 'sum', 'origem': 'valor_saldo'},
            {'campo': 'aderencia_media', 'tipo': 'avg', 'origem': 'aderencia'},
        ],
    },

    'milestones': {
        'milestones': [
            {'campo': 'milestone_count', 'tipo': 'counta', 'origem': 'milestone'},
            {'campo': 'milestone_distinct', 'tipo': 'distinct', 'origem': 'milestone'},
            {'campo': 'farol_count', 'tipo': 'counta', 'origem': 'farol'},
        ],
    },

    'acoes': {
        'acoes': [
            {'campo': 'acao_count', 'tipo': 'counta', 'origem': 'acao'},
            {'campo': 'acao_distinct', 'tipo': 'distinct', 'origem': 'acao'},
            {'campo': 'responsavel_distinct', 'tipo': 'distinct', 'origem': 'responsavel'},
        ],
    },

    'servicos-notaveis': {
        'servicos_notaveis': [
            {'campo': 'total_sum', 'tipo': 'sum', 'origem': 'total'},
            {'campo': 'previsto_sum', 'tipo': 'sum', 'origem': 'previsto'},
            {'campo': 'real_sum', 'tipo': 'sum', 'origem': 'real'},
            {'campo': 'avanco_media', 'tipo': 'avg', 'origem': 'avanco'},
        ],
    },
}


def montar_catalogo():
    """
    Materializa as medidas de TODAS as paginas.

    Um mesmo dataset pode ser declarado por varias paginas com medidas
    diferentes; as listas sao UNIFICADAS (senao a ultima declaracao
    apagaria os campos das anteriores).

    Devolve:
        {nome_dataset: {'contexto': {...},
                        'registros': [...],
                        'medidas': [campos...]}}
    """
    # 1) unifica as medidas por dataset, preservando a ordem de declaracao
    unificadas = {}
    for datasets in PAGINAS.values():
        for nome, medidas in datasets.items():
            atual = unificadas.setdefault(nome, [])
            existentes = {m.get('campo') for m in atual}
            for m in medidas:
                if m.get('campo') not in existentes:
                    atual.append(m)

    # 2) materializa
    resultados = {}
    for nome, medidas in unificadas.items():
        dados = carregar(nome)
        resultados[nome] = {
            'contexto': _contexto_padrao(dados) if dados else {},
            'registros': aplicar_agregacoes(dados, medidas) if dados else [],
            'medidas': [m['campo'] for m in medidas],
        }
    return resultados


def main():
    """Grava dados/agregacoes.json (catalogo consumido pelas paginas)."""
    catalogo = montar_catalogo()
    caminho = os.path.join(PASTA_DADOS, 'agregacoes.json')
    tmp = caminho + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(catalogo, f, ensure_ascii=False, indent=2)
    os.replace(tmp, caminho)

    print(f'Catalogo de agregacoes -> {os.path.relpath(caminho, RAIZ)}')
    for nome, bloco in catalogo.items():
        print(f'  {nome:20} {len(bloco["registros"]):5} registros  '
              f'campos: {", ".join(bloco["medidas"]) or "-"}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

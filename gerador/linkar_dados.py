# -*- coding: utf-8 -*-
"""
linkar_dados.py
===============
Funcao canonica de LINK entre a planilha-mestra e o site.

    DataBase/Dados_GeraisReport_AFR.xlsx  ->  dados/*.json

Diferente de `coletar_dados.py` (que cobre so 3 abas), este modulo mapeia
TODAS as abas relevantes de forma DECLARATIVA: cada aba vira um "spec" com
o nome do JSON de saida e a lista de colunas que interessam. Colunas sao
resolvidas por apelido tolerante (sem acento / case-insensitive / substring),
entao renomear uma coluna no Excel nao quebra a geracao.

Uso como script:
    python gerador/linkar_dados.py                 # regera todos os JSONs
    python gerador/linkar_dados.py --somente stma  # regera apenas um
    python gerador/linkar_dados.py --verificar     # so valida, nao grava
    python gerador/linkar_dados.py --xlsx outro.xlsx

Uso como biblioteca:
    from gerador.linkar_dados import linkar_dados
    resultado = linkar_dados()          # dict {json: n_registros}
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
from datetime import date, datetime

try:
    import openpyxl
except ImportError:  # pragma: no cover
    openpyxl = None

# --------------------------------------------------------------------
# Caminhos
# --------------------------------------------------------------------
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX_PADRAO = os.path.join(RAIZ, 'DataBase', 'Dados_GeraisReport_AFR.xlsx')
PASTA_DADOS = os.path.join(RAIZ, 'dados')

# --------------------------------------------------------------------
# Normalizacao / conversao de tipos
# --------------------------------------------------------------------
def normalizar(txt) -> str:
    """Rotulo sem acento, minusculo, espacos colapsados."""
    if txt is None:
        return ''
    s = unicodedata.normalize('NFKD', str(txt))
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'\s+', ' ', s).strip().lower()


def eh_data_serial(nome_col) -> bool:
    """Cabecalhos do tipo '2026-03-09 00:00:00' sao datas serializadas."""
    return isinstance(nome_col, (datetime, date)) or bool(
        re.match(r'^\d{4}-\d{2}-\d{2}', str(nome_col or ''))
    )


def iso_data(v):
    """datetime/date/str -> 'YYYY-MM-DD' (ou None)."""
    if v is None or v == '':
        return None
    if isinstance(v, (datetime, date)):
        return v.strftime('%Y-%m-%d')
    s = str(v).strip()
    m = re.match(r'(\d{4})-(\d{2})-(\d{2})', s)
    return f'{m.group(1)}-{m.group(2)}-{m.group(3)}' if m else s


def num(v):
    """Valor -> float (aceita virgula decimal) ou None."""
    if v is None or v == '':
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace('.', '').replace(',', '.') if ',' in str(v) else str(v).strip()
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def inteiro(v):
    f = num(v)
    return int(f) if f is not None else None


def texto(v):
    if v is None:
        return None
    s = str(v).strip()
    return s or None


TIPOS = {
    'texto': texto,
    'data': iso_data,
    'num': num,
    'int': inteiro,
    'flag': lambda v: texto(v).lower() if texto(v) else None,
}

# --------------------------------------------------------------------
# Resolution de abas e colunas
# --------------------------------------------------------------------
def achar_aba(wb, alvo: str):
    """Aba por nome normalizado; tolera variacoes de encoding/espaco."""
    alvo_n = normalizar(alvo)
    for nome in wb.sheetnames:
        if normalizar(nome) == alvo_n:
            return nome
    for nome in wb.sheetnames:
        if alvo_n in normalizar(nome) or normalizar(nome) in alvo_n:
            return nome
    return None


def achar_coluna(cabecalhos, *apelidos, obrigatoria=True):
    """Indice da coluna que casa com um dos apelidos (exato, depois substring)."""
    norm = [normalizar(h) if not eh_data_serial(h) else None for h in cabecalhos]
    for apelido in apelidos:
        ap = normalizar(apelido)
        for i, h in enumerate(norm):
            if h == ap:
                return i
    for apelido in apelidos:
        ap = normalizar(apelido)
        for i, h in enumerate(norm):
            if h and ap and ap in h:
                return i
    if obrigatoria:
        raise KeyError(f'coluna {apelidos} nao encontrada em {cabecalhos}')
    return None


# --------------------------------------------------------------------
# Specs de link: cada aba -> um JSON
#   (chave)        nome do JSON (sem .json)
#   aba            nome da aba no Excel
#   colunas        [(campo_json, (apelidos...), tipo), ...]
#   chave_dedup    campo usado para descartar linha totalmente vazia
# --------------------------------------------------------------------
SPECS = [
    {
        'json': 'fisico_total',
        'aba': '% Fisico Total',
        'colunas': [
            ('id_contrato', ('ID Contrato',), 'texto'),
            ('contratada', ('Contratada',), 'texto'),
            ('mes', ('Mes', 'Mês'), 'data'),
            ('semana', ('Semana',), 'int'),
            ('data', ('Data',), 'data'),
            ('baseline_1', ('Baseline 1',), 'num'),
            ('baseline_1_acum', ('Baseline 1 Acum',), 'num'),
            ('real', ('Real',), 'num'),
            ('real_acum', ('Real Acum',), 'num'),
            ('projetado_acum', ('Projetado Acum',), 'num'),
            ('aderencia', ('Aderencia', 'Aderência'), 'num'),
        ],
        'chave_dedup': 'data',
    },
    {
        'json': 'pluviometria',
        'aba': 'Pluviometria',
        'colunas': [
            ('mes', ('Mes', 'Mês'), 'data'),
            ('semana', ('Semana',), 'int'),
            ('data', ('Data',), 'data'),
            ('historica_acum', ('historica acum', 'histórica acum'), 'num'),
            ('historica_media_dia', ('historica media/dia', 'histórica média/dia'), 'num'),
            ('mm_dia', ('mm/dia', 'mm dia'), 'num'),
            ('mm_acum', ('mm acum',), 'num'),
            ('dia_paralisado', ('dia paralisado',), 'flag'),
        ],
        'chave_dedup': 'data',
    },
    {
        'json': 'status_semanal',
        'aba': 'Status Semanal',
        'colunas': [
            ('contratada', ('Contratada',), 'texto'),
            ('mes_referencia', ('Mes Referencia', 'Mês Referência', 'Mes'), 'data'),
            ('semana', ('Semana',), 'int'),
            ('item', ('Item',), 'texto'),
            ('descricao', ('Descricao', 'Descrição'), 'texto'),
        ],
        'chave_dedup': 'descricao',
    },
    {
        'json': 'stma',
        'aba': 'STMA',
        'colunas': [
            ('id_contrato', ('ID Contrato',), 'texto'),
            ('contratada', ('Contratada',), 'texto'),
            ('mes_referencia', ('Mes Referencia', 'Mês Referência'), 'data'),
            ('data', ('Data',), 'data'),
            ('semana', ('Semana',), 'int'),
            ('agenda', ('Agenda',), 'texto'),
            ('indicador', ('Indicador',), 'texto'),
            ('resultado', ('Resultado',), 'num'),
            ('tipo', ('Tipo',), 'texto'),
            ('observacoes', ('Observacoes', 'Observações'), 'texto'),
        ],
        'chave_dedup': 'data',
    },
    {
        'json': 'sla',
        'aba': 'SLA',
        'colunas': [
            ('validacao', ('Validacao', 'Validação'), 'texto'),
            ('id_contrato', ('ID Contrato',), 'texto'),
            ('contratada', ('Contratada',), 'texto'),
            ('mes', ('Mes', 'Mês'), 'data'),
            ('indicador', ('Indicador',), 'texto'),
            ('descricao', ('Descricao', 'Descrição'), 'texto'),
            ('meta', ('Meta',), 'num'),
            ('resultado', ('Resultado',), 'num'),
            ('aplicacao_sla', ('Aplicacao SLA',), 'num'),
            ('observacao', ('Observacao', 'Observação'), 'texto'),
        ],
        'chave_dedup': 'indicador',
    },
    {
        'json': 'medicoes',
        'aba': 'Medições',
        'colunas': [
            ('id_contrato', ('ID Contrato',), 'texto'),
            ('contratada', ('Contratada',), 'texto'),
            ('mes_referencia', ('Mes Referencia', 'Mês Referência'), 'data'),
            ('numero_medicao', ('Nº Medicao', 'Nº Medição'), 'texto'),
            ('valor_medicao', ('R$ Medicao', 'R$ Medição'), 'num'),
            ('valor_acumulado', ('R$ Acumulado',), 'num'),
            ('valor_saldo', ('R$ Saldo',), 'num'),
            ('valor_retencao', ('R$ Retencao', 'R$ Retenção'), 'num'),
            ('data_medicao', ('Data Medicao', 'Data Medição'), 'data'),
            ('status', ('Status',), 'texto'),
            ('aderencia', ('Aderencia', 'Aderência'), 'num'),
            ('desvio_pct', ('Desvio %',), 'num'),
        ],
        'chave_dedup': 'id_contrato',
    },
    {
        'json': 'milestones',
        'aba': 'Milestones',
        'colunas': [
            ('id_contrato', ('ID Contrato',), 'texto'),
            ('contratada', ('Contratada',), 'texto'),
            # ATENCAO: nesta aba o campo vem como rotulo ("OLD"), nao como data
            ('mes_referencia', ('Mes Referencia', 'Mês Referência'), 'texto'),
            ('sequencia', ('Sequencia',), 'texto'),
            ('etapa', ('Etapa',), 'texto'),
            ('milestone', ('Milestone',), 'texto'),
            ('data_baseline', ('Data Baseline',), 'data'),
            ('data_real', ('Data Real/Projetada',), 'data'),
            ('data_replan', ('Data Replan.', 'Data Replan'), 'data'),
            ('farol', ('Farol',), 'texto'),
            ('farol_plano_acao', ('Farol Plano de Acao',), 'texto'),
        ],
        'chave_dedup': 'milestone',
    },
    {
        'json': 'acoes',
        'aba': 'Ações',
        'colunas': [
            ('data_acao', ('Data Acao', 'Data Ação'), 'data'),
            ('acao', ('Acao', 'Ação'), 'texto'),
            ('responsavel', ('Responsavel', 'Responsável'), 'texto'),
            ('status', ('Status',), 'texto'),
            ('data_conclusao', ('Data Conclusao', 'Data Conclusão'), 'data'),
        ],
        'chave_dedup': 'acao',
    },
    {
        'json': 'igpp_gf',
        'aba': 'IGPP-GF',
        'colunas': [
            ('id_contrato', ('ID Contrato',), 'texto'),
            ('contratada', ('Contratada',), 'texto'),
            ('igpp_aplicavel', ('IGPP Aplicavel', 'IGPP Aplicável'), 'texto'),
            ('mes_referencia', ('Mes Referencia', 'Mês Referência'), 'data'),
            ('composicao', ('Composicao', 'Composição'), 'texto'),
            ('peso', ('Peso',), 'num'),
            ('metrica', ('Metrica', 'Métrica'), 'texto'),
            ('descricao_item', ('Descricao Item', 'Descrição Item'), 'texto'),
            ('qde', ('Qde', 'Qtde'), 'num'),
            ('pontos', ('Pontos',), 'num'),
            ('resultado_apuracao', ('Resultado Apuracao', 'Resultado Apuração'), 'num'),
            ('resultado_igpp', ('Resultado IGPP',), 'num'),
            ('meta_contrato', ('Meta Contrato',), 'num'),
        ],
        'chave_dedup': 'metrica',
    },
    {
        'json': 'desvios_stma',
        'aba': 'Desvios STMA',
        'colunas': [
            ('descricao_macro', ('Descricao macro', 'Descrição macro'), 'texto'),
            ('plano_acao', ('Plano de Acao?', 'Plano de Ação?'), 'texto'),
            ('id', ('ID',), 'texto'),
            ('data', ('Data',), 'data'),
            ('diretoria', ('Diretoria',), 'texto'),
            ('site', ('Site',), 'texto'),
            ('area', ('Area', 'Área'), 'texto'),
            ('setor', ('Setor',), 'texto'),
            ('turno', ('Turno',), 'texto'),
            ('descricao', ('Descricao', 'Descrição'), 'texto'),
            ('potencial_gravidade', ('Potencial de Gravidade',), 'texto'),
            ('data_encerramento', ('Data de Encerramento',), 'data'),
            ('dias_resolucao', ('Qtde. de dias para a resolucao',
                                'Qtde. de dias para a resolução'), 'num'),
            ('recorrente', ('Recorrente?',), 'texto'),
            ('status', ('Status',), 'texto'),
            ('causa_raiz', ('Causa Raiz',), 'texto'),
        ],
        'chave_dedup': 'id',
    },
    {
        'json': 'histograma',
        'aba': 'Histograma',
        'colunas': [
            ('id_contrato', ('ID Contrato',), 'texto'),
            ('contratada', ('Contratada',), 'texto'),
            ('tipo', ('Tipo',), 'texto'),
            ('mes', ('Mes', 'Mês'), 'data'),
            ('equipamento', ('Equipamento',), 'texto'),
            ('previsto', ('Prev', 'Previsto'), 'num'),
            ('real', ('Real',), 'num'),
        ],
        'chave_dedup': 'equipamento',
    },
    {
        'json': 'dados_contrato',
        'aba': 'Dados Contrato',
        'colunas': [
            ('id_contrato', ('ID Contrato',), 'texto'),
            ('contratada', ('Contratada',), 'texto'),
            ('contratada_reduzida', ('Contratada reduzida',), 'texto'),
            ('mes_referencia', ('Mes Referencia', 'Mês Referência'), 'data'),
            ('gestor', ('Gestor',), 'texto'),
            ('escopo', ('Escopo',), 'texto'),
            ('inicio', ('Inicio', 'Início'), 'data'),
            ('termino', ('Termino', 'Término'), 'data'),
            ('duracao', ('Duracao', 'Duração'), 'num'),
            ('valor_total', ('R$ Total',), 'num'),
            ('medido', ('Medido',), 'num'),
            ('saldo', ('Saldo',), 'num'),
            ('canteiro', ('Canteiro',), 'texto'),
        ],
        'chave_dedup': 'id_contrato',
    },
    {
        'json': 'servicos_notaveis',
        'aba': 'Servicos Notaveis',
        'colunas': [
            ('id_contrato', ('ID Contrato',), 'texto'),
            ('contratada', ('Contratada',), 'texto'),
            ('mes_referencia', ('Mes Referencia', 'Mês Referência'), 'data'),
            ('semana', ('Semana',), 'int'),
            ('dia', ('Dia',), 'data'),
            ('grupo_servico', ('Grupo Servico', 'Grupo Serviço'), 'texto'),
            ('servico_notavel', ('Servico Notavel', 'Serviço Notável'), 'texto'),
            ('unidade', ('Un',), 'texto'),
            ('total', ('Total',), 'num'),
            ('previsto', ('Previsto',), 'num'),
            ('real', ('Real',), 'num'),
            ('avanco', ('Avanco', 'Avanço'), 'num'),
        ],
        'chave_dedup': 'servico_notavel',
    },
]


# --------------------------------------------------------------------
# Motor
# --------------------------------------------------------------------
def ler_aba(wb, spec):
    """Aplica o spec de uma aba e devolve a lista de registros."""
    nome_aba = achar_aba(wb, spec['aba'])
    if nome_aba is None:
        raise KeyError(f"aba nao encontrada: {spec['aba']!r}")

    ws = wb[nome_aba]
    linhas = ws.iter_rows(values_only=True)
    try:
        cab = list(next(linhas))
    except StopIteration:
        return []

    # Resolve indices uma vez por aba
    mapa = {}
    faltando = []
    for campo, apelidos, tipo in spec['colunas']:
        try:
            mapa[campo] = (achar_coluna(cab, *apelidos), tipo)
        except KeyError:
            # Coluna opcional: registra ausencia, segue gerando o JSON
            faltando.append(campo)
            mapa[campo] = (None, tipo)

    chave = spec.get('chave_dedup')
    chave_idx = mapa.get(chave, (None, None))[0] if chave else None

    out = []
    for r in linhas:
        if r is None or all(x is None for x in r):
            continue
        if chave_idx is not None and r[chave_idx] is None:
            continue

        reg = {}
        vazio = True
        for campo, (idx, tipo) in mapa.items():
            valor = r[idx] if (idx is not None and idx < len(r)) else None
            reg[campo] = TIPOS[tipo](valor)
            if reg[campo] is not None:
                vazio = False
        if not vazio:
            out.append(reg)

    if faltando:
        print(f"    [aviso] {spec['json']}: colunas ausentes -> {faltando}")
    return out


def escrever_json(nome, dados):
    os.makedirs(PASTA_DADOS, exist_ok=True)
    caminho = os.path.join(PASTA_DADOS, f'{nome}.json')
    tmp = caminho + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)
    os.replace(tmp, caminho)  # escrita atomica: nunca deixa JSON pela metade
    return len(dados)


def _inventario():
    """Conta registros de todos os JSONs valem em /dados (exceto versao)."""
    inventario = {}
    if not os.path.isdir(PASTA_DADOS):
        return inventario
    for arq in sorted(os.listdir(PASTA_DADOS)):
        if not arq.endswith('.json') or arq == 'versao.json':
            continue
        try:
            with open(os.path.join(PASTA_DADOS, arq), encoding='utf-8') as f:
                dados = json.load(f)
        except (OSError, ValueError):
            continue
        if isinstance(dados, list):
            inventario[arq[:-5]] = len(dados)
    return inventario


def linkar_dados(xlsx=None, somente=None, gravar=True):
    """
    Funcao principal: le a planilha e (re)gera os JSONs em /dados.

    xlsx     : caminho da planilha (default: DataBase/Dados_GeraisReport_AFR.xlsx)
    somente  : lista/set de nomes de JSON a regerar (None = todos)
    gravar   : se False, apenas valida e conta registros

    Retorna dict {nome_json: n_registros}
    """
    if openpyxl is None:  # pragma: no cover
        raise RuntimeError('openpyxl nao instalado: pip install openpyxl')

    xlsx = xlsx or XLSX_PADRAO
    if not os.path.exists(xlsx):
        raise FileNotFoundError(f'planilha nao encontrada: {xlsx}')

    alvo = set(somente) if somente else None
    specs = [s for s in SPECS if alvo is None or s['json'] in alvo]

    print(f'Lendo {os.path.basename(xlsx)} ...')
    wb = openpyxl.load_workbook(xlsx, data_only=True, read_only=True)
    resultado = {}
    try:
        for spec in specs:
            try:
                dados = ler_aba(wb, spec)
            except KeyError as e:
                print(f'  [ERRO] {spec["json"]}: {e}')
                continue
            if gravar:
                resultado[spec['json']] = escrever_json(spec['json'], dados)
            else:
                resultado[spec['json']] = len(dados)
    finally:
        wb.close()

    if gravar:
        # versao.json sempre descreve o ESTADO ATUAL da pasta /dados,
        # nao apenas o subconjunto regerado nesta execucao.
        escrever_json('versao', {
            'gerado_em': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'fonte': os.path.basename(xlsx),
            'registros': _inventario(),
        })

    for nome, n in resultado.items():
        print(f'  {nome}{".json" if gravar else ""}: {n} registros')
    return resultado


def main(argv=None):
    ap = argparse.ArgumentParser(description='Linka a planilha-mestra aos JSONs do site.')
    ap.add_argument('--xlsx', default=None, help='caminho alternativo da planilha')
    ap.add_argument('--somente', nargs='*', default=None, help='regerar apenas estes JSONs')
    ap.add_argument('--verificar', action='store_true', help='nao grava, apenas valida')
    args = ap.parse_args(argv)

    try:
        res = linkar_dados(
            xlsx=args.xlsx,
            somente=args.somente,
            gravar=not args.verificar,
        )
    except (FileNotFoundError, RuntimeError) as e:
        print(f'ERRO: {e}', file=sys.stderr)
        return 1

    print('OK.' if not args.verificar else 'Verificacao OK (nada foi gravado).')
    return 0 if res else 1


if __name__ == '__main__':
    raise SystemExit(main())

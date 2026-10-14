from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
EXCEL_PATH = ROOT / 'DataBase' / 'Dados_GeraisReport_AFR.xlsx'
OUTPUT_PATH = ROOT / 'dashboard_data.json'


def _safe_numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors='coerce')


def _read_sheet(name: str) -> pd.DataFrame:
    return pd.read_excel(EXCEL_PATH, sheet_name=name)


def build_dashboard_snapshot() -> dict:
    eng = _read_sheet('Engenharia').copy()
    eng.columns = [str(col).strip() for col in eng.columns]
    eng = eng.dropna(subset=['LD', 'Emitidos']).copy()
    eng['Emitidos'] = _safe_numeric(eng['Emitidos'])
    eng['A emitir'] = _safe_numeric(eng['A emitir'])
    eng['No prazo'] = _safe_numeric(eng['No prazo'])
    eng['Tendência de Atraso'] = _safe_numeric(eng['Tendência de Atraso'])
    eng['Atrasado'] = _safe_numeric(eng['Atrasado'])
    eng['Avanço %'] = _safe_numeric(eng['Avanço %'])

    disciplina_summary = (
        eng.groupby('Disciplina', dropna=False)
        .agg(
            emitidos=('Emitidos', 'sum'),
            a_emitir=('A emitir', 'sum'),
            no_prazo=('No prazo', 'sum'),
            atrasado=('Atrasado', 'sum'),
            progresso=('Avanço %', 'mean'),
        )
        .reset_index()
        .sort_values('emitidos', ascending=False)
        .head(8)
    )
    disciplina_summary['progresso'] = disciplina_summary['progresso'] * 100

    actions = _read_sheet('Ações').copy()
    actions.columns = [str(col).strip() for col in actions.columns]
    actions['Status'] = actions['Status'].fillna('Sem status').astype(str)
    actions_summary = actions['Status'].value_counts().head(6).to_dict()

    status_semanal = _read_sheet('Status Semanal').copy()
    status_semanal.columns = [str(col).strip() for col in status_semanal.columns]
    status_summary = status_semanal['Item'].fillna('Sem item').astype(str).value_counts().head(6).to_dict()

    cards = {
        'emitidos': int(eng['Emitidos'].sum()),
        'a_emitir': int(eng['A emitir'].sum()),
        'no_prazo': int(eng['No prazo'].sum()),
        'atrasados': int(eng['Atrasado'].sum()),
        'progresso_geral': round(float(eng['Avanço %'].mean() * 100), 1),
    }

    dashboard = {
        'report_title': 'PERFORMANCE SEMANAL',
        'cards': cards,
        'disciplinas': [
            {'label': row['Disciplina'], 'valor': int(row['emitidos']), 'progresso': round(float(row['progresso']), 1)}
            for _, row in disciplina_summary.iterrows()
        ],
        'status': [{'label': key, 'valor': int(value)} for key, value in actions_summary.items()],
        'items': [{'label': key, 'valor': int(value)} for key, value in status_summary.items()],
        'filters': {
            'disciplinas': sorted(eng['Disciplina'].dropna().astype(str).unique().tolist()),
            'status': sorted(actions['Status'].dropna().astype(str).unique().tolist()),
        },
        'generated_at': '2026-10-14',
    }
    return dashboard


def write_dashboard_json(output_path: str | Path = OUTPUT_PATH) -> Path:
    output = Path(output_path).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(build_dashboard_snapshot(), ensure_ascii=False, indent=2), encoding='utf-8')
    return output


if __name__ == '__main__':
    output = write_dashboard_json()
    print(f'Dashboard data written to {output}')

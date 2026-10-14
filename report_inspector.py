from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pbixray import PBIXRay


def _find_report_directory(root: Path) -> Path:
    pbip_dir = root / 'PBIP'
    if not pbip_dir.exists():
        return root

    for candidate in sorted(pbip_dir.glob('*.Report')):
        return candidate.parent.parent if candidate.name.endswith('.Report') else candidate

    return root


def _iter_values(value: Any):
    if isinstance(value, dict):
        for nested in value.values():
            yield from _iter_values(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from _iter_values(nested)
    else:
        yield value


def _extract_field_name(value: Any) -> list[str]:
    if not isinstance(value, dict):
        return []
    names: list[str] = []
    if 'Property' in value and isinstance(value['Property'], str):
        names.append(value['Property'])
    if 'Entity' in value and isinstance(value['Entity'], str):
        names.append(value['Entity'])
    if 'Name' in value and isinstance(value['Name'], str):
        names.append(value['Name'])
    if 'Level' in value and isinstance(value['Level'], str):
        names.append(value['Level'])
    for nested in value.values():
        names.extend(_extract_field_name(nested))
    return names


def build_pbip_layout(pbip_root: str | None = None) -> dict[str, Any]:
    root = Path(pbip_root).expanduser().resolve() if pbip_root else Path(__file__).resolve().parent
    report_dir = root / 'PBIP'
    report_root = None
    for candidate in sorted(report_dir.glob('*.Report')):
        report_root = candidate
        break
    if report_root is None:
        raise FileNotFoundError('PBIP report not found under PBIP/')

    pages_root = report_root / 'definition' / 'pages'
    pages: list[dict[str, Any]] = []

    for page_dir in sorted(pages_root.iterdir()):
        if not page_dir.is_dir():
            continue
        page_json = page_dir / 'page.json'
        if not page_json.exists():
            continue
        page_data = json.loads(page_json.read_text(encoding='utf-8'))
        page_name = page_data.get('displayName', page_dir.name)

        visuals: list[dict[str, Any]] = []
        visuals_dir = page_dir / 'visuals'
        if visuals_dir.exists():
            for visual_dir in sorted(visuals_dir.iterdir()):
                visual_json = visual_dir / 'visual.json'
                if not visual_json.exists():
                    continue
                visual_data = json.loads(visual_json.read_text(encoding='utf-8'))
                visual = visual_data.get('visual', {})
                pos = visual_data.get('position', {})
                fields: list[str] = []
                query_state = visual.get('query', {}).get('queryState', {})
                for nested in _iter_values(query_state):
                    if isinstance(nested, str) and ('.' in nested or '[' not in nested):
                        fields.append(nested)
                for filt in visual_data.get('filterConfig', {}).get('filters', []):
                    fields.extend(_extract_field_name(filt.get('field', {})))
                unique_fields = []
                seen = set()
                for field in fields:
                    if field and field not in seen:
                        unique_fields.append(field)
                        seen.add(field)

                visuals.append({
                    'name': visual_data.get('name', visual_dir.name),
                    'visualType': visual.get('visualType', 'unknown'),
                    'position': {
                        'x': pos.get('x'),
                        'y': pos.get('y'),
                        'width': pos.get('width'),
                        'height': pos.get('height'),
                    },
                    'fields': unique_fields[:8],
                })

        pages.append({
            'id': page_dir.name,
            'displayName': page_name,
            'width': page_data.get('width'),
            'height': page_data.get('height'),
            'visuals': visuals,
        })

    return {'pages': pages}


def build_report_metadata(pbix_path: str) -> dict[str, Any]:
    pbix_file = Path(pbix_path).expanduser().resolve()
    if not pbix_file.exists():
        raise FileNotFoundError(f'PBIX not found: {pbix_file}')

    report = PBIXRay(str(pbix_file))
    tables = [str(item) for item in report.tables]

    root_dir = pbix_file.parent
    report_dir = _find_report_directory(root_dir)
    pages_path = report_dir / 'PBIP' / next((p.name for p in (report_dir / 'PBIP').glob('*.Report')), '') / 'definition' / 'pages' / 'pages.json'

    if not pages_path.exists():
        pages_path = report_dir / 'PBIP' / 'AFR - Relatório Semanal.Report' / 'definition' / 'pages' / 'pages.json'

    page_order: list[str] = []
    if pages_path.exists():
        with pages_path.open('r', encoding='utf-8') as handle:
            payload = json.load(handle)
        page_order = payload.get('pageOrder', [])

    metadata = {
        'report_name': pbix_file.stem,
        'table_count': len(tables),
        'tables': tables,
        'page_count': len(page_order),
        'pages': page_order,
        'notes': [
            'PBIXRay validated the Power BI model and listed the semantic tables from the file.',
            'The PBIP layout and visual JSON files reveal the real BI parameters: page size, visual positions, and filter/slicer fields extracted from the report definition.'
        ],
    }
    return metadata


def write_metadata_json(output_path: str | Path, pbix_path: str) -> Path:
    output = Path(output_path).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(build_report_metadata(pbix_path), ensure_ascii=False, indent=2), encoding='utf-8')
    return output


def write_pbip_layout_json(output_path: str | Path, pbip_root: str | Path | None = None) -> Path:
    output = Path(output_path).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = build_pbip_layout(str(pbip_root)) if pbip_root is not None else build_pbip_layout()
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    return output


if __name__ == '__main__':
    report_path = Path(__file__).resolve().parent / 'AFR - Relatório Semanal.pbix'
    write_metadata_json(Path(__file__).resolve().parent / 'report_metadata.json', str(report_path))
    write_pbip_layout_json(Path(__file__).resolve().parent / 'pbip_layout.json')
    print('Metadata and PBIP layout written to json files.')

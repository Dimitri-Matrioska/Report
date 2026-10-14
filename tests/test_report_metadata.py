import unittest
from pathlib import Path

from report_inspector import build_report_metadata


class ReportMetadataTests(unittest.TestCase):
    def test_pbix_metadata_loads_report_structure(self):
        root = Path(__file__).resolve().parents[1]
        report_path = root / 'AFR - Relatório Semanal.pbix'

        payload = build_report_metadata(str(report_path))

        self.assertIn('report_name', payload)
        self.assertIn('tables', payload)
        self.assertIn('pages', payload)
        self.assertGreater(payload['page_count'], 0)
        self.assertTrue(len(payload['tables']) > 0)
        self.assertIn('Engenharia', payload['tables'])


if __name__ == '__main__':
    unittest.main()

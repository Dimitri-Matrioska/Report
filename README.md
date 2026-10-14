# Relatório HTML do Power BI

Este projeto reune:

- os arquivos de origem do relatório Power BI em `PBIP/`
- a base de dados em `DataBase/Dados_GeraisReport_AFR.xlsx`
- uma visualização HTML interativa inspirada no layout do relatório
- a extração de metadados do `.pbix` usando `PBIXRay`

## Como executar

1. Gere os artefatos JSON:
   ```bash
   python generate_dashboard_data.py
   python report_inspector.py
   ```
2. Inicie o servidor web:
   ```bash
   python server.py
   ```
3. Abra no navegador:
   ```text
   http://127.0.0.1:8000/
   ```

## Observação

O arquivo `.pbix` foi validado com `PBIXRay`, e a biblioteca confirmou a estrutura do modelo sem detectar report parameters explícitos declarados como parâmetros independentes. Os filtros e seleções são derivados da modelagem do relatório e da organização do dataset.

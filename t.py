import pandas as pd
CAMINHO = "DataBase/Dados_GeraisReport_AFR.xlsx"
xls = pd.ExcelFile(CAMINHO)
aba = [s for s in xls.sheet_names if 'Desvios STMA' in s][0]
df = pd.read_excel(CAMINHO, sheet_name=aba, nrows=2)
print("Colunas do Excel:", df.columns.tolist())
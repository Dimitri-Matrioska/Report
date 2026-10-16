const FUNCOES = {
  0: (a) => a.length,
  1: (a) => a.length ? Math.min(...a) : 0,
  2: (a) => a.length ? Math.max(...a) : 0,
  3: (a) => a.length ? a.reduce((x,y)=>x+y,0) / a.length : 0,
  4: (a) => a.reduce((x,y)=>x+y, 0),
  5: (a) => new Set(a).size
};
function agregar(valores, funcCode) {
  const limpos = valores.filter(v => v !== null && v !== undefined && !isNaN(v));
  return (FUNCOES[funcCode] || FUNCOES[4])(limpos);
}
const fmt = {
  pct: (v) => ((Number(v) || 0) * 100).toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1}) + '%',
  num: (v) => (Number(v) || 0).toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1}),
  int: (v) => Math.round(Number(v) || 0).toString()
};
function ultimaDataCom(dados, campo) {
  const comValor = dados.filter(d => d[campo] !== null && d[campo] !== undefined);
  if (!comValor.length) return null;
  return comValor.map(d => d.data).sort().pop();
}
function maxDe(dados, campo) {
  const valores = dados.map(d => d[campo]).filter(v => v !== null && v !== undefined && !isNaN(v));
  return valores.length ? Math.max(...valores) : 0;
}
function filtrarPorMes(dados, mes) {
  return dados.filter(d => d.mes === mes);
}

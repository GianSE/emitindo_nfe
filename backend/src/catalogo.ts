// Catálogo de produtos vendáveis (no ERP real, viria da tabela `produtos`
// com seus dados fiscais). Mapeia o código do produto -> dados p/ a NFe.
export interface ProdutoCatalogo {
  cProd: string;
  xProd: string;
  NCM: string;
  CFOP: string;
  uCom: string;
  vUnit: string;
}

export const CATALOGO: Record<string, ProdutoCatalogo> = {
  "001": { cProd: "001", xProd: "CAMISETA ALGODAO AZUL M", NCM: "61091000", CFOP: "6102", uCom: "UN", vUnit: "49.90" },
  "002": { cProd: "002", xProd: "CALCA JEANS PRETA 42", NCM: "62034200", CFOP: "6102", uCom: "UN", vUnit: "129.90" },
};

// Destinatário padrão (homologação). O front pode sobrescrever nome/doc.
export const CLIENTE_PADRAO = {
  doc: "11122233396",
  xNome: "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL",
  xLgr: "AVENIDA BRASIL",
  nro: "500",
  xBairro: "JARDIM",
  cMun: "3304557",
  xMun: "RIO DE JANEIRO",
  UF: "RJ",
  CEP: "20040002",
  indIEDest: "9",
};

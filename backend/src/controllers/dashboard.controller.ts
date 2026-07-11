import * as comprasService from "../services/compras.service.js";
import * as dashboardService from "../services/dashboard.service.js";

export const compras = () => comprasService.listar();
export const resumo = () => dashboardService.resumo();

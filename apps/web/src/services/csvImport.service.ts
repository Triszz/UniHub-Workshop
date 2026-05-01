import { api } from "./api";
import type { CsvImportLog } from "../types";

const normalizeLog = (log: CsvImportLog): CsvImportLog => ({
  ...log,
  totalRows: log.totalRows == null ? null : Number(log.totalRows),
  importedRows: log.importedRows == null ? null : Number(log.importedRows),
  skippedRows: log.skippedRows == null ? null : Number(log.skippedRows),
  errorRows: log.errorRows == null ? null : Number(log.errorRows),
});

export const csvImportService = {
  getHistory: async (): Promise<CsvImportLog[]> => {
    const response = await api.get<CsvImportLog[]>("/admin/csv-imports");
    return response.data.map(normalizeLog);
  },
};

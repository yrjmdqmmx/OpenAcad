import * as XLSX from "xlsx";
import type { DataTable, Dataset, Cell } from "./types";
export function tableFromRows(
  rows: Cell[][],
  name = "数据表",
  role = "data",
): DataTable {
  while (rows.length && rows.at(-1)?.every((v) => v === "" || v === null))
    rows.pop();
  if (!rows.length)
    throw new Error(`“${name}”没有数据，请至少提供列标题和一行数据。`);
  const columns = rows[0].map((v, i) =>
    v === null || v === "" ? `列 ${i + 1}` : String(v),
  );
  if (columns.length > 500 || rows.length > 100001)
    throw new Error(`“${name}”超过当前表格上限（500 列、100000 行）。`);
  return {
    id: crypto.randomUUID(),
    name,
    role,
    columns,
    rows: rows.slice(1).map((r) => columns.map((_, i) => r[i] ?? "")),
  };
}
export function parseText(text: string, delimiter?: string): DataTable {
  if (!text.trim()) throw new Error("请先粘贴数据，第一行应为列标题。");
  const workbook = XLSX.read(text, {
    type: "string",
    raw: true,
    FS: delimiter || (text.includes("\t") ? "\t" : ","),
  });
  return tableFromRows(
    XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
      header: 1,
      raw: true,
      defval: "",
    }) as Cell[][],
    "粘贴数据",
  );
}
export async function parseFile(
  file: File,
  forceText = false,
): Promise<Dataset> {
  if (file.size > 10 * 1024 * 1024)
    throw new Error(`“${file.name}”超过 10 MB。请拆分表格后再上传。`);
  if (
    /\.(xlsx?|csv|tsv)$/i.test(file.name) ||
    (!forceText && /\.txt$/i.test(file.name))
  ) {
    let book: XLSX.WorkBook;
    try {
      book = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        raw: true,
        codepage: 65001,
      });
    } catch {
      throw new Error(
        `无法解析“${file.name}”。请确认它是有效的 CSV、TSV 或 Excel 文件；若 Excel 设置了密码，请先另存为未加密文件。`,
      );
    }
    return {
      tables: book.SheetNames.map((name, i) =>
        tableFromRows(
          XLSX.utils.sheet_to_json(book.Sheets[name], {
            header: 1,
            raw: true,
            defval: "",
          }) as Cell[][],
          book.SheetNames.length === 1 ? file.name : name,
          i === 0 ? "data" : `table-${i + 1}`,
        ),
      ),
    };
  }
  const text = await file.text(),
    format = file.name.split(".").at(-1)?.toLowerCase() || "txt";
  return {
    tables: [],
    text,
    format,
    files: [
      { id: crypto.randomUUID(), name: file.name, role: format, format, text },
    ],
  };
}
export function csv(table: DataTable) {
  return XLSX.utils.sheet_to_csv(
    XLSX.utils.aoa_to_sheet([table.columns, ...table.rows]),
    { FS: ",", RS: "\n" },
  );
}
export function exampleWorkbook(dataset: Dataset): Blob {
  const book = XLSX.utils.book_new();
  dataset.tables.forEach((t, i) =>
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([t.columns, ...t.rows]),
      `${i + 1}-${t.name}`.slice(0, 31).replace(/[\\/*?:[\]]/g, "_"),
    ),
  );
  return new Blob([XLSX.write(book, { bookType: "xlsx", type: "array" })], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

import { describe, expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as XLSX from "xlsx";
import { templates } from "../src/templates";
import { makeDetailProject, describeField, detailExampleDownload, sheetDescription, spreadsheetColumn } from "../src/templates/detailExamples";
import { templateGuide, templateGuides } from "../src/templates/detailGuides";
import { TemplateDetail } from "../src/components/TemplateDetail";
import { encodeProject, decodeProject } from "../src/core/project";

describe("模板详情与实际输入保持一致", () => {
  test("注册的每一种模板均有专属说明，列字母可覆盖宽表", () => {
    expect(Object.keys(templateGuides).sort()).toEqual(templates.map(t => t.id).sort());
    expect([0, 25, 26, 51, 52, 701].map(spreadsheetColumn)).toEqual(["A", "Z", "AA", "AZ", "BA", "ZZ"]);
  });

  for (const template of templates) {
    test(`${template.id}：说明、默认图与项目往返`, () => {
      const before = JSON.stringify(template.example);
      const project = makeDetailProject(template);
      const guide = templateGuide(template);
      expect([guide.axes, guide.color, guide.prepare, guide.style].every(Boolean)).toBe(true);
      expect(template.validate(project.dataset, project.style).filter(i => i.severity !== "warning")).toEqual([]);
      for (const table of project.dataset.tables) {
        expect(sheetDescription(template, table)).not.toBe("");
        for (const column of table.columns) {
          expect(Object.values(describeField(template, table, column)).every(Boolean)).toBe(true);
        }
      }
      const picture = renderToStaticMarkup(createElement(template.Renderer, { project }));
      const original = renderToStaticMarkup(createElement(template.Renderer, { project: { ...project, dataset: template.example } }));
      expect(picture).toBe(original);
      expect(picture).not.toMatch(/NaN|Infinity/);
      const restored = decodeProject(encodeProject(project), templates);
      expect(restored.dataset).toEqual(project.dataset);
      expect(restored.analysis).toEqual(project.analysis);
      const html = renderToStaticMarkup(createElement(TemplateDetail, { template, onStart: () => {} }));
      expect(html.match(/<h2\b/g)).toHaveLength(2);
      expect(html).toContain("图表介绍");
      expect(html).toContain("如何使用");
      expect(html).not.toMatch(/示例来源|CC0-1.0|从数据到图片|准备数据<\/h2>/);
      expect(JSON.stringify(template.example)).toBe(before);
    });

    test(`${template.id}：下载包含与图相同的全部工作表或原格式文本`, async () => {
      const project = makeDetailProject(template);
      const download = detailExampleDownload(template, project);
      if (project.dataset.tables.length) {
        expect(download.name).toMatch(/\.xlsx$/);
        const book = XLSX.read(await download.blob.arrayBuffer(), { type: "array" });
        expect(book.SheetNames).toHaveLength(project.dataset.tables.length);
        project.dataset.tables.forEach((table, i) => {
          const actual = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[i]], { header: 1, raw: true, defval: "" });
          expect(actual).toEqual([table.columns, ...table.rows.map(row => row.map(cell => cell ?? ""))]);
        });
      } else {
        expect(download.name).toMatch(/\.nwk$/);
        expect(await download.blob.text()).toBe(project.dataset.text);
      }
    });
  }
});

import { expect, test } from 'vitest';
import { templates } from '../src/templates';
import { makeProject } from '../src/core/project';
import { assertExportReady, magneticExportIssue } from '../src/core/exportReadiness';

const project = () => makeProject(templates.find(t => t.id === 'magnetic-correlation')!);
test('磁成像导出需要完整矩阵，损坏项目不会让导出检查崩溃', async () => {
  const p = project();
  await expect(assertExportReady(p)).resolves.toBeUndefined();
  p.analysis!.result = { data: { correlation: [null] } };
  expect(() => magneticExportIssue(p)).not.toThrow();
  await expect(assertExportReady(p)).rejects.toThrow('尚无有效成像');
  p.analysis!.result = { data: { correlation: [[0.5]] } };
  await expect(assertExportReady(p)).rejects.toThrow('尚无有效成像');
});
test('其他图种字段不能绕过成像结果过期校验，错误方法不能冒充成像结果', async () => {
  const p = project();
  p.analysis!.params.inc = 45;
  p.style.ordinationInput = 'scores';
  await expect(assertExportReady(p)).rejects.toThrow('重新计算');
  p.analysis!.method = 'pca';
  await expect(assertExportReady(p)).rejects.toThrow('尚无有效成像');
});

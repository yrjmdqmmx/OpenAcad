import { afterEach, expect, test, vi } from 'vitest';
import { waitJob } from './api';
afterEach(() => vi.unstubAllGlobals());
test('取消后晚到的完成响应不能返回旧结果', async () => {
  let respond!: (value: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { respond = resolve; })));
  const abort = new AbortController();
  const result = waitJob('job', 'token', abort.signal);
  abort.abort();
  respond(new Response(JSON.stringify({ id: 'job', status: 'finished', result: { obsolete: true } }), { status: 200 }));
  await expect(result).rejects.toThrow('已停止等待');
});

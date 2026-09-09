/**
 * proxyFetch 工具函数测试
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const undiciMocks = vi.hoisted(() => {
  const agents: Array<{
    proxyUrl: string;
    close: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }> = [];

  return {
    agents,
    fetch: vi.fn(),
    ProxyAgent: vi.fn(function (this: (typeof agents)[number], proxyUrl: string) {
      this.proxyUrl = proxyUrl;
      this.close = vi.fn().mockResolvedValue(undefined);
      this.destroy = vi.fn().mockResolvedValue(undefined);
      agents.push(this);
    }),
  };
});

vi.mock('undici', () => ({
  fetch: undiciMocks.fetch,
  ProxyAgent: undiciMocks.ProxyAgent,
}));

import { proxyFetch } from '../../../../src/utils/proxyFetch.js';

const proxyEnvKeys = [
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'http_proxy',
  'https_proxy',
] as const;
const originalProxyEnv = Object.fromEntries(
  proxyEnvKeys.map((key) => [key, process.env[key]])
);

function abortableRequest(
  _url: string,
  options: { signal?: AbortSignal }
): Promise<Response> {
  return new Promise((_resolve, reject) => {
    options.signal?.addEventListener(
      'abort',
      () => reject(new DOMException('The operation was aborted.', 'AbortError')),
      { once: true }
    );
  });
}

describe('proxyFetch', () => {
  beforeEach(() => {
    for (const key of proxyEnvKeys) {
      delete process.env[key];
    }
    undiciMocks.agents.length = 0;
    undiciMocks.ProxyAgent.mockClear();
    undiciMocks.fetch.mockReset();
    undiciMocks.fetch.mockResolvedValue(new Response('ok'));
  });

  afterEach(() => {
    for (const key of proxyEnvKeys) {
      const value = originalProxyEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    vi.useRealTimers();
  });

  describe('基本功能', () => {
    it('应该能够发起 GET 请求', async () => {
      const body = await proxyFetch('https://example.test/get', {}, (response) =>
        response.text()
      );

      expect(body).toBe('ok');
      expect(undiciMocks.fetch).toHaveBeenCalledWith(
        'https://example.test/get',
        expect.objectContaining({ dispatcher: undefined })
      );
    });

    it('应该能够发起 POST 请求', async () => {
      await proxyFetch(
        'https://example.test/post',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'data' }),
        },
        (response) => response.text()
      );

      expect(undiciMocks.fetch).toHaveBeenCalledWith(
        'https://example.test/post',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"test":"data"}',
        })
      );
    });

    it('应该支持自定义 headers', async () => {
      await proxyFetch(
        'https://example.test/headers',
        {
          headers: { 'X-Custom-Header': 'test-value' },
        },
        (response) => response.text()
      );

      expect(undiciMocks.fetch).toHaveBeenCalledWith(
        'https://example.test/headers',
        expect.objectContaining({
          headers: { 'X-Custom-Header': 'test-value' },
        })
      );
    });
  });

  describe('超时处理', () => {
    it.each([100, undefined])(
      'bounds header waiting with timeout %s',
      async (timeout) => {
        vi.useFakeTimers();
        undiciMocks.fetch.mockImplementationOnce(abortableRequest);
        const budget = timeout ?? 30000;
        const assertion = expect(
          proxyFetch('https://example.test/slow', { timeout }, (response) =>
            response.text()
          )
        ).rejects.toThrow(`Request timeout after ${budget}ms`);
        await vi.advanceTimersByTimeAsync(budget);
        await assertion;
        expect(vi.getTimerCount()).toBe(0);
      }
    );
  });

  it('keeps its deadline active while a response body is still streaming', async () => {
    vi.useFakeTimers();
    undiciMocks.fetch.mockImplementationOnce(
      (_url: string, options: { signal: AbortSignal }) =>
        Promise.resolve(
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                options.signal.addEventListener(
                  'abort',
                  () => {
                    controller.error(
                      new DOMException('The operation was aborted.', 'AbortError')
                    );
                  },
                  { once: true }
                );
              },
            })
          )
        )
    );
    const assertion = expect(
      proxyFetch('https://example.test/slow-body', { timeout: 100 }, (response) =>
        response.text()
      )
    ).rejects.toThrow('Request timeout after 100ms');
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('releases its proxy dispatcher after response consumption', async () => {
    process.env.HTTPS_PROXY = 'http://proxy.example.com:8080';
    await proxyFetch('https://example.test/get', {}, (response) => response.text());
    expect(undiciMocks.agents[0]?.destroy).toHaveBeenCalledOnce();
  });

  it('cancels an unread body when the consumer returns early', async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    undiciMocks.fetch.mockResolvedValueOnce(
      new Response(new ReadableStream<Uint8Array>({ cancel }), { status: 503 })
    );
    expect(
      await proxyFetch(
        'https://example.test/error',
        {},
        async (response) => response.status
      )
    ).toBe(503);
    expect(cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('releases its dispatcher on consumer failure without replacing the error', async () => {
    vi.useFakeTimers();
    process.env.HTTPS_PROXY = 'http://proxy.example.com:8080';
    await expect(
      proxyFetch('https://example.test/parse', {}, async () => {
        throw new Error('bad metadata');
      })
    ).rejects.toThrow('bad metadata');
    expect(undiciMocks.agents[0]?.destroy).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps external cancellation active during body consumption', async () => {
    vi.useFakeTimers();
    const external = new AbortController();
    const remove = vi.spyOn(external.signal, 'removeEventListener');
    let started!: () => void;
    const bodyStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    undiciMocks.fetch.mockImplementationOnce(
      (_url: string, options: { signal: AbortSignal }) =>
        Promise.resolve(
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                options.signal.addEventListener(
                  'abort',
                  () => controller.error(new DOMException('cancelled', 'AbortError')),
                  { once: true }
                );
              },
            })
          )
        )
    );
    const assertion = expect(
      proxyFetch(
        'https://example.test/body',
        { signal: external.signal },
        (response) => {
          started();
          return response.text();
        }
      )
    ).rejects.toThrow('cancelled');
    await bodyStarted;
    external.abort();
    await assertion;
    expect(remove).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  describe('AbortSignal', () => {
    it('应该支持外部 AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        proxyFetch(
          'https://example.test/get',
          { signal: controller.signal },
          (response) => response.text()
        )
      ).rejects.toThrow('The operation was aborted.');
      expect(undiciMocks.fetch).not.toHaveBeenCalled();
    });
  });

  describe('代理支持', () => {
    it('应该正确处理 HTTPS_PROXY 环境变量', async () => {
      process.env.HTTPS_PROXY = 'http://proxy.example.com:8080';

      await proxyFetch('https://example.test/get', {}, (response) => response.text());

      expect(undiciMocks.ProxyAgent).toHaveBeenCalledWith(
        'http://proxy.example.com:8080'
      );
      expect(undiciMocks.fetch).toHaveBeenCalledWith(
        'https://example.test/get',
        expect.objectContaining({ dispatcher: undiciMocks.agents[0] })
      );
    });

    it('应该正确处理 HTTP_PROXY 环境变量', async () => {
      process.env.HTTP_PROXY = 'http://proxy.example.com:8080';

      await proxyFetch('http://example.test/get', {}, (response) => response.text());

      expect(undiciMocks.ProxyAgent).toHaveBeenCalledWith(
        'http://proxy.example.com:8080'
      );
      expect(undiciMocks.fetch).toHaveBeenCalledWith(
        'http://example.test/get',
        expect.objectContaining({ dispatcher: undiciMocks.agents[0] })
      );
    });
  });

  describe('错误处理', () => {
    it('应该处理网络错误', async () => {
      undiciMocks.fetch.mockRejectedValueOnce(new Error('network error'));

      await expect(
        proxyFetch('https://example.test', {}, (response) => response.text())
      ).rejects.toThrow('network error');
    });

    it('应该处理无效的 URL', async () => {
      undiciMocks.fetch.mockRejectedValueOnce(new TypeError('Invalid URL'));

      await expect(
        proxyFetch('not-a-valid-url', {}, (response) => response.text())
      ).rejects.toThrow('Invalid URL');
    });
  });

  describe('选项传递', () => {
    it('应该支持 fetch 标准选项', async () => {
      await proxyFetch(
        'https://example.test/put',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'text/plain' },
          body: 'test data',
        },
        (response) => response.text()
      );

      expect(undiciMocks.fetch).toHaveBeenCalledWith(
        'https://example.test/put',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'text/plain' },
          body: 'test data',
        })
      );
    });

    it('应该处理 JSON 响应', async () => {
      undiciMocks.fetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ result: 'ok' }), {
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const data = await proxyFetch('https://example.test/json', {}, (response) =>
        response.json()
      );

      expect(data).toEqual({ result: 'ok' });
    });

    it('应该处理文本响应', async () => {
      undiciMocks.fetch.mockResolvedValueOnce(new Response('robots content'));

      await expect(
        proxyFetch('https://example.test/robots.txt', {}, (response) => response.text())
      ).resolves.toBe('robots content');
    });
  });
});

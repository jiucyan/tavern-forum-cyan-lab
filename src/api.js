import { extractAssistantReasoning, extractAssistantText } from './prompt.js';

function cleanEndpoint(value) {
    return String(value || '').trim().replace(/\/+$/, '');
}

export function resolveEndpoint(base, kind) {
    const endpoint = cleanEndpoint(base);
    if (!endpoint) throw new Error(kind === 'image' ? '请先填写生图 API 地址' : '请先填写文本 API 地址');
    if (kind === 'image') {
        return /\/images\/generations$/i.test(endpoint) ? endpoint : `${endpoint}/images/generations`;
    }
    return /\/chat\/completions$/i.test(endpoint) ? endpoint : `${endpoint}/chat/completions`;
}

export function resolveModelsEndpoint(base) {
    const endpoint = cleanEndpoint(base);
    if (!endpoint) throw new Error('请先填写 API 地址');
    if (/\/models$/i.test(endpoint)) return endpoint;
    const apiBase = endpoint
        .replace(/\/chat\/completions$/i, '')
        .replace(/\/images\/generations$/i, '');
    return `${apiBase}/models`;
}

function authHeaders(apiKey, includeContentType = true) {
    const headers = includeContentType ? { 'Content-Type': 'application/json' } : {};
    if (String(apiKey || '').trim()) headers.Authorization = `Bearer ${String(apiKey).trim()}`;
    return headers;
}

async function fetchJson(url, init, timeoutMs = 90000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        const text = await response.text();
        let payload = null;
        try {
            payload = text ? JSON.parse(text) : {};
        } catch {
            payload = { raw: text };
        }
        if (!response.ok) {
            const reason = payload?.error?.message || payload?.message || payload?.raw || `${response.status} ${response.statusText}`;
            throw new Error(`API 请求失败：${reason}`);
        }
        return payload;
    } catch (error) {
        if (error?.name === 'AbortError') throw new Error('API 请求超时，请检查地址或网络');
        if (error instanceof TypeError) throw new Error(`无法连接 API（可能是地址错误或浏览器 CORS 限制）：${error.message}`);
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

export async function fetchAvailableModels(config) {
    if (config?.provider === 'sillytavern') throw new Error('酒馆当前连接的模型由 SillyTavern 管理');
    const payload = await fetchJson(resolveModelsEndpoint(config?.endpoint), {
        method: 'GET',
        headers: authHeaders(config?.apiKey, false),
    }, 30000);
    const source = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.models) ? payload.models : Array.isArray(payload) ? payload : [];
    const models = [...new Set(source.map(item => {
        if (typeof item === 'string') return item.trim();
        return String(item?.id || item?.name || item?.model || '').trim();
    }).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    if (!models.length) throw new Error('接口已响应，但没有找到可用的模型名称');
    return models;
}

function buildResponseFormat(jsonSchema) {
    if (!jsonSchema?.value) return undefined;
    return {
        type: 'json_schema',
        json_schema: {
            name: String(jsonSchema.name || 'tavern_forum_response'),
            description: String(jsonSchema.description || ''),
            strict: Boolean(jsonSchema.strict),
            schema: jsonSchema.value,
        },
    };
}

function requestMessages(request) {
    if (Array.isArray(request?.messages) && request.messages.length) {
        return request.messages
            .filter(message => ['system', 'user', 'assistant'].includes(message?.role) && String(message?.content || '').trim())
            .map(message => ({ role: message.role, content: String(message.content) }));
    }
    return [
        { role: 'system', content: String(request?.system || '') },
        { role: 'user', content: String(request?.user || '') },
    ];
}

export function buildTextRequestBody(config, request) {
    const excluded = new Set(Array.isArray(config?.excludedBodyParameters) ? config.excludedBodyParameters : []);
    const body = {
        ...(!excluded.has('model') ? { model: String(config?.model || '').trim() } : {}),
        messages: requestMessages(request),
        ...(!excluded.has('temperature') ? { temperature: Number(config?.temperature ?? 0.9) } : {}),
        ...(!excluded.has('max_tokens') ? { max_tokens: Number(config?.maxTokens ?? 8192) } : {}),
        ...(request?.jsonSchema && !excluded.has('response_format') ? { response_format: buildResponseFormat(request.jsonSchema) } : {}),
    };
    return body;
}

export async function generateForumTextResult(config, request, { captureTrace = false } = {}) {
    if (config?.provider === 'sillytavern') {
        const context = globalThis.SillyTavern?.getContext?.();
        const generateRaw = context?.generateRaw;
        if (typeof generateRaw !== 'function') throw new Error('当前 SillyTavern 不支持使用酒馆默认连接生成');
        const options = {
            prompt: requestMessages(request),
            responseLength: Number(config.maxTokens || 8192),
            trimNames: false,
            ...(request?.jsonSchema ? { jsonSchema: request.jsonSchema } : {}),
        };
        if (captureTrace && !request?.jsonSchema && typeof context.generateRawData === 'function') {
            const payload = await context.generateRawData(options);
            const text = typeof payload === 'string' ? payload : extractAssistantText(payload);
            if (!String(text || '').trim()) throw new Error('酒馆默认连接返回了空内容');
            return {
                text: String(text).trim(),
                reasoning: typeof payload === 'string' ? '' : extractAssistantReasoning(payload),
            };
        }
        const text = await generateRaw(options);
        if (!String(text || '').trim()) throw new Error('酒馆默认连接返回了空内容');
        return { text: String(text).trim(), reasoning: '' };
    }
    const model = String(config?.model || '').trim();
    if (!model && !(config?.excludedBodyParameters || []).includes('model')) throw new Error('请先填写文本模型名称');
    const endpoint = resolveEndpoint(config.endpoint, 'text');
    const body = buildTextRequestBody(config, request);
    const payload = await fetchJson(endpoint, {
        method: 'POST',
        headers: authHeaders(config.apiKey),
        body: JSON.stringify(body),
    });
    const text = extractAssistantText(payload);
    if (!text) throw new Error('文本 API 返回了空内容');
    return {
        text,
        reasoning: captureTrace ? extractAssistantReasoning(payload) : '',
    };
}

export async function generateForumText(config, request) {
    const result = await generateForumTextResult(config, request);
    return result.text;
}

export async function generateForumImage(config, prompt) {
    const model = String(config?.model || '').trim();
    if (!model) throw new Error('请先填写生图模型名称');
    const payload = await fetchJson(resolveEndpoint(config.endpoint, 'image'), {
        method: 'POST',
        headers: authHeaders(config.apiKey),
        body: JSON.stringify({
            model,
            prompt: String(prompt || '').trim(),
            n: 1,
            size: String(config.size || '1024x1024'),
        }),
    }, 180000);

    const image = payload?.data?.[0];
    if (image?.url) return { type: 'url', value: image.url };
    if (image?.b64_json) return { type: 'base64', value: `data:image/png;base64,${image.b64_json}` };
    if (payload?.url) return { type: 'url', value: payload.url };
    throw new Error('生图 API 没有返回图片 URL 或 base64 数据');
}

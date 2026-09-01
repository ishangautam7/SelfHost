import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getAppBySubdomain, getAppForUser } from './db';
import { tunnelManager } from './tunnel';

// Allow these hosts to bypass the subdomain proxy
const DEFAULT_API_HOSTS = ['api.ishangautam7.com.np', 'selfhost-h5ze.onrender.com'];
const MAX_BODY_SIZE = 10 * 1024 * 1024;
const LINKED_BACKEND_PREFIX = '/_backend';

export function extractSubdomain(host: string, baseDomain: string): string | null {
  const hostWithoutPort = host.split(':')[0].toLowerCase();
  const suffix = `.${baseDomain.toLowerCase()}`;
  if (hostWithoutPort.endsWith(suffix) && hostWithoutPort.length > suffix.length) {
    const subdomain = hostWithoutPort.slice(0, hostWithoutPort.length - suffix.length);
    if (subdomain) {
      return subdomain;
    }
  }
  return null;
}

export function getLinkedBackendPath(originalUrl: string, pathname: string): string | null {
  if (pathname !== LINKED_BACKEND_PREFIX && !pathname.startsWith(`${LINKED_BACKEND_PREFIX}/`)) return null;
  const stripped = originalUrl.slice(LINKED_BACKEND_PREFIX.length);
  return !stripped ? '/' : stripped.startsWith('?') ? `/${stripped}` : stripped;
}

export async function proxyMiddleware(req: Request, res: Response, next: NextFunction) {
  const host = req.headers.host;
  if (!host) {
    return next();
  }

  // Bypass proxy for API domains - pass directly to Express routes
  const apiHosts = new Set([...DEFAULT_API_HOSTS, process.env.SERVER_HOST].filter(Boolean));
  if (apiHosts.has(host.split(':')[0].toLowerCase())) {
    return next();
  }

  // If this is an API request or dashboard request, let it pass through to regular routes
  // But actually, we only intercept if we detect a valid subdomain for our app.
  const baseDomain = process.env.BASE_DOMAIN || 'selfhost.ishangautam7.com.np';
  const subdomain = extractSubdomain(host, baseDomain);

  if (!subdomain) {
    // If not a subdomain matching our base domain, pass to normal API routes
    return next();
  }

  // It's a subdomain request! Look up the app.
  const app = await getAppBySubdomain(subdomain);
  if (!app) {
    return res.status(404).send(`No app found for subdomain: ${subdomain}.${baseDomain}`);
  }
  if (app.status !== 'running') {
    return res.status(503).send('This app is not running.');
  }

  const linkedPath = getLinkedBackendPath(req.originalUrl, req.path);
  let targetApp = app;
  let targetPath = req.originalUrl;
  if (linkedPath !== null) {
    if (!app.linked_app_id) return res.status(404).send('No backend app is linked.');
    targetApp = await getAppForUser(app.linked_app_id, app.user_id);
    if (!targetApp) return res.status(502).send('The linked backend app no longer exists.');
    if (targetApp.status !== 'running') return res.status(503).send('The linked backend app is not running.');
    targetPath = linkedPath;
  }

  // Found the app. Find the connected tunnel.
  const targetAgentId = targetApp.agent_id || targetApp.user_id;
  const ws = tunnelManager.getSenderByAgentId(targetApp.user_id, targetAgentId);
  if (!ws) {
    return res.status(503).send('The host for this app is currently offline. Please try again later.');
  }

  const requestId = uuidv4();
  const headers = Object.fromEntries(
    Object.entries(req.headers).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, Array.isArray(value) ? value.join(', ') : value]]
    )
  );

  let bodySize = 0;
  let bodyTooLarge = false;
  let bodyBuffer: Buffer[] = [];
  req.on('data', chunk => {
    bodySize += chunk.length;
    if (bodySize > MAX_BODY_SIZE) {
      bodyTooLarge = true;
      bodyBuffer = [];
      if (!res.headersSent) res.status(413).send('Request body too large');
      return;
    }
    bodyBuffer.push(chunk);
  });

  req.on('end', async () => {
    if (bodyTooLarge) return;
    const bodyBytes = Buffer.concat(bodyBuffer);
    const bodyArray = bodyBytes.length > 0 ? Array.from(bodyBytes) : undefined;

    const responseMsg = await tunnelManager.sendHttpRequest(targetApp.user_id, targetAgentId, {
      type: 'HttpRequest',
      payload: {
        request_id: requestId,
        subdomain: targetApp.subdomain,
        method: req.method,
        path: targetPath,
        headers,
        body: bodyArray
      }
    });

    if (!responseMsg) {
      return res.status(504).send('Request timed out (30s)');
    }

    // Proxy back the response
    const { status_code, headers: respHeaders, body: respBody } = responseMsg.payload;

    if (!Number.isInteger(status_code) || status_code < 100 || status_code > 599) {
      return res.status(502).send('The agent returned an invalid response.');
    }
    res.status(status_code);

    const hopByHopHeaders = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);
    for (const [key, value] of Object.entries(respHeaders)) {
      if (!hopByHopHeaders.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    }

    if (respBody) {
      res.end(Buffer.from(respBody));
    } else {
      res.end();
    }
  });
}

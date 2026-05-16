import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getAppBySubdomain } from './db';
import { tunnelManager } from './tunnel';

const BASE_DOMAIN = process.env.BASE_DOMAIN || 'selfhost.ishangautam7.com.np';

export function extractSubdomain(host: string, baseDomain: string): string | null {
  const hostWithoutPort = host.split(':')[0];
  const suffix = `.${baseDomain}`;
  if (hostWithoutPort.endsWith(suffix) && hostWithoutPort.length > suffix.length) {
    const subdomain = hostWithoutPort.slice(0, hostWithoutPort.length - suffix.length);
    if (subdomain && !subdomain.includes('.')) {
      return subdomain;
    }
  }
  return null;
}

export async function proxyMiddleware(req: Request, res: Response, next: NextFunction) {
  const host = req.headers.host;
  if (!host) {
    return next();
  }

  // If this is an API request or dashboard request, let it pass through to regular routes
  // But actually, we only intercept if we detect a valid subdomain for our app.
  const subdomain = extractSubdomain(host, BASE_DOMAIN);
  
  if (!subdomain) {
    // If not a subdomain matching our base domain, pass to normal API routes
    return next();
  }

  // It's a subdomain request! Look up the app.
  const app = getAppBySubdomain(subdomain);
  if (!app) {
    return res.status(404).send(`No app found for subdomain: ${subdomain}.${BASE_DOMAIN}`);
  }

  // Found the app. Find the connected tunnel.
  const ws = tunnelManager.getSender(app.user_id);
  if (!ws) {
    return res.status(503).send('The host for this app is currently offline. Please try again later.');
  }

  const requestId = uuidv4();
  const headers = req.headers as Record<string, string>;
  
  let bodyBuffer: Buffer[] = [];
  req.on('data', chunk => bodyBuffer.push(chunk));
  
  req.on('end', async () => {
    const bodyBytes = Buffer.concat(bodyBuffer);
    const bodyArray = bodyBytes.length > 0 ? Array.from(bodyBytes) : undefined;

    const responseMsg = await tunnelManager.sendHttpRequest(app.user_id, {
      type: 'HttpRequest',
      payload: {
        request_id: requestId,
        subdomain,
        method: req.method,
        path: req.originalUrl,
        headers,
        body: bodyArray
      }
    });

    if (!responseMsg) {
      return res.status(504).send('Request timed out (30s)');
    }

    // Proxy back the response
    const { status_code, headers: respHeaders, body: respBody } = responseMsg.payload;
    
    res.status(status_code);
    
    for (const [key, value] of Object.entries(respHeaders)) {
      if (key.toLowerCase() !== 'transfer-encoding') {
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

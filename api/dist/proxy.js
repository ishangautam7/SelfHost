"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractSubdomain = extractSubdomain;
exports.proxyMiddleware = proxyMiddleware;
const uuid_1 = require("uuid");
const db_1 = require("./db");
const tunnel_1 = require("./tunnel");
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'selfhost.ishangautam7.com.np';
// Allow these hosts to bypass the subdomain proxy
const ALLOWED_API_HOSTS = ['api.ishangautam7.com.np', 'selfhost-h5ze.onrender.com'];
function extractSubdomain(host, baseDomain) {
    const hostWithoutPort = host.split(':')[0];
    const suffix = `.${baseDomain}`;
    if (hostWithoutPort.endsWith(suffix) && hostWithoutPort.length > suffix.length) {
        const subdomain = hostWithoutPort.slice(0, hostWithoutPort.length - suffix.length);
        if (subdomain) {
            return subdomain;
        }
    }
    return null;
}
async function proxyMiddleware(req, res, next) {
    const host = req.headers.host;
    if (!host) {
        return next();
    }
    // Bypass proxy for API domains - pass directly to Express routes
    if (ALLOWED_API_HOSTS.includes(host)) {
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
    const app = await (0, db_1.getAppBySubdomain)(subdomain);
    if (!app) {
        return res.status(404).send(`No app found for subdomain: ${subdomain}.${BASE_DOMAIN}`);
    }
    // Found the app. Find the connected tunnel.
    const ws = tunnel_1.tunnelManager.getSender(app.user_id);
    if (!ws) {
        return res.status(503).send('The host for this app is currently offline. Please try again later.');
    }
    const requestId = (0, uuid_1.v4)();
    const headers = req.headers;
    let bodyBuffer = [];
    req.on('data', chunk => bodyBuffer.push(chunk));
    req.on('end', async () => {
        const bodyBytes = Buffer.concat(bodyBuffer);
        const bodyArray = bodyBytes.length > 0 ? Array.from(bodyBytes) : undefined;
        const responseMsg = await tunnel_1.tunnelManager.sendHttpRequest(app.user_id, {
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
        }
        else {
            res.end();
        }
    });
}

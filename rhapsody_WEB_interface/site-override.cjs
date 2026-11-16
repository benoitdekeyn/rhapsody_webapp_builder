'use strict';

function siteOverride(config) {
  const api = { host: '127.0.0.1', port: 8080, token: '', ...config.api };
  const site = { title: '', reconnectMs: 1000, theme: 'dark', showDebug: false, ...config.site };
  const host = api.host === '0.0.0.0' || api.host === '::' ? 'localhost' : api.host;
  return {
    ...(site.title ? { title: site.title } : {}),
    api: { url: `http://${host}:${api.port}`, token: api.token, reconnectMs: site.reconnectMs },
    ui: { theme: site.theme, showDebug: site.showDebug },
  };
}

module.exports = { siteOverride };

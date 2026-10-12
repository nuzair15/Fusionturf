export const imageWidgetUri = "ui://fusion-bookings/image-v1.html";
export const imageToolMeta = {
  ui: { resourceUri: imageWidgetUri, visibility: ["model", "app"] },
  "openai/widgetAccessible": true,
  "openai/outputTemplate": imageWidgetUri,
  "openai/toolInvocation/invoking": "Creating booking image",
  "openai/toolInvocation/invoked": "Booking image ready",
};

// No customer data is embedded in the template. The host supplies the tool result.
export function imageWidgetHtml(origin: string) {
  return String.raw`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  :root{color-scheme:light dark}body{margin:0;font:14px system-ui,sans-serif}main{padding:16px}h2{font-size:18px;margin:0 0 8px}p{line-height:1.5}img{display:block;width:100%;height:auto;border-radius:10px}a{color:light-dark(#156343,#87dbb5)}[hidden]{display:none!important}.frame{max-height:650px;overflow:auto}#status{color:light-dark(#57645d,#b7c4bc)}
  </style></head><body><main><h2 id="title">Fusion Turf booking image</h2><p id="summary"></p><p id="status" role="status">Loading booking image...</p><div class="frame"><img id="image" hidden referrerpolicy="no-referrer" alt="Fusion Turf booking calendar"></div><p><a id="open" hidden target="_blank" rel="noopener noreferrer">Open full-size PNG</a> <a id="download" hidden target="_blank" rel="noopener noreferrer">Download PNG</a></p><p id="expiry"></p><p><button id="refresh" hidden>Refresh calendar</button></p></main><script>
  const allowedOrigin = ${JSON.stringify(origin)};
  const image = document.getElementById('image'), link = document.getElementById('open'), status = document.getElementById('status');
  const download = document.getElementById('download'), refresh = document.getElementById('refresh');
  let currentUrl, currentData, refreshing = false, refreshTimer;
  function validUrl(value) {
    try {
      const url = new URL(value);
      if (url.origin === allowedOrigin && !url.username && !url.password && /^\/api\/integrations\/bookings\/files\/[a-f0-9]{32}\/[A-Za-z0-9_-]+\.png$/.test(url.pathname)) return url;
    } catch {}
  }
  for (const anchor of [link, download]) anchor.addEventListener('click', event => {
    if (window.openai?.openExternal) { event.preventDefault(); window.openai.openExternal({href:anchor.href}); }
  });
  function refreshDone(result) {
    clearTimeout(refreshTimer); refreshing = false; refresh.disabled = false;
    if (result?.structuredContent) render(result.structuredContent);
    else if (result?.image) render(result);
    else { status.hidden = false; status.textContent = 'Could not refresh. Ask for this calendar again in chat.'; }
  }
  refresh.addEventListener('click', async () => {
    if (refreshing || !currentData?.venue?.id) return;
    refreshing = true; refresh.disabled = true; status.hidden = false; status.textContent = 'Refreshing calendar...';
    const args = {venueId:currentData.venue.id,startDate:currentData.startDate,endDate:currentData.endDate,audience:currentData.audience};
    refreshTimer = setTimeout(() => refreshDone(null), 60000);
    try {
      if (window.openai?.callTool) refreshDone(await window.openai.callTool('get_calendar', args));
      else window.parent.postMessage({jsonrpc:'2.0',id:'fusion-image-refresh',method:'tools/call',params:{name:'get_calendar',arguments:args}}, '*');
    } catch { refreshDone(null); }
  });
  function render(data) {
    if (!data?.image?.url) return;
    const url = validUrl(data.image.url), saveUrl = validUrl(data.image.downloadUrl || data.image.url);
    if (!url || !saveUrl) return;
    currentData = data; refresh.hidden = !data.venue?.id;
    document.getElementById('title').textContent = data.title || (data.venue?.name ? data.venue.name + ' calendar' : 'Fusion Turf booking image');
    document.getElementById('summary').textContent = data.summary ? data.startDate + ' to ' + data.endDate + ' | ' + data.summary.totalBookings + ' bookings | ' + data.summary.hoursBooked + ' hours | ' + data.venue.timezone : '';
    if (currentUrl === url.href) return;
    currentUrl = url.href;
    const expires = Date.parse(data.image.expiresAt);
    document.getElementById('expiry').textContent = Number.isFinite(expires) ? 'Download available until ' + new Date(expires).toLocaleString() + '. Refresh for a new copy.' : '';
    status.hidden = false; status.textContent = 'Loading booking image...'; image.hidden = true;
    image.onload = () => { image.hidden = false; status.hidden = true; };
    image.onerror = () => { image.hidden = true; status.hidden = false; status.textContent = 'The image could not load. Open the PNG link, or ask for a fresh image if the link has expired.'; };
    image.alt = document.getElementById('title').textContent;
    image.src = url.href; link.href = url.href; link.hidden = false; download.href = saveUrl.href; download.hidden = false;
  }
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.data?.jsonrpc !== '2.0') return;
    const message = event.data;
    if (message.id === 'fusion-image-init' && message.result) window.parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/initialized',params:{}}, '*');
    if (message.id === 'fusion-image-refresh') refreshDone(message.result);
    if (message.method === 'ui/notifications/tool-result') render(message.params?.structuredContent);
    if (message.id !== undefined && message.method === 'ui/resource-teardown') window.parent.postMessage({jsonrpc:'2.0',id:message.id,result:{}}, '*');
  });
  window.addEventListener('openai:set_globals', event => render(event.detail?.globals?.toolOutput));
  render(window.openai?.toolOutput);
  if (window.parent !== window) window.parent.postMessage({jsonrpc:'2.0',id:'fusion-image-init',method:'ui/initialize',params:{appInfo:{name:'Fusion Turf booking image',version:'1.0.0'},appCapabilities:{},protocolVersion:'2026-01-26'}}, '*');
  </script></body></html>`;
}

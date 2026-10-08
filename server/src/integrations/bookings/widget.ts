export const imageWidgetUri = "ui://fusion-bookings/image-v1.html";
export const imageToolMeta = {
  ui: { resourceUri: imageWidgetUri },
  "openai/outputTemplate": imageWidgetUri,
  "openai/toolInvocation/invoking": "Creating booking image",
  "openai/toolInvocation/invoked": "Booking image ready",
};

// No customer data is embedded in the template. The host supplies the tool result.
export function imageWidgetHtml(origin: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  :root{color-scheme:light dark}body{margin:0;font:14px system-ui,sans-serif}main{padding:16px}h2{font-size:18px;margin:0 0 8px}p{line-height:1.5}img{display:block;width:100%;height:auto;border-radius:10px}a{color:light-dark(#156343,#87dbb5)}[hidden]{display:none!important}.frame{max-height:650px;overflow:auto}#status{color:light-dark(#57645d,#b7c4bc)}
  </style></head><body><main><h2 id="title">Fusion Turf booking image</h2><p id="summary"></p><p id="status" role="status">Loading booking image...</p><div class="frame"><img id="image" hidden referrerpolicy="no-referrer" alt="Fusion Turf booking calendar"></div><p><a id="open" hidden target="_blank" rel="noopener noreferrer">Open / save full-size PNG</a></p><p>Image links last 15 minutes. Ask for the calendar again for a fresh image.</p></main><script>
  const allowedOrigin = ${JSON.stringify(origin)};
  const image = document.getElementById('image'), link = document.getElementById('open'), status = document.getElementById('status');
  let currentUrl;
  function render(data) {
    if (!data?.image?.url) return;
    let url;
    try { url = new URL(data.image.url); } catch { return; }
    if (url.origin !== allowedOrigin || !url.pathname.startsWith('/api/integrations/bookings/files/') || !url.pathname.endsWith('.png')) return;
    document.getElementById('title').textContent = data.title || (data.venue?.name ? data.venue.name + ' calendar' : 'Fusion Turf booking image');
    document.getElementById('summary').textContent = data.summary ? data.startDate + ' to ' + data.endDate + ' | ' + data.summary.totalBookings + ' bookings | ' + data.summary.hoursBooked + ' hours | ' + data.venue.timezone : '';
    if (currentUrl === url.href) return;
    currentUrl = url.href;
    status.hidden = false; status.textContent = 'Loading booking image...'; image.hidden = true;
    image.onload = () => { image.hidden = false; status.hidden = true; };
    image.onerror = () => { image.hidden = true; status.hidden = false; status.textContent = 'The image could not load. Open the PNG link, or ask for a fresh image if the link has expired.'; };
    image.alt = document.getElementById('title').textContent;
    image.src = url.href; link.href = url.href; link.hidden = false;
  }
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.data?.jsonrpc !== '2.0') return;
    const message = event.data;
    if (message.id === 'fusion-image-init' && message.result) window.parent.postMessage({jsonrpc:'2.0',method:'ui/notifications/initialized',params:{}}, '*');
    if (message.method === 'ui/notifications/tool-result') render(message.params?.structuredContent);
    if (message.id !== undefined && message.method === 'ui/resource-teardown') window.parent.postMessage({jsonrpc:'2.0',id:message.id,result:{}}, '*');
  });
  window.addEventListener('openai:set_globals', event => render(event.detail?.globals?.toolOutput));
  render(window.openai?.toolOutput);
  if (window.parent !== window) window.parent.postMessage({jsonrpc:'2.0',id:'fusion-image-init',method:'ui/initialize',params:{appInfo:{name:'Fusion Turf booking image',version:'1.0.0'},appCapabilities:{},protocolVersion:'2026-01-26'}}, '*');
  </script></body></html>`;
}

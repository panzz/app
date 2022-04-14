const endpointUrl = 'https://preauthenticator.webaverse.online/';

export const connect = async () => {
  const iframe = document.createElement('iframe');
  const p = new Promise((accept, reject) => {
    iframe.addEventListener('load', () => {
      const message = e => {
        const {kvsInit} = e.data;
        if (kvsInit) {
          const {port} = e.data;
          accept(port);
          
          window.removeEventListener('message', message);
        }
      };
      window.addEventListener('message', message);
    });
    iframe.addEventListener('error', err => {
      reject(err);
    });
    iframe.crossOrigin = 'Anonymous';
    iframe.src = endpointUrl;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
  });
  const port = await p;
  port.request = function(req) {
    return new Promise((accept, reject) => {
      port.addEventListener('message', e => {
        accept(e.data);
      }, {once: true});
      port.postMessage(req);
    });
  };
  port.callAuthenticatedApi = async (name, url, query) => {
    const res = await port.request({
      method: 'callAuthenticatedApi',
      data: {
        name,
        url,
        query,
      },
    });
    return res;
  };
  port.setAuthenticatedApi = async (name, origin, authorization) => {
    const res = await port.request({
      method: 'setAuthenticatedApi',
      data: {
        name,
        origin,
        authorization,
      },
    });
    const {ok} = res;
    return ok;
  };
  port.hasAuthenticatedApi = async name => {
    const res = await port.request({
      method: 'hasAuthenticatedApi',
      data: {
        name,
      },
    });
    const {has} = res;
    return has;
  };
  port.deleteAuthenticatedApi = async key => {
    const res = await port.request({
      method: 'deleteAuthenticatedApi',
      data: {
        key,
      },
    });
    const {deleted} = res;
    return deleted;
  };
  port.start();

  return port;
};

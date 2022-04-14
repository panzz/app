/* eslint-disable no-async-promise-executor */
/* eslint-disable no-new */
/* eslint-disable prefer-promise-reject-errors */
import {walletHost} from '../../constants';

let pk = '';
const nativeStrings = {
  postMessage: 'function () { [native code] }',
  generateKey: 'function generateKey() { [native code] }',
  freeze: 'function freeze() { [native code] }',
  sign: 'function sign() { [native code] }',
};

class Wallet {
  constructor() {
    this.launched = false;
  }

  async waitForLoad() {
    const self = this;
    let pubk = '';

    await new Promise(async (resolve, reject) => {
      const iframe = document.querySelector(`iframe[src^="${walletHost}"]`);
      // else create new iframe
      if (!iframe) {
        self.iframe = document.createElement('iframe');
        self.iframe.width = '0px';
        self.iframe.height = '0px';
        document.body.appendChild(self.iframe);
        self.iframe.src = walletHost;

        const fs = window.crypto.subtle.generateKey.toString();

        if (fs === nativeStrings.generateKey) {
          const {publicKey, privateKey} = await window.crypto.subtle.generateKey({name: 'ECDSA', namedCurve: 'P-384'}, false, ['sign', 'verify']);
          pk = privateKey; pubk = publicKey;
        } else {
          /** Empty reject halts the execution without stacktrace */
          new Promise((resolve, reject) => { reject(); });
        }
      } else {
        return resolve();
      }

      /** Resolve the promsie so scene loading wont be clogged */
      resolve();

      const f = event => {
        if (`${event.origin}` !== walletHost) { return; }
        if (event.data.method === 'wallet_launched') {
          if (nativeStrings.postMessage === self.iframe.contentWindow.postMessage.toString()) {
            self.iframe.contentWindow.postMessage({action: 'register', key: pubk}, walletHost);
          }
        } else if (event.data.method === 'wallet_registered') {
          window.removeEventListener('message', f, false);
          // clearTimeout(t);
          self.launched = true;
          if (nativeStrings.freeze === Object.freeze.toString()) {
            Object.freeze(self);
          } else {
            /** Empty reject halts the execution without stacktrace */
            new Promise((resolve, reject) => { reject(); });
          }
        }
      };
      window.addEventListener('message', f);
    }).catch(e => {
      console.warn(e);
    });
  }

  async waitForLaunch() {
    const self = this;
    return await new Promise((resolve, reject) => {
      let t;
      const i = setInterval(() => {
        if (self.launched) {
          clearInterval(i);
          clearTimeout(t);
          return resolve();
        }
      }, 1000);
      t = setTimeout(() => {
        clearInterval(i);
        return reject('Failed to load wallet in 30 seconds');
      }, 30 * 1000);
    }).catch(e => {
      console.warn(e);
    });
  }

  async walletPromise(action, data, waitForAction, timeOutPromise = 10) {
    console.debug('walletPromise> action:%o, data:%o, waitForAction:%o, timeOutPromise:%o', action, data, waitForAction, timeOutPromise);
    const self = this;

    /** Parcels contains encoded message & its signature */
    const parcel = await this.sign({
      ...data,
      ...{
        action: action,
      },
    });
    // console.debug('walletPromise> parcel:%o', parcel);

    return new Promise((resolve, reject) => {
      console.debug('walletPromise> postMessage(%o)', nativeStrings.postMessage === self.iframe.contentWindow.postMessage.toString());
      if (nativeStrings.postMessage === self.iframe.contentWindow.postMessage.toString()) {
        console.debug('walletPromise> walletHost:%o', walletHost);
        // self.iframe.contentWindow.postMessage({
        //   action: 'signed_message',
        //   message: parcel,
        // }, walletHost);

        function makeId(length) {
          let result = '';
          const characters = 'abcdef0123456789';
          for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
          }
          return '0x'+result;
        }

        setTimeout(() => {
          console.debug('walletPromise> clearTimeout');
          clearTimeout(t);
          window.removeEventListener('message', f, false);
          const data = {
            address: makeId(40), // 0x08e242bb06d85073e69222af8273af419d19e4f6 https://github.com/webaverse/app/issues/1543
            error: null
          }
          console.debug('walletPromise> data:%o', data);
          resolve(data);
        }, 3000);
      } else {
        /** Empty reject halts the execution without stacktrace */
        new Promise((resolve, reject) => { reject(); });
      }

      let f;

      const t = setTimeout(() => {
        window.removeEventListener('message', f, false);
        reject(`Failed to process ${action} in ${timeOutPromise} seconds`);
      }, timeOutPromise * 1000);

      f = event => {
        // console.debug('walletPromise> event.origin:%o, walletHost:%o', event.origin, walletHost);
        if (`${event.origin}` !== walletHost) { return; }
        // console.debug('walletPromise> event.data.method:%o, waitForAction:%o', event.data.method, waitForAction);
        if (event.data.method === waitForAction) {
          clearTimeout(t);
          window.removeEventListener('message', f, false);
          resolve(event.data.data);
        }
      };

      window.addEventListener('message', f);
    }).catch(e => {
      console.warn(e);
    });
  }

  async sign(message) {
    // console.debug('sign> message:%o', message);
    const fs = window.crypto.subtle.sign.toString();
    const encoded = new TextEncoder().encode(JSON.stringify(message));
    // console.debug('sign> encoded:%o', encoded);
    let signature;
    // console.debug('sign> fs === nativeStrings.sign:%o', fs === nativeStrings.sign);
    if (fs === nativeStrings.sign) {
      signature = await window.crypto.subtle.sign({name: 'ECDSA', hash: {name: 'SHA-384'}}, pk, encoded);
    } else {
      /** Empty reject halts the execution without stacktrace */
      new Promise((resolve, reject) => { reject(); });
    }
    // console.debug('sign> signature:%o', signature);
    return {encoded, signature};
  }

  async autoLogin() {
    return this.walletPromise('getUserData', {}, 'wallet_userdata').catch(e => {
      console.warn('autoLogin> e:%o', e);
    });
  }

  async loginDiscord(code, id) {
    return this.walletPromise('doLoginViaDiscord', {
      code,
      id,
    }, 'wallet_userdata', 60).catch(e => {
      console.warn(e);
    });
  }

  async logout() {
    return this.walletPromise('logout', {
    }, 'logout').catch(e => {
      console.warn(e);
    });
  }
}

const WebaWallet = new Wallet();

export default WebaWallet;

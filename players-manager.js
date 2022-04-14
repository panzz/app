/* player manager binds y.js data to player objects
player objects load their own avatar and apps using this binding */

// import * as THREE from 'three';
import * as Z from 'zjs';
import {RemotePlayer} from './character-controller.js';
// import {getPlayerPrefix} from './util.js';
// import {playersMapName} from './constants.js';
import metaversefileApi from 'metaversefile';

class PlayersManager {
  constructor() {
    this.playersArray = null;
    
    this.remotePlayers = new Map();
    
    this.unbindStateFn = null;
  }
  getPlayersState() {
    return this.playersArray;
  }
  unbindState() {
    const lastPlayers = this.playersArray;
    if (lastPlayers) {
      this.unbindStateFn();
      this.playersArray = null;
      this.unbindStateFn = null;
    }
  }
  bindState(nextPlayersArray) {
    this.unbindState();
    
    this.playersArray = nextPlayersArray;
    
    if (this.playersArray) {
      const localPlayer = metaversefileApi.useLocalPlayer();
      
      const playersObserveFn = e => {
        const {added, deleted, delta, keys} = e.changes;
        for (const item of added.values()) {
          let playerMap = item.content.type;
          if (playerMap.constructor === Object) {
            for (let i = 0; i < this.playersArray.length; i++) {
              const localPlayerMap = this.playersArray.get(i, Z.Map); // force to be a map
              if (localPlayerMap.binding === item.content.type) {
                playerMap = localPlayerMap;
                break;
              }
            }
          }

          const playerId = playerMap.get('playerId');
          
          if (playerId !== localPlayer.playerId) {
            console.log('add playerId %o, localPlayer:%o', playerId, localPlayer.playerId);
            
            console.log('add playersArray:%o', this.playersArray);
            const remotePlayer = new RemotePlayer({
              playerId,
              playersArray: this.playersArray,
            });
            this.remotePlayers.set(playerId, remotePlayer);
            console.log('after add remotePlayers:%o', this.remotePlayers);
          }
        }
        // console.log('players observe', added, deleted);
        for (const item of deleted.values()) {
          console.log('player remove 1', item);
          const playerId = item.content.type._map.get('playerId').content.arr[0]; // needed to get the old data
          console.log('player remove 2', playerId, localPlayer.playerId);

          if (playerId !== localPlayer.playerId) {
            console.log('remove playerId %o, localPlayer:%O', playerId, localPlayer.playerId);
            
            const remotePlayer = this.remotePlayers.get(playerId);
            console.log('remove remotePlayer:%o', remotePlayer);
            this.remotePlayers.delete(playerId);
            remotePlayer.destroy();
            console.log('after remove remotePlayers:%o', this.remotePlayers);
          }
        }
      };
      this.playersArray.observe(playersObserveFn);
      this.unbindStateFn = this.playersArray.unobserve.bind(this.playersArray, playersObserveFn);
    }
  }
  update(timestamp, timeDiff) {
    // console.debug('update> remotePlayers(%o):%o', this.remotePlayers.size, this.remotePlayers.values())
    // if (!this.remotePlayers.size || this.remotePlayers.values() <=  0) {
    //   return
    // }
    for (const remotePlayer of this.remotePlayers.values()) {
      console.debug('update> remotePlayer(%o:%o)', this.remotePlayers.values(), Object.prototype.toString.call(remotePlayer.updateAvatar)=== '[object Function]')
      if (remotePlayer && Object.prototype.toString.call(remotePlayer.updateAvatar)=== '[object Function]') {
        remotePlayer.updateAvatar(timestamp, timeDiff);
      }
    }
  }
}
const playersManager = new PlayersManager();

export {
  playersManager,
};

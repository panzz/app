/*
this file contains the singleplayer code.
*/

import * as THREE from 'three';
// import * as Y from 'yjs';
import * as Z from 'zjs/z.mjs';
import WSRTC from 'wsrtc/wsrtc.js';

import hpManager from './hp-manager.js';
// import {rigManager} from './rig.js';
import {AppManager} from './app-manager.js';
// import {chatManager} from './chat-manager.js';
// import {getState, setState} from './state.js';
// import {makeId} from './util.js';
import {scene, sceneHighPriority, sceneLowPriority} from './renderer.js';
import metaversefileApi from 'metaversefile';
import {appsMapName, playersMapName} from './constants.js';
import {playersManager} from './players-manager.js';
import * as metaverseModules from './metaverse-modules.js';
import {createParticleSystem} from './particle-system.js';
import * as sounds from './sounds.js';

const localEuler = new THREE.Euler();

// world
export const world = {};

const appManager = new AppManager({
  appsMap: null,
});
world.appManager = appManager;

world.particleSystem = createParticleSystem();
scene.add(world.particleSystem);

// multiplayer
let wsrtc = null;


world.getConnection = () => wsrtc;

world.connectState = state => {
  state.setResolvePriority(1);

  world.appManager.unbindState();
  world.appManager.clear();
  world.appManager.bindState(state.getArray(appsMapName));
  
  playersManager.bindState(state.getArray(playersMapName));
  
  const localPlayer = metaversefileApi.useLocalPlayer();
  localPlayer.bindState(state.getArray(playersMapName));
  
  // note: here we should load up the apps in the state since it won't happen automatically.
  // until we implement that, only fresh state is supported...
};
world.isConnected = () => !!wsrtc;
world.connectRoom = async u => {
  console.debug('world.connectRoom> u:%o', u);
  // await WSRTC.waitForReady();
  
  world.appManager.unbindState();
  world.appManager.clear();

  const localPlayer = metaversefileApi.useLocalPlayer();
  const state = new Z.Doc();
  state.setResolvePriority(1);
  wsrtc = new WSRTC(u, {
    localPlayer,
    crdtState: state,
  });
  const open = e => {
    wsrtc.removeEventListener('open', open);
    
    world.appManager.bindState(state.getArray(appsMapName));
    playersManager.bindState(state.getArray(playersMapName));
    
    const init = e => {
      wsrtc.removeEventListener('init', init);
      
      localPlayer.bindState(state.getArray(playersMapName));
      // if (mediaStream) {
      //   wsrtc.enableMic(mediaStream);
      // }
    };
    wsrtc.addEventListener('init', init);
  };
  wsrtc.addEventListener('open', open);


  // const name = makeId(5);
  // let interval, intervalMetadata;
  wsrtc.addEventListener('open', async e => {
    console.log('Channel Open!');

  }, {once: true});

  wsrtc.addEventListener('close', e => {
    console.log('Channel Close!');

  }, {once: true});


  wsrtc.close = (close => function() {
    close.apply(this, arguments);

    wsrtc.dispatchEvent(new MessageEvent('close'));
  })(wsrtc.close);

  return wsrtc;
};
world.disconnectRoom = () => {
  console.debug('world.disconnectRoom> wsrtc:%o', wsrtc);
  if (wsrtc) {
    wsrtc.close();
    wsrtc = null;

    // world.clear();
    // world.newState();
  }
};
/* world.clear = () => {
  appManager.clear();
}; */
/* world.save = () => {
  return world.appManager.state.toJSON();
}; */

const _getBindSceneForRenderPriority = renderPriority => {
  switch (renderPriority) {
    case 'high': {
      return sceneHighPriority;
    }
    case 'low': {
      return sceneLowPriority;
    }
    /* case 'postPerspectiveScene': {
      return postScenePerspective;
    }
    case 'postOrthographicScene': {
      return postSceneOrthographic;
    } */
    default: {
      return scene;
    }
  }
};
const _bindHitTracker = app => {
  const bindScene = _getBindSceneForRenderPriority(app.getComponent('renderPriority'));
  
  const hitTracker = hpManager.makeHitTracker();
  bindScene.add(hitTracker);
  hitTracker.add(app);
  app.hitTracker = hitTracker;

  const frame = e => {
    const {timeDiff} = e.data;
    hitTracker.update(timeDiff);
  };
  world.appManager.addEventListener('frame', frame);
  const die = () => {
    world.appManager.removeTrackedApp(app.instanceId);
  };
  app.addEventListener('die', die); 
  
  const cleanup = () => {
    // console.log('cleanup hit trakcer parent', hitTracker.parent, app.parent);
    bindScene.remove(hitTracker);
    world.appManager.removeEventListener('frame', frame);
    app.removeEventListener('die', die);
  };
  
  app.hit = (_hit => function(damage, opts = {}) {
    const result = hitTracker.hit(damage);
    const {hit, died} = result;
    if (hit) {
      const {collisionId, hitPosition, hitDirection, hitQuaternion, willDie} = opts;
      if (willDie) {
        hpManager.triggerDamageAnimation(collisionId);
        
        const soundFiles = sounds.getSoundFiles();
        const enemyDeathSound = soundFiles.enemyDeath[Math.floor(Math.random() * soundFiles.enemyDeath.length)];
        sounds.playSound(enemyDeathSound);
      }

      {
        const damageMeshApp = metaversefileApi.createApp();
        (async () => {
          await metaverseModules.waitForLoad();
          const {modules} = metaversefileApi.useDefaultModules();
          const m = modules['damageMesh'];
          await damageMeshApp.addModule(m);
        })();
        damageMeshApp.position.copy(hitPosition);
        localEuler.setFromQuaternion(hitQuaternion, 'YXZ');
        localEuler.x = 0;
        localEuler.z = 0;
        damageMeshApp.quaternion.setFromEuler(localEuler);
        damageMeshApp.updateMatrixWorld();
        scene.add(damageMeshApp);
      }
      
      app.dispatchEvent({
        type: 'hit',
        collisionId,
        hitPosition,
        hitDirection,
        hitQuaternion,
        willDie,
        hp: hitTracker.hp,
        totalHp: hitTracker.totalHp,
      });
    }
    if (died) {
      app.dispatchEvent({
        type: 'die',
        // position: cylinderMesh.position,
        // quaternion: cylinderMesh.quaternion,
      });
    }
    return result;
  })(app.hit);
  app.willDieFrom = damage => (hitTracker.hp - damage) <= 0;
  app.unbindHitTracker = () => {
    cleanup();
    delete app.hitTracker;
    delete app.hit;
    delete app.willDieFrom;
  };
};
appManager.addEventListener('appadd', e => {
  const app = e.data;
  _bindHitTracker(app);
});
appManager.addEventListener('trackedappmigrate', async e => {
  const {app, sourceAppManager, destinationAppManager} = e.data;
  if (this === sourceAppManager) {
    app.unbindHitTracker();
    app.unbindHitTracker = null;
  } else if (this === destinationAppManager) {
    _bindHitTracker(app);
  }
});
appManager.addEventListener('appremove', async e => {
  const app = e.data;
  app.unbindHitTracker();
  app.unbindHitTracker = null;
});

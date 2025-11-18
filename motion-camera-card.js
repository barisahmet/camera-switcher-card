class MotionCameraCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._config = null;
    this._activeCamera = null;
    this._unsubscribes = [];
  }

  set hass(hass) {
    const oldHass = this._hass;
    this._hass = hass;
    
    // Only update if this is the first time or if relevant states changed
    if (!oldHass || this._shouldUpdate(oldHass, hass)) {
      this._updateActiveCamera();
    } else {
      this._render();
    }
  }

  _shouldUpdate(oldHass, newHass) {
    if (!this._config) {
      return false;
    }

    // Check if any motion sensor state has changed
    for (const camera of this._config.cameras) {
      for (const entityId of camera.motion_entities) {
        const oldState = oldHass.states[entityId];
        const newState = newHass.states[entityId];
        if (oldState?.state !== newState?.state) {
          return true;
        }
      }
    }

    // Check if the active camera state has changed (for name updates, etc.)
    const oldCameraState = oldHass.states[this._activeCamera];
    const newCameraState = newHass.states[this._activeCamera];
    if (oldCameraState !== newCameraState) {
      return true;
    }

    return false;
  }

  setConfig(config) {
    if (!config.cameras || !Array.isArray(config.cameras)) {
      throw new Error('You need to define cameras');
    }

    for (const camera of config.cameras) {
      if (!camera.camera_entity) {
        throw new Error('Each camera needs a camera_entity');
      }
      if (!camera.motion_entities || !Array.isArray(camera.motion_entities) || camera.motion_entities.length === 0) {
        throw new Error('Each camera needs at least one motion_entity');
      }
    }

    this._config = config;
    this._activeCamera = config.cameras[0].camera_entity;
    this._render();
  }

  getCardSize() {
    return 3;
  }

  _updateActiveCamera() {
    if (!this._hass || !this._config) {
      return;
    }

    // Find the first camera with an active motion sensor
    for (const camera of this._config.cameras) {
      const hasActiveMotion = camera.motion_entities.some(entityId => {
        const state = this._hass.states[entityId];
        return state && state.state === 'on';
      });

      if (hasActiveMotion) {
        if (this._activeCamera !== camera.camera_entity) {
          this._activeCamera = camera.camera_entity;
          this._render();
        }
        return;
      }
    }

    // If no motion detected, show the first camera
    if (this._activeCamera !== this._config.cameras[0].camera_entity) {
      this._activeCamera = this._config.cameras[0].camera_entity;
      this._render();
    }
  }

  _render() {
    if (!this._config || !this._hass) {
      return;
    }

    const cameraState = this._hass.states[this._activeCamera];
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        ha-card {
          overflow: hidden;
          position: relative;
        }
        .camera-container {
          position: relative;
          width: 100%;
        }
        .camera-image {
          width: 100%;
          display: block;
        }
        .camera-name {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(0, 0, 0, 0.5);
          color: white;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 500;
        }
        .motion-indicator {
          position: absolute;
          top: 8px;
          right: 8px;
          background: #f44336;
          color: white;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .motion-indicator::before {
          content: '';
          width: 8px;
          height: 8px;
          background: white;
          border-radius: 50%;
          animation: pulse 1s infinite;
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        .error {
          padding: 16px;
          color: #f44336;
          font-weight: 500;
        }
      </style>
      <ha-card>
        ${this._renderCameraContent(cameraState)}
      </ha-card>
    `;
  }

  _renderCameraContent(cameraState) {
    if (!cameraState) {
      return `<div class="error">Camera entity not found: ${this._activeCamera}</div>`;
    }

    const hasActiveMotion = this._isActiveMotionForCamera(this._activeCamera);
    const cameraName = cameraState.attributes.friendly_name || this._activeCamera;
    const cameraImageSrc = this._getCameraImageUrl(this._activeCamera);

    return `
      <div class="camera-container">
        <img class="camera-image" src="${cameraImageSrc}" alt="${cameraName}" />
        ${hasActiveMotion ? '<div class="motion-indicator">Motion Detected</div>' : ''}
        <div class="camera-name">${cameraName}</div>
      </div>
    `;
  }

  _isActiveMotionForCamera(cameraEntity) {
    const camera = this._config.cameras.find(c => c.camera_entity === cameraEntity);
    if (!camera) {
      return false;
    }

    return camera.motion_entities.some(entityId => {
      const state = this._hass.states[entityId];
      return state && state.state === 'on';
    });
  }

  _getCameraImageUrl(entityId) {
    if (!this._hass) {
      return '';
    }
    
    // Use the Home Assistant API to get the camera image
    // The token is automatically handled by Home Assistant's authentication
    return `/api/camera_proxy/${entityId}`;
  }

  static getConfigElement() {
    return document.createElement('motion-camera-card-editor');
  }

  static getStubConfig() {
    return {
      cameras: [
        {
          camera_entity: 'camera.example',
          motion_entities: ['binary_sensor.example_motion']
        }
      ]
    };
  }
}

customElements.define('motion-camera-card', MotionCameraCard);

// Register the card with Home Assistant
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'motion-camera-card',
  name: 'Motion Camera Card',
  description: 'A card that switches between cameras based on motion detection',
  preview: false,
  documentationURL: 'https://github.com/barisahmet/camera-switcher-card'
});

console.info(
  '%c MOTION-CAMERA-CARD %c Version 1.0.0 ',
  'color: white; background: #2196F3; font-weight: 700;',
  'color: white; background: #424242; font-weight: 700;'
);

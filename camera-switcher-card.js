import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class CameraSwitcherCard extends LitElement {
  static get properties() {
    return {
      hass: {},
      config: {},
      _activeCamera: { type: String },
      // Logic state (used internally, not for rendering)
      _isMotionActive: { type: Boolean }, 
    };
  }

  static getStubConfig(hass) {
    const cams = Object.keys(hass.states || {}).filter((e) =>
      e.startsWith("camera.")
    );
    const first = cams[0] || "camera.example";
    return {
      show_name: false,
      stretch: false,
      timeout: 10,
      cameras: [
        {
          camera_entity: first,
          motion_entities: [],
        },
      ],
    };
  }

  static async getConfigElement() {
    return document.createElement("camera-switcher-card-editor");
  }

  setConfig(config) {
    if (!config.cameras || !Array.isArray(config.cameras) || config.cameras.length === 0) {
      throw new Error("You must define at least one camera in 'cameras'.");
    }

    const normCams = config.cameras.map((c, idx) => {
      if (!c.camera_entity) {
        throw new Error(`Camera #${idx + 1} is missing 'camera_entity'.`);
      }
      return {
        camera_entity: c.camera_entity,
        motion_entities: Array.isArray(c.motion_entities) ? c.motion_entities : [],
      };
    });

    this.config = {
      show_name: false,
      stretch: false,
      timeout: 10,
      ...config,
      cameras: normCams,
    };

    // PERFORMANCE: Build WatchList
    this._watchList = new Set();
    normCams.forEach((c) => {
      this._watchList.add(c.camera_entity);
      c.motion_entities.forEach((m) => this._watchList.add(m));
    });

    this._activeCamera = this.config.cameras[0].camera_entity;
    this._lastTriggeredCamera = null;
    this._lastMotionTime = 0;
    this._timeoutTimer = null;
    this._isMotionActive = false;
  }

  set hass(hass) {
    const oldHass = this._hass;
    this._hass = hass;

    if (!this.config) return;

    // PERFORMANCE: Only update if relevant entities changed
    let shouldUpdate = !oldHass;
    
    if (oldHass) {
      for (const entityId of this._watchList) {
        if (oldHass.states[entityId] !== hass.states[entityId]) {
          shouldUpdate = true;
          break;
        }
      }
    }

    if (shouldUpdate) {
      this._updateLogic();
    }
  }

  get hass() {
    return this._hass;
  }

  _updateLogic() {
    const hass = this._hass;
    const cfg = this.config;
    const now = Date.now();
    
    // 1. Scan for motion
    let foundMotionCamera = null;

    for (const cam of cfg.cameras) {
      for (const ent of cam.motion_entities) {
        const stateObj = hass.states[ent];
        if (stateObj && stateObj.state === "on") {
          foundMotionCamera = cam.camera_entity;
          this._isMotionActive = true;
        }
      }
    }

    // 2. Logic Decision
    if (foundMotionCamera) {
      // Motion detected -> Switch
      this._lastTriggeredCamera = foundMotionCamera;
      this._lastMotionTime = now;
      
      if (this._activeCamera !== foundMotionCamera) {
        this._activeCamera = foundMotionCamera;
        if (this._timeoutTimer) {
          clearTimeout(this._timeoutTimer);
          this._timeoutTimer = null;
        }
      }
    } else {
      // No Motion
      this._isMotionActive = false;

      if (this._lastTriggeredCamera) {
        const elapsed = (now - this._lastMotionTime) / 1000;
        const timeout = cfg.timeout || 0;

        if (elapsed < timeout) {
          // Wait time not expired, stay on camera
          this._activeCamera = this._lastTriggeredCamera;

          // Set timer if not exists
          if (!this._timeoutTimer) {
            const remainingMS = (timeout - elapsed) * 1000;
            this._timeoutTimer = setTimeout(() => {
              this._timeoutTimer = null;
              this._updateLogic(); // Re-check
              this.requestUpdate();
            }, remainingMS + 100);
          }
        } else {
          // Time expired -> Revert to default
          this._activeCamera = cfg.cameras[0].camera_entity;
          this._lastTriggeredCamera = null;
        }
      } else {
        // Default state
        this._activeCamera = cfg.cameras[0].camera_entity;
      }
    }
  }

  render() {
    const hass = this._hass;
    const cfg = this.config;
    if (!hass || !cfg) return html``;

    const camEntity = this._activeCamera || cfg.cameras[0].camera_entity;
    const stateObj = hass.states[camEntity];

    if (!stateObj) {
      return html`
        <ha-card>
          <div class="error">
            Entity <code>${camEntity}</code> not found.
          </div>
        </ha-card>
      `;
    }

    const stretch = cfg.stretch === true;
    const showName = cfg.show_name !== false;

    return html`
      <ha-card class="camera-card">
        <div class="camera-wrapper ${stretch ? "stretch" : "normal"}">
          <ha-camera-stream
            .hass=${hass}
            .stateObj=${stateObj}
            muted
            controls=${cfg.controls ?? false}
            allow-exoplayer
          ></ha-camera-stream>

          ${showName
            ? html`
                <div class="camera-label">
                  ${stateObj.attributes.friendly_name || camEntity}
                </div>
              `
            : html``}
        </div>
      </ha-card>
    `;
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }
      ha-card.camera-card {
        overflow: hidden;
        transition: all 0.3s ease-in-out; 
      }
      .camera-wrapper {
        position: relative;
        width: 100%;
        background: black;
      }
      .camera-wrapper.stretch {
        height: 100vh;
      }
      .camera-wrapper.normal {
        height: auto;
        aspect-ratio: 16/9;
      }
      ha-camera-stream {
        width: 100%;
        height: 100%;
        display: block;
        animation: fade-in 0.5s ease-out;
      }

      @keyframes fade-in {
        from { opacity: 0.8; }
        to { opacity: 1; }
      }

      .camera-label {
        position: absolute;
        left: 8px;
        bottom: 8px;
        padding: 4px 8px;
        background: rgba(0, 0, 0, 0.6);
        color: white;
        font-size: 0.9rem;
        border-radius: 4px;
        pointer-events: none;
      }

      .error {
        padding: 16px;
        color: var(--error-color);
      }
    `;
  }

  getCardSize() {
    return 6;
  }
}

if (!customElements.get("camera-switcher-card")) {
  customElements.define("camera-switcher-card", CameraSwitcherCard);
}

// ---------- GUI EDITOR ----------

class CameraSwitcherCardEditor extends LitElement {
  static get properties() {
    return {
      hass: {},
      _config: { type: Object },
    };
  }

  setConfig(config) {
    this._config = config;
  }

  _valueChanged(ev) {
    if (!this._config || !this.hass) return;
    const target = ev.target;
    const configValue = target.configValue;
    const value = target.checked !== undefined ? target.checked : ev.detail.value;

    if (configValue) {
        this._config = {
            ...this._config,
            [configValue]: value,
        };
        this._fireConfigChanged();
    }
  }

  _fireConfigChanged() {
    const ev = new Event("config-changed", {
      bubbles: true,
      composed: true,
    });
    ev.detail = { config: this._config };
    this.dispatchEvent(ev);
  }

  _moveCamera(index, direction) {
    const cams = [...(this._config.cameras || [])];
    if (direction === -1 && index > 0) {
      [cams[index], cams[index - 1]] = [cams[index - 1], cams[index]];
    } else if (direction === 1 && index < cams.length - 1) {
      [cams[index], cams[index + 1]] = [cams[index + 1], cams[index]];
    } else {
        return;
    }
    this._config = { ...this._config, cameras: cams };
    this._fireConfigChanged();
  }

  _removeCamera(index) {
    const cams = [...(this._config.cameras || [])];
    cams.splice(index, 1);
    this._config = { ...this._config, cameras: cams };
    this._fireConfigChanged();
  }

  _addCamera() {
    const cams = [...(this._config.cameras || [])];
    cams.push({ camera_entity: "", motion_entities: [] });
    this._config = { ...this._config, cameras: cams };
    this._fireConfigChanged();
  }

  _updateCameraEntity(index, value) {
    const cams = [...(this._config.cameras || [])];
    cams[index] = { ...cams[index], camera_entity: value };
    this._config = { ...this._config, cameras: cams };
    this._fireConfigChanged();
  }

  _updateMotionEntities(camIndex, motionIndex, value) {
    const cams = [...(this._config.cameras || [])];
    const motions = [...(cams[camIndex].motion_entities || [])];
    
    if (value === null) { 
        motions.splice(motionIndex, 1);
    } else {
        motions[motionIndex] = value;
    }
    
    cams[camIndex] = { ...cams[camIndex], motion_entities: motions };
    this._config = { ...this._config, cameras: cams };
    this._fireConfigChanged();
  }

  _addMotionEntity(camIndex) {
    const cams = [...(this._config.cameras || [])];
    const motions = [...(cams[camIndex].motion_entities || [])];
    motions.push("");
    cams[camIndex] = { ...cams[camIndex], motion_entities: motions };
    this._config = { ...this._config, cameras: cams };
    this._fireConfigChanged();
  }

  _removeMotionEntity(camIndex, motionIndex) {
      this._updateMotionEntities(camIndex, motionIndex, null);
  }

  render() {
    if (!this.hass || !this._config) return html``;

    const cams = this._config.cameras || [];

    return html`
      <div class="card-config">
        <div class="settings-group">
            <ha-formfield .label=${"Show Camera Name"}>
              <ha-switch
                .checked=${this._config.show_name !== false}
                .configValue=${"show_name"}
                @change=${this._valueChanged}
              ></ha-switch>
            </ha-formfield>

            <ha-formfield .label=${"Stretch to Fullscreen"}>
              <ha-switch
                .checked=${this._config.stretch === true}
                .configValue=${"stretch"}
                @change=${this._valueChanged}
              ></ha-switch>
            </ha-formfield>
            
            <div class="timeout-input">
                <ha-textfield
                    label="Revert Delay (seconds)"
                    type="number"
                    min="0"
                    .value=${this._config.timeout || 10}
                    .configValue=${"timeout"}
                    @input=${this._valueChanged}
                ></ha-textfield>
                <p class="help-text">How long to wait after motion stops before reverting to default.</p>
            </div>
        </div>

        <div class="separator"></div>

        <div class="cameras-header">
            <h3>Cameras</h3>
            <span class="subtitle">Order matters: First camera is Default.</span>
        </div>

        ${cams.map((cam, idx) => html`
          <div class="camera-item">
            <div class="camera-header">
                <div class="camera-title">
                   ${idx === 0 ? html`<ha-icon icon="mdi:star" class="default-icon"></ha-icon>` : html`<span class="index-badge">${idx+1}</span>`}
                   <span>${cam.camera_entity || "New Camera"}</span>
                </div>
                <div class="camera-actions">
                    <ha-icon-button 
                        .disabled=${idx === 0} 
                        @click=${() => this._moveCamera(idx, -1)}
                        title="Move Up"
                    ><ha-icon icon="mdi:arrow-up"></ha-icon></ha-icon-button>
                    
                    <ha-icon-button 
                        .disabled=${idx === cams.length - 1} 
                        @click=${() => this._moveCamera(idx, 1)}
                        title="Move Down"
                    ><ha-icon icon="mdi:arrow-down"></ha-icon></ha-icon-button>

                    <ha-icon-button 
                        class="delete-btn"
                        @click=${() => this._removeCamera(idx)}
                        title="Remove Camera"
                    ><ha-icon icon="mdi:delete"></ha-icon></ha-icon-button>
                </div>
            </div>

            <div class="camera-content">
                <ha-selector
                    .hass=${this.hass}
                    .selector=${{ entity: { domain: "camera" } }}
                    .value=${cam.camera_entity}
                    .label=${"Camera Entity"}
                    @value-changed=${(e) => this._updateCameraEntity(idx, e.detail.value)}
                ></ha-selector>

                <div class="motion-section">
                    <div class="motion-header">
                        <span>Trigger Entities</span>
                        <ha-button @click=${() => this._addMotionEntity(idx)} class="add-motion-btn">
                             Add Trigger
                        </ha-button>
                    </div>
                    
                    ${(cam.motion_entities || []).map((m, mIdx) => html`
                        <div class="motion-row">
                            <ha-selector
                                .hass=${this.hass}
                                .selector=${{ entity: { domain: ["binary_sensor", "input_boolean", "sensor"] } }}
                                .value=${m}
                                @value-changed=${(e) => this._updateMotionEntities(idx, mIdx, e.detail.value)}
                            ></ha-selector>
                            <ha-icon-button 
                                @click=${() => this._removeMotionEntity(idx, mIdx)}
                            ><ha-icon icon="mdi:close"></ha-icon></ha-icon-button>
                        </div>
                    `)}
                </div>
            </div>
          </div>
        `)}

        <ha-button raised @click=${this._addCamera} class="add-camera-main">
            <ha-icon icon="mdi:plus" slot="icon"></ha-icon> Add Camera
        </ha-button>

      </div>
    `;
  }

  static get styles() {
    return css`
      .card-config { display: flex; flex-direction: column; gap: 16px; }
      .settings-group { display: flex; flex-direction: column; gap: 12px; }
      .timeout-input { margin-top: 8px; }
      .help-text { font-size: 0.8em; color: var(--secondary-text-color); margin-top: 4px; }
      .separator { height: 1px; background: var(--divider-color); margin: 8px 0; }
      
      .cameras-header { display: flex; justify-content: space-between; align-items: center; }
      .subtitle { font-size: 0.85em; color: var(--secondary-text-color); }
      
      .camera-item { 
          border: 1px solid var(--divider-color); 
          border-radius: 8px; 
          overflow: hidden; 
          background: var(--card-background-color);
      }
      .camera-header {
          background: var(--secondary-background-color);
          padding: 8px 16px;
          display: flex; justify-content: space-between; align-items: center;
          border-bottom: 1px solid var(--divider-color);
      }
      .camera-title { font-weight: 500; display: flex; align-items: center; gap: 8px; }
      .default-icon { color: var(--primary-color); }
      .index-badge { 
          background: var(--primary-color); color: var(--text-primary-color); 
          font-size: 0.75em; padding: 2px 6px; border-radius: 50%; 
      }
      .camera-actions ha-icon-button { color: var(--secondary-text-color); }
      .camera-actions ha-icon-button.delete-btn { color: var(--error-color); }

      .camera-content { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
      
      .motion-section { 
          background: var(--primary-background-color); 
          border: 1px dashed var(--divider-color);
          border-radius: 4px; padding: 8px;
      }
      .motion-header { 
          display: flex; justify-content: space-between; align-items: center; 
          margin-bottom: 8px; font-size: 0.9em; font-weight: 500; 
      }
      .add-motion-btn { --mdc-theme-primary: var(--primary-color); }
      .motion-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
      .motion-row ha-selector { flex: 1; }
      
      .add-camera-main { width: 100%; margin-top: 8px; }
    `;
  }
}

if (!customElements.get("camera-switcher-card-editor")) {
  customElements.define("camera-switcher-card-editor", CameraSwitcherCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "camera-switcher-card",
  name: "Camera Switcher Card",
  description: "Auto-switches camera based on motion with timeout and priority.",
});

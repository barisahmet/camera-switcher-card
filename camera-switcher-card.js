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
      _motionMeta: { type: Object },
    };
  }

  // ---------- GUI EDITÖR ENTEGRASYONU ----------
  static getStubConfig(hass) {
    const cams = Object.keys(hass.states || {}).filter((e) =>
      e.startsWith("camera.")
    );
    const first = cams[0] || "camera.example";
    return {
      show_name: false,
      stretch: false,
      cameras: [
        {
          camera_entity: first,
          motion_entities: [],
          priority: 0,
        },
      ],
    };
  }

  static async getConfigElement() {
    return document.createElement("camera-switcher-card-editor");
  }
  // ---------------------------------------------

  setConfig(config) {
    if (!config.cameras || !Array.isArray(config.cameras) || config.cameras.length === 0) {
      throw new Error("You must define at least one camera in 'cameras'.");
    }

    // Kameraları normalize et
    const normCams = config.cameras.map((c, idx) => {
      if (!c.camera_entity) {
        throw new Error(`Camera #${idx + 1} is missing 'camera_entity'.`);
      }
      return {
        camera_entity: c.camera_entity,
        motion_entities: Array.isArray(c.motion_entities)
          ? c.motion_entities
          : [],
        priority: typeof c.priority === 'number' ? c.priority : 0,
      };
    });

    this.config = {
      show_name: false,
      stretch: false,
      ...config,
      cameras: normCams,
    };

    this._motionMeta = {};
    // İlk kamera her zaman default
    this._activeCamera = this.config.cameras[0].camera_entity;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.config) return;
    this._updateActiveCamera();
  }

  get hass() {
    return this._hass;
  }

  /**
   * Motion entity'lerini takip edip aktif kamerayı seçer.
   * - Motion varsa: en son ON olan kamerayı seç
   * - Motion yoksa: ilk kamerada (default) kal
   */
  _updateActiveCamera() {
    const hass = this._hass;
    const cfg = this.config;
    if (!hass || !cfg) return;

    if (!this._motionMeta) this._motionMeta = {};
    const motionMeta = this._motionMeta;
    const now = Date.now();

    // Motion entity state'lerini güncelle
    for (const cameraCfg of cfg.cameras) {
      for (const ent of cameraCfg.motion_entities) {
        if (!ent) continue;
        const st = hass.states[ent];
        const isOn = st && st.state === "on";

        if (!motionMeta[ent]) {
          motionMeta[ent] = {
            isOn: isOn,
            lastOn: isOn ? now : 0,
          };
          continue;
        }

        // off -> on transition
        if (!motionMeta[ent].isOn && isOn) {
          motionMeta[ent].lastOn = now;
        }

        motionMeta[ent].isOn = isOn;
      }
    }

    // Hangi kameralar aktif?
    const activeCameras = [];
    for (const cameraCfg of cfg.cameras) {
      let camIsActive = false;
      let camLastOn = 0;
      for (const ent of cameraCfg.motion_entities) {
        const mm = motionMeta[ent];
        if (mm && mm.isOn) {
          camIsActive = true;
          if (mm.lastOn > camLastOn) camLastOn = mm.lastOn;
        }
      }
      if (camIsActive) {
        activeCameras.push({
          camera_entity: cameraCfg.camera_entity,
          priority: cameraCfg.priority || 0,
          lastOn: camLastOn,
        });
      }
    }

    let newActive = this._activeCamera;

    if (activeCameras.length > 0) {
      // Sort by priority (descending), then by lastOn (descending)
      activeCameras.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return b.lastOn - a.lastOn;
      });
      newActive = activeCameras[0].camera_entity;
    } else {
      // Hiç motion yok -> ilk kamerayı (default) göster
      newActive = cfg.cameras[0].camera_entity;
    }

    if (newActive !== this._activeCamera) {
      this._activeCamera = newActive;
      this.requestUpdate();
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
            Camera entity <code>${camEntity}</code> not found.
          </div>
        </ha-card>
      `;
    }

    const stretch = cfg.stretch === true;

    return html`
      <ha-card class="camera-card ${stretch ? "stretch" : "normal"}">
        <div class="camera-wrapper ${stretch ? "stretch" : "normal"}">
          <ha-camera-stream
            .hass=${hass}
            .stateObj=${stateObj}
            muted
            controls=${cfg.controls ?? false}
            allow-exoplayer
          ></ha-camera-stream>

          ${cfg.show_name !== false
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
        height: 100%;
      }

      ha-card.camera-card {
        height: 100%;
        width: 100%;
        padding: 0;
        border-radius: 0;
        box-shadow: none;
      }

      .camera-wrapper {
        position: relative;
        width: 100%;
        overflow: hidden;
      }

      .camera-wrapper.stretch {
        height: 100%;
        min-height: 100vh; /* popup / fullscreen için */
      }

      .camera-wrapper.normal {
        height: auto;
        min-height: 0;
      }

      .camera-wrapper.stretch ha-camera-stream {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }

      .camera-wrapper.normal ha-camera-stream {
        position: relative;
        width: 100%;
        height: auto;
      }

      .camera-label {
        position: absolute;
        left: 1rem;
        bottom: 1rem;
        padding: 0.3rem 0.6rem;
        background: rgba(0, 0, 0, 0.5);
        color: #fff;
        font-size: 0.9rem;
        border-radius: 0.4rem;
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

// ---------- GUI EDITÖR SINIFI (Modern ha-selector kullanımı) ----------
class CameraSwitcherCardEditor extends LitElement {
  static get properties() {
    return {
      hass: {},
      _config: { type: Object },
      _cameras: { type: Array },
    };
  }

  setConfig(config) {
    const base = {
      show_name: false,
      stretch: false,
      cameras: [],
      ...config,
    };
    this._config = base;
    this._cameras = base.cameras
      ? JSON.parse(JSON.stringify(base.cameras))
      : [];
  }

  _fireConfigChanged() {
    if (!this._config) return;
    const newConfig = {
      ...this._config,
      cameras: this._cameras,
    };
    this._config = newConfig;

    const ev = new Event("config-changed", {
      bubbles: true,
      composed: true,
    });
    ev.detail = { config: newConfig };
    this.dispatchEvent(ev);
  }

  _onShowNameToggle(e) {
    const checked = e.target.checked;
    this._config = {
      ...this._config,
      show_name: checked,
    };
    this._fireConfigChanged();
  }

  _onStretchToggle(e) {
    const checked = e.target.checked;
    this._config = {
      ...this._config,
      stretch: checked,
    };
    this._fireConfigChanged();
  }

  _onCameraEntityChange(e, index) {
    const value = e.detail?.value ?? "";
    const cams = [...this._cameras];
    cams[index] = {
      ...cams[index],
      camera_entity: value,
    };
    this._cameras = cams;
    this._fireConfigChanged();
  }

  _onPriorityChange(e, index) {
    const value = parseInt(e.target.value, 10);
    const cams = [...this._cameras];
    cams[index] = {
      ...cams[index],
      priority: isNaN(value) ? 0 : value,
    };
    this._cameras = cams;
    this._fireConfigChanged();
  }

  _onMotionEntityChange(e, camIndex, motionIndex) {
    const value = e.detail?.value ?? "";
    const cams = [...this._cameras];
    const cam = { ...cams[camIndex] };
    const motions = Array.isArray(cam.motion_entities)
      ? [...cam.motion_entities]
      : [];
    motions[motionIndex] = value;
    cam.motion_entities = motions;
    cams[camIndex] = cam;
    this._cameras = cams;
    this._fireConfigChanged();
  }

  _addCamera() {
    this._cameras = [
      ...(this._cameras || []),
      { camera_entity: "", motion_entities: [], priority: 0 },
    ];
    this._fireConfigChanged();
  }

  _removeCamera(index) {
    this._cameras = this._cameras.filter((_, i) => i !== index);
    this._fireConfigChanged();
  }

  _addMotionEntity(camIndex) {
    const cams = [...this._cameras];
    const cam = { ...cams[camIndex] };
    const motions = Array.isArray(cam.motion_entities)
      ? [...cam.motion_entities]
      : [];
    motions.push("");
    cam.motion_entities = motions;
    cams[camIndex] = cam;
    this._cameras = cams;
    this._fireConfigChanged();
  }

  _removeMotionEntity(camIndex, motionIndex) {
    const cams = [...this._cameras];
    const cam = { ...cams[camIndex] };
    const motions = Array.isArray(cam.motion_entities)
      ? [...cam.motion_entities]
      : [];
    motions.splice(motionIndex, 1);
    cam.motion_entities = motions;
    cams[camIndex] = cam;
    this._cameras = cams;
    this._fireConfigChanged();
  }

  render() {
    if (!this._config) return html``;

    const showName = this._config.show_name === true;
    const stretch = this._config.stretch === true;

    return html`
      <div class="card-config">
        <!-- Show Name Toggle -->
        <ha-formfield .label=${"Show camera name overlay"}>
          <ha-switch
            .checked=${showName}
            @change=${this._onShowNameToggle}
          ></ha-switch>
        </ha-formfield>

        <!-- Stretch Toggle -->
        <ha-formfield .label=${"Full-screen stretched video"}>
          <ha-switch
            .checked=${stretch}
            @change=${this._onStretchToggle}
          ></ha-switch>
        </ha-formfield>

        <!-- Cameras List -->
        <div class="cameras-section">
          <div class="section-header">
            <span class="section-title">Cameras & Motion Entities</span>
            <span class="section-subtitle">First camera is the default</span>
          </div>

          ${this._cameras && this._cameras.length
            ? this._cameras.map(
                (cam, index) => html`
                  <div class="camera-card">
                    <div class="camera-card-header">
                      <div class="camera-title-row">
                        ${index === 0
                          ? html`<ha-icon
                              icon="mdi:star"
                              class="default-icon"
                            ></ha-icon>`
                          : ""}
                        <span class="camera-title">
                          ${cam.camera_entity || `Camera ${index + 1}`}
                          ${index === 0 ? html`<span class="default-badge">Default</span>` : ""}
                        </span>
                      </div>
                      <ha-icon-button
                        .label=${"Remove camera"}
                        @click=${() => this._removeCamera(index)}
                      >
                        <ha-icon icon="mdi:delete"></ha-icon>
                      </ha-icon-button>
                    </div>

                    <div class="camera-config">
                      <!-- Camera Entity -->
                      <ha-selector
                        .hass=${this.hass}
                        .selector=${{
                          entity: {
                            domain: "camera",
                          },
                        }}
                        .value=${cam.camera_entity || ""}
                        .label=${"Camera entity"}
                        @value-changed=${(e) =>
                          this._onCameraEntityChange(e, index)}
                      ></ha-selector>

                      <!-- Priority -->
                      <div class="priority-field">
                        <label for="priority-${index}">
                          Priority (higher = more important)
                        </label>
                        <input
                          type="number"
                          id="priority-${index}"
                          .value=${cam.priority || 0}
                          @input=${(e) => this._onPriorityChange(e, index)}
                          min="0"
                          step="1"
                        />
                      </div>

                      <!-- Motion Entities -->
                      <div class="motion-entities">
                        <div class="subsection-header">
                          <span>Motion Entities</span>
                          <ha-button
                            @click=${() => this._addMotionEntity(index)}
                          >
                            <ha-icon icon="mdi:plus" slot="icon"></ha-icon>
                            Add Motion
                          </ha-button>
                        </div>

                        ${(cam.motion_entities || []).length > 0
                          ? (cam.motion_entities || []).map(
                              (ent, mIndex) => html`
                                <div class="motion-row">
                                  <ha-selector
                                    .hass=${this.hass}
                                    .selector=${{
                                      entity: {
                                        domain: ["binary_sensor", "input_boolean"],
                                      },
                                    }}
                                    .value=${ent || ""}
                                    @value-changed=${(e) =>
                                      this._onMotionEntityChange(
                                        e,
                                        index,
                                        mIndex
                                      )}
                                  ></ha-selector>
                                  <ha-icon-button
                                    .label=${"Remove"}
                                    @click=${() =>
                                      this._removeMotionEntity(index, mIndex)}
                                  >
                                    <ha-icon icon="mdi:delete"></ha-icon>
                                  </ha-icon-button>
                                </div>
                              `
                            )
                          : html`<div class="empty-state">
                              No motion entities configured
                            </div>`}
                      </div>
                    </div>
                  </div>
                `
              )
            : html`<div class="empty-state-main">
                No cameras configured yet.
              </div>`}

          <!-- Add Camera Button -->
          <ha-button
            class="add-camera-btn"
            @click=${this._addCamera}
          >
            <ha-icon icon="mdi:plus-circle" slot="icon"></ha-icon>
            Add Camera
          </ha-button>
        </div>
      </div>
    `;
  }

  static get styles() {
    return css`
      .card-config {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      ha-selector {
        width: 100%;
      }

      ha-formfield {
        display: flex;
        align-items: center;
        padding: 8px 0;
      }

      .cameras-section {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding-top: 16px;
        border-top: 1px solid var(--divider-color);
      }

      .section-header {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .section-title {
        font-size: 1rem;
        font-weight: 500;
      }

      .section-subtitle {
        font-size: 0.85rem;
        color: var(--secondary-text-color);
        font-style: italic;
      }

      .camera-card {
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        overflow: hidden;
        background: var(--card-background-color);
      }

      .camera-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: var(--secondary-background-color);
        border-bottom: 1px solid var(--divider-color);
      }

      .camera-title-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .default-icon {
        color: var(--warning-color);
        --mdc-icon-size: 18px;
      }

      .camera-title {
        font-weight: 500;
        font-size: 0.95rem;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .default-badge {
        font-size: 0.75rem;
        padding: 2px 8px;
        background: var(--warning-color);
        color: var(--text-primary-color);
        border-radius: 12px;
        font-weight: 600;
      }

      .camera-config {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 16px;
      }

      .priority-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .priority-field label {
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--primary-text-color);
      }

      .priority-field input {
        padding: 8px 12px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
        font-size: 0.9rem;
      }

      .priority-field input:focus {
        outline: none;
        border-color: var(--primary-color);
      }

      .motion-entities {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        background: var(--secondary-background-color);
        border-radius: 8px;
      }

      .subsection-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        font-weight: 500;
        font-size: 0.9rem;
      }

      .motion-row {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .motion-row ha-selector {
        flex: 1;
      }

      .motion-row ha-icon-button {
        flex-shrink: 0;
      }

      .empty-state {
        padding: 12px;
        text-align: center;
        color: var(--secondary-text-color);
        font-size: 0.9rem;
        font-style: italic;
      }

      .empty-state-main {
        padding: 24px;
        text-align: center;
        color: var(--secondary-text-color);
        font-style: italic;
      }

      .add-camera-btn {
        width: 100%;
      }

      ha-button {
        cursor: pointer;
      }

      ha-icon-button {
        --mdc-icon-button-size: 40px;
        --mdc-icon-size: 20px;
        cursor: pointer;
      }
    `;
  }
}

if (!customElements.get("camera-switcher-card-editor")) {
  customElements.define("camera-switcher-card-editor", CameraSwitcherCardEditor);
}

// Card picker için metadata
window.customCards = window.customCards || [];
window.customCards.push({
  type: "camera-switcher-card",
  name: "Camera Switcher Card",
  description:
    "Shows the last camera where motion was detected. Feed it camera + motion entities.",
});

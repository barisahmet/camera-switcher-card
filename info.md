# Camera Switcher Card

A custom Home Assistant card that displays multiple cameras and automatically switches between them based on binary sensor states (e.g., motion detection, person detection).

## Features

- Display multiple camera entities
- Automatically switch to a camera when its associated binary sensor(s) turn on
- Smooth transitions between cameras
- Support for multiple motion sensors per camera
- Configurable priority-based camera selection (higher priority cameras are shown first when multiple have active motion)

## Installation

### HACS (Recommended)

1. Open HACS in your Home Assistant instance
2. Go to "Frontend"
3. Click the 3 dots in the top right corner
4. Select "Custom repositories"
5. Add this repository URL with category "Lovelace"
6. Click "Install"
7. Restart Home Assistant

### Manual Installation

1. Download `camera-switcher-card.js` from the latest release
2. Copy it to `config/www/` folder
3. Add the following to your Lovelace resources:

```yaml
resources:
  - url: /local/camera-switcher-card.js
    type: module
```

## Configuration

Add the card to your Lovelace dashboard:

```yaml
type: custom:camera-switcher-card
cameras:
  - camera_entity: camera.doorbell
    motion_entities:
      - binary_sensor.kamera_oe_person_detected
    priority: 10
  - camera_entity: camera.bahce
    motion_entities:
      - binary_sensor.bahce_kapisi_zili_person_detected
    priority: 5
```

### Options

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `cameras` | list | yes | - | List of camera configurations |
| `camera_entity` | string | yes | - | Entity ID of the camera |
| `motion_entities` | list | yes | - | List of binary sensor entity IDs for motion detection |
| `priority` | number | no | 0 | Priority value for the camera. Higher values take precedence when multiple cameras have active motion. |

## How it Works

1. The card displays the first camera by default
2. When any binary sensor in a camera's `motion_entities` list turns "on", the card switches to that camera
3. If multiple cameras have active motion sensors:
   - Cameras with higher `priority` values are shown first
   - If priorities are equal, the camera with the most recent motion is shown
4. When all motion sensors are "off", the card returns to displaying the first camera

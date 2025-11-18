# Motion Camera Card

A custom Home Assistant card that displays multiple cameras and automatically switches between them based on binary sensor states (e.g., motion detection, person detection).

![HACS Badge](https://img.shields.io/badge/HACS-Custom-orange.svg)
![GitHub release (latest by date)](https://img.shields.io/github/v/release/barisahmet/camera-switcher-card)

## Features

- Automatically switch to a camera when its associated binary sensor(s) turn on
- Priority-based camera selection (first camera with active motion sensor takes precedence)
- Clean, modern UI with camera names

## Installation

### HACS (Recommended)

1. Open HACS in your Home Assistant instance
2. Go to "Frontend"
3. Click the 3 dots in the top right corner
4. Select "Custom repositories"
5. Add `https://github.com/barisahmet/camera-switcher-card` with category "Lovelace"
6. Click "Install"
7. Restart Home Assistant

### Manual Installation

1. Download `motion-camera-card.js` from the [latest release](https://github.com/barisahmet/camera-switcher-card/releases)
2. Copy it to your `config/www/` folder
3. Add the following to your Lovelace resources (Configuration -> Lovelace Dashboards -> Resources):

```yaml
url: /local/motion-camera-card.js
type: module
```

## Configuration

Add the card to your Lovelace dashboard:

```yaml
type: custom:motion-camera-card
cameras:
  - camera_entity: camera.doorbell
    motion_entities:
      - binary_sensor.kamera_oe_person_detected
  - camera_entity: camera.bahce
    motion_entities:
      - binary_sensor.bahce_kapisi_zili_person_detected
```

### Options

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `cameras` | list | yes | - | List of camera configurations (see below) |

#### Camera Configuration

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `camera_entity` | string | yes | - | Entity ID of the camera (e.g., `camera.doorbell`) |
| `motion_entities` | list | yes | - | List of binary sensor entity IDs for motion/person detection (e.g., `binary_sensor.motion`) |

### Example Configuration

```yaml
type: custom:motion-camera-card
cameras:
  - camera_entity: camera.front_door
    motion_entities:
      - binary_sensor.front_door_motion
      - binary_sensor.front_door_person_detected
  - camera_entity: camera.back_yard
    motion_entities:
      - binary_sensor.back_yard_motion
  - camera_entity: camera.garage
    motion_entities:
      - binary_sensor.garage_motion
```

## How it Works

1. **Default View**: The card displays the first camera in the list by default
2. **Motion Detection**: When any binary sensor in a camera's `motion_entities` list turns "on", the card automatically switches to that camera
3. **Priority**: If multiple cameras have active motion sensors simultaneously, the first one in the list takes priority
4. **Return to Default**: When all motion sensors turn "off", the card returns to displaying the first camera

## Troubleshooting

### Card not showing

- Ensure the card is properly installed and added to Lovelace resources
- Check the browser console for errors
- Clear your browser cache

### Camera not switching

- Verify that your binary sensor entity IDs are correct
- Check that the binary sensors are actually turning "on" in the Home Assistant Developer Tools
- Ensure the camera entities are valid and accessible

### Camera image not loading

- Verify camera entity IDs are correct
- Check that cameras are properly configured in Home Assistant
- Ensure you have proper permissions to access camera streams

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

## Support

If you find this card useful, please star the repository!

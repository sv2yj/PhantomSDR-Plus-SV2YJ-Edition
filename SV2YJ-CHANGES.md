# PhantomSDR-Plus SV2YJ Edition — Changes

**Based on upstream v4.2.0**

**Maintained by SV2YJ**

## Purpose

The PhantomSDR-Plus SV2YJ Edition is a community-enhanced edition of PhantomSDR-Plus, based on upstream version 4.2.0.

This document records the modifications, enhancements, and experimental features developed and tested as part of the SV2YJ Edition.

The purpose of documenting these changes is to make each modification easier to identify, study, reuse, improve, and continue independently by radio amateurs and developers.

The original PhantomSDR-Plus project and its upstream authors remain fully credited. The changes described in this document refer specifically to additions or modifications made for the SV2YJ Edition.

---
## 1. S-Meter Theme System

The analog S-meter interface was extended with a selectable theme system while preserving the original meter behavior.

### Added / Modified

- Three selectable S-meter themes:
  - Dark
  - Amber
  - Green
- Theme selection is changed directly from the analog S-meter.
- The selected theme is stored locally in the browser.
- The Green theme replaced the earlier experimental "Vintage" naming.
- Theme handling was unified so that the selected S-meter face and its associated panel presentation remain visually consistent.
- The default Dark appearance remains available.

### Main source files

- `frontend/src/lib/SMeterAnalog.svelte`
- `frontend/src/App.svelte`

### Implementation notes

`SMeterAnalog.svelte` manages the available themes and sends the selected theme to the main application.

`App.svelte` receives the selected theme and applies the corresponding S-meter panel styling.

The implementation was designed so that the S-meter theme can be changed without altering the receiver's tuning or signal-processing operation.

---
## 2. Mobile Extended Video Recording

Video recording capability was added to the Mobile Extended interface, extending the recording functionality beyond audio-only recording.

### Added / Modified

- Video recording support added to Mobile Extended mode.
- Audio recording remains available as before.
- Mobile users can select and record a defined screen/video area.
- Recording controls were integrated into the Mobile Extended interface.
- Video recording state is handled independently from audio recording state.
- The implementation preserves the existing Desktop recording functionality.

### Main source files

- `frontend/src/App.svelte`
- `frontend/src/lib/VideoAreaSelector.svelte`

### Implementation notes

The Mobile Extended interface was extended to expose the video recording functionality that was previously available on Desktop.

The implementation uses the existing video-area selection mechanism and integrates it with the mobile interface while keeping audio and video recording as separate functions.

The modification was designed to add mobile video recording without changing the normal Desktop recording workflow.

---
## 3. Mobile One-Row Header

The mobile interface header was redesigned to provide a more compact single-row layout and make better use of the limited horizontal and vertical space available on mobile devices.

### Added / Modified

- Mobile header reorganized into a compact one-row layout.
- Important receiver controls and information remain accessible without unnecessarily increasing header height.
- Reduced vertical space consumption leaves more screen area available for the spectrum, waterfall, and receiver controls.
- The change is targeted at the mobile interface and preserves the Desktop layout.

### Main source file

- `frontend/src/App.svelte`

### Implementation notes

The mobile header layout and related styling were adjusted specifically for smaller displays.

The objective was to improve space efficiency without removing essential controls or changing their underlying functions.

This modification forms part of the broader SV2YJ Mobile Extended interface optimization.

---
## 4. Mobile Extended Portrait Fine-Tuning

The Mobile Extended interface was further optimized for portrait orientation to improve usability on smartphones and other narrow displays.

### Added / Modified

- Portrait layout refined specifically for Mobile Extended mode.
- Screen space distribution improved for narrow vertical displays.
- Receiver controls adjusted to fit more naturally within the available width.
- Unnecessary vertical space was reduced where possible.
- Spectrum, waterfall, audio, and control areas were balanced for improved mobile usability.
- Desktop behavior and layout remain unaffected by these portrait-specific adjustments.

### Main source file

- `frontend/src/App.svelte`

### Implementation notes

The portrait-oriented Mobile Extended layout was fine-tuned after practical testing on mobile displays.

The changes focus primarily on responsive layout, spacing, sizing, and positioning rather than altering receiver functionality.

These adjustments complement the Mobile One-Row Header and form part of the broader SV2YJ optimization of PhantomSDR-Plus for practical mobile operation.

---
## 5. Spectrum Toggle — Mobile and Desktop Defaults

The spectrum display behavior was adjusted so that Desktop and Mobile interfaces start with different defaults appropriate to their available screen space.

### Added / Modified

- Desktop default:
  - Spectrum display ON.
- Mobile default:
  - Spectrum display OFF.
- The spectrum can still be enabled or disabled by the user.
- The different defaults improve the initial viewing area on smaller mobile displays without changing the normal Desktop presentation.
- The modification affects the initial interface state and does not remove spectrum functionality from Mobile.

### Main source file

- `frontend/src/App.svelte`

### Implementation notes

The default spectrum visibility is determined according to the active Desktop or Mobile interface.

On Desktop, the traditional spectrum presentation remains enabled by default.

On Mobile, the spectrum starts disabled to preserve more vertical space for the waterfall and receiver controls, while remaining available through the normal spectrum toggle.

---
## 6. Mobile Chat Height Optimization

The chat area in the mobile interface was adjusted to use screen space more efficiently and to coexist better with the receiver display and controls.

### Added / Modified

- Mobile chat height optimized for smaller displays.
- Reduced unnecessary occupation of vertical screen space.
- Improved balance between the chat area and the receiver interface.
- More usable space remains available for the spectrum, waterfall, audio, and tuning controls.
- The adjustment is specific to the mobile layout and does not alter normal Desktop chat behavior.
- Chat functionality itself remains unchanged.

### Main source file

- `frontend/src/App.svelte`

### Implementation notes

The modification focuses on the dimensions and layout behavior of the chat area when PhantomSDR-Plus is used from a mobile device.

The objective is to keep chat available and practical without allowing it to dominate the limited vertical space of a smartphone display.

This adjustment forms part of the broader SV2YJ Mobile Extended interface optimization.

---
## 7. Mobile Waterfall / Audio Gap Optimization

The mobile interface spacing between the waterfall display and the audio/control area was refined to make better use of the limited vertical screen space.

### Added / Modified

- Reduced unnecessary vertical gap between the waterfall and audio/control sections.
- Improved continuity between the main receiver display and the controls below it.
- More efficient use of available screen height on smartphones.
- The adjustment complements the other Mobile Extended portrait-layout improvements.
- Desktop layout and functionality remain unaffected.

### Main source file

- `frontend/src/App.svelte`

### Implementation notes

The modification focuses on mobile layout spacing rather than receiver or signal-processing functionality.

The spacing was fine-tuned through practical mobile testing so that the waterfall and audio/control areas use the available vertical space more efficiently without overlapping or interfering with normal operation.

This adjustment forms part of the broader SV2YJ Mobile Extended interface optimization.

---
## 8. Mobile SPAN Cycling

A dedicated SPAN cycling function was added to the mobile interface, allowing the operator to quickly change the visible frequency range around the current tuning position.

### Added / Modified

- Mobile SPAN control cycles through five viewing ranges:
  - ±50 kHz
  - ±100 kHz
  - ±200 kHz
  - ±500 kHz
  - Full span
- Each activation advances to the next available span.
- After the Full setting, the control returns to the beginning of the cycle.
- The function allows rapid adjustment between detailed and wider spectrum/waterfall views.
- The currently tuned frequency remains the operational reference while changing the displayed span.
- The modification is intended primarily for practical operation on limited-size mobile displays.

### Main source file

- `frontend/src/App.svelte`

### Implementation notes

The SPAN cycling mechanism provides a compact alternative to occupying additional mobile screen space with several separate span controls.

The progressively wider ranges allow the operator to move quickly from a detailed view around the tuned frequency to a broad overview of the available band.

This feature forms part of the SV2YJ Mobile Extended operating enhancements.

---
## 9. Desktop and Mobile UP/DOWN Tuning

A shared UP/DOWN tuning system was implemented for Desktop and Mobile operation, providing predictable channel stepping while preserving fine-tuning behavior.

### Added / Modified

- UP and DOWN tuning controls use the same underlying tuning logic on Desktop and Mobile.
- Standard tuning advances by the appropriate frequency step.
- European Medium Wave (MW) channel raster is supported from:
  - 522 kHz to 1629 kHz
  - 9 kHz channel spacing
- Within the MW broadcast range, UP/DOWN tuning follows the European 9 kHz channel raster.
- Fine tuning remains available independently of the channel stepping system.
- A non-zero fine-tuning offset/magnitude is remembered so that normal channel stepping does not unnecessarily discard the operator's fine adjustment.
- The Desktop interface layout was preserved while the common tuning behavior was introduced.

### Main source file

- `frontend/src/App.svelte`

### Implementation notes

The tuning logic distinguishes between normal channel stepping and fine tuning.

For the European Medium Wave broadcast band, the UP/DOWN controls follow the 9 kHz raster between 522 kHz and 1629 kHz.

The implementation was designed so that an operator can move between MW channels predictably while retaining the ability to make and preserve smaller frequency adjustments when required.

The same tuning mechanism is shared by Desktop and Mobile controls, reducing behavioral differences between the two interfaces.

---
## 10. Mobile UP/DOWN Long-Press Manual Scanning

The Mobile Extended UP/DOWN tuning controls were enhanced with long-press operation, allowing the same buttons to perform both single-step tuning and continuous manual scanning.

### Added / Modified

- Short tap:
  - Performs one normal tuning step.
- Long press:
  - Continuous manual tuning begins after approximately 500 ms.
  - Tuning then repeats approximately every 200 ms while the button remains pressed.
- The long-press function uses the same tuning logic as normal UP/DOWN operation.
- Scanning stops at the limits of the band from which the operation started.
- Frequency wrapping from one band edge to the opposite edge is prevented.
- Within the European Medium Wave broadcast range, long-press tuning respects:
  - 522 kHz lower limit
  - 1629 kHz upper limit
  - 9 kHz channel raster
- Pointer capture is used to provide reliable press-and-hold operation on touch devices.
- Long-touch text selection is suppressed where necessary to prevent accidental selection of interface text during scanning.
- Normal text selection and interaction remain available for input and textarea elements.

### Main source file

- `frontend/src/App.svelte`

### Implementation notes

The long-press mechanism extends the existing UP/DOWN controls rather than introducing a separate tuning system.

A quick tap therefore retains normal single-step operation, while holding the same control automatically repeats the tuning action.

The implementation includes explicit stopping behavior at the applicable band boundaries and does not wrap around to the opposite end of the band.

For Medium Wave operation, the same European 9 kHz channel-spacing logic used by the standard UP/DOWN tuning system is retained during long-press scanning.

This provides a compact manual scanning function particularly suited to touch-screen and smartphone operation.

---
## Development and Compatibility Approach

The PhantomSDR-Plus SV2YJ Edition is developed on top of the original upstream PhantomSDR-Plus v4.2.0 codebase.

Upstream v4.2.0 remains the reference base of this edition.

The objective of the SV2YJ Edition is not to replace or unnecessarily modify existing PhantomSDR-Plus functionality. Its purpose is to add new, practical, and useful capabilities while preserving the established behavior of the original application wherever possible.

### Development principles

- PhantomSDR-Plus upstream v4.2.0 remains the fixed reference base of the SV2YJ Edition.
- Existing upstream functionality should be preserved wherever possible.
- New features are added as extensions rather than replacements for existing functions.
- Mobile-specific improvements should not unnecessarily alter Desktop operation.
- Shared functionality should maintain consistent behavior between Desktop and Mobile interfaces where appropriate.
- Each modification is developed and tested individually before proceeding to the next change.
- Working states are backed up during development so that a verified implementation can be restored if necessary.
- Changes are documented individually so that other radio amateurs and developers can identify, study, reuse, modify, or improve them independently.
- Future useful ideas from newer upstream versions may be studied and selectively adapted, but such additions will be documented separately and will not change the declared base of this edition.

### Compatibility philosophy

The SV2YJ Edition aims to extend PhantomSDR-Plus without reducing its existing capabilities or unnecessarily limiting its original hardware and operating flexibility.

Where a modification affects only a specific interface, such as Mobile Extended, the corresponding Desktop behavior is preserved whenever technically possible.

This approach allows the project to evolve through additional practical features while maintaining a clear relationship with the original PhantomSDR-Plus v4.2.0 codebase.

---

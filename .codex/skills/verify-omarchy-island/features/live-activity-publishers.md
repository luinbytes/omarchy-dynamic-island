# Live activity publishers

## Sub-features

First-party media, OSD pulses, power, reminders, Bluetooth, microphone, recording, and delegated owner actions.

## How to get to it (user POV)

The user starts or changes a supported system activity. The island presents a bounded summary and sends an action back to the existing domain owner.

## Driving it with the disposable Omarchy VM

This feature is not yet driveable from the standalone repository. After integration, use synthetic fixture IPC first, then one owner at a time. Verify activity state, action effects, owner logs, and fallback behavior in the VM.

## Gotchas

The island is not a notification daemon and must not create duplicate media, PipeWire, UPower, Bluetooth, reminder, or recording collectors. Sensitive payloads need redaction. The real-surface proof is BLOCKED until integration into a disposable VM.

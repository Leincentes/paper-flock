# Paper Flock Privacy

Paper Flock is local-first. The v1.6.0 browser and Android releases do not
automatically upload gameplay, feedback, diagnostics, identifiers, or personal
information. The Android app does not request Internet access. See
`privacy.html` for the public notice used by Google Play.


## Closed-test diagnostics

Paper Flock v1.6.0 keeps a bounded rolling diagnostic log on the device. The
log records operational events such as startup success, recovery, level
starts/completions, hints, undo actions, restarts, deadlocks, backup outcomes,
and Android WebView renderer recovery. It excludes raw saves, puzzle boards,
accounts, advertising identifiers, contacts, location, and user-entered
content.

The log is never uploaded automatically. A player must explicitly choose
**Settings → Data → Export tester report** and then decide whether to share the
file. The player can clear the local test history at any time.

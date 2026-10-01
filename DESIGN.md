# DankTimeLog design

A DankMaterialShell plugin that tracks time against user-defined presets (WORK,
STUDY, WASTE, ...). One timer runs at a time, started and stopped by hand, and
the popout shows per-preset averages per day.

Target: DMS 1.6.2, Quickshell 0.3.1.

## Scope

In v1:

- Presets: add, edit, archive.
- Start a preset, switch to another, stop.
- Bar pill showing the running preset and its elapsed time.
- Popout with start/switch/stop controls, today's totals, and the averages chart.
- IPC commands so keybindings can drive the timer.
- The timer stops when the machine is off or suspended.

Not in v1:

- Editing, deleting, or manually adding sessions.
- Launcher trigger, desktop widget, CSV export, long-running-timer reminders.
- A stats view larger than the popout.

## Data model

**Preset**: `{ presetId, displayName, colorHex, iconName, isArchived }`

- Sessions reference `presetId`, so renaming a preset keeps its history.
- Presets with history are archived rather than deleted, so past averages stay
  correct. Archived presets are hidden from the start buttons but still appear
  in the chart for ranges that contain their sessions.
- Until the user saves presets in settings, the daemon uses two defaults,
  Work and Study. An empty `colorHex` means the theme accent.

**Session**: `{ presetId, startEpochMilliseconds, endEpochMilliseconds }`

- The running timer is the single session whose `endEpochMilliseconds` is
  `null`.
- Elapsed time is never stored; it is always `now - startEpochMilliseconds`.
- Timestamps are UTC epoch milliseconds. Grouping into days uses local time, at
  aggregation time, so DST and time-zone changes do not corrupt stored data.

## Timer rules

1. One timer at a time. Starting a preset while another runs closes the running
   session at the same instant and opens the new one, so there is no gap or
   overlap between them.
2. Starting the preset that is already running is a no-op.
3. Archiving the running preset stops it first.
4. No pause. Stop and start again produce two sessions with the same totals.

## Stopping when the machine is off

There is no reliable signal at power-off or on a crash, so detection is based on
a heartbeat rather than on shutdown hooks.

- While a session is open, the daemon records `lastHeartbeatEpochMilliseconds`
  every `kHeartbeatIntervalMilliseconds` (30 s). This bounds the time lost on a
  hard power-off to 30 s.
- On every heartbeat tick, and once at startup, the daemon compares the current
  wall-clock time against the last heartbeat. If the gap exceeds
  `kMachineOffGapThresholdMilliseconds` (90 s, three missed heartbeats), the
  session is closed at the last heartbeat and the timer is left stopped.
- A gap below the threshold is treated as a shell restart (`dms restart`, a
  config reload) and the session continues.
- Suspend is covered by the same check. Quickshell timers run on the monotonic
  clock, which does not advance during suspend, so the first tick after wake
  sees a large wall-clock gap and closes the session at the last heartbeat.
- The timer is not resumed after boot or wake; starting again is a manual
  action, consistent with starting being manual in the first place.

The first tick after wake can arrive up to 30 s late, so the pill may show the
pre-suspend session for that long. If that turns out to matter, the daemon can
also listen to logind `PrepareForSleep` (DMS already subscribes to it in
`SessionService`) and close the session exactly at suspend. The heartbeat check
stays regardless, since it is the only thing that handles power loss and
crashes.

The gap decision is a pure function of
`(lastHeartbeatEpochMilliseconds, nowEpochMilliseconds)`, so it is unit-tested
without a shell.

## Averages

Both views show average time per day for each preset, as horizontal bars, with
the combined total underneath. A toggle in the popout switches between them.

**This week**: Monday 00:00 local time through now.

- Denominator: calendar days from Monday through today inclusive, with today
  counted as a whole day. On Monday this equals today's total so far.

**Last N days**: the N calendar days ending today, with N entered in the popout
(quick picks 7, 30, 90).

- Days with no tracked time count as zero.
- Denominator: N, or the number of days since the first recorded session if
  that is fewer. Without that cap, the first weeks of use would be averaged over
  days before tracking started and read artificially low.
- The last N chosen is saved in plugin settings.

Sessions are clipped to the range, whose start is always a local midnight, so a
session that crosses into the range contributes only the part inside it. The
running session counts up to now.

## Architecture

DMS composite plugin, id `dankTimeLog`.

```
plugin.json
TimeLogDaemon.qml     single owner of presets, sessions, and the running timer;
                      persistence, heartbeat, IPC handler
TimeLogWidget.qml     bar pill and popout; reads daemon state, sends actions to it
TimeLogSettings.qml   preset add/edit/archive
SessionLog.mjs        start, switch, stop, and gap-close as functions from
                      sessions to sessions
SessionMath.mjs       day and week boundaries, per-preset totals, averages,
                      gap decision
PresetCatalog.mjs     preset lookup by id and by name
DurationFormat.mjs    "1h 05m" style formatting
tests/                node --test suites for the .mjs files
```

The daemon is the only owner because DMS creates a separate widget instance per
bar per monitor; state held in widgets would diverge across screens. Widgets
hold a non-owning reference to the daemon through
`PluginService.pluginDaemonInstances[pluginId]`, bind to its `presets`,
`sessions`, and `runningSession`, and call its `startPreset` and
`stopRunningSession` for every mutation.

The daemon itself holds no session logic beyond calling `SessionLog` and
saving the result, so start, switch, stop, and the machine-off close are all
covered by the Node tests.

The `.mjs` files are ECMAScript modules with no QML or Qt APIs. QML imports
them with `import "SessionMath.mjs" as SessionMath` and Node imports them
unchanged, so the tested code is the code the shell runs. They take the
current time as an argument rather than reading the clock.

The tests pin `TZ` to `America/New_York` so the DST cases run against real
23- and 25-hour days regardless of the machine's zone.

## IPC

Target `dankTimeLog`, matching the plugin id so it cannot collide with another
plugin's handler, for `dms ipc call dankTimeLog <command>`:

| Command | Effect |
|---|---|
| `start <presetName>` | Start or switch to the preset (case-insensitive name match) |
| `stop` | Stop the running session |
| `toggle <presetName>` | Stop if that preset is running, otherwise start it |
| `status` | Running preset name and elapsed seconds, tab-separated, or empty |

## Storage

- Presets and the chosen N go in plugin settings (`savePluginData`).
- Sessions go in `~/.local/state/DankMaterialShell/plugins/dankTimeLog_sessions.json`,
  in DMS's plugin state directory, written by the daemon's own `FileView` with
  `atomicWrites: true`. Staying under the plugin's own state path is part of
  what the registry review checks.
  - Not `savePluginState`: in DMS 1.6.2, after a plugin reload (toggling it off
    and on, or an update) the first save never reaches disk. The next save
    writes everything, so the only loss is when the shell dies in between,
    but a session started right after a reload could vanish that way.
  - If the file exists but cannot be parsed, the daemon starts with no history
    and does not save for that run, rather than overwrite the file.
- The heartbeat goes in its own file in the same directory,
  `dankTimeLog_heartbeat.json`, written the same way. Keeping it separate means
  a heartbeat every 30 s does not rewrite the whole session history.

```json
{ "formatVersion": 1, "sessions": [ ... ] }
```

Session writes happen only on start, switch, stop, and gap-close. At around
ten sessions a day the history grows by roughly 300 KB a year, so loading it
whole and rewriting it whole is fine.

## Refresh rates

The registry review flags fast polling, so nothing ticks faster than it needs
to:

- The bar pill shows `h:mm` and updates once a minute, aligned to the minute
  boundary of the session's elapsed time.
- The popout shows seconds and ticks every second, only while it is open.
- The heartbeat runs every 30 s, only while a session is open.

## Conventions

- Colors, font sizes, spacing, and radii come from `Theme` tokens; controls are
  Dank components rather than raw Qt Quick Controls.
- Every user-facing string goes through `I18n.trFor("dankTimeLog", ...)` so the
  plugin can join the central DMS translation project later without touching
  every string.

## Build and checks

`./check.sh` runs all of these:

- `qmlformat` clean on all QML, using the repo's `.qmlformat.ini` (4-space
  indent, 250 columns, matching DMS).
- `qmllint` clean on all QML and `.mjs` files.
- `node --test 'tests/*.test.mjs'` passes.

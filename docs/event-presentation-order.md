# Live event presentation order

`Service.qml` reconciles source changes into the Hub schedule and the peek lease in one deferred transaction. The provider snapshots remain live.

| State | Presentation |
| --- | --- |
| Eligible event waits for coalescing | Each recipient retains its previous compact text, icons, artwork, and measured width. |
| Peek activates | The peek takes visual ownership before the compact hold releases. |
| Closed peek | Compact bodies retain their geometry behind the peek. |
| Peek content changes | The old payload leaves the clip before the latest payload enters. The capsule does not restart its geometry animation. |
| Peek expires with a replacement pending | The display remains in place through the remaining coalescing interval, at most 250 ms, then changes directly to the replacement. |
| Manual detail is open | The detail remains live. Unrelated peeks appear below it. |
| Peek retracts | The current compact selection resumes from retained geometry. |
| Notification peek completes | Its recipient does not replay the same temporary notification preview in compact mode. History and manual routes remain available. |
| DND, startup baseline, or no eligible recipient | No pending presentation hold remains. |
| A monitor enters fullscreen | That recipient abandons its peek. Leaving fullscreen does not replay the abandoned event. |
| Reduced motion | The same event order applies. Geometry and content changes snap to their targets. |

`PresentationGateModel.js` owns per-screen compact holds. The same selected schedule feeds both text measurement and frame construction. Manual preflight keeps the current compact presentation until the expanded geometry commits.

`MotionModel.js` owns geometry, body suspension, and serial peek content replacement on the existing motion clock. `PeekContent.qml` translates one payload across its clip. A payload cannot activate a different event while replacement is in progress.

Media metadata retains its separate fixed-position title, artist, and artwork crossfade. Each artwork fallback uses the weight of its corresponding image layer.

Portable checks cover source transitions and interrupted motion. They do not establish rendered parity. The renderer and live publishers remain unfinished.

# Wi-Fi, Ethernet and hotspots

Open the connection ball on the login page, then **إعدادات الشبكة**.

- Automatic discovery sends through every connected IPv4 adapter, including Ethernet, Wi-Fi and Windows hotspot adapters. Choosing a search priority does not disable any adapter or change the connected teacher.
- Ethernet and Wi-Fi students can share the same teacher when their networks can reach each other. The app does not create a hotspot or bridge isolated routers. Join the Wi-Fi/hotspot in Windows first; internet access is not needed.
- Start the main computer on the teacher only. Pair students using the teacher's connection code. If broadcast discovery is blocked, enter a reachable teacher IPv4 address manually.
- The network tab lists adapter names and addresses. On a hosting computer, students can use those addresses for manual connection. Preferred adapter addresses are stored per installation; if unavailable, discovery continues on the remaining adapters.
- On a trusted school network, use Windows' Private profile so the installer's existing local-subnet firewall rules can apply. Guest networks and client isolation can block device-to-device traffic. This update does not broaden firewall access to Public networks.

## Recovery and data

Connection checks keep the current working route. If it fails, discovery looks for the previously paired teacher's device identity, then verifies TLS against the saved certificate fingerprint before using another address. It preserves the session and does not pair with a different teacher. No network preference changes credentials, school data, adapter configuration or Windows routing.

Student requests have a bounded network timeout. Answer/submit writes are not automatically replayed by the transport; the existing persisted revision queue handles synchronization and duplicate protection. While offline, the exam can continue from the local snapshot under its existing deadline and reconnect rules.

## Verification

- `node --import tsx --test tests/network-discovery.test.ts`: subnet routing, independent adapter failure, source-address validation, deduplication and certificate-bound alternatives.
- `node tests/network-ipc.cjs`: isolated desktop backend pair, actual UDP/TLS discovery and pairing, saved preferences, unchanged active target, second-host prevention.
- `node --import tsx tests/network-settings-ui.ts`: login connection panel, preference selection, guide player, responsive layout and reduced motion.
- `npm run benchmark:network`: concurrent student saves and reconnects on a temporary server.

A single-computer test cannot validate a particular router's wireless isolation, Windows firewall profile or hotspot radio stability; test the installed version on two actual classroom computers before a live exam.

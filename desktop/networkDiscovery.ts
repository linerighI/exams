import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os';
import { isIP } from 'node:net';
import dgram from 'node:dgram';
export type NetworkAdapter = { name: string; address: string; netmask: string };
export type SchoolDevice = {
  host: string;
  hosts: string[];
  school: string;
  port: number;
  deviceId?: string;
  pairingVersion?: number;
  hostState?: string;
};
export function networkAdapters(
  interfaces: Record<string, NetworkInterfaceInfo[] | undefined> = networkInterfaces(),
): NetworkAdapter[] {
  return Object.entries(interfaces).flatMap(([name, rows]) =>
    (rows || [])
      .filter((row) => row.family === 'IPv4' && !row.internal && isIP(row.address) === 4)
      .map((row) => ({ name, address: row.address, netmask: row.netmask })),
  );
}
export function discoveryRoutes(adapters: NetworkAdapter[], preferred = '') {
  const sorted = [...adapters].sort(
    (a, b) => Number(b.address === preferred) - Number(a.address === preferred),
  );
  return [
    { address: '127.0.0.1', destinations: ['127.0.0.1'] },
    ...sorted.map((adapter) => ({
      address: adapter.address,
      destinations: [
        ...new Set([
          '255.255.255.255',
          adapter.address
            .split('.')
            .map((v, i) => Number(v) | (~Number(adapter.netmask.split('.')[i]) & 255))
            .join('.'),
        ]),
      ],
    })),
  ];
}
export function preferredEndpoints(hosts: string[], adapters: NetworkAdapter[], preferred: string) {
  const adapter = adapters.find((item) => item.address === preferred);
  if (!adapter) return hosts;
  const sameSubnet = (host: string) =>
    host
      .split('.')
      .every(
        (part, i) =>
          (Number(part) & Number(adapter.netmask.split('.')[i])) ===
          (Number(adapter.address.split('.')[i]) & Number(adapter.netmask.split('.')[i])),
      );
  return [...hosts].sort((a, b) => Number(sameSubnet(b)) - Number(sameSubnet(a)));
}
// A separate bound socket sends through each interface, rather than the default route only.
export function discoverSchools(
  port: number,
  adapters = networkAdapters(),
  preferred = '',
  duration = 2000,
): Promise<SchoolDevice[]> {
  return new Promise((resolve) => {
    const sockets: dgram.Socket[] = [],
      repeats: ReturnType<typeof setTimeout>[] = [],
      results = new Map<string, SchoolDevice>();
    let finished = false;
    const close = (socket: dgram.Socket) => {
      try {
        socket.close();
      } catch {}
    };
    setTimeout(() => {
      finished = true;
      repeats.forEach(clearTimeout);
      sockets.forEach(close);
      resolve(
        [...results.values()].map((device) => {
          const hosts = preferredEndpoints(device.hosts, adapters, preferred);
          return {
            ...device,
            hosts,
            host:
              adapters.some((adapter) => adapter.address === preferred) && hosts.length
                ? hosts[0]
                : device.host,
          };
        }),
      );
    }, duration);
    for (const route of discoveryRoutes(adapters, preferred)) {
      const socket = dgram.createSocket('udp4');
      sockets.push(socket);
      socket.on('error', () => close(socket));
      socket.on('message', (message, remote) => {
        if (finished || message.length > 4096 || isIP(remote.address) !== 4) return;
        try {
          const value = JSON.parse(message.toString());
          if (value.port !== port || typeof value.school !== 'string' || value.school.length > 300)
            return;
          const key =
            typeof value.deviceId === 'string' && value.deviceId.length <= 100
              ? value.deviceId
              : remote.address;
          const previous = results.get(key);
          const hosts = [...new Set([...(previous?.hosts || []), remote.address])];
          const host = previous && previous.host !== '127.0.0.1' ? previous.host : remote.address;
          results.set(key, {
            host,
            hosts,
            school: value.school,
            port,
            deviceId: typeof value.deviceId === 'string' ? value.deviceId : undefined,
            pairingVersion: value.pairingVersion === 1 ? 1 : undefined,
            hostState: value.hostState === 'starting' ? 'starting' : 'active',
          });
        } catch {}
      });
      socket.bind(0, route.address, () => {
        if (finished) {
          close(socket);
          return;
        }
        try {
          socket.setBroadcast(true);
        } catch {
          close(socket);
          return;
        }
        const send = () => {
          for (const address of route.destinations) {
            try {
              socket.send('ALSHEREQI_DISCOVER_V1', port + 1, address, () => {});
            } catch {}
          }
        };
        send();
        repeats.push(setTimeout(send, Math.min(650, duration / 2)));
      });
    }
  });
}
const fingerprint = (value: string) => value.replaceAll(':', '').toUpperCase();
export async function verifiedAlternative(
  current: { host: string; fingerprint: string },
  devices: SchoolDevice[],
  probe: (host: string, pin: string) => Promise<unknown>,
) {
  const candidates = [
    ...new Set(
      devices
        .filter(
          (device) =>
            device.deviceId && fingerprint(device.deviceId) === fingerprint(current.fingerprint),
        )
        .flatMap((device) => device.hosts || [device.host]),
    ),
  ]
    .filter((host) => host !== current.host && host !== '127.0.0.1' && isIP(host) === 4)
    .slice(0, 8);
  for (let i = 0; i < candidates.length; i += 3) {
    const results = await Promise.all(
      candidates.slice(i, i + 3).map(async (host) => {
        try {
          await probe(host, current.fingerprint);
          return host;
        } catch {
          return undefined;
        }
      }),
    );
    const found = results.find(Boolean);
    if (found) return found;
  }
}

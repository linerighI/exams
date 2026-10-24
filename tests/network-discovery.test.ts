import test from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import {
  discoveryRoutes,
  networkAdapters,
  discoverSchools,
  verifiedAlternative,
  preferredEndpoints,
} from '../desktop/networkDiscovery';
test('discovery covers Ethernet, Wi-Fi and hotspot subnets without disabling other interfaces', () => {
  const adapters = [
    { name: 'Ethernet', address: '10.4.5.8', netmask: '255.255.252.0' },
    { name: 'Wi-Fi', address: '192.168.1.20', netmask: '255.255.255.0' },
    { name: 'Hotspot', address: '192.168.137.1', netmask: '255.255.255.0' },
  ];
  const routes = discoveryRoutes(adapters, '192.168.1.20');
  assert.equal(routes[1].address, '192.168.1.20');
  assert.equal(routes.length, 4);
  assert.ok(routes.find((r) => r.address === '10.4.5.8')!.destinations.includes('10.4.7.255'));
  assert.ok(
    routes.find((r) => r.address === '192.168.137.1')!.destinations.includes('192.168.137.255'),
  );
  assert.equal(
    networkAdapters({
      lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1' } as any],
      wifi: [
        {
          family: 'IPv4',
          internal: false,
          address: '192.168.1.2',
          netmask: '255.255.255.0',
        } as any,
      ],
    }).length,
    1,
  );
});
test('one failed adapter does not discard discovery replies; source address wins over advertised host', async () => {
  const socket = dgram.createSocket('udp4');
  await new Promise<void>((resolve) => socket.bind(0, '127.0.0.1', resolve));
  const port = (socket.address() as any).port - 1;
  socket.on('message', (_message, remote) => {
    socket.send('not json', remote.port, remote.address);
    socket.send(
      JSON.stringify({
        port,
        school: 'Test school',
        host: '198.51.100.1',
        hosts: ['198.51.100.2'],
        deviceId: 'A'.repeat(64),
        pairingVersion: 1,
      }),
      remote.port,
      remote.address,
    );
  });
  try {
    const devices = await discoverSchools(
      port,
      [{ name: 'Disconnected', address: '192.0.2.44', netmask: '255.255.255.0' }],
      '',
      500,
    );
    assert.equal(devices.length, 1);
    assert.equal(devices[0].host, '127.0.0.1');
    assert.deepEqual(devices[0].hosts, ['127.0.0.1']);
    assert.equal(devices[0].pairingVersion, 1);
  } finally {
    socket.close();
  }
});
test('address recovery only accepts the same pinned teacher after a successful TLS probe', async () => {
  const pin = 'AB'.repeat(32),
    current = { host: '10.1.1.2', fingerprint: pin };
  const devices = [
    {
      host: '192.168.137.1',
      hosts: ['192.168.137.1', '192.168.1.8'],
      school: 'Teacher',
      port: 4310,
      deviceId: pin.match(/../g)!.join(':'),
    },
    {
      host: '192.168.1.99',
      hosts: ['192.168.1.99'],
      school: 'Impostor',
      port: 4310,
      deviceId: '00'.repeat(32),
    },
  ];
  const tried: string[] = [];
  const found = await verifiedAlternative(current, devices, async (host, pinValue) => {
    tried.push(host);
    assert.equal(pinValue, pin);
    if (host === '192.168.137.1') throw Error('wrong certificate');
  });
  assert.equal(found, '192.168.1.8');
  assert.ok(!tried.includes('192.168.1.99'));
  assert.equal(current.host, '10.1.1.2');
  assert.equal(
    await verifiedAlternative(current, devices, async () => {
      throw Error('unreachable');
    }),
    undefined,
  );
});

test('a preferred Wi-Fi subnet wins for new pairing while Ethernet remains a fallback', () => {
  const adapters = [{ name: 'Wi-Fi', address: '192.168.137.9', netmask: '255.255.255.0' }];
  assert.deepEqual(preferredEndpoints(['10.0.0.2', '192.168.137.1'], adapters, '192.168.137.9'), [
    '192.168.137.1',
    '10.0.0.2',
  ]);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app';
import { newPairingCode, normalizePairingCode, pairingKey, pairingProof } from '../server/pairing';

test('connection codes authenticate the observed certificate and fresh challenge without transmitting the code', async () => {
  const code = newPairingCode();
  assert.match(code, /^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){2}$/);
  const fingerprint = 'AB'.repeat(32);
  const nonce = 'cd'.repeat(32);
  const directory = mkdtempSync(join(tmpdir(), 'school-pairing-'));
  const server = await createApp({ directory, pairingCode: code, pairingFingerprint: fingerprint });
  try {
    const reply = await server.app.inject({ method: 'POST', url: '/api/pair/proof', payload: { nonce } });
    assert.equal(reply.statusCode, 200);
    assert.ok(!reply.body.includes(code));
    const key = pairingKey(code.toLowerCase().replaceAll('-', ' '), fingerprint);
    assert.equal(reply.json().proof, pairingProof(key, nonce, fingerprint));
    assert.notEqual(reply.json().proof, pairingProof(key, 'ef'.repeat(32), fingerprint));
    assert.notEqual(reply.json().proof, pairingProof(pairingKey(code, 'CD'.repeat(32)), nonce, 'CD'.repeat(32)));
    assert.notEqual(reply.json().proof, pairingProof(pairingKey('AAAA-AAAA-AAAA', fingerprint), nonce, fingerprint));
    assert.equal((await server.app.inject({ method: 'POST', url: '/api/pair/proof', payload: { nonce: 'invalid' } })).statusCode, 400);
    assert.equal((await server.app.inject({ method: 'POST', url: '/api/pair', payload: { code: normalizePairingCode(code).toLowerCase() } })).statusCode, 200);
    assert.equal((await server.app.inject({ method: 'POST', url: '/api/pair', payload: { code: 'wrong' } })).statusCode, 403);
  } finally { await server.app.close(); rmSync(directory, { recursive: true, force: true }); }
});

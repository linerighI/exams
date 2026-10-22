import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createAppUpdater } from '../desktop/appUpdater';
import { createManagedUpdates } from '../desktop/managedUpdates';

const bytes = Buffer.from('verified-school-release'),
  hash = createHash('sha256').update(bytes).digest('hex');
const campaign = {
  id: 'a'.repeat(32),
  version: '1.5.5',
  size: bytes.length,
  hash,
  notes: 'release',
  createdAt: 1,
};
test('managed client downloads over LAN, waits for exam submission and installs only after the countdown and server lease', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'managed-updates-'));
  let active = true,
    time = 1000,
    installed = 0,
    downloads = 0;
  const reports: string[] = [];
  const updater = createAppUpdater({
    directory,
    current: '1.5.4',
    emit: () => {},
    install: async () => {
      reports.push('native');
      installed++;
    },
  });
  const worker = createManagedUpdates({
    updater,
    current: '1.5.4',
    now: () => time,
    context: () => 'student-session',
    query: async () => ({ campaign, active }),
    report: async (_c, status) => {
      if (status === 'installing') assert.equal(active, false);
      reports.push(status);
    },
    transport: async () => {
      downloads++;
      return new Response(bytes);
    },
  });
  try {
    await worker.tick();
    assert.equal(updater.state().waiting, true);
    assert.equal(installed, 0);
    assert.equal(downloads, 1);
    active = false;
    await worker.tick();
    assert.equal(updater.state().installAt, 21000);
    assert.equal(installed, 0);
    time = 22000;
    await worker.tick();
    assert.equal(installed, 1);
    assert.deepEqual(reports.slice(-2), ['installing', 'native']);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
test('cancellation, changed sessions, corrupt downloads and a newly active exam never launch an installer', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'managed-safety-'));
  let key: string | undefined = 'session',
    active = false,
    installed = 0,
    published: any = campaign,
    time = 1000;
  const updater = createAppUpdater({
    directory,
    current: '1.5.4',
    emit: () => {},
    install: async () => {
      installed++;
    },
  });
  const worker = createManagedUpdates({
    updater,
    current: '1.5.4',
    now: () => time,
    context: () => key,
    query: async () => ({ campaign: published, active }),
    report: async () => {},
    transport: async () => new Response(bytes),
  });
  try {
    await worker.tick();
    active = true;
    time = 25000;
    await worker.tick();
    assert.equal(installed, 0);
    assert.equal(updater.state().waiting, true);
    active = false;
    await worker.tick();
    published = null;
    time = 60000;
    await worker.tick();
    assert.equal(installed, 0);
    published = campaign;
    key = undefined;
    await worker.tick();
    assert.equal(installed, 0);
    updater.acceptSchool({ ...campaign, hash: '0'.repeat(64) }, async () => new Response(bytes));
    assert.equal((await updater.download()).status, 'error');
    await assert.rejects(updater.install());
    assert.equal(installed, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
test('school delivery resumes verified bytes and refuses a damaged cached file before install', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'managed-resume-'));
  const updater = createAppUpdater({
    directory,
    current: '1.5.4',
    emit: () => {},
    install: async () => {
      throw Error('must not install');
    },
  });
  try {
    writeFileSync(join(directory, hash + '.part'), bytes.subarray(0, 4));
    updater.acceptSchool(campaign, async (offset) => {
      assert.equal(offset, 4);
      return new Response(bytes.subarray(offset), {
        status: 206,
        headers: { 'Content-Range': `bytes 4-${bytes.length - 1}/${bytes.length}` },
      });
    });
    assert.equal((await updater.download()).status, 'ready');
    writeFileSync(join(directory, hash + '.exe'), 'tampered');
    await assert.rejects(updater.install(), /تغيّر/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a declined or failed installation is reported after restart instead of repeatedly relaunching UAC',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'managed-declined-'));let downloads=0,installed=0;const statuses:string[]=[];
  const updater=createAppUpdater({directory,current:'1.5.4',emit:()=>{},install:async()=>{installed++;}});
  const worker=createManagedUpdates({updater,current:'1.5.4',context:()=> 'student',failedCampaign:()=>campaign.id,
    query:async()=>({campaign,active:false}),report:async(_c,status)=>{statuses.push(status);},
    transport:async()=>{downloads++;return new Response(bytes);}});
  try{await worker.tick();await worker.tick();assert.equal(downloads,0);assert.equal(installed,0);assert.deepEqual(statuses,['error','error']);}
  finally{rmSync(directory,{recursive:true,force:true});}
});

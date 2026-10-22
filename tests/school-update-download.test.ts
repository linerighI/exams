import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:https';
import { X509Certificate } from 'node:crypto';
import selfsigned from 'selfsigned';
import { downloadSchoolUpdate } from '../desktop/schoolUpdateDownload';

test('LAN download pins the paired teacher certificate before sending the token and supports ranges',async()=>{
  const cert=await selfsigned.generate([{name:'commonName',value:'localhost'}],{keySize:2048});
  const bytes=Buffer.from('verified update bytes');let requests=0;
  const server=createServer({key:cert.private,cert:cert.cert},(req,res)=>{
    requests++;assert.equal(req.headers.authorization,'Bearer paired-student-token');
    assert.equal(req.url,`/api/school-updates/${'a'.repeat(32)}/file`);
    assert.equal(req.headers.range,'bytes=4-');
    res.writeHead(206,{'Content-Type':'application/octet-stream','Content-Range':`bytes 4-${bytes.length-1}/${bytes.length}`});res.end(bytes.subarray(4));
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=(server.address() as {port:number}).port;
  try{
    const options={host:'127.0.0.1',port,fingerprint:new X509Certificate(cert.cert).fingerprint256,token:'paired-student-token',id:'a'.repeat(32),offset:4,signal:AbortSignal.timeout(5000)};
    const response=await downloadSchoolUpdate(options);assert.equal(response.status,206);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes.subarray(4));
    await assert.rejects(downloadSchoolUpdate({...options,fingerprint:'00'.repeat(32)}),/بصمة/);
    assert.equal(requests,1,'wrong certificate must not receive an HTTP request or token');
    assert.throws(()=>downloadSchoolUpdate({...options,id:'../not-an-update'}));
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

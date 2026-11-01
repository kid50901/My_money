import assert from 'node:assert/strict';
const origin=process.env.LEDGER_TEST_URL||'http://127.0.0.1:8787';if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin))throw Error('Integration tests only run against a local preview.');
const id='integration-'+Date.now(),headers={'Content-Type':'application/json','oai-authenticated-user-id':id,'oai-authenticated-user-email':'integration@example.test'};
async function request(path,body,extra={}){const r=await fetch(origin+path,{method:body?'POST':'GET',headers,...extra,...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json()}}
assert.equal((await request('/api/ledger',undefined,{headers:{}})).status,401);
const start=await request('/api/ledger');assert.equal(start.status,200);assert.equal(start.body.revision,null);
const data={accounts:[{id:'cash',kind:'asset',name:'Test Cash',category:'Cash',currency:'TWD',symbol:'',linked:'',due:''}],months:{'2026-10':{cash:{qty:111,rate:1,buy:0}}}};
const one=await request('/api/ledger',{data,revision:null},{method:'PUT'});assert.equal(one.status,200);
const two=await request('/api/ledger',{data:{...data,months:{'2026-10':{cash:{qty:222,rate:1,buy:0}}}},revision:one.body.revision},{method:'PUT'});assert.equal(two.status,200);assert.equal(two.body.versions.length,1);
assert.equal((await request('/api/ledger',{data,revision:one.body.revision},{method:'PUT'})).status,409);
const version=two.body.versions[0].id;
assert.equal((await request('/api/ledger/restore',{id:version,revision:two.body.revision},{headers:{...headers,'oai-authenticated-user-id':id+'-other'}})).status,404);
const restored=await request('/api/ledger/restore',{id:version,revision:two.body.revision});assert.equal(restored.status,200);assert.equal(restored.body.data.months['2026-10'].cash.qty,111);assert.equal(restored.body.versions.length,2);
const edits=await Promise.all([333,444].map(qty=>request('/api/ledger',{data:{...data,months:{'2026-10':{cash:{qty,rate:1,buy:0}}}},revision:restored.body.revision},{method:'PUT'})));
assert.deepEqual(edits.map(x=>x.status).sort(),[200,409]);
console.log('PASS: authenticated API, cloud snapshot, restore, cross-user isolation, stale-write rejection, concurrent-save protection.');

import test from 'node:test';
import assert from 'node:assert/strict';
import reset from '../api/send-reset-code.js';
import upsert from '../api/resend-upsert.js';
import frontendReset from '../frontend/api/send-reset-code.js';
import frontendUpsert from '../frontend/api/resend-upsert.js';

const secret = 'relay-test-'.repeat(5);
function response() {
  return { statusCode: 200, setHeader() {}, status(n) {this.statusCode=n;return this;}, json(body) {this.body=body;return this;}, end() {return this;} };
}
test('email relays fail closed, validate input, fix sender and redact provider data', async () => {
  const oldEnv = { ...process.env };
  const oldFetch = globalThis.fetch;
  const calls=[];
  globalThis.fetch = async (url, options) => {
    calls.push({url, body:JSON.parse(options.body)});
    return {ok:true,status:200,json:async()=>({private:'provider secret'})};
  };
  try {
    delete process.env.EMAIL_RELAY_SECRET;
    process.env.CRON_SECRET = secret;
    process.env.EMAIL_TEST_SECRET = secret;
    process.env.RESEND_API_KEY = 'fake-provider-key';
    process.env.RESEND_AUDIENCE_ID = 'test-audience';
    process.env.EMAIL_FROM = 'Configured <no-reply@example.com>';
    for (const handler of [reset,upsert,frontendReset,frontendUpsert]) {
      for (const configured of [undefined,'short',secret]) {
        if (configured===undefined) delete process.env.EMAIL_RELAY_SECRET;
        else process.env.EMAIL_RELAY_SECRET = configured;
        const res=response();
        await handler({method:'POST',headers:{'x-api-key':configured===secret?'wrong':secret},body:{}},res);
        assert.equal(res.statusCode,401);
      }
    }
    assert.equal(calls.length,0);
    process.env.EMAIL_RELAY_SECRET = secret;
    const invalid=response();
    await reset({method:'POST',headers:{'x-api-key':secret},body:{to:'test@example.com',code:'<script>',minutes:15}},invalid);
    assert.equal(invalid.statusCode,400);
    assert.equal(calls.length,0);
    const valid=response();
    await reset({method:'POST',headers:{'x-api-key':secret},body:{to:'test@example.com',code:'123456',minutes:15,from:'Attacker <bad@example.com>'}},valid);
    assert.equal(valid.statusCode,200);
    assert.deepEqual(valid.body,{ok:true});
    assert.equal(calls.at(-1).body.from,process.env.EMAIL_FROM);
    globalThis.fetch=async()=>({ok:false,status:403,json:async()=>({private:'provider secret'})});
    const failed=response();
    await upsert({method:'POST',headers:{'x-api-key':secret},body:{email:'test@example.com'}},failed);
    assert.equal(failed.statusCode,502);
    assert.deepEqual(failed.body,{ok:false,error:'contact operation failed'});
    globalThis.fetch=async()=>{throw new Error('provider secret');};
    const exception=response();
    await reset({method:'POST',headers:{'x-api-key':secret},body:{to:'test@example.com',code:'123456'}},exception);
    assert.deepEqual(exception.body,{ok:false,error:'email delivery failed'});
  } finally {
    globalThis.fetch=oldFetch;
    for(const key of Object.keys(process.env)) if(!(key in oldEnv)) delete process.env[key];
    Object.assign(process.env,oldEnv);
  }
});

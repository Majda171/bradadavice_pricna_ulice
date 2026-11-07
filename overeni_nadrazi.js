// Ověření, že návrat vlakem nevyvolá další rozřazování již rozřazeného studenta.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, 'kings-cross.js'), 'utf8');
const castle = 'https://majda171.github.io/skola-car-a-kouzel/hrad.html';
const sorting = 'https://majda171.github.io/skola-car-a-kouzel/rozrazeni.html';

async function checkJourney(houseCode, stationCompleted) {
  const nodes = new Map();
  const get = id => {
    if (!nodes.has(id)) nodes.set(id, {
      hidden: true, disabled: true, href: sorting, textContent: '',
      handlers: {}, currentTime: 0,
      addEventListener(event, handler) { this.handlers[event] = handler; },
      play() { return Promise.resolve(); }, pause() {},
      requestFullscreen() { return Promise.resolve(); }
    });
    return nodes.get(id);
  };
  const redirects = [];
  let completeCalls = 0;
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: 'student-123' } } }) },
    from(table) {
      assert.equal(table, 'profiles');
      return { select(field) {
        assert.equal(field, 'house_code');
        return { eq(column, id) {
          assert.equal(column, 'id'); assert.equal(id, 'student-123');
          return { single: async () => ({ data: { house_code: houseCode }, error: null }) };
        } };
      } };
    },
    async rpc(name) {
      if (name === 'v17_station_status') return { data: { schoolReady: true, stationCompleted }, error: null };
      if (name === 'v17_complete_station') { completeCalls++; return { data: { stationCompleted: true }, error: null }; }
      throw new Error(`Neznámé RPC: ${name}`);
    }
  };
  const window = { BradaviceDB: { client: db }, location: { assign: url => redirects.push(url) }, addEventListener() {} };
  const document = { getElementById: get, fullscreenElement: false };
  vm.runInNewContext(script, { window, document, console, setTimeout() {} });
  const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
  await flush();
  assert.equal(get('boardTrain').disabled, false);
  const target = houseCode ? castle : sorting;
  assert.equal(get('toSorting').href, target);
  if (stationCompleted) assert.equal(get('toSorting').hidden, false);
  get('boardTrain').handlers.click();
  get('stationVideo').handlers.ended();
  await flush();
  assert.deepEqual(redirects, [target]);
  assert.equal(completeCalls, stationCompleted ? 0 : 1);
}

(async () => {
  for (const completed of [false, true]) {
    await checkJourney('N', completed);
    await checkJourney(null, completed);
  }
  console.log('V pořádku: noví i rozřazení studenti, první i opakovaná jízda vlakem.');
})().catch(error => { console.error(error); process.exitCode = 1; });

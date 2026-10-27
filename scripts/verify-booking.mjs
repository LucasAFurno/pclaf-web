import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

// Pruebas sin red ni reservas reales. El navegador del cliente puede estar en otra zona horaria.
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-10-27T20:00:00Z'])); }
}
const html = readFileSync('src/content/legacy/turnos.html', 'utf8');
const script = html.slice(html.indexOf("const SUPA="), html.indexOf('// Init'));
const client = vm.createContext({ Date: FixedDate, Intl, console, AbortSignal });
vm.runInContext(script, client);
vm.runInContext(`
  availableMonth='2026-10';
  portal=async (action,payload)=>{globalThis.lastQuery=payload;return [];};
`, client);
assert.equal(vm.runInContext('argentinaNow().time', client), '17:00');
assert.equal(vm.runInContext("horariosSimuladosOcupados('2026-10-27').length", client), 4);
assert.equal(vm.runInContext("slotAvailable('2026-10-27','10:00')", client), false);
assert.equal(vm.runInContext("slotAvailable('2026-10-27','17:00')", client), false);
assert.equal(vm.runInContext("slotAvailable('2026-10-27','17:30')", client), true);
assert.equal(vm.runInContext("slotAvailable('2026-10-27','18:30')", client), false);
assert.equal(vm.runInContext("slotAvailable('2026-10-27','17:30',{'2026-10-27':['17:30','17:30']})", client), false);
assert.equal(vm.runInContext("slotAvailable('2026-11-02','10:00')", client), false);
for (const [year, month, lastDay] of [[2026, 10, '2026-11-30'], [2027, 1, '2027-02-28'], [2028, 1, '2028-02-29']]) {
  await vm.runInContext(`loadOccupied(${year},${month})`, client);
  assert.equal(client.lastQuery.hasta, lastDay);
}
vm.runInContext("portal=async()=>{throw new Error('offline');}", client);
await assert.rejects(vm.runInContext('loadOccupied(2026,10)', client), /offline/);
vm.runInContext('portal=async()=>null', client);
await assert.rejects(vm.runInContext('loadOccupied(2026,10)', client), /inválida/);

const server = vm.createContext({
  Date: FixedDate, Intl, console,
  Deno: { env: { get: () => '' }, serve: () => {} },
});
const backend = readFileSync('supabase/functions/pclaf-portal/index.ts', 'utf8');
vm.runInContext(stripTypeScriptTypes(backend), server);
assert.equal(vm.runInContext("date('2026-11-31')", server), '');
assert.equal(vm.runInContext("date('2028-02-29')", server), '2028-02-29');
assert.equal(vm.runInContext("date('2027-02-29')", server), '');
for (const hora of ['10:00', '17:00', '19:00']) {
  await assert.rejects(vm.runInContext(`book({nombre:'Prueba',telefono:'1135708345',servicio:'Prueba',fecha:'2026-10-27',hora:'${hora}'})`, server), /no está disponible/);
}
console.log('Turnos verificados: bloqueos simulados, hora argentina, cupos, fin de mes, errores de disponibilidad y validación del servidor.');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('src/content/legacy/historial.html', 'utf8');
const source = html.slice(html.indexOf('const SUPABASE_URL'), html.lastIndexOf('</script>'));
const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, {
    innerHTML: '', classList: { add() {}, remove() {}, toggle() { return true; } },
    addEventListener() {}, scrollIntoView() {}, querySelector() { return { setAttribute() {} }; },
  });
  return elements.get(id);
};
const context = vm.createContext({
  console, encodeURIComponent, document: { getElementById: element, querySelectorAll: () => [] },
});
vm.runInContext(source, context);
const before = { id: 'before', filename: 'auto_cliente_antes.html', created_at: '2026-10-01T12:00:00Z', html_cliente: '<p>Antes</p>' };
const after = { id: 'after', filename: 'auto_cliente_despues.html', created_at: '2026-10-02T12:00:00Z', html_cliente: '<p>Después</p>' };
context.fixture = {
  codigo: 'PRUEBA', nombre: 'Cliente', apellido: 'De prueba',
  machines: [
    { id: 'm1', nombre: 'HP Notebook', modelo: 'G10', repairs: [
      { id: 'r1', numero: 101, problema: 'Temperatura', estado: 'entregado', fecha_entrega: '2026-10-01',
        steps: [{ estado: 'done', titulo: 'PCLAF -', fecha: '2 oct', nota: 'Pruebas terminadas.' }],
        reports: [before, after], ratings: [{ puntuacion: 1, comentario: 'Calificación anterior' }] },
      { id: 'r2', numero: 100, problema: 'Mantenimiento', estado: 'entregado', reports: [], ratings: [] },
    ] },
    { id: 'm2', nombre: 'PC de prueba', modelo: '', repairs: [{ id: 'r3', numero: 102, problema: 'Revisión', estado: 'proceso', reports: [], ratings: [] }] },
  ],
};
vm.runInContext('currentClient=fixture;renderMachines(fixture,fixture.codigo)', context);
assert(element('panelMachines').innerHTML.includes('2 equipos registrados'), 'El contador debe contar equipos y no reparaciones');
await vm.runInContext("showMachine('m1')", context);
const delivered = element('panelHistory').innerHTML;
assert.equal((delivered.match(/class="google-review-link"/g) || []).length, 2, 'Todos los trabajos entregados deben permitir reseñar en Google, sin filtrar opiniones anteriores');
assert(delivered.includes('https://g.page/r/CebOQaDNkBJNEBM/review'));
assert(!delivered.includes('Calificación anterior'));
assert(!delivered.includes('<textarea'));
assert(!delivered.includes('Entrega estimada'), 'Un trabajo entregado no debe mostrar una entrega estimada anterior');
assert(delivered.includes('PCLAF -') && delivered.includes('HP Notebook') && delivered.includes('G10'), 'Los nombres originales deben conservarse');
assert(delivered.includes('Ver resultado del servicio') && delivered.includes('Ver diagnóstico inicial'));
assert(delivered.includes('Consultar por este arreglo'));
assert.equal((delivered.match(/Consultar por este arreglo/g) || []).length, 2, 'Debe haber una sola consulta por reparación, sin duplicarla en el resumen');
const url = vm.runInContext('repairWhatsApp(fixture.machines[0],fixture.machines[0].repairs[0])', context);
assert(decodeURIComponent(url).includes('#101') && decodeURIComponent(url).includes('PRUEBA'));
await vm.runInContext("showMachine('m2')", context);
assert(!element('panelHistory').innerHTML.includes('google-review-link'), 'No se pide una reseña por un trabajo todavía en proceso');
assert(element('panelHistory').innerHTML.includes('En reparación'));
assert(!/enviarCalif|selectedStars|portal\('rate'/.test(source), 'La pantalla ya no debe guardar calificaciones internas');
console.log('Historial verificado: nombres conservados, equipos contados correctamente, estados, informes, consulta contextual y reseñas directas de Google sin calificación interna.');

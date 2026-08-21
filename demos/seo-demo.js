const page = location.pathname.split('/').pop().replace('.html','');
const data = {
  'cafe-bruma':['Diseño web para cafeterías','Landing para cafeterías con menú, WhatsApp, horarios y pedidos. PCLAF crea páginas web adaptadas a cada negocio.','Mini Web'],
  'casa-amapola':['Diseño web para librerías','Web para librerías, editoriales y tiendas culturales con catálogo y consultas por WhatsApp.','Landing esencial'],
  bruma:['Diseño web para marcas de ropa','Tienda visual para indumentaria, colecciones y ventas por WhatsApp.','Catálogo comercial'],
  'estudio-23':['Diseño web para estudios creativos','Portfolio y landing para agencias, diseñadores y servicios creativos.','Landing comercial'],
  forme:['Diseño web para arquitectos','Web para estudios de arquitectura, reformas e interiores con proyectos destacados.','Landing comercial'],
  alma:['Diseño web para bienestar y terapias','Web con agenda, actividades y reservas para espacios de bienestar.','Landing esencial'],
  altura:['Diseño web para inmobiliarias','Catálogo inmobiliario con propiedades, filtros y consultas directas.','Catálogo comercial'],
  movi:['Diseño web para talleres y bicicleterías','Web para talleres, servicios y comercios de barrio con turnos por WhatsApp.','Landing esencial'],
  'corte-09':['Diseño web para barberías','Web para barberías y peluquerías con turnos, servicios y reservas.','Landing esencial'],
  'obra-clara':['Diseño web para constructoras y reformas','Landing para captar presupuestos de reformas, obras y servicios profesionales.','Landing comercial'],
  'luna-roja':['Diseño web para restaurantes y bares','Web gastronómica con menú, reservas y consultas por WhatsApp.','Landing comercial'],
  pulso:['Landing page para software y SaaS','Página para explicar un producto digital y conseguir demos comerciales.','Landing comercial'],
  'flor-de-sol':['Diseño web para florerías','Catálogo online para florerías, regalos y pedidos por WhatsApp.','Catálogo comercial'],
  vital:['Diseño web para gimnasios','Web para gimnasios, entrenadores, clases y turnos online.','Landing esencial'],
  nube:['Diseño web para eventos','Landing para eventos, celebraciones y producción con consultas directas.','Landing comercial'],
  archivo:['Tienda web para marcas de autor','Web para colecciones, objetos y marcas de nicho con catálogo visual.','Catálogo comercial']
}[page];
if (data) {
  const [service, description, plan] = data;
  document.title = `${service} | PCLAF`;
  const meta = document.createElement('meta'); meta.name = 'description'; meta.content = description; document.head.append(meta);
  const canonical = document.createElement('link'); canonical.rel = 'canonical'; canonical.href = `${location.origin}${location.pathname}`; document.head.append(canonical);
  const section = document.createElement('section');
  section.setAttribute('aria-label', service);
  section.style.cssText = 'padding:52px 24px;background:#101010;color:#fff;text-align:center;font-family:Arial,sans-serif';
  section.innerHTML = `<div style="max-width:760px;margin:auto"><small style="color:#ff5b45;font-weight:700">PCLAF · PLANES PARA CADA ETAPA</small><h2 style="font-size:clamp(30px,5vw,54px);margin:14px 0">${service}</h2><p style="line-height:1.65;color:#ddd">${description} Este ejemplo muestra una posible dirección visual. Formato sugerido: <b>${plan}</b>; lo definimos según el alcance que necesites.</p><a style="display:inline-block;margin-top:12px;padding:14px 18px;background:#ff5b45;color:#fff;text-decoration:none;font-weight:700" href="/diseno-web.html#precios-web">VER PLANES Y ELEGIR →</a></div>`;
  document.body.append(section);
}

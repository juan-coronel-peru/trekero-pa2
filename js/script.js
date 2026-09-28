"use strict";

/* TREKERO - CONSOLIDADO 2 */

// 1. VALORES, OPERADORES Y FUNCIONES CON ARGUMENTOS.
const CLAVE_CARRITO = "trekero-c2-carrito-v1";
const CLAVE_RESULTADO = "trekero-c2-resultado-v1";
const MAXIMO = 20; // Límite didáctico por producto; no representa cupos reales.
let almacenamientoDisponible = true;
let temporizadorAviso;
let recorridoEvento = [];
let dibujandoCarrito = false;

// Los precios se guardan en centavos enteros para sumar sin errores decimales.
const dinero = centavos => "US$ " + (centavos / 100).toFixed(2);

/* Función reutilizable: antes sería un cálculo fijo para un tour; ahora recibe
   precio y cantidad para servir a todos los productos. La guía no define
   "funciones crecientes": se documenta como SUPUESTO la ampliación progresiva
   de funciones reutilizables (Growing functions). Además, con precio positivo,
   este subtotal aumenta cuando aumenta la cantidad. */
function calcularSubtotal(precio, cantidad) {
  return precio * cantidad;
}

// Recursividad: caso base y avance de una posición. Hay solo 3 productos.
function sumarRecursivo(filas, posicion = 0) {
  if (posicion >= filas.length) return 0;
  return filas[posicion].subtotal + sumarRecursivo(filas, posicion + 1);
}

// Bucle while. Se reutiliza para numerar tarjetas con 01, 02, 03.
function numeroConCeros(numero, ancho = 2) {
  let texto = String(numero);
  while (texto.length < ancho) texto = "0" + texto;
  return texto;
}

function leerDatos(clave, sesion = false) {
  try {
    const almacen = sesion ? sessionStorage : localStorage;
    const texto = almacen.getItem(clave);
    if (!texto) return null;
    try {
      return JSON.parse(texto);
    } catch {
      return null; // Un dato dañado no debe impedir abrir la página.
    }
  } catch {
    almacenamientoDisponible = false;
    return null;
  }
}

function guardarDatos(clave, datos, sesion = false) {
  try {
    const almacen = sesion ? sessionStorage : localStorage;
    almacen.setItem(clave, JSON.stringify(datos));
    return true;
  } catch {
    almacenamientoDisponible = false;
    return false;
  }
}

// 2. OBJETOS, CLASES, PROTOTIPOS Y POLIMORFISMO.
class Producto {
  constructor(id, nombre, precio, descripcion) {
    this.id = id;
    this.nombre = nombre;
    this.precio = precio;
    this.descripcion = descripcion;
  }
  subtotal(cantidad) {
    return calcularSubtotal(this.precio, cantidad);
  }
  tipo() {
    return "Producto";
  }
}

class Tour extends Producto {
  tipo() {
    return "Tour · precio por viajero";
  }
}

class Complemento extends Producto {
  tipo() {
    return "Complemento · precio por unidad";
  }
}

// Método definido explícitamente en el prototipo y utilizado en las tarjetas.
Producto.prototype.precioFormateado = function () {
  return dinero(this.precio);
};

// Array de objetos. Los dos tipos responden distinto al mismo método tipo().
const productos = [
  new Tour("compartido", "Machu Picchu compartido", 12000,
    "Modalidad compartida de ejemplo para practicar la compra de un tour."),
  new Tour("privado", "Machu Picchu privado", 18000,
    "Modalidad privada de ejemplo. No anuncia servicios ni disponibilidad real."),
  new Complemento("box-lunch", "Box lunch de ejemplo", 2000,
    "Complemento ficticio para mostrar cómo sumar otro producto al carrito.")
];

// Map relaciona cada identificador con su producto. No es un mapa geográfico.
const productosPorId = new Map(productos.map(producto => [producto.id, producto]));

// 3. ENCAPSULAMIENTO: #items solo se modifica mediante métodos de Carrito.
class Carrito {
  #items = new Map();

  constructor() {
    this.cargar();
  }
  cargar() {
    this.#items.clear();
    const guardados = leerDatos(CLAVE_CARRITO);
    if (!Array.isArray(guardados)) return;
    for (const fila of guardados.slice(0, 30)) {
      if (fila && productosPorId.has(fila.id) &&
          Number.isInteger(fila.cantidad) && fila.cantidad >= 1 && fila.cantidad <= MAXIMO) {
        this.#items.set(fila.id, fila.cantidad);
      }
    }
  }
  cantidad(id) {
    return this.#items.get(id) || 0;
  }
  agregar(id) {
    return this.establecerCantidad(id, this.cantidad(id) + 1);
  }
  establecerCantidad(id, cantidad) {
    if (!productosPorId.has(id) || !Number.isInteger(cantidad) ||
        cantidad < 1 || cantidad > MAXIMO) return false;
    this.#items.set(id, cantidad);
    this.guardar();
    return true;
  }
  eliminar(id) {
    this.#items.delete(id);
    this.guardar();
  }
  vaciar() {
    this.#items.clear();
    this.guardar();
  }
  filas() {
    const filas = [];
    for (const [id, cantidad] of this.#items) {
      const producto = productosPorId.get(id);
      filas.push({ producto, cantidad, subtotal: producto.subtotal(cantidad) });
    }
    return filas;
  }
  unidades() {
    let total = 0;
    for (const cantidad of this.#items.values()) total += cantidad;
    return total;
  }
  total() {
    return sumarRecursivo(this.filas());
  }
  guardar() {
    // Solo se almacenan IDs y cantidades, nunca nombres, correos o pagos.
    const filas = this.filas().map(fila => ({
      id: fila.producto.id, cantidad: fila.cantidad
    }));
    guardarDatos(CLAVE_CARRITO, filas);
  }
}
const carrito = new Carrito();

// 4. FUNCIONES QUE MODIFICAN EL DOM.
function avisar(mensaje) {
  const aviso = document.getElementById("aviso");
  aviso.textContent = mensaje;
  aviso.hidden = false;
  clearTimeout(temporizadorAviso);
  // Temporizador: el mensaje desaparece sin bloquear la página con alert().
  temporizadorAviso = setTimeout(() => { aviso.hidden = true; }, 4500);
}

function actualizarContadores() {
  document.querySelectorAll(".contador-carrito").forEach(contador => {
    contador.textContent = carrito.unidades();
  });
}

const normalizar = texto => texto.toLowerCase().normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").trim();

function mostrarProductos() {
  const zona = document.getElementById("productos");
  if (!zona) return;
  const busqueda = normalizar(document.getElementById("buscar").value);
  const orden = document.getElementById("ordenar").value;
  const encontrados = productos.filter(producto =>
    normalizar(producto.nombre).includes(busqueda));
  switch (orden) {
    case "menor": encontrados.sort((a, b) => a.precio - b.precio); break;
    case "mayor": encontrados.sort((a, b) => b.precio - a.precio); break;
    default: break;
  }
  zona.replaceChildren();
  encontrados.forEach((producto, indice) => {
    const tarjeta = document.createElement("article");
    tarjeta.className = "tarjeta producto";
    // El contenido proviene del catálogo fijo, no de campos del usuario.
    tarjeta.innerHTML = `
      <span class="numero">${numeroConCeros(indice + 1)}</span>
      <h3>${producto.nombre}</h3>
      <p class="nota">${producto.tipo()}</p>
      <p>${producto.descripcion}</p>
      <p class="precio">${producto.precioFormateado()}</p>
      <button class="boton" type="button" data-agregar="${producto.id}"
        aria-label="Agregar ${producto.nombre} al carrito">Agregar al carrito</button>`;
    tarjeta.querySelector("button").addEventListener("click", evento => {
      if (evento.eventPhase === Event.AT_TARGET) recorridoEvento.push("Objetivo: botón");
    });
    zona.append(tarjeta);
  });
  const cantidad = encontrados.length;
  document.getElementById("resultado-busqueda").textContent = cantidad
    ? `${cantidad} producto(s) de ejemplo.` : "No hay coincidencias. Prueba otra búsqueda.";
}

function actualizarCompra() {
  const comprar = document.getElementById("comprar");
  if (!comprar) return;
  const vacio = carrito.unidades() === 0;
  comprar.disabled = vacio || !document.getElementById("aceptar-demo").checked;
  document.getElementById("vaciar").disabled = vacio;
}

function mostrarCarrito() {
  actualizarContadores();
  const zona = document.getElementById("lista-carrito");
  if (!zona || dibujandoCarrito) return;
  // Evita procesar un change provocado por retirar un campo que tenía foco.
  dibujandoCarrito = true;
  try {
    zona.replaceChildren();
    const filas = carrito.filas();
    document.getElementById("carrito-vacio").hidden = filas.length > 0;
    for (const fila of filas) {
      const producto = fila.producto;
      const tarjeta = document.createElement("article");
      tarjeta.className = "fila-carrito";
      tarjeta.dataset.id = producto.id;
      tarjeta.innerHTML = `
        <h3>${producto.nombre}</h3>
        <p class="nota">${producto.tipo()} · ${producto.precioFormateado()}</p>
        <div class="control-cantidad">
          <label for="cantidad-${producto.id}">Cantidad</label>
          <div class="cantidad-botones">
            <button type="button" data-accion="restar" aria-label="Restar una unidad de ${producto.nombre}" ${fila.cantidad === 1 ? "disabled" : ""}>−</button>
            <input id="cantidad-${producto.id}" type="number" min="1" max="${MAXIMO}"
              step="1" value="${fila.cantidad}" aria-label="Cantidad de ${producto.nombre}">
            <button type="button" data-accion="sumar" aria-label="Sumar una unidad de ${producto.nombre}" ${fila.cantidad === MAXIMO ? "disabled" : ""}>+</button>
          </div>
          <p class="subtotal">Subtotal: <strong>${dinero(fila.subtotal)}</strong></p>
          <button class="quitar" type="button" data-accion="eliminar">Eliminar</button>
        </div>`;
      zona.append(tarjeta);
    }
    document.getElementById("unidades-total").textContent = carrito.unidades();
    document.getElementById("total-carrito").textContent = dinero(carrito.total());
    if (!almacenamientoDisponible) {
      document.getElementById("estado-almacenamiento").textContent =
        "Tu navegador no permite guardar el carrito: se conserva solo mientras sigas en esta página.";
    }
    actualizarCompra();
  } finally {
    dibujandoCarrito = false;
  }
}

// Se devuelve el foco a la cantidad para no perder la posición al redibujar.
function enfocarCantidad(id) {
  const campo = document.getElementById("cantidad-" + id);
  if (campo) campo.focus({ preventScroll: true });
}

// 5. COMPRA SIMULADA Y CONFIRMACIÓN (sin datos de tarjeta ni servidor).
function simularCompra() {
  if (!carrito.unidades() || !document.getElementById("aceptar-demo").checked) return;
  const resultado = {
    tipo: "compra",
    codigo: "DEMO-" + Date.now().toString(36).toUpperCase(),
    items: carrito.filas().map(fila => ({ id: fila.producto.id, cantidad: fila.cantidad }))
  };
  // Guardamos el resumen solo durante esta sesión, antes de vaciar el carrito.
  const guardado = guardarDatos(CLAVE_RESULTADO, resultado, true);
  carrito.vaciar();
  if (guardado) {
    window.location.href = "confirmacion.html";
  } else {
    mostrarCarrito();
    document.getElementById("aceptar-demo").checked = false;
    actualizarCompra();
    document.getElementById("estado-compra").textContent =
      "Compra de prueba completada. No hubo cobro ni reserva. No se pudo guardar el resumen en este navegador.";
  }
}

function mostrarConfirmacion() {
  const titulo = document.getElementById("titulo-confirmacion");
  if (!titulo) return;
  const resultado = leerDatos(CLAVE_RESULTADO, true);
  const texto = document.getElementById("texto-confirmacion");
  const detalle = document.getElementById("detalle-confirmacion");
  if (!resultado) return;
  if (resultado.tipo === "consulta") {
    titulo.textContent = "Consulta de prueba validada";
    texto.textContent = "JavaScript comprobó los campos. Los datos del formulario no se guardaron ni se enviaron a la agencia.";
    return;
  }
  if (resultado.tipo !== "compra" || !Array.isArray(resultado.items) ||
      resultado.items.length === 0 || resultado.items.length > productos.length) return;
  const filas = [];
  for (const item of resultado.items) {
    if (!item || !productosPorId.has(item.id) || !Number.isInteger(item.cantidad) ||
        item.cantidad < 1 || item.cantidad > MAXIMO) return;
    const producto = productosPorId.get(item.id);
    filas.push({ producto, cantidad: item.cantidad, subtotal: producto.subtotal(item.cantidad) });
  }
  titulo.textContent = "Compra de prueba completada";
  texto.textContent = "Este es el resumen de la última simulación en esta pestaña. El carrito quedó vacío.";
  const lista = document.createElement("ul");
  for (const fila of filas) {
    const elemento = document.createElement("li");
    elemento.textContent = `${fila.producto.nombre} × ${fila.cantidad}: ${dinero(fila.subtotal)}`;
    lista.append(elemento);
  }
  const total = document.createElement("p");
  total.className = "total-carrito";
  total.textContent = "Total simulado: " + dinero(sumarRecursivo(filas));
  detalle.append(lista, total);
}

// 6. FORMULARIO: foco, validación, tipos de datos y evento submit.
function prepararFormulario() {
  const formulario = document.getElementById("formulario-contacto");
  if (!formulario) return;
  const nombre = document.getElementById("nombre");
  const mensaje = document.getElementById("mensaje");
  const fecha = document.getElementById("fecha");
  const error = document.getElementById("error-formulario");
  const ayuda = document.getElementById("ayuda-campo");
  const hoy = new Date();
  fecha.min = `${hoy.getFullYear()}-${numeroConCeros(hoy.getMonth() + 1)}-${numeroConCeros(hoy.getDate())}`;
  const ayudas = new Map([
    ["nombre", "Escribe un nombre ficticio de al menos 2 caracteres."],
    ["correo", "Usa un correo ficticio, por ejemplo: alex@example.com."],
    ["fecha", "Elige hoy o una fecha futura para esta prueba."],
    ["viajeros", "Ingresa un número entero entre 1 y 20 (límite de la práctica)."],
    ["consulta", "Selecciona el motivo de tu consulta."],
    ["mensaje", "Escribe entre 10 y 600 caracteres, sin datos personales reales."]
  ]);
  formulario.querySelectorAll("input, select, textarea").forEach(campo => {
    campo.addEventListener("focus", () => {
      ayuda.textContent = ayudas.get(campo.id) || "Confirma que comprendes el alcance de la prueba.";
    });
    campo.addEventListener("input", () => {
      campo.setCustomValidity("");
      campo.removeAttribute("aria-invalid");
      error.textContent = "";
    });
    campo.addEventListener("blur", () => {
      campo.setAttribute("aria-invalid", String(!campo.checkValidity()));
    });
  });
  // novalidate solo se activa después de instalar el controlador de JavaScript.
  formulario.addEventListener("submit", evento => {
    evento.preventDefault();
    nombre.setCustomValidity(nombre.value.trim().length < 2 ? "Escribe al menos dos caracteres." : "");
    mensaje.setCustomValidity(mensaje.value.trim().length < 10 ? "Escribe un mensaje de al menos diez caracteres." : "");
    if (!formulario.checkValidity()) {
      error.textContent = "Revisa los campos: faltan datos o alguno no es válido.";
      const campo = formulario.querySelector(":invalid");
      campo.setAttribute("aria-invalid", "true");
      campo.focus();
      formulario.reportValidity();
      return;
    }
    const guardado = guardarDatos(CLAVE_RESULTADO, { tipo: "consulta" }, true);
    if (guardado) window.location.href = "confirmacion.html";
    else {
      formulario.reset();
      ayuda.textContent = "Consulta de prueba validada. No se enviaron ni guardaron los datos.";
    }
  });
  formulario.noValidate = true;
  formulario.querySelector('button[type="submit"]').disabled = false;
}

// 7. EVENTOS: carga, teclado, cambio, clic, captura y burbujeo, scroll y timer.
document.addEventListener("DOMContentLoaded", () => {
  actualizarContadores();
  mostrarProductos();
  mostrarCarrito();
  prepararFormulario();
  mostrarConfirmacion();

  const buscar = document.getElementById("buscar");
  if (buscar) {
    buscar.addEventListener("input", mostrarProductos);
    buscar.addEventListener("keydown", evento => {
      if (evento.key === "Escape") {
        buscar.value = "";
        mostrarProductos();
      }
    });
    document.getElementById("ordenar").addEventListener("change", mostrarProductos);
    const zona = document.getElementById("productos");
    // Captura: el padre recibe el clic antes que el botón objetivo.
    zona.addEventListener("click", evento => {
      if (evento.target.closest("[data-agregar]")) recorridoEvento = ["Captura: catálogo"];
    }, true);
    // Burbujeo: un solo controlador del padre atiende los botones del catálogo.
    zona.addEventListener("click", evento => {
      const boton = evento.target.closest("[data-agregar]");
      if (!boton) return;
      recorridoEvento.push("Burbujeo: catálogo");
      document.getElementById("detalle-evento").textContent = recorridoEvento.join(" → ");
      const id = boton.dataset.agregar;
      const agregado = carrito.agregar(id);
      actualizarContadores();
      if (agregado) avisar(productosPorId.get(id).nombre + " agregado al carrito.");
      else avisar("Límite de la práctica: máximo 20 unidades por producto.");
    });
  }

  const lista = document.getElementById("lista-carrito");
  if (lista) {
    lista.addEventListener("click", evento => {
      const boton = evento.target.closest("button[data-accion]");
      if (!boton) return;
      const id = boton.closest("[data-id]").dataset.id;
      switch (boton.dataset.accion) {
        case "sumar": carrito.establecerCantidad(id, carrito.cantidad(id) + 1); break;
        case "restar": carrito.establecerCantidad(id, carrito.cantidad(id) - 1); break;
        case "eliminar": carrito.eliminar(id); avisar("Producto eliminado del carrito."); break;
        default: return;
      }
      mostrarCarrito();
      enfocarCantidad(id);
      if (boton.dataset.accion === "eliminar") {
        const siguiente = lista.querySelector("input");
        if (siguiente) siguiente.focus({ preventScroll: true });
        else document.querySelector("#carrito-vacio a").focus();
      }
    });
    lista.addEventListener("change", evento => {
      if (dibujandoCarrito) return;
      if (!evento.target.matches('input[type="number"]')) return;
      const id = evento.target.closest("[data-id]").dataset.id;
      const cantidad = Number(evento.target.value);
      if (!carrito.establecerCantidad(id, cantidad)) {
        avisar("Escribe una cantidad entera entre 1 y 20.");
      }
      mostrarCarrito();
      enfocarCantidad(id);
    });
    document.getElementById("vaciar").addEventListener("click", () => {
      carrito.vaciar();
      document.getElementById("aceptar-demo").checked = false;
      mostrarCarrito();
      avisar("Carrito vacío.");
      document.querySelector("#carrito-vacio a").focus();
    });
    document.getElementById("aceptar-demo").addEventListener("change", actualizarCompra);
    document.getElementById("comprar").addEventListener("click", simularCompra);
  }

  const arriba = document.getElementById("volver-arriba");
  const actualizarScroll = () => { arriba.hidden = window.scrollY < 450; };
  window.addEventListener("scroll", actualizarScroll, { passive: true });
  actualizarScroll();
  arriba.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "auto" });
    document.querySelector(".marca").focus({ preventScroll: true });
  });
  // Sincroniza el carrito si se modifica desde otra pestaña del mismo sitio.
  window.addEventListener("storage", evento => {
    if (evento.key === CLAVE_CARRITO || evento.key === null) {
      carrito.cargar();
      mostrarCarrito();
    }
  });
});

window.addEventListener("load", () => {
  document.body.dataset.carga = "completa";
  console.log("TreKero: página y recursos cargados. Carrito de práctica disponible.");
});

import React, { useEffect, useState } from "react";
import { ToastContainer, toast } from "react-toastify";

const PuntoDeVenta = () => {
  const [productos, setProductos] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [facturaUrl, setFacturaUrl] = useState(null);
  const [codigoBarras, setCodigoBarras] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [formaPago, setFormaPago] = useState("Efectivo");
  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState(0); // <-- Porcentaje

  // Estados para modal / clientes (Deuda)
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [showProductosModal, setShowProductosModal] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({ nombre: "", dni: "" });
  const [busquedaClientes, setBusquedaClientes] = useState(""); // <-- Estado para búsqueda de clientes

  // Confirm modal antes de asignar deuda
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState(null); // { cliente, deudaActual, montoCarrito, nuevaDeuda }

  useEffect(() => {
    fetch("http://localhost:4000/productos")
      .then((res) => res.json())
      .then((data) => setProductos(data))
      .catch((err) => console.error("Error al obtener productos:", err));
  }, []);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (/^[0-9]$/.test(e.key)) {
        setCodigoBarras((prev) => prev + e.key);
      }

      if (e.key === "Enter" && codigoBarras.length > 0) {
        agregarPorCodigoBarras(codigoBarras);
        setCodigoBarras("");
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [codigoBarras]);

  const agregarPorCodigoBarras = async (codigo) => {
    try {
      const res = await fetch(`http://localhost:4000/productos?codigo=${codigo}`);
      const productos = await res.json();
      const producto = productos[0];

      if (producto) {
        agregarAlCarrito(producto);
      } else {
        toast.error("Producto no encontrado ❌", { position: "top-right" });
      }
    } catch (err) {
      console.error("Error al buscar producto por código de barras:", err);
      toast.error("Error al buscar producto ❌", { position: "top-right" });
    }
  };

  const agregarAlCarrito = (producto) => {
    if (producto.stock <= 0) {
      toast.error("Este producto no tiene stock disponible ❌", { position: "top-right" });
      return;
    }

    const itemEnCarrito = carrito.find((item) => item.codigo === producto.codigo);
    
    if (itemEnCarrito && itemEnCarrito.cantidad >= producto.stock) {
      toast.warning(`Stock máximo alcanzado para ${producto.nombre} ⚠️`, { position: "top-right" });
      return;
    }

    const existe = carrito.find((item) => item.codigo === producto.codigo);
    if (existe) {
      setCarrito(
        carrito.map((item) =>
          item.codigo === producto.codigo
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        )
      );
    } else {
      setCarrito([...carrito, { ...producto, cantidad: 1 }]);
    }
    toast.success(`Producto agregado: ${producto.nombre} ✅`, { position: "top-right" });
  };

  const disminuirCantidad = (codigo) => {
    setCarrito(
      carrito
        .map((item) =>
          item.codigo === codigo
            ? { ...item, cantidad: item.cantidad - 1 }
            : item
        )
        .filter((item) => item.cantidad > 0)
    );
  };

  const subtotal = carrito.reduce(
    (acc, item) => acc + item.precio * item.cantidad,
    0
  );
  
  // Calcular descuento en monto
  const descuentoMonto = (subtotal * descuentoPorcentaje) / 100;
  const total = subtotal - descuentoMonto;

  const cobrarVenta = async () => {
    if (carrito.length === 0) {
      toast.error("El carrito está vacío ❌", { position: "top-right" });
      return;
    }

    // Validar que el porcentaje esté entre 0 y 100
    if (descuentoPorcentaje < 0 || descuentoPorcentaje > 100) {
      toast.error("El porcentaje debe estar entre 0 y 100 ❌", { position: "top-right" });
      return;
    }

    try {
      const res = await fetch("http://localhost:4000/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          productos: carrito,
          formaPago: formaPago,
          descuentoPorcentaje: descuentoPorcentaje // <-- Enviar porcentaje
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("¡Venta realizada con éxito! ✅", { position: "top-right" });
        
        if (descuentoPorcentaje > 0) {
          toast.info(`Descuento aplicado: ${descuentoPorcentaje}% ($${descuentoMonto.toFixed(2)})`, { position: "top-right" });
        }
        toast.info(`Total: $${data.total} - Pago: ${formaPago}`, { position: "top-right" });

        if (data.factura) {
          setFacturaUrl(`http://localhost:4000/facturas/${data.factura}`);
        }

        setCarrito([]);
        setFormaPago("Efectivo");
        setDescuentoPorcentaje(0); // <-- Resetear

        fetch("http://localhost:4000/productos")
          .then((res) => res.json())
          .then((data) => setProductos(data))
          .catch((err) => console.error("Error al actualizar productos:", err));
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.message || "Error en la venta ❌", { position: "top-right" });
      }
    } catch (err) {
      console.error("Error de conexión:", err);
      toast.error("Error de conexión ❌", { position: "top-right" });
    }
  };

  // -----------------------
  // Funciones clientes / Deuda
  // -----------------------
  const fetchClientes = async () => {
    setLoadingClientes(true);
    try {
      const res = await fetch("http://localhost:4000/clientes");
      const data = await res.json();
      setClientes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error al obtener clientes:", err);
      toast.error("No se pudieron cargar los clientes");
    } finally {
      setLoadingClientes(false);
    }
  };

  const abrirModalDeuda = async () => {
    if (carrito.length === 0) {
      toast.warn("Agrega productos al carrito antes de registrar una deuda");
      return;
    }
    await fetchClientes();
    setShowClienteModal(true);
  };

  const agregarClienteConDeuda = async () => {
    if (!nuevoCliente.nombre.trim() || !nuevoCliente.dni.trim()) {
      toast.warn("Nombre y DNI son requeridos");
      return;
    }
    try {
      const body = { nombre: nuevoCliente.nombre.trim(), dni: nuevoCliente.dni.trim(), deuda: Number(total) || 0, productosDeuda: carrito };
      const res = await fetch("http://localhost:4000/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success("Cliente creado y deuda registrada");
        setNuevoCliente({ nombre: "", dni: "" });
        fetchClientes();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || "Error al crear cliente");
      }
    } catch (err) {
      console.error("Error creando cliente:", err);
      toast.error("Error al crear cliente");
    }
  };

  // abre modal de confirmación con detalles
  const openConfirmModal = (cliente) => {
    if (!cliente || !cliente._id) return;
    const deudaActual = Number(cliente.deuda) || 0;
    const montoCarrito = Number(total) || 0;
    const nuevaDeuda = deudaActual + montoCarrito;
    setConfirmPayload({ cliente, deudaActual, montoCarrito, nuevaDeuda });
    setConfirmModalOpen(true);
  };

  // realiza la petición para asignar deuda (llamado desde el modal de confirmación)
  const handleConfirmAssign = async () => {
    if (!confirmPayload) return;
    const { cliente, nuevaDeuda } = confirmPayload;
    try {
      // 1) Actualizar deuda del cliente y guardar productosDeuda
      const res = await fetch(`http://localhost:4000/clientes/${cliente._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          deuda: nuevaDeuda,
          productosDeuda: carrito // Guardamos los productos asociados a la deuda para usarlos al pagar
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || "Error al asignar deuda");
        return;
      }

      // 2) Actualizar stock en backend según los productos del carrito
      // Al asignar deuda queremos reservar/descontar el stock, pero NO contabilizar ingreso hasta el pago.
      try {
        for (const item of carrito) {
          // Si el producto tiene _id lo usamos; si no, buscamos por codigo
          const prodId = item._id;
          const nuevoStock = (Number(item.stock || 0) - Number(item.cantidad || 0));
          if (prodId) {
            await fetch(`http://localhost:4000/productos/${prodId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stock: nuevoStock })
            });
          } else if (item.codigo) {
            // Intentar actualizar por búsqueda de código (no ideal, pero sirve como fallback)
            const resFind = await fetch(`http://localhost:4000/productos?codigo=${encodeURIComponent(item.codigo)}`);
            if (resFind.ok) {
              const arr = await resFind.json().catch(() => []);
              const prod = Array.isArray(arr) && arr[0];
              if (prod && prod._id) {
                await fetch(`http://localhost:4000/productos/${prod._id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ stock: nuevoStock })
                });
              }
            }
          }
        }
      } catch (err) {
        console.error('Error actualizando stock al asignar deuda:', err);
        toast.warn('La deuda fue asignada pero hubo un problema al actualizar el stock (revisar consola)');
      }

      // 3) Finalizar UI: actualizar clientes, productos y limpiar carrito
      toast.success("Deuda registrada y stock actualizado correctamente");
      fetchClientes();
      setShowClienteModal(false);
      // Vaciar carrito y resetear descuento tras asignar la deuda
      setCarrito([]);
      setDescuentoPorcentaje(0);
      // Actualizar la lista de productos para reflejar el nuevo stock
      fetch("http://localhost:4000/productos")
        .then((res) => res.json())
        .then((data) => setProductos(data))
        .catch((err) => console.error("Error al actualizar productos:", err));
      // Emitir evento para que los reportes se refresquen (Top incluirá productosDeuda)
      try {
        const event = new CustomEvent('ventas:updated', {
          detail: { tipo: 'deuda_asignada', fecha: new Date() }
        });
        window.dispatchEvent(event);
      } catch (e) {
        console.error('Error al emitir evento ventas:updated tras asignar deuda', e);
      }
    } catch (err) {
      console.error("Error asignando deuda:", err);
      toast.error("Error al asignar deuda");
    } finally {
      setConfirmModalOpen(false);
      setConfirmPayload(null);
    }
  };

  const descargarBoleta = () => {
    if (facturaUrl) {
      const a = document.createElement("a");
      a.href = facturaUrl;
      a.download = `factura_${Date.now()}.pdf`;
      a.click();
      toast.info("Descarga iniciada 📄");
    } else {
      toast.error("No hay factura para descargar");
    }
  };

  return (
    <div style={{ display: "flex", gap: "20px", padding: "20px" }}>
      {/* Panel de controles / buscador (limpio y claro) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Punto de Venta</h2>
          <div style={{ color: '#9aa', fontSize: 13, marginTop: 4 }}>Selecciona productos desde el modal y ajusta cantidad en el carrito.</div>
        </div>

       
        

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowProductosModal(true)}
            style={{ flex: 1, padding: 12, borderRadius: 8, background: '#1f2937', color: '#fff', border: '1px solid #333', cursor: 'pointer', fontWeight: 600 }}
            aria-label="Ver todos los productos"
          >
          Ver todos los productos
          </button>
          
        </div>

        <div style={{ fontSize: 13, color: '#99a', marginTop: 6 }}>
          Tip: utiliza la tecla de barras numéricas + Enter para agregar por código.
        </div>
      </div>

      {/* Carrito amplio (derecha) */}
      <div style={{ flex: 2, border: "1px solid #222", padding: "18px", borderRadius: "12px", background: '#070707', boxShadow: '0 6px 18px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Carrito</h2>
          <div style={{ color: '#9aa' }}>{carrito.length} artículo(s)</div>
        </div>

        {carrito.length === 0 ? (
          <div style={{ padding: 24, borderRadius: 8, background: '#0b0b0b', textAlign: 'center', color: '#8b98a6' }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Carrito vacío</div>
            <div style={{ fontSize: 13 }}>Agrega productos desde "Ver todos los productos" o usando el escáner.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {carrito.map((item) => (
              <div key={item.codigo} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 8, background: '#0b0b0b', border: '1px solid #151515' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: item.stock > 0 ? '#34d399' : '#f87171' }} />
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.nombre}</div>
                    <div style={{ fontSize: 13, color: '#99a' }}>${item.precio.toFixed(2)} · <span style={{ color: '#7b8794' }}>cod: {item.codigo}</span></div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0f1724', padding: '6px 8px', borderRadius: 8 }}>
                    <button onClick={() => disminuirCantidad(item.codigo)} aria-label={`Disminuir ${item.nombre}`} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 16 }}>−</button>
                    <div style={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}>{item.cantidad}</div>
                    <button onClick={() => agregarAlCarrito(item)} aria-label={`Aumentar ${item.nombre}`} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 16 }}>＋</button>
                  </div>
                  <div style={{ minWidth: 90, textAlign: 'right', fontWeight: 700 }}>${(item.precio * item.cantidad).toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* INPUT DE DESCUENTO PORCENTAJE */}
        <div style={{ marginTop: 14, marginBottom: 8 }}>
          <label style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>Descuento (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={descuentoPorcentaje}
            onChange={(e) => {
              const valor = Math.max(0, Math.min(100, Number(e.target.value)));
              setDescuentoPorcentaje(valor);
            }}
            style={{ padding: 10, width: '100%', borderRadius: 8, border: '1px solid #222', background: '#0b0b0b', color: '#fff', fontSize: 14 }}
            placeholder="0"
          />
          {descuentoPorcentaje > 0 && (
            <div style={{ fontSize: 13, color: '#86efac', marginTop: 6 }}>Descuento: ${descuentoMonto.toFixed(2)} ({descuentoPorcentaje}%)</div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: '#9aa' }}>Total</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: descuentoPorcentaje > 0 ? '#86efac' : '#fff' }}>${total.toFixed(2)}</div>
          </div>

          <div style={{ width: 260, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select
              value={formaPago}
              onChange={(e) => setFormaPago(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: '1px solid #222', background: '#071122', color: '#fff' }}
            >
              <option value="Efectivo">Efectivo</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="Debito">Débito</option>
            </select>
            <button onClick={cobrarVenta} style={{ padding: 12, borderRadius: 10, background: '#ef4444', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer' }}>Cobrar venta</button>
            <button onClick={abrirModalDeuda} style={{ padding: 12, borderRadius: 10, background: '#f59e0b', color: '#08121a', border: 'none', fontWeight: 800, cursor: 'pointer' }}>Registrar deuda</button>
          </div>
        </div>
      </div>

      {/* Modal Clientes / Deuda */}
      {showClienteModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999
        }}>
          <div style={{ width: 760, maxHeight: "80vh", overflow: "auto", background: "#0f0f0f", padding: 20, borderRadius: 8, color: "white" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Clientes - Asignar Deuda</h3>
              <button 
                onClick={() => setShowClienteModal(false)} 
                style={{ 
                  padding: "10px",
                  background: "transparent",
                  color: "#999",
                  border: "none",
                  fontSize: "24px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  transition: "background-color 0.2s",
                  ':hover': {
                    backgroundColor: "rgba(201, 14, 14, 0.1)"
                  }
                }}
              >
                ×
              </button>
            </div>

            {/* Agregar el campo de búsqueda aquí */}
            <input
              type="text"
              placeholder="Buscar cliente por nombre o DNI..."
              value={busquedaClientes}
              onChange={(e) => setBusquedaClientes(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 6,
                border: "1px solid #333",
                background: "#0f0f0f",
                color: "white",
                fontSize: 14,
                marginBottom: 16
              }}
            />

            {loadingClientes ? <p>Cargando clientes...</p> : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {/* Modificar el mapeo de clientes para incluir el filtro */}
                  {clientes
                    .filter(c => 
                      c.nombre.toLowerCase().includes(busquedaClientes.toLowerCase()) ||
                      (c.dni && c.dni.toString().includes(busquedaClientes))
                    )
                    .map((c) => (
                    <div key={c._id} style={{ 
                      padding: 15,
                      borderRadius: 8,
                      background: "#151515",
                      border: "1px solid #333",
                      marginBottom: 10
                    }}>
                      {/* Contenedor principal del cliente */}
                      <div style={{ 
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 12
                      }}>
                        {/* Info del cliente */}
                        <div>
                          <div style={{ 
                            fontSize: 18,
                            fontWeight: 700,
                            marginBottom: 4
                          }}>
                            {c.nombre}
                          </div>
                          <div style={{ 
                            fontSize: 14,
                            color: "#ccc",
                            marginBottom: 8
                          }}>
                            DNI: {c.dni || "-"}
                          </div>
                        </div>

                        {/* Deuda actual destacada */}
                        <div style={{
                          background: "#1a1a1a",
                          padding: "8px 12px",
                          borderRadius: 6,
                          border: "1px solid #333"
                        }}>
                          <div style={{ fontSize: 12, color: "#999" }}>Deuda actual:</div>
                          <div style={{ 
                            fontSize: 18,
                            fontWeight: "bold",
                            color: Number(c.deuda || 0) > 0 ? "#f4a261" : "#4ade80"
                          }}>
                            ${Number(c.deuda || 0).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Nueva deuda y botón */}
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "#1a1a1a",
                        padding: 10,
                        borderRadius: 6,
                        marginTop: 8
                      }}>
                        <div>
                          <div style={{ fontSize: 13, color: "#999" }}>Nueva deuda total:</div>
                          <div style={{ 
                            fontSize: 16,
                            fontWeight: "bold",
                            color: "#f4a261"
                          }}>
                            ${(Number(c.deuda || 0) + Number(total)).toFixed(2)}
                          </div>
                        </div>
                        <button 
                          onClick={() => openConfirmModal(c)} 
                          style={{ 
                            padding: "10px 16px",
                            background: "#2a9d8f",
                            color: "white",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 14,
                            fontWeight: "500",
                            transition: "all 0.2s ease",
                            ':hover': {
                              background: "#238b7e"
                            }
                          }}
                        >
                          Registrar nueva deuda
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <hr style={{ borderColor: "rgba(255,255,255,0.06)", margin: "16px 0" }} />

                {/* Sección de nuevo cliente */}
                <div style={{ 
                  background: "#1a1a1a",
                  padding: 20,
                  borderRadius: 8,
                  marginTop: 20
                }}>
                  <h4 style={{ 
                    margin: "0 0 12px 0",
                    fontSize: 16,
                    color: "#fff"
                  }}>
                    Registrar nuevo cliente con deuda
                  </h4>
                  <div style={{ display: "flex", gap: 12 }}>
                    <input 
                      placeholder="Nombre" 
                      value={nuevoCliente.nombre} 
                      onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })} 
                      style={{ 
                        flex: 1,
                        padding: "10px 12px",
                        borderRadius: 6,
                        border: "1px solid #333",
                        background: "#0f0f0f",
                        color: "white",
                        fontSize: 14
                      }} 
                    />
                    <input 
                      placeholder="DNI" 
                      value={nuevoCliente.dni} 
                      onChange={(e) => setNuevoCliente({ ...nuevoCliente, dni: e.target.value })} 
                      style={{ 
                        width: 180,
                        padding: "10px 12px",
                        borderRadius: 6,
                        border: "1px solid #333",
                        background: "#0f0f0f",
                        color: "white",
                        fontSize: 14
                      }} 
                    />
                    <button 
                      onClick={agregarClienteConDeuda} 
                      style={{ 
                        padding: "10px 16px",
                        background: "#2a9d8f",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 14,
                        fontWeight: "500",
                        whiteSpace: "nowrap"
                      }}
                    >
                      Registrar deuda de ${total.toFixed(2)}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de confirmación visual antes de asignar deuda */}
      {confirmModalOpen && confirmPayload && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000
        }}>
          <div style={{
            width: 460, background: "#0b0b0b", color: "white", borderRadius: 12,
            padding: 20, boxShadow: "0 8px 30px rgba(0,0,0,0.6)", border: "1px solid #222"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Confirmar asignación de deuda</h3>
              <button onClick={() => { setConfirmModalOpen(false); setConfirmPayload(null); }} style={{ background: "transparent", border: "none", color: "#ccc", fontSize: 20 }}>✕</button>
            </div>

            <div style={{ background: "#0f0f0f", padding: 14, borderRadius: 8, border: "1px solid #1f1f1f", marginBottom: 12 }}>
              <div style={{ fontSize: 14, color: "#bbb", marginBottom: 6 }}>{confirmPayload.cliente.nombre} <span style={{ color: "#888", fontSize: 12 }}>· DNI: {confirmPayload.cliente.dni || "-"}</span></div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#999" }}>Deuda actual</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: Number(confirmPayload.deudaActual) > 0 ? "#f4a261" : "#4ade80" }}>
                    ${Number(confirmPayload.deudaActual).toFixed(2)}
                  </div>
                </div>
                <div style={{ width: 1, height: 48, background: "#1b1b1b" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#999" }}>Monto carrito</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
                    ${Number(confirmPayload.montoCarrito).toFixed(2)}
                  </div>
                </div>
                <div style={{ width: 1, height: 48, background: "#1b1b1b" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#999" }}>Nueva deuda</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#f97316" }}>
                    ${Number(confirmPayload.nuevaDeuda).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => { setConfirmModalOpen(false); setConfirmPayload(null); toast.info("Asignación cancelada"); }} style={{ padding: "10px 14px", background: "#232323", color: "#ddd", border: "none", borderRadius: 8 }}>Cancelar</button>
              <button onClick={handleConfirmAssign} style={{ padding: "10px 16px", background: "#16a34a", color: "white", border: "none", borderRadius: 8, fontWeight: 700 }}>Confirmar y Registrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Productos - listado completo */}
      {showProductosModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ width: 900, maxHeight: "85vh", overflow: "auto", background: "#0f0f0f", padding: 20, borderRadius: 8, color: "white" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Todos los productos</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  placeholder="Buscar..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  style={{ padding: 8, borderRadius: 6, border: '1px solid #333', background: '#0b0b0b', color: 'white' }}
                />
                <button onClick={() => setShowProductosModal(false)} style={{ padding: 8, borderRadius: 6, background: 'transparent', border: '1px solid #333', color: '#ccc' }}>Cerrar</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {productos
                .filter((p) => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
                .map((producto) => (
                  <div
                    key={producto._id}
                    onClick={() => { agregarAlCarrito(producto); }}
                    style={{
                      width: 180,
                      padding: 12,
                      borderRadius: 8,
                      background: '#121212',
                      border: '1px solid #222',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>{producto.nombre}</div>
                    <div style={{ fontSize: 13, color: '#9aa' }}>${producto.precio}</div>
                    <div style={{ fontSize: 12, color: '#777', marginTop: 8 }}>Stock: {producto.stock}</div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
};

export default PuntoDeVenta;
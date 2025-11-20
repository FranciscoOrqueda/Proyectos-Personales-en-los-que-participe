// src/components/ProductoForm.jsx
import React, { useState, useCallback, useEffect } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import AgregarProducto from "./AgregarProductos.jsx";
import TarjetasProductos from "./TarjetasProductos.jsx";

const ProductoForm = () => {
  const [productos, setProductos] = useState([]);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({
    nombre: "",
    precio: "",
    precioCompra: "",
    stock: "",
    imagen: "",
    linea: "",
    lineaId: "",
  });
  const [lineas, setLineas] = useState([]);
  const [crearLineaOpen, setCrearLineaOpen] = useState(false);
  const [nuevaLineaNombre, setNuevaLineaNombre] = useState("");
  const [nuevaLineaPct, setNuevaLineaPct] = useState(0);
  const [busqueda, setBusqueda] = useState("");

  const cargarProductos = useCallback(() => {
    fetch("http://localhost:4000/productos")
      .then((res) => res.json())
      .then((data) => setProductos(data))
      .catch((err) => console.error("Error al obtener productos:", err));
  }, []);

  useEffect(() => {
    cargarProductos();
  }, [cargarProductos]);

  const eliminarProducto = (id) => {
    toast(
      ({ closeToast }) => (
        <div>
          <p>⚠️ ¿Deseas eliminar este producto?</p>
          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button
              onClick={() => {
                fetch(`http://localhost:4000/productos/${id}`, { method: "DELETE" })
                  .then(() => {
                    cargarProductos();
                    toast.success("Producto eliminado correctamente");
                  })
                  .catch(() => toast.error("Error al eliminar producto"));
                closeToast();
              }}
              style={{
                background: "red",
                color: "white",
                border: "none",
                padding: "5px 10px",
                borderRadius: "5px",
                cursor: "pointer",
              }}
            >
              Sí
            </button>
            <button
              onClick={closeToast}
              style={{
                background: "gray",
                color: "white",
                border: "none",
                padding: "5px 10px",
                borderRadius: "5px",
                cursor: "pointer",
              }}
            >
              No
            </button>
          </div>
        </div>
      ),
      { autoClose: false, closeOnClick: false }
    );
  };

  const guardarCambios = async () => {
    // Validaciones SOLO al guardar
    if (!form.nombre.trim()) {
      toast.warn("⚠️ El nombre no puede estar vacío.");
      return;
    }
    if (Number(form.precio) < 0) {
      toast.warn("⚠️ El precio no puede ser negativo.");
      return;
    }
    if (Number(form.precioCompra) < 0) {
      toast.warn("⚠️ El precio de compra no puede ser negativo.");
      return;
    }
    if (Number(form.stock) < 0) {
      toast.warn("⚠️ El stock no puede ser negativo.");
      return;
    }
    if (Number(form.precioCompra) > Number(form.precio)) {
      toast.warn("⚠️ El precio de compra no puede superar al precio de venta.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("nombre", form.nombre);
      formData.append("precio", form.precio);
      formData.append("precioCompra", form.precioCompra);
      formData.append("stock", form.stock);
      formData.append("codigo", editando.codigo);
      // enviar lineaId y guardar linea nombre también para compatibilidad
      if (form.lineaId) {
        formData.append("lineaId", form.lineaId);
        const lineaObj = lineas.find(l => String(l._id) === String(form.lineaId));
        if (lineaObj) formData.append("linea", lineaObj.nombre);
      } else {
        formData.append("linea", form.linea || "");
      }

      if (form.archivo) {
        formData.append("imagen", form.archivo);
      }

      const res = await fetch(`http://localhost:4000/productos/${editando._id}`, {
        method: "PUT",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al modificar producto");
      }

      await res.json();
      cargarProductos();
      setEditando(null);
      toast.success("Producto modificado correctamente");
    } catch (error) {
      console.error("Error al modificar producto:", error);
      toast.error(`Error al modificar el producto: ${error.message}`);
    }
  };

  // Cargar lineas
  useEffect(() => {
    fetch('http://localhost:4000/lineas')
      .then(r => r.json())
      .then(d => setLineas(Array.isArray(d) ? d : []))
      .catch(err => console.error('Error al cargar lineas', err));
  }, []);

  const handleCrearLinea = async () => {
    if (!nuevaLineaNombre.trim()) return toast.error('Nombre requerido');
    try {
      const res = await fetch('http://localhost:4000/lineas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: nuevaLineaNombre.trim(), porcentaje: Number(nuevaLineaPct) || 0 }) });
      if (!res.ok) throw new Error('Error creando linea');
      const data = await res.json();
      setLineas(prev => [data, ...prev]);
      setForm({ ...form, lineaId: data._id });
      setCrearLineaOpen(false);
      setNuevaLineaNombre(''); setNuevaLineaPct(0);
      toast.success('Línea creada');
    } catch (err) {
      console.error(err);
      toast.error('No se pudo crear la línea');
    }
  };

  const productosFiltrados = productos.filter((producto) =>
    producto.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="app-main-layout">
      <ToastContainer autoClose={2500} hideProgressBar={false} theme="colored" />

      <div className="app-form-section">
        {!editando && (
          <div className="formulario-agregar">
            <AgregarProducto onProductoAgregado={cargarProductos} />
          </div>
        )}

        {editando && (
          <div className="form-container">
            <h2>Modificar Producto</h2>
            <form>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Nombre"
              />

                <div style={{ marginTop: 8 }}>
                  <label style={{ display: 'block', marginBottom: 6 }}>Línea / Categoría</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select value={form.lineaId || ""} onChange={(e) => setForm({ ...form, lineaId: e.target.value })} style={{ flex: 1, padding: 8 }}>
                      <option value="">-- Sin línea --</option>
                      {lineas.map(l => <option key={l._id} value={l._id}>{l.nombre} ({l.porcentaje}%)</option>)}
                    </select>
                    <button type="button" onClick={() => setCrearLineaOpen(!crearLineaOpen)} style={{ padding: '8px 10px' }}>{crearLineaOpen ? 'Cancelar' : 'Nueva línea'}</button>
                  </div>
                  {crearLineaOpen && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input placeholder="Nombre línea" value={nuevaLineaNombre} onChange={(e) => setNuevaLineaNombre(e.target.value)} />
                      <input placeholder="Porcentaje %" type="number" value={nuevaLineaPct} onChange={(e) => setNuevaLineaPct(e.target.value)} style={{ width: 120 }} />
                      <button type="button" onClick={handleCrearLinea}>Crear</button>
                    </div>
                  )}
                </div>

              {/* 🔁 Orden cambiado: primero precioCompra, luego precio */}
              <input
                type="number"
                value={form.precioCompra}
                onChange={(e) =>
                  setForm({ ...form, precioCompra: e.target.value })
                }
                placeholder="Precio (compra)"
              />

              <input
                type="number"
                value={form.precio}
                onChange={(e) =>
                  setForm({ ...form, precio: e.target.value })
                }
                placeholder="Precio (venta)"
              />

              {/* Sugerencia de precio según línea */}
              {form.precioCompra && (form.lineaId || form.linea) && (() => {
                const lineaObj = lineas.find(l => String(l._id) === String(form.lineaId)) || (form.linea ? lineas.find(l => l.nombre === form.linea) : null);
                const pct = lineaObj ? Number(lineaObj.porcentaje || 0) : 0;
                if (!isNaN(Number(form.precioCompra))) {
                  const sugerido = (Number(form.precioCompra) * (1 + pct / 100)).toFixed(2);
                  return (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ background: '#f0f8ff', padding: '8px 12px', borderRadius: 6 }}>
                        Precio sugerido: ${sugerido} ({pct}% sobre compra)
                      </div>
                      <button type="button" onClick={() => setForm({ ...form, precio: sugerido })}>Aplicar</button>
                    </div>
                  );
                }
                return null;
              })()}

              <input
                type="number"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                placeholder="Stock"
              />

              <div style={{ marginBottom: "16px" }}>
                {form.imagen && (
                  <div style={{ marginBottom: "8px" }}>
                    <p>Imagen actual:</p>
                    <img
                      src={`http://localhost:4000/uploads/${form.imagen}`}
                      alt="Imagen actual"
                      style={{
                        width: "100px",
                        height: "100px",
                        objectFit: "cover",
                        borderRadius: "4px",
                      }}
                    />
                  </div>
                )}
                <label style={{ display: "block", marginTop: "8px" }}>
                  Cambiar imagen:
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setForm({ ...form, archivo: e.target.files[0] })
                    }
                    style={{ marginTop: "4px" }}
                  />
                </label>
              </div>

              <div style={{ marginTop: 8 }}>
                <label style={{ display: 'block', marginBottom: 6 }}>Línea / Categoría</label>
                <input type="text" value={form.linea} onChange={(e) => setForm({ ...form, linea: e.target.value })} placeholder="Línea (ej: Bebidas)" />
              </div>

              {/* Mostrar ganancia solo si ambos precios son válidos y no negativa */}
              {form.precio !== "" &&
                form.precioCompra !== "" &&
                Number(form.precio) >= Number(form.precioCompra) && (
                  <div
                    style={{
                      background: "#2ecc71",
                      color: "#062e16",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      marginTop: "12px",
                      fontWeight: 600,
                      boxShadow: "0 4px 10px rgba(46, 204, 113, 0.15)",
                      display: "inline-block",
                    }}
                  >
                    Ganancia por unidad: $
                    {(Number(form.precio) - Number(form.precioCompra)).toFixed(2)}
                  </div>
                )}

              <div style={{ display: "flex", gap: "16px", marginTop: "16px" }}>
                <button type="button" onClick={guardarCambios}>
                  Guardar
                </button>
                <button type="button" onClick={() => setEditando(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <div className="app-tarjetas-section">
        <input
          type="text"
          placeholder="Buscar producto por nombre"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{
            padding: "10px",
            marginBottom: "20px",
            borderRadius: "5px",
            border: "1px solid #ccc",
            width: "100%",
          }}
        />

        <TarjetasProductos
          productos={productosFiltrados}
          onEliminar={eliminarProducto}
          onEditar={(producto) => {
            setEditando(producto);
            setForm({
              nombre: producto.nombre || "",
              precio: producto.precio || "",
              precioCompra: producto.precioCompra || "",
              stock: producto.stock || "",
                imagen: producto.imagen || "",
                linea: producto.linea || "",
            });
          }}
        />
      </div>
    </div>
  );
};

export default ProductoForm;

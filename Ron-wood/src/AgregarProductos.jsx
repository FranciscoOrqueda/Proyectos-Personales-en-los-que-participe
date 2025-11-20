import React, { useState, useRef } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const AgregarProductos = ({ onProductoAgregado }) => {
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [stock, setStock] = useState("");
  const [imagen, setImagen] = useState("");
  const [codigo, setCodigo] = useState("");
  const [productoExistente, setProductoExistente] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [mensajeProducto, setMensajeProducto] = useState("");
  const [precioCompra, setPrecioCompra] = useState("");
  const [ganancia, setGanancia] = useState(0);
  const [linea, setLinea] = useState("");
  const [lineas, setLineas] = useState([]);
  const [crearLineaOpen, setCrearLineaOpen] = useState(false);
  const [nuevaLineaNombre, setNuevaLineaNombre] = useState("");
  const [nuevaLineaPct, setNuevaLineaPct] = useState(0);
  
  // Estados para aumentos masivos
  const [mostrarAumentos, setMostrarAumentos] = useState(false);
  const [lineaAumento, setLineaAumento] = useState("");
  const [porcentajeAumento, setPorcentajeAumento] = useState("");
  const [procesandoAumento, setProcesandoAumento] = useState(false);
  
  const timeoutRef = useRef(null);

  // Buscar producto por código
  const buscarPorCodigo = async (codigoBarras) => {
    if (!codigoBarras.trim()) {
      limpiarFormulario();
      return;
    }

    setBuscando(true);
    setMensajeProducto("");
    try {
      const response = await fetch(`http://localhost:4000/productos?codigo=${codigoBarras}`);
      const productos = await response.json();
      const productoEncontrado = productos.find((p) => p.codigo === codigoBarras);

      if (productoEncontrado) {
        setProductoExistente(productoEncontrado);
        setNombre(productoEncontrado.nombre);
        setPrecio(productoEncontrado.precio?.toString() || "");
        setPrecioCompra(
          productoEncontrado.precioCompra !== undefined
            ? String(productoEncontrado.precioCompra)
            : ""
        );
        setImagen(productoEncontrado.imagen);
        setLinea(productoEncontrado.lineaId || productoEncontrado.linea || "");
        setStock("");
        setMensajeProducto(`✅ Producto encontrado: ${productoEncontrado.nombre}`);
      } else {
        setProductoExistente(null);
        setMensajeProducto("");
        setPrecioCompra("");
        setLinea("");
      }
    } catch (error) {
      console.error("Error al buscar producto:", error);
      toast.error("Error al buscar producto en el servidor");
    } finally {
      setBuscando(false);
    }
  };

  // Cargar lineas
  const cargarLineas = async () => {
    try {
      const res = await fetch('http://localhost:4000/lineas');
      if (res.ok) {
        const arr = await res.json();
        setLineas(Array.isArray(arr) ? arr : []);
      }
    } catch (err) {
      console.error('No se pudieron cargar lineas', err);
    }
  };

  // Crear nueva linea rápida
  const handleCrearLinea = async () => {
    if (!nuevaLineaNombre.trim()) return toast.error('Nombre requerido');
    try {
      const res = await fetch('http://localhost:4000/lineas', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          nombre: nuevaLineaNombre.trim(), 
          porcentaje: Number(nuevaLineaPct) || 0 
        }) 
      });
      if (!res.ok) throw new Error('Error creando linea');
      const data = await res.json();
      setLineas(prev => [data, ...prev]);
      setLinea(data._id);
      setCrearLineaOpen(false);
      setNuevaLineaNombre(''); 
      setNuevaLineaPct(0);
      toast.success('Línea creada');
    } catch (err) {
      console.error('Error creando linea', err);
      toast.error('No se pudo crear la línea');
    }
  };

  // ============================
  // 🆕 AUMENTO MASIVO POR LÍNEA
  // ============================
  
  const handleAplicarAumento = async () => {
    if (!lineaAumento) {
      toast.warning("Selecciona una línea");
      return;
    }
    
    const pct = Number(porcentajeAumento);
    if (isNaN(pct) || pct === 0) {
      toast.warning("Ingresa un porcentaje válido (puede ser negativo para bajar precios)");
      return;
    }

    const lineaNombre = lineas.find(l => l._id === lineaAumento)?.nombre || 'la línea';
    
    if (!window.confirm(`¿Confirmas aplicar ${pct > 0 ? '+' : ''}${pct}% a todos los productos de "${lineaNombre}"?`)) {
      return;
    }

    setProcesandoAumento(true);
    try {
      const response = await fetch('http://localhost:4000/productos/aumentar-linea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineaId: lineaAumento,
          porcentaje: pct
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        toast.success(`✅ ${data.modificados} productos actualizados con ${pct > 0 ? '+' : ''}${pct}%`);
        setPorcentajeAumento("");
        setLineaAumento("");
        if (onProductoAgregado) onProductoAgregado();
      } else {
        toast.error(data.message || "Error al aplicar aumento");
      }
    } catch (err) {
      console.error('Error aplicando aumento:', err);
      toast.error("Error de conexión");
    } finally {
      setProcesandoAumento(false);
    }
  };

  const limpiarCampos = () => {
    setNombre("");
    setPrecio("");
    setPrecioCompra("");
    setStock("");
    setImagen("");
    setGanancia(0);
  };

  const limpiarFormulario = () => {
    setCodigo("");
    setProductoExistente(null);
    setMensajeProducto("");
    limpiarCampos();
  };

  const handleCodigoChange = (e) => {
    const nuevoCodigo = e.target.value;
    setCodigo(nuevoCodigo);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (nuevoCodigo.length >= 3) {
      timeoutRef.current = setTimeout(() => buscarPorCodigo(nuevoCodigo), 500);
    } else {
      setProductoExistente(null);
      setMensajeProducto("");
    }
  };

  const handleImagenChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const formatosValidos = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!formatosValidos.includes(file.type)) {
        toast.error("Formato no válido. Solo JPG, PNG, WEBP o GIF.");
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setImagen(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!codigo.trim()) {
      toast.warning("Debes ingresar un código de barras.");
      return;
    }

    if (parseInt(stock) <= 0) {
      toast.warning("El stock debe ser mayor a 0.");
      return;
    }

    if (Number(precioCompra) > Number(precio)) {
      toast.warning("⚠️ El precio de compra no puede ser mayor al precio de venta.");
      return;
    }

    if (productoExistente) {
      const stockAAgregar = parseInt(stock);
      const id = productoExistente.id || productoExistente._id || productoExistente._id?.toString();
      const nuevoStock = (Number(productoExistente.stock) || 0) + stockAAgregar;

      const productoActualizado = {
        ...productoExistente,
        stock: nuevoStock,
      };

      if (linea !== undefined) {
        productoActualizado.lineaId = linea;
        const lineaObj = lineas.find(l => String(l._id) === String(linea));
        productoActualizado.linea = lineaObj ? lineaObj.nombre : productoActualizado.linea;
      }

      if (precioCompra !== "" && !isNaN(Number(precioCompra))) {
        productoActualizado.precioCompra = parseFloat(precioCompra);
      }

      try {
        const response = await fetch(`http://localhost:4000/productos/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(productoActualizado),
        });

        if (response.ok) {
          toast.success(`Se agregaron ${stockAAgregar} unidades al stock`);
          limpiarFormulario();
          if (onProductoAgregado) onProductoAgregado();
        } else {
          toast.error("Error al actualizar el stock");
        }
      } catch (error) {
        console.error("Error en la petición:", error);
        toast.error("Error de conexión con el servidor");
      }
    } else {
      if (!nombre.trim() || !precio) {
        toast.warning("Debes completar nombre y precio para productos nuevos.");
        return;
      }

      const nuevoProducto = {
        codigo,
        nombre,
        precio: parseFloat(precio),
        precioCompra: precioCompra !== "" ? parseFloat(precioCompra) : 0,
        stock: parseInt(stock),
        imagen,
        lineaId: linea || undefined,
        linea: (lineas.find(l => String(l._id) === String(linea)) || {}).nombre || undefined,
      };

      try {
        const response = await fetch("http://localhost:4000/productos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nuevoProducto),
        });

        if (response.ok) {
          toast.success("Producto nuevo agregado con éxito");
          limpiarFormulario();
          if (onProductoAgregado) onProductoAgregado();
        } else {
          toast.error("Error al agregar el producto");
        }
      } catch (error) {
        console.error("Error en la petición:", error);
        toast.error("Error de conexión con el servidor");
      }
    }
  };

  React.useEffect(() => { cargarLineas(); }, []);

  return (
    <div className="form-container">
      <h2>Agregar Producto</h2>
      
      {/* ============================
          🆕 AUMENTO MASIVO POR LÍNEA
          ============================ */}
      <div style={{ 
        marginBottom: 20, 
        padding: 15, 
        background: '#1a1a2e',
        borderRadius: 8,
        border: '1px solid #16213e'
      }}>
        <button
          type="button"
          onClick={() => setMostrarAumentos(!mostrarAumentos)}
          style={{
            width: '100%',
            padding: '10px',
            background: '#0f3460',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.95rem'
          }}
        >
          {mostrarAumentos ? '▼' : '▶'} Aumento Masivo por Línea
        </button>

        {mostrarAumentos && (
          <div style={{ marginTop: 15 }}>
            <label style={{ display: 'block', marginBottom: 8, color: '#e94560', fontWeight: 600 }}>
              Seleccionar Línea
            </label>
            <select 
              value={lineaAumento} 
              onChange={e => setLineaAumento(e.target.value)}
              style={{ 
                width: '100%', 
                padding: 10, 
                marginBottom: 12,
                background: '#16213e',
                color: '#fff',
                border: '1px solid #0f3460',
                borderRadius: 6
              }}
            >
              <option value="">-- Selecciona una línea --</option>
              {lineas.map(l => (
                <option key={l._id} value={l._id}>
                  {l.nombre}
                </option>
              ))}
            </select>

            <label style={{ display: 'block', marginBottom: 8, color: '#e94560', fontWeight: 600 }}>
              Porcentaje de Cambio
            </label>
            <input
              type="number"
              placeholder="Ej: 15 (o -10 para bajar)"
              value={porcentajeAumento}
              onChange={e => setPorcentajeAumento(e.target.value)}
              style={{ 
                width: '100%', 
                padding: 10, 
                marginBottom: 12,
                background: '#16213e',
                color: '#fff',
                border: '1px solid #0f3460',
                borderRadius: 6
              }}
            />

            <button
              type="button"
              onClick={handleAplicarAumento}
              disabled={procesandoAumento}
              style={{
                width: '100%',
                padding: '12px',
                background: procesandoAumento ? '#555' : '#e94560',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: procesandoAumento ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '1rem'
              }}
            >
              {procesandoAumento ? '⏳ Procesando...' : ' Aplicar Cambio a Toda la Línea'}
            </button>

            <p style={{ 
              marginTop: 12, 
              fontSize: '0.85rem', 
              color: '#aaa',
              fontStyle: 'italic'
            }}>
              💡 <strong>Ejemplo:</strong> Si pones 15%, todos los productos de la línea subirán un 15%. 
              Si pones -10%, bajarán un 10%. <strong>Este cambio es permanente.</strong>
            </p>
          </div>
        )}
      </div>

      {/* Formulario original */}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Código de barras (escanea o escribe)"
          value={codigo}
          onChange={handleCodigoChange}
          required
          autoFocus
          style={{
            backgroundColor: productoExistente ? "#380f0fff" : "",
            borderColor: productoExistente ? "#4caf50" : "",
          }}
        />

        {buscando && (
          <p style={{ color: "#fff", margin: "0.5rem 0", fontSize: "0.9rem" }}>
            🔍 Buscando producto...
          </p>
        )}

        {mensajeProducto && (
          <p
            style={{
              color: "#4caf50",
              margin: "0.5rem 0",
              fontSize: "0.9rem",
              fontWeight: "500",
              backgroundColor: "rgba(76, 175, 80, 0.1)",
              padding: "0.5rem",
              borderRadius: "4px",
            }}
          >
            {mensajeProducto}
          </p>
        )}

        <input
          type="text"
          placeholder="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required={!productoExistente}
          disabled={productoExistente}
        />

        <div style={{ marginTop: 8 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>Línea / Categoría</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={linea} onChange={e => setLinea(e.target.value)} style={{ flex: 1, padding: 8 }}>
              <option value="">-- Sin línea --</option>
              {lineas.map(l => <option key={l._id} value={l._id}>{l.nombre}</option>)}
            </select>
            <button type="button" onClick={() => setCrearLineaOpen(!crearLineaOpen)} style={{ padding: '8px 10px' }}>
              {crearLineaOpen ? 'Cancelar' : 'Nueva línea'}
            </button>
          </div>
          {crearLineaOpen && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input
  placeholder="Nombre línea"
  value={nuevaLineaNombre}
  onChange={e => setNuevaLineaNombre(e.target.value)}
/>


              <button type="button" onClick={handleCrearLinea}>Crear</button>
            </div>
          )}
        </div>

        <input
          type="number"
          placeholder="Precio de compra"
          value={precioCompra}
          onChange={(e) => {
            const nuevoValor = e.target.value;
            setPrecioCompra(nuevoValor);
            setGanancia(Number(precio) - Number(nuevoValor));
          }}
        />

        <input
          type="number"
          placeholder="Precio Venta"
          value={precio}
          onChange={(e) => {
            const nuevoValor = e.target.value;
            setPrecio(nuevoValor);
            setGanancia(Number(nuevoValor) - Number(precioCompra));
          }}
          required={!productoExistente}
          disabled={productoExistente}
        />

        {precio !== "" &&
          precioCompra !== "" &&
          Number(precio) >= Number(precioCompra) && (
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
              Ganancia por unidad: ${ganancia.toFixed(2)}
            </div>
          )}

        <input
          type="number"
          placeholder={productoExistente ? "Cantidad a agregar" : "Stock inicial"}
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          required
          min="1"
        />

        <input
          type="file"
          accept="image/*"
          onChange={handleImagenChange}
          disabled={productoExistente}
        />

        {imagen && (
          <div style={{ margin: "1rem 0", textAlign: "center" }}>
            <img
              src={imagen}
              alt="Vista previa"
              style={{ width: "100px", height: "100px", objectFit: "cover" }}
            />
          </div>
        )}

        <button type="submit">
          {productoExistente ? "Agregar Stock" : "Crear Producto"}
        </button>
      </form>
    </div>
  );
};

export default AgregarProductos;
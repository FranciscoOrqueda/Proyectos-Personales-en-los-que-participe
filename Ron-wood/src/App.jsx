import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBoxes, faCashRegister, faTruck, faReceipt, faDollarSign } from '@fortawesome/free-solid-svg-icons'
import ProductoForm from "./ProductoForm.jsx";
import { useState, useEffect } from 'react'
import logo from '../img/logo.jpg'
import PuntoDeVenta from "./PuntoDeVenta.jsx";
import Reportes from "./reportes.jsx";
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { faBell } from "@fortawesome/free-solid-svg-icons";
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Deudas from './Deudas.jsx';

const Login = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch("http://localhost:4000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      setMessage(data.message);

      if (data.success) {
        toast.success(data.message || 'Inicio de sesión correcto', { position: 'top-right', autoClose: 2500 });
        onLoginSuccess(); // para cambiar al dashboard
      }
      
    } catch (err) {
      toast.error('Credenciales incorrectas', { position: 'top-right', autoClose: 2500 });
      console.error("Error de conexión:", err);
      setMessage('Error de conexión al servidor');
    }
  };

  return (
    <div style={{ 
      maxWidth: '400px', 
      margin: '50px auto',
      padding: '40px',
      borderRadius: '15px',
      background: 'rgba(30, 30, 30, 0.95)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <div style={{
        textAlign: 'center',
        marginBottom: '30px'
      }}>
        <img 
          src={logo} 
          alt="Ron Wood Logo" 
          style={{
            width: '180px',
            marginBottom: '20px'
          }}
        />
        <h2 style={{
          color: '#fff',
          fontSize: '24px',
          marginBottom: '10px',
          fontWeight: '600'
        }}>
          Panel Administrativo
        </h2>
        <p style={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '14px'
        }}>
          Ingresa tus credenciales para continuar
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '16px',
              transition: 'border-color 0.3s ease',
              outline: 'none'
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(230, 57, 70, 0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
          />
        </div>
        
        <div style={{ marginBottom: '25px' }}>
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '16px',
              transition: 'border-color 0.3s ease',
              outline: 'none'
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(230, 57, 70, 0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
          />
        </div>

        <button 
          type="submit" 
          style={{
            width: '100%',
            padding: '14px',
            background: '#e63946',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background 0.3s ease',
            marginBottom: '20px'
          }}
          onMouseEnter={e => e.target.style.background = '#dc2f3c'}
          onMouseLeave={e => e.target.style.background = '#e63946'}
        >
          Iniciar sesión
        </button>
      </form>

      {message && (
        <p style={{
          textAlign: 'center',
          color: message.includes('Error') ? '#ff4d4d' : '#4CAF50',
          fontSize: '14px',
          margin: 0
        }}>
          {message}
        </p>
      )}
    </div>
  );
};

// 🔔 Header con campanita de bajo stock (único cambio)
const Header = ({ img }) => {
  const [bajoStock, setBajoStock] = useState([]);
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    const obtenerBajoStock = async () => {
      try {
        const res = await fetch("http://localhost:4000/productos/bajo-stock");
        const data = await res.json();
        setBajoStock(data);
      } catch (err) {
        console.error("Error al obtener productos con bajo stock:", err);
      }
    };

    obtenerBajoStock();
    const intervalo = setInterval(obtenerBajoStock, 30000); // cada 30 segundos
    return () => clearInterval(intervalo);
  }, []);

  return (
    <>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px' }}>
        <img src={img} alt="imagen-logo" />

        {/* Campanita */}
        <div style={{ position: 'relative' }}>
          <FontAwesomeIcon
            icon={faBell}
            size="2x"
            style={{ cursor: 'pointer', color: bajoStock.length > 0 ? '#ffb703' : '#ccc' }}
            onClick={() => setMostrar(!mostrar)}
          />
          {bajoStock.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                background: 'red',
                color: 'white',
                borderRadius: '50%',
                padding: '3px 6px',
                fontSize: '12px',
                fontWeight: 'bold',
              }}
            >
              {bajoStock.length}
            </span>
          )}
          {mostrar && bajoStock.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '35px',
                right: '0',
                background: '#222',
                color: 'white',
                border: '1px solid #444',
                borderRadius: '8px',
                padding: '10px',
                width: '250px',
                zIndex: 100,
                boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
              }}
            >
              <h4 style={{ margin: '0 0 10px', textAlign: 'center' }}>⚠️ Bajo stock</h4>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {bajoStock.map((p) => (
                  <li key={p._id} style={{ padding: '5px 0', borderBottom: '1px solid #444' }}>
                    {p.nombre} — Stock: {p.stock}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </header>
    </>
  );
};

const Cart =({titulo, icon, descripcion, onClick }) => {
  return (
    <div className='card' onClick={onClick} style={{ cursor: "pointer" }}>
      <FontAwesomeIcon icon={icon} size="2x" />
      <h2>{titulo}</h2>
      <p>{descripcion}</p>
    </div>
  )
}

const Modal = ({ open, onClose, children }) => {
  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-btn" onClick={onClose}>✖</button>
        {children}
      </div>
    </div>
  );
};

const ProveedorForm = () => {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [activo, setActivo] = useState(true);
  const [proveedores, setProveedores] = useState([]);
  const [selectedProveedor, setSelectedProveedor] = useState(null);

  // Cargar proveedores al inicio
  useEffect(() => {
    fetch("http://localhost:4000/proveedores")
      .then((res) => res.json())
      .then((data) => {
        // Normalizar datos recibidos
        const normalized = Array.isArray(data)
          ? data.map((p) => ({
              ...p,
              nombre: p.nombre ? String(p.nombre).trim() : "",
              telefono: p.telefono ? String(p.telefono).trim() : "",
              email: p.email ? String(p.email).trim() : "",
              activo: Boolean(p.activo),
            }))
          : [];
        setProveedores(normalized);
      })
      .catch((err) => console.error("Error cargando proveedores:", err));
  }, []);

  // Agregar proveedor
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validación mínima
    if (!nombre.trim()) {
      toast.error("El nombre es obligatorio", { position: 'top-right', autoClose: 2500 });
      return;
    }

    const payload = {
      nombre: String(nombre).trim(),
      telefono: String(telefono).trim(),
      email: String(email).trim(),
      activo: Boolean(activo),
    };

    try {
      const res = await fetch("http://localhost:4000/proveedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        const prov = {
          ...data.proveedor,
          nombre: String(data.proveedor.nombre || payload.nombre).trim(),
          telefono: String(data.proveedor.telefono || payload.telefono).trim(),
          email: String(data.proveedor.email || payload.email).trim(),
          activo: Boolean(data.proveedor.activo ?? payload.activo),
        };
        setProveedores((prev) => [...prev, prov]);
        setNombre("");
        setTelefono("");
        setEmail("");
        setActivo(true);
        toast.success("Proveedor agregado correctamente ", { position: 'top-right', autoClose: 2500 });
      }
      
    } catch (err) {
      console.error("Error agregando proveedor:", err);
      toast.error("Error al conectar con el servidor", { position: 'top-right', autoClose: 2500 });
    }
  };

  // Modificar proveedor
  const handleUpdate = async () => {
    if (!selectedProveedor) return;

    const payload = {
      nombre: String(selectedProveedor.nombre || "").trim(),
      telefono: String(selectedProveedor.telefono || "").trim(),
      email: String(selectedProveedor.email || "").trim(),
      activo: Boolean(selectedProveedor.activo),
    };

    try {
      const res = await fetch(`http://localhost:4000/proveedores/${selectedProveedor._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setProveedores((prev) =>
          prev.map((p) => (p._id === selectedProveedor._id ? { ...p, ...payload } : p))
        );
        toast.success("Proveedor actualizado correctamente ", { position: 'top-right', autoClose: 2500 });
        setSelectedProveedor(null);
      } else {
        toast.error("Error al actualizar el proveedor", { position: 'top-right', autoClose: 2500 });
      }
    } catch (err) {
      console.error("Error actualizando proveedor:", err);
      toast.error("Error al conectar con el servidor", { position: 'top-right', autoClose: 2500 });
    }
  };

  return (
    <div>
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Gestión de Proveedores 🚚</h2>

  <div className="proveedor-layout">
        {/* Formulario en la columna izquierda */}
        <div style={{ borderRight: "1px solid rgba(255,255,255,0.1)", paddingRight: "20px" }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="text"
              placeholder="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              style={{ padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#fff" }}
            />
            <input
              type="text"
              placeholder="Teléfono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#fff" }}
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "#fff" }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Estado:
              <select
                value={String(activo)}
                onChange={(e) => setActivo(e.target.value === "true")}
                style={{ padding: 8, borderRadius: 8, background: "transparent", color: "#c54343ff", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </label>
            <button type="submit" style={{ padding: 10, borderRadius: 8, background: "#e63946", color: "#fff", border: "none", cursor: "pointer" }}>
              Agregar Proveedor
            </button>
          </form>
        </div>

        {/* Lista de proveedores en dos columnas */}
  <div className="proveedor-columns">
          {/* Columna de Proveedores Activos */}
          <div>
            <h3 style={{ textAlign: "center", color: "#4CAF50", marginBottom: "15px" }}>Proveedores Activos</h3>
            <ul className="proveedor-lista">
              {proveedores
                .filter(prov => prov.activo)
                .map((prov) => (
                  <li
                    key={prov._id}
                    className="proveedor-item"
                    onClick={() => setSelectedProveedor({ ...prov })}
                    style={{ 
                      background: "rgba(76, 175, 80, 0.1)",
                      border: "1px solid rgba(76, 175, 80, 0.3)",
                      marginBottom: "8px",
                      padding: "10px",
                      borderRadius: "8px",
                      cursor: "pointer"
                    }}
                  >
                    <span>{prov.nombre} <br />
  {prov.telefono && (
    <a
      href={`https://wa.me/54${prov.telefono.replace(/\D/g, '')}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: "#25D366", textDecoration: "none", fontWeight: "bold" }}
      onClick={(e) => e.stopPropagation()} // evita que abra el modal al hacer clic
    >
      📞 WhatsApp
    </a>
  )}</span>
                  </li>
              ))}
            </ul>
          </div>

          {/* Columna de Proveedores Inactivos */}
          <div>
            <h3 style={{ textAlign: "center", color: "#f44336", marginBottom: "15px" }}>Proveedores Inactivos</h3>
            <ul className="proveedor-lista">
              {proveedores
                .filter(prov => !prov.activo)
                .map((prov) => (
                  <li
                    key={prov._id}
                    className="proveedor-item"
                    onClick={() => setSelectedProveedor({ ...prov })}
                    style={{ 
                      background: "rgba(244, 67, 54, 0.1)",
                      border: "1px solid rgba(244, 67, 54, 0.3)",
                      marginBottom: "8px",
                      padding: "10px",
                      borderRadius: "8px",
                      cursor: "pointer"
                    }}
                  >
                    <span>{prov.nombre}</span>
                  </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {selectedProveedor && (
        <div className="modal-overlay">
          <div className="modal-card">
            <button className="close-btn" onClick={() => setSelectedProveedor(null)}>✖</button>
            <h3>Editar Proveedor</h3>
            <input
              type="text"
              value={selectedProveedor.nombre}
              onChange={(e) => setSelectedProveedor({ ...selectedProveedor, nombre: e.target.value })}
              style={{ padding: 8, borderRadius: 8 }}
            />
            <input
              type="text"
              value={selectedProveedor.telefono}
              onChange={(e) => setSelectedProveedor({ ...selectedProveedor, telefono: e.target.value })}
              style={{ padding: 8, borderRadius: 8 }}
            />
            <input
              type="email"
              value={selectedProveedor.email}
              onChange={(e) => setSelectedProveedor({ ...selectedProveedor, email: e.target.value })}
              style={{ padding: 8, borderRadius: 8 }}
            />
            <label>
              Estado:
              <select
                value={String(selectedProveedor.activo)}
                onChange={(e) => setSelectedProveedor({ ...selectedProveedor, activo: e.target.value === "true" })}
                style={{ padding: 8, borderRadius: 8 }}
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={handleUpdate} style={{ padding: 8, borderRadius: 8, background: "#2a9d8f", color: "#fff", border: "none" }}>
                Guardar Cambios
              </button>
              <button onClick={() => setSelectedProveedor(null)} style={{ padding: 8, borderRadius: 8 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Main = () => {
  const [selected, setSelected] = useState(null);
  return (
    <main>
      <div className='dashboard'>
        <Cart 
          titulo="Productos"
          icon={faBoxes}
          descripcion="Gestiona el stock, precios y detalles de todos los productos."
          onClick={() => setSelected("productos")}
        />
        <Cart 
          titulo="Ventas"
          icon={faCashRegister}
          descripcion="Consulta y administra las ventas realizadas en el sistema."
          onClick={() => setSelected("ventas")}
        />
        <Cart 
          titulo="Proveedores"
          icon={faTruck}
          descripcion="Mantén un registro de tus proveedores y sus contactos."
          onClick={() => setSelected("proveedores")}
        />
        <Cart 
          titulo="Reportes"
          icon={faReceipt}
          descripcion="Visualiza y descarga reportes del sistema."
          onClick={() => setSelected("reportes")}
        />
        {/* Modificar la Card de Deudas para usar el mismo sistema */}
        <Cart 
          titulo="Deudas"
          icon={faDollarSign} // Necesitarás importar faDollarSign de fontawesome
          descripcion="Gestiona y consulta las deudas pendientes de los clientes."
          onClick={() => setSelected("deudas")}
        />
      </div>

      <Modal open={selected !== null} onClose={() => setSelected(null)}>
        {selected === "productos" && <ProductoForm />}
        {selected === "ventas" && <PuntoDeVenta />}
        {selected === "proveedores" && <ProveedorForm />}
        {selected === "reportes" && (
          <div style={{padding: 30, textAlign: 'center'}}>
            <Reportes />
          </div>
        )}
        {selected === "deudas" && <Deudas />}
      </Modal>
    </main>
  )
}

const Footer =({text}) => {
  return(
    <footer>
      {text}
    </footer>
  )
}

function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  const handleLoginSuccess = () => {
    setLoggedIn(true);
  };

  return (
    <Router>
      {loggedIn ? (
        <div>
          <Header img={logo}></Header>
          <Main></Main>
          <Footer text="© 2025 Ron Wood - Almacén de Bebidas | Panel Administrativo" />
        </div>
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
      {/* Ya no necesitamos estas rutas porque usamos el Modal */}
      {/* <Routes>
        <Route path="/deudas" element={<Deudas />} />
      </Routes> */}
    </Router>
  );
}

export default App
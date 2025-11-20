import React from "react";

function TarjetasProductos({ productos, onEditar, onEliminar }) {
  return (
    <div className="tarjetas-productos-container">
      {productos.map((producto) => (
        <div key={producto._id} className="tarjeta-producto">
          <div className="imagen-producto">
            {producto.imagen ? (
              <img 
                src={`http://localhost:4000/uploads/${producto.imagen}`}
                alt={producto.nombre}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/placeholder.png';
                  console.log('Error cargando imagen:', producto.imagen);
                }}
              />
            ) : (
              <span className="sin-imagen">Sin imagen</span>
            )}
          </div>
          <h3>{producto.nombre}</h3>
          {producto.linea && (
            <p style={{ fontSize: '0.9rem', color: '#8fb', marginTop: 4 }}>
              <strong>Línea:</strong> {producto.linea}
            </p>
          )}
          <p>
            <strong>Precio:</strong> ${producto.precio}
          </p>
          <p>
            <strong>Stock:</strong> {producto.stock}
          </p>
          <p style={{ fontSize: '0.9rem', color: '#aaa', marginTop: '8px' }}>
            <strong>Código:</strong> {producto.codigo}
          </p>
          <div
            style={{
              marginTop: "16px",
              display: "flex",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            <button onClick={() => onEditar(producto)}>Modificar</button>
            <button onClick={() => onEliminar(producto._id)}>Eliminar</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default TarjetasProductos;
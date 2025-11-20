import { useState, useEffect } from "react";
import { toast } from "react-toastify";

function Deudas() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedDeuda, setSelectedDeuda] = useState(null);
  const [montoPago, setMontoPago] = useState("");
  const [formaPago, setFormaPago] = useState("Efectivo");
  const [refreshKey, setRefreshKey] = useState(0);
  const [busqueda, setBusqueda] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [facturaUrl, setFacturaUrl] = useState(null);

  useEffect(() => {
    const fetchClientes = async () => {
      setLoading(true);
      try {
        const res = await fetch("http://localhost:4000/clientes");
        if (!res.ok) throw new Error("Error al obtener clientes");

        const data = await res.json();
        const clientesConDeuda = data.filter((c) => c.deuda > 0);
        setClientes(clientesConDeuda);
      } catch (err) {
        console.error("Error:", err);
        toast.error("Error al cargar las deudas");
      } finally {
        setLoading(false);
      }
    };

    fetchClientes();
  }, [refreshKey]);

  const handlePagarDeuda = async () => {
    if (isProcessing) return;

    try {
      if (!selectedDeuda || !montoPago) {
        toast.error("Por favor ingresa un monto");
        return;
      }

      const montoNumerico = Number(montoPago);
      if (isNaN(montoNumerico) || montoNumerico <= 0) {
        toast.error("El monto debe ser mayor a 0");
        return;
      }

      if (montoNumerico > selectedDeuda.deuda) {
        toast.error(`El monto máximo a pagar es $${selectedDeuda.deuda}`);
        return;
      }

      setIsProcessing(true);
      const nuevaDeuda = selectedDeuda.deuda - montoNumerico;

      // 🔹 PASO 1: Registrar la venta
      let ventaJson = null;
      if (selectedDeuda.productosDeuda && selectedDeuda.productosDeuda.length > 0) {
        try {
          const proporcionPago = montoNumerico / selectedDeuda.deuda;

          const productosAjustados = selectedDeuda.productosDeuda.map((p) => ({
            ...p,
            cantidad: Math.round(p.cantidad * proporcionPago * 100) / 100,
          }));

          const payload = {
            productos: productosAjustados,
            formaPago: formaPago,
            clienteId: selectedDeuda._id,
            total: montoNumerico,
            esPagoDeuda: true,
          };

          const ventaRes = await fetch("http://localhost:4000/ventas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          ventaJson = await ventaRes.json().catch(() => null);

          if (!ventaRes.ok) {
            console.error("Error registrando venta al pagar deuda:", ventaJson);
            toast.warn(
              `Pago registrado pero no se pudo crear la venta: ${
                ventaJson && ventaJson.message
                  ? ventaJson.message
                  : "problema en /ventas"
              }`
            );
          } else {
            toast.success("Venta registrada correctamente");
            if (ventaJson && ventaJson.factura) {
              setFacturaUrl(`http://localhost:4000/facturas/${ventaJson.factura}`);
            }

            try {
              const prodRes = await fetch("http://localhost:4000/productos");
              if (prodRes.ok) {
                const productosActualizados = await prodRes.json();
                console.debug(
                  "Productos actualizados tras venta de deuda, cantidad:",
                  productosActualizados.length
                );
              }
            } catch (e) {
              console.error(
                "No se pudo actualizar lista de productos tras venta de deuda",
                e
              );
            }
          }
        } catch (errVenta) {
          console.error("Excepción al intentar crear venta por pago de deuda:", errVenta);
          toast.warn("Pago registrado pero ocurrió un error al intentar crear la venta (revisa consola)");
        }
      }

      // 🔹 PASO 2: Actualizar la deuda del cliente
      const clientePayload = { deuda: nuevaDeuda };
      if (nuevaDeuda === 0) clientePayload.productosDeuda = [];

      const resCliente = await fetch(
        `http://localhost:4000/clientes/${selectedDeuda._id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(clientePayload),
        }
      );

      if (!resCliente.ok) {
        const errorData = await resCliente.json().catch(() => ({}));
        throw new Error(errorData.message || "Error al actualizar la deuda");
      }

      // 🔹 PASO 3: Registrar el pago
      const pagoPayload = {
        clienteId: selectedDeuda._id,
        clienteNombre: selectedDeuda.nombre,
        montoPagado: montoNumerico,
        formaPago,
        fecha: new Date(),
        deudaPrevia: selectedDeuda.deuda,
        deudaRestante: nuevaDeuda,
      };

      if (ventaJson && (ventaJson.ventaId || ventaJson.ventaId === 0)) {
        pagoPayload.ventaId = ventaJson.ventaId;
      }
      if (ventaJson && ventaJson.factura) {
        pagoPayload.ventaFactura = ventaJson.factura;
      }

      const resPago = await fetch("http://localhost:4000/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pagoPayload),
      });

      if (!resPago.ok) {
        const errorData = await resPago.json().catch(() => ({}));
        throw new Error(errorData.message || "Error al registrar el pago");
      }

      try {
        const event = new CustomEvent("ventas:updated", {
          detail: { monto: montoNumerico, tipo: "pago_deuda", fecha: new Date() },
        });
        window.dispatchEvent(event);
      } catch (e) {
        console.error("Error al emitir evento ventas:updated tras pago:", e);
      }

      // 🔹 PASO 4: Generar factura
      const resFactura = await fetch("http://localhost:4000/pagos/factura", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pago: {
            clienteId: selectedDeuda._id,
            clienteNombre: selectedDeuda.nombre,
            dni: selectedDeuda.dni,
            montoPagado: montoNumerico,
            formaPago,
            fecha: new Date(),
            deudaPrevia: selectedDeuda.deuda,
            deudaRestante: nuevaDeuda,
          },
        }),
      });

      if (!resFactura.ok) {
        throw new Error("Error al generar la factura");
      }

      const facturaData = await resFactura.json();
      if (facturaData.success) {
        setFacturaUrl(`http://localhost:4000/facturas/${facturaData.factura}`);
        window.open(`http://localhost:4000/facturas/${facturaData.factura}`, "_blank");
      }

      toast.success(
        nuevaDeuda === 0
          ? `¡${selectedDeuda.nombre} ha saldado su deuda!`
          : `Pago de $${montoNumerico} registrado. Deuda restante: $${nuevaDeuda}`
      );

      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error("Error:", error);
      toast.error(error.message || "Error al procesar el pago");
    } finally {
      setIsProcessing(false);
      setShowPayModal(false);
      setSelectedDeuda(null);
      setMontoPago("");
    }
  };

  const handleCloseModal = () => {
    setShowPayModal(false);
    setSelectedDeuda(null);
    setMontoPago("");
  };

  const clientesFiltrados = clientes.filter(
    (cliente) =>
      cliente.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      cliente.dni.toString().includes(busqueda)
  );

  // 🔹 Calcular total de deudas
  const totalDeudas = clientesFiltrados.reduce(
    (acc, cliente) => acc + Number(cliente.deuda || 0),
    0
  );

  return (
    <div style={{ padding: 20 }}>
      <h2>Gestión de Deudas</h2>

      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Buscar cliente por nombre o DNI"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "5px",
            border: "1px solid #ccc",
            fontSize: "16px",
          }}
        />
      </div>

      {loading ? (
        <p>Cargando deudas...</p>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 16,
            maxWidth: 1200,
            margin: "0 auto",
          }}
        >
          {clientesFiltrados.length === 0 ? (
            <p>No hay clientes con deuda que coincidan con la búsqueda</p>
          ) : (
            <>
              {clientesFiltrados.map((cliente) => (
                <div
                  key={cliente._id}
                  style={{
                    background: "#1a1a1a",
                    borderRadius: 8,
                    padding: 20,
                    border: "1px solid #333",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, marginBottom: 4 }}>{cliente.nombre}</h3>
                    <p style={{ margin: 0, color: "#999", fontSize: 14 }}>
                      DNI: {cliente.dni}
                    </p>
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 20,
                        fontWeight: "bold",
                        color: "#f4a261",
                      }}
                    >
                      Debe: ${Number(cliente.deuda).toFixed(2)}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedDeuda(cliente);
                      setShowPayModal(true);
                      setMontoPago("");
                    }}
                    style={{
                      padding: "10px 20px",
                      background: "#2a9d8f",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 16,
                    }}
                  >
                    Registrar Pago
                  </button>
                </div>
              ))}

              {/* 🔹 TOTAL DE DEUDAS ABAJO */}
              <div
                style={{
                  background: "#111",
                  border: "1px solid #444",
                  borderRadius: 8,
                  padding: 16,
                  textAlign: "right",
                  fontSize: 18,
                  fontWeight: "bold",
                  color: "#f4a261",
                  marginTop: 10,
                }}
              >
                Total general de deudas: ${totalDeudas.toFixed(2)}
              </div>
            </>
          )}
        </div>
      )}

      {showPayModal && selectedDeuda && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#1a1a1a",
              padding: 24,
              borderRadius: 12,
              width: "90%",
              maxWidth: 500,
              border: "1px solid #333",
            }}
          >
            <h3 style={{ margin: 0, marginBottom: 16 }}>Registrar Pago</h3>

            <div style={{ marginBottom: 20 }}>
              <p style={{ margin: "4px 0" }}>Cliente: {selectedDeuda.nombre}</p>
              <p style={{ margin: "4px 0" }}>DNI: {selectedDeuda.dni}</p>
              <p style={{ margin: "4px 0", color: "#f4a261", fontSize: 18 }}>
                Deuda total: ${selectedDeuda.deuda.toFixed(2)}
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8 }}>Monto a pagar:</label>
              <input
                type="number"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
                placeholder="Ingrese el monto"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 4,
                  border: "1px solid #444",
                  background: "#0f0f0f",
                  color: "white",
                  fontSize: 16,
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", marginBottom: 8 }}>
                Forma de pago:
              </label>
              <select
                value={formaPago}
                onChange={(e) => setFormaPago(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 4,
                  border: "1px solid #444",
                  background: "#0f0f0f",
                  color: "white",
                  fontSize: 16,
                }}
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Tarjeta">Tarjeta</option>
                <option value="Transferencia">Transferencia</option>
              </select>
            </div>

            {(() => {
              const montoNumerico = Number(montoPago);
              const isMontoInvalido =
                isNaN(montoNumerico) ||
                montoNumerico <= 0 ||
                montoNumerico > selectedDeuda.deuda;

              return (
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button
                    onClick={handleCloseModal}
                    disabled={isProcessing}
                    style={{
                      padding: "8px 16px",
                      background: "#333",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                      opacity: isProcessing ? 0.5 : 1,
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handlePagarDeuda}
                    disabled={isMontoInvalido || isProcessing}
                    style={{
                      padding: "8px 16px",
                      background:
                        isMontoInvalido || isProcessing ? "#555" : "#2a9d8f",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor:
                        isMontoInvalido || isProcessing ? "not-allowed" : "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    {isProcessing ? "Procesando..." : "Confirmar Pago"}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

export default Deudas;

import { useState, useEffect, useCallback } from "react";
import Chart from "react-apexcharts";

function Reportes() {
  const [fecha, setFecha] = useState("");
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState("dia");
  const [dataProductos, setDataProductos] = useState({ labels: [], series: [] });
  const [dataVentas, setDataVentas] = useState({ labels: [], series: [] });
  const [dataLineas, setDataLineas] = useState({ labels: [], series: [] });
  const [gastos, setGastos] = useState({}); // { '2025-11-09': 120 }
  const [gastoMonto, setGastoMonto] = useState("");
  const [gastoFecha, setGastoFecha] = useState("");
  const [graficosData, setGraficosData] = useState([]);
  const [topN, setTopN] = useState(10);
  const [chartHeight, setChartHeight] = useState(400);
  const [totalDia, setTotalDia] = useState(0);
  const [mostrarVentas, setMostrarVentas] = useState(false);
  const [mostrarGastosDiarios, setMostrarGastosDiarios] = useState(false);

  // Función para agrupar ventas
  const agruparVentas = useCallback((ventasList, tipoAgrup) => {
    const agrupadas = {};
    ventasList.forEach(v => {
      const fechaVenta = new Date(v.fecha);
      let key;
      
      if (tipoAgrup === "dia") {
        key = fechaVenta.toLocaleDateString('es-AR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).split('/').reverse().join('-');
      } else if (tipoAgrup === "semana") {
        const primerDiaSemana = new Date(fechaVenta);
        primerDiaSemana.setDate(fechaVenta.getDate() - fechaVenta.getDay());
        key = primerDiaSemana.toLocaleDateString('es-AR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).split('/').reverse().join('-');
      } else if (tipoAgrup === "mes") {
        key = `${fechaVenta.getFullYear()}-${String(fechaVenta.getMonth() + 1).padStart(2, "0")}`;
      }

      const venta = {
        ...v,
        total: Number(v.total || 0)
      };
      
      agrupadas[key] = agrupadas[key] || [];
      agrupadas[key].push(venta);
    });
    return agrupadas;
  }, []);

  // Función para generar data de productos
  const generarDataProductos = useCallback(async (ventasList = [], tipoAgrup = "dia", top = 10) => {
    const hoy = new Date();
    let filteredVentas = ventasList;

    if (tipoAgrup === "dia") {
      filteredVentas = ventasList.filter(v => 
        new Date(v.fecha).toDateString() === hoy.toDateString()
      );
    } else if (tipoAgrup === "semana") {
      const unaSemanaMenos = new Date(hoy.setDate(hoy.getDate() - 7));
      filteredVentas = ventasList.filter(v => 
        new Date(v.fecha) >= unaSemanaMenos
      );
    } else if (tipoAgrup === "mes") {
      const unMesMenos = new Date(hoy.setMonth(hoy.getMonth() - 1));
      filteredVentas = ventasList.filter(v => 
        new Date(v.fecha) >= unMesMenos
      );
    }

    // Excluir pagos de deuda del conteo de productos (no deben aparecer en el Top)
    filteredVentas = filteredVentas.filter(v => !(v.esPago || v.tipo === 'pago_deuda'));

    // Incluir productos que están reservados en clientes con deuda (productosDeuda)
    // Esto permite que el Top se actualice inmediatamente al asignar una deuda (reserva de stock),
    // pero los totales/ingresos seguirán dependiendo sólo de Ventas/ Pagos.
    try {
      const resClientes = await fetch("http://localhost:4000/clientes");
      if (resClientes.ok) {
        const allClientes = await resClientes.json();
        const clientesConDeuda = (Array.isArray(allClientes) ? allClientes : []).filter(c => Number(c.deuda) > 0 && Array.isArray(c.productosDeuda) && c.productosDeuda.length > 0);

        // Convertir cada productosDeuda en una "venta" temporal con fecha actual para que pase los filtros por fecha
        const pseudoVentas = clientesConDeuda.map(c => ({
          productos: c.productosDeuda,
          fecha: new Date().toISOString(),
          tipo: 'deuda_asignada',
          clienteId: c._id
        }));

        filteredVentas = filteredVentas.concat(pseudoVentas);
      }
    } catch (err) {
      console.error('No se pudieron obtener clientes para incluir productosDeuda en Top:', err);
    }

    const contador = {};
    filteredVentas.forEach(venta => {
      (venta.productos || []).forEach(p => {
        const nombre = String(p.nombre || "");
        // Si no viene cantidad, contar como 1 unidad
        contador[nombre] = (contador[nombre] || 0) + (p.cantidad || 1);
      });
    });

    const topProductos = Object.entries(contador)
      .sort((a, b) => b[1] - a[1])
      .slice(0, top);

    setDataProductos({
      labels: topProductos.map(p => p[0]),
      series: [{
        name: "Cantidad vendida",
        data: topProductos.map(p => p[1])
      }]
    });
  }, []);

  // Función para generar data de ventas
  const generarDataVentas = useCallback((ventasList = [], tipoAgrup = "dia") => {
    const agrupadas = agruparVentas(ventasList, tipoAgrup);
    const labels = Object.keys(agrupadas).sort();
    const data = labels.map(k =>
      agrupadas[k].reduce((acc, v) => acc + (v.total || 0), 0)
    );

    // Series de gastos: buscar en el mapa `gastos` por cada label
    const gastosData = labels.map(k => Number(gastos[k] || 0));

    setDataVentas({
      labels,
      series: [
        { name: "Total ventas", data },
        { name: "Gastos", data: gastosData }
      ]
    });
  }, [agruparVentas, gastos]);

  // Agrupar ventas por línea (categoría de producto) y calcular porcentaje de ingreso
  const generarDataLineas = useCallback(async (ventasList = []) => {
    try {
      // Obtener catálogo de productos para conocer la 'linea' de cada codigo
      const resProd = await fetch('http://localhost:4000/productos');
      const productosArr = resProd.ok ? await resProd.json() : [];
      const mapaLinea = {};
      (Array.isArray(productosArr) ? productosArr : []).forEach(p => {
        if (p && p.codigo) mapaLinea[p.codigo] = p.linea || 'Sin línea';
      });

      const totals = {}; // linea -> total revenue
      ventasList.forEach(v => {
        (v.productos || []).forEach(p => {
          // Ignorar pagos mapeados (codigo que comienza con pago_)
          if (String(p.codigo || '').startsWith('pago_')) return;
          const linea = mapaLinea[p.codigo] || (p.linea || 'Sin línea');
          const ingreso = Number(p.precio || 0) * Number(p.cantidad || 1);
          totals[linea] = (totals[linea] || 0) + ingreso;
        });
      });

      const labels = Object.keys(totals).sort((a,b) => totals[b] - totals[a]);
      const values = labels.map(l => totals[l]);
      const totalGeneral = values.reduce((a,b) => a + b, 0) || 1;
      const porcentajes = values.map(v => Math.round((v / totalGeneral) * 100)); // sin decimales

      setDataLineas({ labels, series: porcentajes });
    } catch (err) {
      console.error('Error generando data por lineas', err);
      setDataLineas({ labels: [], series: [] });
    }
  }, []);

  // Efecto para cargar datos iniciales
  useEffect(() => {
    const desde = '2025-01-01';
    const hasta = '2025-12-31';
    Promise.all([
      fetch(`http://localhost:4000/reportes/graficos?desde=${desde}&hasta=${hasta}`).then(r => r.json()),
      fetch(`http://localhost:4000/gastos?desde=${desde}&hasta=${hasta}`).then(r => r.json())
    ]).then(([graficos, gastosArr]) => {
      setGraficosData(graficos);
      // construir mapa de gastos por fecha
      const mapa = {};
      (Array.isArray(gastosArr) ? gastosArr : []).forEach(g => {
        const k = formatDateKey(g.fecha);
        if (!k) return;
        mapa[k] = (mapa[k] || 0) + Number(g.monto || 0);
      });
      setGastos(mapa);
      generarDataVentas(graficos, tipo);
      generarDataProductos(graficos, tipo);
      // Generar resumen por líneas (porcentaje sobre ingresos)
      generarDataLineas(graficos);
    }).catch(err => console.error(err));
  }, [tipo, generarDataVentas, generarDataProductos]);

  // Efecto para cargar ventas por fecha
  useEffect(() => {
    if (fecha) {
      setLoading(true);
      fetch(`http://localhost:4000/reportes?fecha=${fecha}`)
        .then(res => res.json())
        .then(data => {
          setVentas(data);
          setLoading(false);
        }).catch(() => setLoading(false));
    } else {
      setVentas([]);
    }
  }, [fecha]);

  // 🔹 Efecto para actualización en tiempo real cuando se paga una deuda
  useEffect(() => {
    const handler = async (event) => {
      console.log('🔔 Evento recibido en Reportes:', event.detail);
      
      try {
        // Esperar un poco para que el servidor procese
        await new Promise(resolve => setTimeout(resolve, 800));

        // SIEMPRE refrescar los gráficos
        const resGraficos = await fetch("http://localhost:4000/reportes/graficos?desde=2025-01-01&hasta=2025-12-31");
        
        if (resGraficos.ok) {
          const data = await resGraficos.json();
          console.log('✅ Datos actualizados:', data.length, 'ventas totales');
          setGraficosData(data);
          generarDataVentas(data, tipo);
          generarDataProductos(data, tipo, topN);
        }

        // Si hay fecha seleccionada, también refrescar la tabla
        if (fecha) {
          const resVentas = await fetch(`http://localhost:4000/reportes?fecha=${fecha}`);
          if (resVentas.ok) {
            const ventasData = await resVentas.json();
            console.log('✅ Ventas de la fecha actualizada');
            setVentas(ventasData);
          }
        }
      } catch (err) {
        console.error('❌ Error refrescando reportes:', err);
      }
    };

    console.log('👂 Registrando listener ventas:updated');
    window.addEventListener('ventas:updated', handler);
    
    return () => {
      console.log('👋 Removiendo listener ventas:updated');
      window.removeEventListener('ventas:updated', handler);
    };
  }, [fecha, tipo, topN, generarDataVentas, generarDataProductos]);

  // Efecto para totales del día
  useEffect(() => {
    if (!fecha) {
      setTotalDia(0);
      return;
    }
    
    const fechaSeleccionada = new Date(fecha);
    const ventasDelDia = ventas.filter(venta => {
      const fechaVenta = new Date(venta.fecha);
      return fechaVenta.toDateString() === fechaSeleccionada.toDateString();
    });
    
    const total = ventasDelDia.reduce((total, venta) => total + venta.total, 0);
    setTotalDia(total);
  }, [fecha, ventas]);

  // Efecto para altura responsiva
  useEffect(() => {
    function handleResize() {
      const w = window.innerWidth;
      if (w <= 420) setChartHeight(220);
      else if (w <= 768) setChartHeight(300);
      else setChartHeight(400);
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Obtener/Guardar gastos desde el servidor
  const formatDateKey = (d) => {
    const dt = new Date(d);
    if (isNaN(dt)) return null;
    return dt.toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
  };

  const fetchGastos = async (desde, hasta) => {
    try {
      const url = `http://localhost:4000/gastos${desde && hasta ? `?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) return setGastos({});
      const arr = await res.json();
      // Agrupar por fecha key
      const mapa = {};
      (Array.isArray(arr) ? arr : []).forEach(g => {
        const k = formatDateKey(g.fecha);
        if (!k) return;
        mapa[k] = (mapa[k] || 0) + Number(g.monto || 0);
      });
      setGastos(mapa);
    } catch (err) {
      console.error('Error cargando gastos desde servidor', err);
      setGastos({});
    }
  };

  const handleAddGasto = async () => {
    const monto = Number(gastoMonto || 0);
    if (!monto || monto <= 0) return alert('Ingrese un monto válido');
    const fechaToSend = gastoFecha ? new Date(gastoFecha).toISOString() : new Date().toISOString();
    try {
      const res = await fetch('http://localhost:4000/gastos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: fechaToSend, monto })
      });
      if (!res.ok) throw new Error('Error al crear gasto');
      // refrescar gastos usando el mismo rango que usamos en graficos
      await fetchGastos('2025-01-01', '2025-12-31');
      setGastoMonto(''); setGastoFecha('');
    } catch (err) {
      console.error('Error agregando gasto:', err);
      alert('No se pudo agregar el gasto');
    }
  };

  const handleRemoveGasto = async (key) => {
    try {
      const res = await fetch(`http://localhost:4000/gastos?fecha=${encodeURIComponent(key)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error eliminando gasto');
      await fetchGastos('2025-01-01', '2025-12-31');
    } catch (err) {
      console.error('Error eliminando gasto:', err);
      alert('No se pudo eliminar el gasto');
    }
  };

  const formatNumber = (num) => {
    const n = Number(num || 0);
    return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const abrirFactura = async (factura) => {
    if (!factura) return alert("No hay factura para esta venta.");
    const url = `http://localhost:4000/facturas/${encodeURIComponent(factura)}`;
    try {
      const win = window.open(url, "_blank");
      if (!win) {
        const res = await fetch(url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      }
    } catch (err) {
      console.error(err);
      alert("Error al abrir la factura.");
    }
  };

  const opcionesProductos = {
    chart: { type: 'bar', background: 'transparent', toolbar: { show: false }, height: chartHeight },
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: chartHeight <= 220 ? '45%' : chartHeight <= 300 ? '55%' : '65%',
        distributed: true
      }
    },
    xaxis: { categories: dataProductos.labels, labels: { style: { colors: '#999', fontSize: chartHeight <= 220 ? '9px' : '11px' } } },
    yaxis: { labels: { style: { colors: '#999', fontSize: chartHeight <= 220 ? '10px' : '11px' } } },
    dataLabels: {
      enabled: true,
      formatter: function (val) { return formatNumber(val); },
      style: { colors: ['#fff'], fontSize: chartHeight <= 220 ? '9px' : '11px', fontWeight: 600 }
    },
    tooltip: { theme: 'dark', y: { formatter: (val) => formatNumber(val) + ' unidades' } },
    legend: { show: false },
    colors: ['#ff6b6b', '#ee5a6f', '#c44569', '#a83f5a', '#8b3a4b', '#6e2e3c', '#ff8787', '#fa8072', '#e57373', '#ef5350'],
    grid: { borderColor: 'rgba(255,255,255,0.08)' },
    responsive: [
      {
        breakpoint: 420,
        options: {
          chart: { height: 200 },
          plotOptions: { bar: { barHeight: '40%' } },
          xaxis: { labels: { style: { fontSize: '9px' } } },
          yaxis: { labels: { style: { fontSize: '9px' } } }
        }
      },
      {
        breakpoint: 768,
        options: {
          chart: { height: 280 },
          plotOptions: { bar: { barHeight: '50%' } },
          xaxis: { labels: { style: { fontSize: '10px' } } }
        }
      }
    ]
  };

  const opcionesVentas = {
    chart: { type: 'bar', background: 'transparent', toolbar: { show: false }, height: chartHeight },
    xaxis: { categories: dataVentas.labels, labels: { style: { colors: '#ccc', fontSize: chartHeight <= 220 ? '9px' : '11px' }, rotate: -45, hideOverlappingLabels: true } },
    yaxis: { labels: { formatter: (val) => '$' + formatNumber(val), style: { colors: '#ccc', fontSize: chartHeight <= 220 ? '9px' : '11px' } } },
    dataLabels: {
      enabled: true,
      formatter: function (val) { if (val < 5000) return ''; return '$' + formatNumber(val); },
      style: { colors: ['#fff'], fontSize: chartHeight <= 220 ? '9px' : '11px', fontWeight: 600 },
      offsetY: -6
    },
    plotOptions: { bar: { borderRadius: 6, columnWidth: chartHeight <= 220 ? '80%' : '60%', dataLabels: { position: 'top' } } },
    tooltip: { theme: 'dark', y: { formatter: (val) => '$' + formatNumber(val) } },
    colors: ['#ff6b6b', '#4dd0e1'],
    legend: { show: true, position: 'top', labels: { colors: ['#ccc'] } },
    grid: { borderColor: 'rgba(255,255,255,0.08)' },
    responsive: [
      {
        breakpoint: 420,
        options: {
          chart: { height: 200 },
          plotOptions: { bar: { columnWidth: '90%' } },
          xaxis: { labels: { style: { fontSize: '9px' }, rotate: -30 } },
          yaxis: { labels: { style: { fontSize: '9px' } } }
        }
      },
      {
        breakpoint: 768,
        options: {
          chart: { height: 280 },
          plotOptions: { bar: { columnWidth: '70%' } },
          xaxis: { labels: { style: { fontSize: '10px' } } }
        }
      }
    ]
  };

  const opcionesLineas = {
    chart: { type: 'donut', background: 'transparent', toolbar: { show: false }, height: 350 },
    labels: dataLineas.labels,
    legend: { position: 'bottom', labels: { colors: ['#fff'] } },
    dataLabels: { enabled: true, formatter: (val, opts) => `${Math.round(val)}%` },
    colors: ['#0284c7', '#06b6d4', '#34d399', '#f59e0b', '#ef4444', '#a78bfa', '#fb7185'],
    tooltip: { theme: 'dark' }
  };

  return (
    <div className="reportes-page" style={{ background: "#000", minHeight: "100vh", padding: "40px 20px" }}>
      <div className="reportes-inner" style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="report-header" style={{ textAlign: "center", marginBottom: 24, padding: "18px 12px" }}>
          <h1 style={{ color: "#fff", fontWeight: 700, margin: 0, fontSize: 28 }}>
            Reportes de Ventas
          </h1>
          <p style={{ color: "rgba(255,255,255,0.7)", marginTop: 6, fontSize: 13 }}>
            Analiza tus ventas y productos más populares
          </p>
        </div>

        <div className="report-section" style={{ 
          background: "rgba(30, 30, 30, 0.9)", 
          padding: "12px 14px", 
          borderRadius: 8, 
          marginBottom: 12,
          border: "1px solid rgba(255, 255, 255, 0.06)"
        }}>
          <h3 style={{ margin: "0 0 12px 0", color: "#fff", fontSize: 18, fontWeight: 600 }}>
            Consultar Ventas por Fecha
          </h3>
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            style={{ 
              width: "100%", 
              maxWidth: 220,
              padding: "8px 10px", 
              borderRadius: 6, 
              border: "1px solid rgba(255,255,255,0.12)", 
              fontSize: 13,
              background: "rgba(0,0,0,0.35)",
              color: "#fff"
            }}
          />
        </div>

        <div className="report-section" style={{ 
          background: "rgba(30, 30, 30, 0.9)", 
          padding: "12px 14px", 
          borderRadius: 8, 
          marginBottom: 16,
          border: "1px solid rgba(255, 255, 255, 0.06)"
        }}>
          <h3 style={{ margin: "0 0 12px 0", color: "#fff", fontSize: 18, fontWeight: 600 }}>
            Configuración de Gráficos
          </h3>
          <p style={{ margin: "0 0 12px 0", color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
            Ajusta cómo quieres visualizar los datos en los gráficos
          </p>
          
          <div className="filters-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div style={{ padding: 8, background: "rgba(0, 0, 0, 0.28)", borderRadius: 6, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
              <label style={{ display: "block", marginBottom: 10, color: "#fff", fontSize: 14, fontWeight: 600 }}>
                Cantidad de Productos
              </label>
              <p style={{ margin: "0 0 10px 0", color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                Cuántos productos quieres ver en el ranking
              </p>
              <select 
                value={topN} 
                onChange={e => setTopN(Number(e.target.value))}
                style={{ 
                  width: "100%", 
                  padding: "8px 10px", 
                  borderRadius: 6, 
                  border: "1px solid rgba(255,255,255,0.12)",
                  fontSize: 13,
                  cursor: "pointer",
                  background: "rgba(0,0,0,0.4)",
                  color: "#fff"
                }}
              >
                <option value={5}>Top 5 productos</option>
                <option value={10}>Top 10 productos</option>
                <option value={15}>Top 15 productos</option>
              </select>
            </div>

            <div style={{ padding: 8, background: "rgba(0, 0, 0, 0.28)", borderRadius: 6, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
              <label style={{ display: "block", marginBottom: 10, color: "#fff", fontSize: 14, fontWeight: 600 }}>
                Gastos diarios
              </label>
              <p style={{ margin: "0 0 10px 0", color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                Agrega un gasto para un día (aparecerá como barra celeste en Total de Ventas)
              </p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input type="date" value={gastoFecha} onChange={e => setGastoFecha(e.target.value)} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#fff' }} />
                <input type="number" placeholder="Monto" value={gastoMonto} onChange={e => setGastoMonto(e.target.value)} style={{ width: 110, padding: 8, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#fff' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <button onClick={handleAddGasto} style={{ padding: '8px 12px', background: '#00bcd4', color: '#012', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>Agregar gasto</button>
                <button onClick={() => { setGastoMonto(''); setGastoFecha(''); }} style={{ padding: '8px 12px', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6 }}>Limpiar</button>
              </div>
              {Object.keys(gastos).length > 0 && (
                <button 
                  onClick={() => setMostrarGastosDiarios(!mostrarGastosDiarios)}
                  style={{ 
                    marginTop: 12,
                    width: '100%',
                    padding: '8px 12px', 
                    background: mostrarGastosDiarios ? 'rgba(0,188,212,0.2)' : 'rgba(0,188,212,0.12)',
                    color: '#00bcd4',
                    border: '1px solid rgba(0,188,212,0.3)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 13,
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8
                  }}
                  onMouseEnter={e => {
                    e.target.style.background = 'rgba(0,188,212,0.25)';
                    e.target.style.borderColor = 'rgba(0,188,212,0.5)';
                  }}
                  onMouseLeave={e => {
                    e.target.style.background = mostrarGastosDiarios ? 'rgba(0,188,212,0.2)' : 'rgba(0,188,212,0.12)';
                    e.target.style.borderColor = 'rgba(0,188,212,0.3)';
                  }}
                >
                  {mostrarGastosDiarios ? 'Ocultar Gastos Diarios' : 'Mostrar Gastos Diarios'}
                  <span style={{ fontSize: '16px', marginTop: '0px' }}>
                    {mostrarGastosDiarios ? '▼' : '▶'}
                  </span>
                </button>
              )}
              {Object.keys(gastos).length > 0 && mostrarGastosDiarios && (
                <div style={{ marginTop: 10 }}>
                  <h5 style={{ margin: 0, color: '#fff', fontSize: 13 }}>Gastos guardados</h5>
                  <ul style={{ listStyle: 'none', padding: 0, marginTop: 8 }}>
                    {Object.entries(gastos).map(([k, v]) => (
                      <li key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, marginBottom: 6 }}>
                        <span style={{ color: '#fff' }}>{k}</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <span style={{ color: '#4dd0e1', fontWeight: 700 }}>${Number(v).toFixed(2)}</span>
                          <button onClick={() => handleRemoveGasto(k)} style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer' }}>Eliminar</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div style={{ padding: 8, background: "rgba(0, 0, 0, 0.28)", borderRadius: 6, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
              <label style={{ display: "block", marginBottom: 10, color: "#fff", fontSize: 14, fontWeight: 600 }}>
                Periodo de Agrupación
              </label>
              <p style={{ margin: "0 0 10px 0", color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                Agrupa las ventas por día, semana o mes
              </p>
              <select 
                value={tipo} 
                onChange={e => setTipo(e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "8px 10px", 
                  borderRadius: 6, 
                  border: "1px solid rgba(255,255,255,0.12)",
                  fontSize: 13,
                  cursor: "pointer",
                  background: "rgba(0,0,0,0.4)",
                  color: "#fff"
                }}
              >
                <option value="dia">Último día</option>
                <option value="semana">Última semana</option>
                <option value="mes">Último mes</option>
              </select>
            </div>
          </div>
        </div>

        {loading && (
          <div style={{ 
            background: "rgba(30, 30, 30, 0.9)", 
            padding: 18, 
            borderRadius: 8, 
            textAlign: "center",
            border: "1px solid rgba(255, 255, 255, 0.06)"
          }}>
            <p style={{ color: "#fff", fontSize: 14, margin: 0 }}>Cargando ventas...</p>
          </div>
        )}

        {!loading && fecha && ventas.length === 0 && (
          <div style={{ 
            background: "rgba(30, 30, 30, 0.9)", 
            padding: 24, 
            borderRadius: 12, 
            textAlign: "center",
            border: "1px solid rgba(255, 193, 7, 0.3)"
          }}>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, margin: 0 }}>
              No hay ventas registradas para la fecha seleccionada
            </p>
          </div>
        )}

        {!loading && ventas.length > 0 && (
          <div style={{ 
            background: "rgba(30, 30, 30, 0.9)", 
            padding: 12, 
            borderRadius: 8, 
            marginBottom: 16,
            border: "1px solid rgba(255, 255, 255, 0.06)"
          }}>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              marginBottom: mostrarVentas ? "12px" : 0 
            }}>
              <h3 style={{ margin: 0, color: "#fff", fontSize: 16, fontWeight: 600 }}>
                Ventas del {new Date(fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
              </h3>
              <button
                onClick={() => setMostrarVentas(!mostrarVentas)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={e => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.06)';
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                }}
              >
                {mostrarVentas ? 'Ocultar Ventas' : 'Mostrar Ventas'}
                <span style={{ fontSize: '18px', marginTop: '-2px' }}>
                  {mostrarVentas ? '▼' : '▶'}
                </span>
              </button>
            </div>
            
            {mostrarVentas && (
              <div style={{ 
                overflowX: "auto",
                maxHeight: "calc(100vh - 400px)",
                overflowY: "auto",
                marginRight: "-12px",
                marginLeft: "-12px",
                paddingLeft: "12px",
                paddingRight: "12px"
              }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "rgba(0, 0, 0, 0.4)" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", color: "#fff", fontWeight: 600, fontSize: 13, borderTopLeftRadius: 6 }}>Hora</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", color: "#fff", fontWeight: 600, fontSize: 13 }}>Productos</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", color: "#fff", fontWeight: 600, fontSize: 13 }}>Total</th>
                    <th style={{ padding: "8px 10px", textAlign: "center", color: "#fff", fontWeight: 600, fontSize: 13, borderTopRightRadius: 6 }}>Factura</th>
                  </tr>
                </thead>
                <tbody>
                  {ventas.map((venta, idx) => {
                    const isPago = venta.tipo === 'pago_deuda';
                    const baseBg = isPago ? (idx % 2 === 0 ? 'rgba(0,188,212,0.06)' : 'rgba(0,188,212,0.04)') : (idx % 2 === 0 ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.3)');
                    const hoverBg = isPago ? 'rgba(0,188,212,0.14)' : 'rgba(255, 107, 107, 0.15)';
                    const qtyBg = isPago ? 'rgba(0,188,212,0.12)' : 'rgba(255, 107, 107, 0.2)';
                    const priceBg = isPago ? 'rgba(0,188,212,0.12)' : 'rgba(76, 175, 80, 0.2)';
                    const totalColor = isPago ? '#00bcd4' : '#4caf50';
                    const buttonBorder = isPago ? '1px solid rgba(0,188,212,0.25)' : '1px solid rgba(255, 107, 107, 0.3)';
                    const buttonBg = isPago ? 'rgba(0,188,212,0.12)' : 'rgba(255, 107, 107, 0.2)';

                    return (
                      <tr key={venta._id} style={{ background: baseBg, transition: 'background 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = hoverBg}
                        onMouseLeave={e => e.currentTarget.style.background = baseBg}
                      >
                        <td style={{ padding: '8px 10px', fontSize: 13, color: '#fff', fontWeight: 500 }}>
                          {new Date(venta.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          {isPago ? (
                            <div style={{
                              padding: '8px 12px',
                              background: 'rgba(0, 188, 212, 0.1)',
                              borderRadius: 6,
                              border: '1px solid rgba(0, 188, 212, 0.3)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4
                            }}>
                              <div style={{ color: '#00bcd4', fontWeight: 700, fontSize: 13 }}>
                                💳 Pago de Deuda
                              </div>
                              <div style={{ color: '#fff', fontSize: 12 }}>
                                {venta.productos[0]?.nombre?.replace('pago deuda/', '') || 'Cliente'}
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {(venta.productos || []).map((p, i) => (
                                  <div key={i} style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  padding: '4px 8px',
                                  background: 'rgba(255, 255, 255, 0.03)',
                                  borderRadius: 6,
                                  border: '1px solid rgba(255, 255, 255, 0.06)'
                                }}>
                                  <span style={{ flex: 1, color: '#fff', fontSize: 13 }}>
                                    <strong>{p.nombre}</strong>
                                  </span>
                                  <span style={{
                                    padding: '3px 8px',
                                    background: qtyBg,
                                    borderRadius: 4,
                                    color: '#fff',
                                    fontSize: 12,
                                    fontWeight: 600
                                  }}>
                                    x{p.cantidad}
                                  </span>
                                  <span style={{
                                    padding: '3px 8px',
                                    background: priceBg,
                                    borderRadius: 4,
                                    color: '#fff',
                                    fontSize: 12,
                                    fontWeight: 600
                                  }}>
                                    ${formatNumber(p.precio)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px', fontSize: 15, color: totalColor, fontWeight: 700 }}>
                          ${formatNumber(venta.total)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <button
                            onClick={() => abrirFactura(venta.factura)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 6,
                              border: buttonBorder,
                              background: buttonBg,
                              color: '#fff',
                              cursor: 'pointer',
                              fontSize: 13,
                              fontWeight: 600,
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => {
                              e.target.style.background = isPago ? 'rgba(0,188,212,0.2)' : 'rgba(255, 107, 107, 0.4)';
                              e.target.style.border = isPago ? '1px solid rgba(0,188,212,0.4)' : '1px solid rgba(255, 107, 107, 0.5)';
                            }}
                            onMouseLeave={e => {
                              e.target.style.background = buttonBg;
                              e.target.style.border = buttonBorder;
                            }}
                          >
                            Ver PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        <div className="charts-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))", gap: 24 }}>
          <div className="report-section" style={{ 
            background: "rgba(30, 30, 30, 0.9)", 
            padding: 24, 
            borderRadius: 12, 
            border: "1px solid rgba(255, 255, 255, 0.1)"
          }}>
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: "#fff", fontSize: 18, fontWeight: 600 }}>
                Top {topN} Productos Más Vendidos
              </h3>
              <p style={{ margin: "6px 0 0 0", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                Agrupado por: <strong>{tipo}</strong>
              </p>
            </div>
            <Chart
              options={opcionesProductos}
              series={dataProductos.series && dataProductos.series.length ? dataProductos.series : [{ name: "Cantidad", data: [] }]}
              type="bar"
              height={chartHeight}
            />
          </div>

          <div className="report-section" style={{ 
            background: "rgba(30, 30, 30, 0.9)", 
            padding: 24, 
            borderRadius: 12, 
            border: "1px solid rgba(255, 255, 255, 0.1)" }}
          >
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: "#fff", fontSize: 18, fontWeight: 600 }}>
                Total de Ventas
              </h3>
              <p style={{ margin: "6px 0 0 0", color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                Agrupado por: <strong>{tipo}</strong>
              </p>
            </div>
            <Chart
              options={opcionesVentas}
              series={
                dataVentas.series && dataVentas.series.length
                  ? dataVentas.series
                  : [{ name: "Total ventas", data: [] }]
              }
              type="bar"
              height={chartHeight}
            />
          </div>
        </div>

        {/* Resumen por líneas (porcentaje sobre ingresos) */}
        <div style={{ marginTop: 20, maxWidth: 900, margin: '20px auto' }}>
          <div style={{ background: 'rgba(30,30,30,0.9)', padding: 18, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 style={{ margin: 0, color: '#fff', fontSize: 16, fontWeight: 600 }}>Distribución de Ingresos por Línea</h3>
            <p style={{ margin: '6px 0 12px 0', color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>Porcentaje del total de ingresos por línea de producto</p>
            {dataLineas.labels && dataLineas.labels.length ? (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 360px' }}>
                  <Chart options={opcionesLineas} series={dataLineas.series || []} type="donut" height={280} />
                </div>
                <div style={{ flex: 1 }}>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {dataLineas.labels.map((lab, i) => (
                      <li key={lab} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', marginBottom: 8 }}>
                        <span style={{ color: '#fff' }}>{lab}</span>
                        <span style={{ color: '#cbd5e1', fontWeight: 700 }}>{dataLineas.series[i]}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>No hay datos para mostrar por línea.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Reportes;
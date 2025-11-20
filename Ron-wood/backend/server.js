import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import PDFDocument from "pdfkit";
import fs from "fs";
import express from "express";
import multer from "multer";
import path from "path";

dotenv.config({ path: './backend/.env' });

// ============================
// 🔹 Conexiones a MongoDB
// ============================


// Conexión Login + Proveedores con manejo de errores
const connLogin = mongoose.createConnection(process.env.MONGO_URI_LOGIN, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
connLogin.on("error", (err) => {
  if (err.message && err.message.match(/Authentication failed/i)) {
    console.error("❌ Error de autenticación en MongoDB Login/Proveedores: usuario o contraseña incorrectos o sin permisos");
  } else if (err.message && err.message.match(/failed to connect/i)) {
    console.error("❌ No se pudo conectar a MongoDB Login/Proveedores: verifica la URI, el clúster o la red");
  } else {
    console.error("❌ Error de conexión a MongoDB Login/Proveedores:", err.message);
  }
});
connLogin.once("open", () => console.log("✅ MongoDB Login/Proveedores conectado"));

// Conexión Productos
const connProductos = mongoose.createConnection(process.env.MONGO_URI_PRODUCTOS, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
connProductos.once("open", () => console.log("✅ MongoDB Productos conectado"));

// Conexión Reportes
const connReportes = mongoose.createConnection(process.env.MONGO_URI_REPORTES, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: "reportes"
});



connReportes.once("open", () => console.log("✅ MongoDB Reportes conectado"));

// ============================
// 🔹 Modelos
// ============================

// Usuarios
const UserSchema = new mongoose.Schema({ username: String, password: String });
const User = connLogin.model("Login", UserSchema, "Login");

// Proveedores
const ProveedorSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  telefono: String,
  email: String,
  activo: { type: Boolean, default: true }
});
const Proveedor = connLogin.model("Proveedor", ProveedorSchema, "Proveedores");

// Productos
const ProductoSchema = new mongoose.Schema({
  codigo: { type: String, required: true, unique: true },
  nombre: String,
  precio: Number,
  precioCompra: Number,
  precioOriginal: Number, // 🆕 Para guardar el precio antes del aumento
  ganancia: Number,
  linea: { type: String },
  lineaId: { type: String },
  stock: Number,
  imagen: String
});
const Producto = connProductos.model("Producto", ProductoSchema, "ProductosRW");

// Líneas (categorías con porcentaje)
const LineaSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  porcentaje: { type: Number, default: 0 } // porcentaje en %
});
const Linea = connProductos.model("Linea", LineaSchema, "Lineas");

const VentaSchema = new mongoose.Schema({
  productos: [
    {
      codigo: String,
      nombre: String,
      precio: Number,
      cantidad: Number
    }
  ],
  total: Number,
  formaPago: { type: String, default: "Efectivo" },
  descuentoPorcentaje: { type: Number, default: 0 }, // <-- 👈 Porcentaje de descuento
  descuentoMonto: { type: Number, default: 0 }, // <-- 👈 Monto calculado del descuento
  tipo: { type: String, default: 'venta' }, // 'venta' | 'pago_deuda'
  fecha: { type: Date, default: Date.now },
  factura: String
});

const Venta = connReportes.model("Venta", VentaSchema, "Ventas");

// ============================
// 🔹 Modelo Cliente
// ============================
const ClienteSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  dni: { type: String, required: true },
  deuda: { type: Number, default: 0 },
  // Guardar los productos relacionados a la deuda para poder registrarlos cuando se pague
  productosDeuda: [{
    codigo: String,
    nombre: String,
    precio: Number,
    cantidad: Number
  }]
});

const Cliente = connLogin.model("Cliente", ClienteSchema, "Clientes");

// Modelo de Pagos
const PagoSchema = new mongoose.Schema({
  clienteId: { type: String, required: true },
  clienteNombre: { type: String, required: true },
  montoPagado: { type: Number, required: true },
  formaPago: { type: String, required: true },
  // referencias opcionales a la venta registrada cuando el pago genera una venta
  ventaId: { type: String },
  ventaFactura: { type: String },
  fecha: { type: Date, default: Date.now },
  deudaPrevia: { type: Number, required: true },
  deudaRestante: { type: Number, required: true }
});

const Pago = connReportes.model("Pago", PagoSchema, "Pagos");

// Modelo de Gastos
const GastoSchema = new mongoose.Schema({
  fecha: { type: Date, required: true },
  monto: { type: Number, required: true },
  descripcion: { type: String }
});

const Gasto = connReportes.model("Gasto", GastoSchema, "Gastos");

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    if (!fs.existsSync('./uploads')) {
      fs.mkdirSync('./uploads');
    }
    cb(null, './uploads');
  },
  filename: function(req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function(req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif|webp/;
const mimetype = /image\/(jpeg|jpg|png|gif|webp)/.test(file.mimetype);
const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

if (mimetype && extname) {
  return cb(null, true);
}
cb(new Error('Solo se permiten archivos de imagen (jpeg, jpg, png, gif, webp)'));
  }
});

const app = express();
app.use(cors());
app.use(express.json());
app.use('/facturas', express.static('./facturas'));
app.use('/uploads', express.static('./uploads')); // Servir archivos estáticos de uploads

// ============================
// 🔹 Rutas Login
// ============================
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username: username.trim() });

  if (!user) return res.json({ success: false, message: "Usuario no encontrado " });

  if (user.password === password.trim()) {
    res.json({ success: true, message: "Login exitoso " });
  } else {
    res.json({ success: false, message: "Usuario o contraseña incorrectos " });
  }
});

// ============================
// 🔹 Rutas Proveedores
// ============================

app.post("/proveedores", async (req, res) => {
  try {
    const { nombre, telefono, email, activo } = req.body;
    const nuevoProveedor = new Proveedor({ nombre, telefono, email, activo });
    await nuevoProveedor.save();
    res.json({ success: true, message: "Proveedor agregado ", proveedor: nuevoProveedor });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error al guardar proveedor ", error: err.message });
  }
});

app.get("/proveedores", async (req, res) => {
  try {
    const proveedores = await Proveedor.find();
    res.json(proveedores);
  } catch (err) {
    res.status(500).json({ success: false, message: "Error al obtener proveedores ", error: err.message });
  }
});

app.put("/proveedores/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, telefono, email, activo } = req.body;
  try {
    const proveedorActualizado = await Proveedor.findByIdAndUpdate(
      id,
      { nombre, telefono, email, activo },
      { new: true }
    );
    if (!proveedorActualizado) {
      return res.status(404).json({ success: false, message: "Proveedor no encontrado " });
    }
    res.json({ success: true, message: "Proveedor actualizado ", proveedor: proveedorActualizado });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error al actualizar proveedor ", error: err.message });
  }
});

// ============================
// 🔹 Rutas Productos
// ============================

app.post("/productos", async (req, res) => {
  const { codigo, nombre, precio, precioCompra, stock, imagen, linea, lineaId } = req.body;
  try {
    let producto = await Producto.findOne({ codigo });
    if (producto) {
      producto.stock = (Number(producto.stock) || 0) + Number(stock || 0);

      if (precioCompra !== undefined && precioCompra !== null && !isNaN(Number(precioCompra))) {
        producto.precioCompra = Number(precioCompra);
      }
      if (precio !== undefined && precio !== null && !isNaN(Number(precio))) {
        producto.precio = Number(precio);
      }

      // Recalcular ganancia cuando haya precio y precioCompra válidos
      if (!isNaN(Number(producto.precio)) && !isNaN(Number(producto.precioCompra))) {
        producto.ganancia = Number(producto.precio) - Number(producto.precioCompra);
      }

      await producto.save();
      return res.status(200).json({ message: "Stock actualizado", producto });
    } else {
      const nuevoProducto = new Producto({
        codigo,
        nombre,
        precio: precio !== undefined ? Number(precio) : undefined,
        precioCompra: precioCompra !== undefined ? Number(precioCompra) : undefined,
        linea: linea || undefined,
        lineaId: lineaId || undefined,
        stock: Number(stock || 0),
        imagen
      });

      // Calcular ganancia si hay ambos precios
      if (!isNaN(Number(nuevoProducto.precio)) && !isNaN(Number(nuevoProducto.precioCompra))) {
        nuevoProducto.ganancia = Number(nuevoProducto.precio) - Number(nuevoProducto.precioCompra);
      }

      await nuevoProducto.save();
      return res.status(201).json({ message: "Producto creado", producto: nuevoProducto });
    }
  } catch (error) {
    res.status(500).json({ message: "Error al agregar producto", error: error.message || error });
  }
});

app.get("/productos", async (req, res) => {
  try {
    const { codigo, codigos } = req.query;
    
    // 🔹 OPTIMIZACIÓN: Si vienen múltiples códigos (separados por coma), buscar todos de una vez
    if (codigos) {
      const codigosArray = codigos.split(',').map(c => c.trim());
      const productos = await Producto.find({ codigo: { $in: codigosArray } }).lean();
      return res.json(productos);
    }
    
    // Si viene un solo código
    if (codigo) {
      const producto = await Producto.findOne({ codigo }).lean();
      return res.json(producto ? [producto] : []);
    }
    
    // Si no viene filtro, obtener todos
    const productos = await Producto.find().lean();
    res.json(productos);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener productos" });
  }
});

// Endpoints Lineas
app.get('/lineas', async (req, res) => {
  try {
    const lineas = await Linea.find();
    res.json(lineas);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener lineas' });
  }
});

app.post('/lineas', async (req, res) => {
  try {
    const { nombre, porcentaje } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    const l = new Linea({ nombre, porcentaje: Number(porcentaje) || 0 });
    await l.save();
    res.status(201).json(l);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear linea' });
  }
});

app.put('/lineas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, porcentaje } = req.body;
    const l = await Linea.findByIdAndUpdate(id, { nombre, porcentaje: Number(porcentaje) }, { new: true });
    if (!l) return res.status(404).json({ error: 'Linea no encontrada' });
    res.json(l);
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar linea' });
  }
});

app.delete('/lineas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Linea.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ error: 'Linea no encontrada' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar linea' });
  }
});

app.put("/productos/:id", upload.single('imagen'), async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) return res.status(404).json({ error: "Producto no encontrado" });

    // Actualizar campos permitidos
    const up = req.body;
    if (up.codigo !== undefined) producto.codigo = up.codigo;
    if (up.nombre !== undefined) producto.nombre = up.nombre;
    if (up.precio !== undefined) producto.precio = Number(up.precio);
    if (up.precioCompra !== undefined) producto.precioCompra = Number(up.precioCompra);
    if (up.linea !== undefined) producto.linea = up.linea;
    if (up.lineaId !== undefined) producto.lineaId = up.lineaId;
    if (up.stock !== undefined) producto.stock = Number(up.stock);
    
    // Si hay una nueva imagen
    if (req.file) {
      // Eliminar la imagen anterior si existe
      if (producto.imagen) {
        const oldImagePath = path.join('./uploads', producto.imagen);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      producto.imagen = req.file.filename;
    }

    // Recalcular ganancia si hay ambos precios válidos
    if (!isNaN(Number(producto.precio)) && !isNaN(Number(producto.precioCompra))) {
      producto.ganancia = Number(producto.precio) - Number(producto.precioCompra);
    } else {
      producto.ganancia = undefined;
    }

    await producto.save();
    res.json(producto);
  } catch (error) {
    console.error('Error completo:', error);
    res.status(500).json({ error: "Error al modificar el producto", message: error.message });
  }
});

app.delete("/productos/:id", async (req, res) => {
  try {
    const eliminado = await Producto.findByIdAndDelete(req.params.id);
    if (!eliminado) return res.status(404).json({ error: "Producto no encontrado" });
    res.json({ mensaje: "✅ Producto eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar el producto" });
  }
});

// ============================
// 🔹 Ruta para productos con poco stock
// ============================
app.get("/productos/bajo-stock", async (req, res) => {
  try {
    // Podés ajustar el límite de stock mínimo (por defecto: 5)
    const limite = Number(req.query.limite) || 5;
    const productosBajoStock = await Producto.find({ stock: { $lte: limite } });
    res.json(productosBajoStock);
  } catch (error) {
    console.error("Error al obtener productos con bajo stock:", error);
    res.status(500).json({ error: "Error al obtener productos con bajo stock" });
  }
});


// ============================
// 🔹 Ruta Ventas
// ============================

app.post("/ventas", async (req, res) => {
  const { productos, formaPago, descuentoPorcentaje } = req.body; // <-- Cambiar a descuentoPorcentaje
  const esPagoDeuda = !!req.body.esPagoDeuda;

  if (!productos || productos.length === 0) {
    // Para un pago de deuda puede que no haya productos (o sí). Mantener la validación solo si no es pago de deuda.
    if (!esPagoDeuda) {
      return res.status(400).json({ success: false, message: "Carrito vacío" });
    }
  }

  try {
    // 🔹 OPTIMIZACIÓN: Hacer UNA sola consulta para obtener TODOS los productos necesarios
    if (!esPagoDeuda && productos.length > 0) {
      const codigos = productos.map(p => p.codigo);
      const productosDB = await Producto.find({ codigo: { $in: codigos } }).lean();
      const productosMap = new Map(productosDB.map(p => [p.codigo, p]));

      // Validar stock de todos los productos de una vez
      for (const item of productos) {
        const producto = productosMap.get(item.codigo);
        if (!producto) return res.status(404).json({ success: false, message: `Producto ${item.codigo} no encontrado` });
        if (producto.stock < item.cantidad)
          return res.status(400).json({ success: false, message: `Stock insuficiente para ${producto.nombre}` });
      }

      // 🔹 Actualizar stock usando bulkWrite (una sola operación)
      const bulkOps = productosDB
        .filter(p => productos.find(item => item.codigo === p.codigo))
        .map(p => {
          const item = productos.find(item => item.codigo === p.codigo);
          return {
            updateOne: {
              filter: { codigo: p.codigo },
              update: { $inc: { stock: -item.cantidad } }
            }
          };
        });

      if (bulkOps.length > 0) {
        await Producto.bulkWrite(bulkOps);
      }
    }    // 🔹 Calcular totales
    let subtotal, descuentoPorcentajeValor, descuentoMonto, total;
    
    // Si viene un total específico (pago de deuda) usar ese
    if (req.body.total !== undefined) {
      total = Number(req.body.total);
      subtotal = total; // Para consistencia en el ticket
      descuentoPorcentajeValor = 0;
      descuentoMonto = 0;
    } else {
      // Calcular normalmente para ventas regulares
      subtotal = productos.reduce((acc, p) => acc + (p.precio * p.cantidad), 0);
      descuentoPorcentajeValor = Number(descuentoPorcentaje) || 0;
      descuentoMonto = (subtotal * descuentoPorcentajeValor) / 100;
      total = subtotal - descuentoMonto;
    }

    // 🔹 Guardar venta en base de datos
    const fileName = `venta_${Date.now()}.pdf`;
    const venta = new Venta({
      productos: productos.map(p => ({
        codigo: p.codigo,
        nombre: p.nombre,
        precio: p.precio,
        cantidad: p.cantidad
      })),
      total,
      formaPago: formaPago || "Efectivo",
      descuentoPorcentaje: descuentoPorcentajeValor, // <-- Guardar porcentaje
      descuentoMonto: descuentoMonto, // <-- Guardar monto calculado
      factura: fileName,
      tipo: esPagoDeuda ? 'pago_deuda' : 'venta'
    });
    await venta.save();

    res.json({
      success: true,
      message: "Venta registrada exitosamente",
      factura: fileName,
      ventaId: venta._id,
      total: total.toFixed(2)
    });

    // 🔹 Generar el PDF
 // Reemplazar la sección de generación del PDF con este código:

// 🔹 Generar el PDF formato ticket térmico
const doc = new PDFDocument({ 
  size: [226.77, 841.89], // 80mm de ancho (puedes usar [165.35, 841.89] para 58mm)
  margins: { top: 10, bottom: 10, left: 10, right: 10 }
});

const filePath = `./facturas/${fileName}`;
if (!fs.existsSync("./facturas")) fs.mkdirSync("./facturas");
const stream = fs.createWriteStream(filePath);
doc.pipe(stream);

const anchoTicket = 206.77; // Ancho útil (80mm - márgenes)
let yPos = 10;

// ===== ENCABEZADO =====
doc.fontSize(12).font('Helvetica-Bold').text('Ron Wood', 10, yPos, { 
  width: anchoTicket, 
  align: 'center' 
});
yPos += 15;

doc.fontSize(8).font('Helvetica').text('Felix de Olazabal 1464', 10, yPos, { 
  width: anchoTicket, 
  align: 'center' 
});
yPos += 12;

// ===== TIPO DE COMPROBANTE =====
doc.fontSize(10).font('Helvetica-Bold').text('PRESUPUESTO', 10, yPos, { 
  width: anchoTicket, 
  align: 'center' 
});
yPos += 12;

doc.fontSize(7).font('Helvetica').text('Comprobante No Válido como Factura', 10, yPos, { 
  width: anchoTicket, 
  align: 'center' 
});
yPos += 15;

// ===== LÍNEA SEPARADORA =====
doc.moveTo(10, yPos).lineTo(216.77, yPos).stroke();
yPos += 8;

// ===== DATOS DE LA VENTA =====
const numeroFactura = fileName.replace('venta_', '').replace('.pdf', '').substring(0, 7);
const fechaActual = new Date().toLocaleDateString('es-AR');
const horaActual = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

doc.fontSize(8).font('Helvetica');
doc.text(`Fecha: ${fechaActual}  Hora: ${horaActual}`, 10, yPos, { width: anchoTicket });
yPos += 12;

doc.text(`Nº: ${numeroFactura}`, 10, yPos, { width: anchoTicket });
yPos += 12;

doc.text(`Forma de Pago: ${formaPago || 'Efectivo'}`, 10, yPos, { width: anchoTicket });
yPos += 12;

doc.text(`Vendedor: _______________`, 10, yPos, { width: anchoTicket });
yPos += 15;

// ===== LÍNEA SEPARADORA =====
doc.moveTo(10, yPos).lineTo(216.77, yPos).stroke();
yPos += 8;

// ===== ENCABEZADO DE PRODUCTOS =====
doc.fontSize(8).font('Helvetica-Bold');
doc.text('Cant.', 10, yPos, { width: 30, align: 'left' });
doc.text('Producto', 45, yPos, { width: 100, align: 'left' });
doc.text('Total', 150, yPos, { width: 66.77, align: 'right' });
yPos += 12;

// ===== LÍNEA SEPARADORA =====
doc.moveTo(10, yPos).lineTo(216.77, yPos).stroke();
yPos += 8;

// ===== PRODUCTOS =====
doc.fontSize(8).font('Helvetica');

productos.forEach((p) => {
  const totalItem = p.precio * p.cantidad;
  
  // Cantidad
  doc.text(p.cantidad.toString(), 10, yPos, { width: 30, align: 'left' });
  
  // Nombre del producto (puede ocupar varias líneas)
  const nombreHeight = doc.heightOfString(p.nombre, { width: 100 });
  doc.text(p.nombre, 45, yPos, { width: 100, align: 'left' });
  
  // Total (alineado a la derecha)
  doc.text(`$${totalItem.toFixed(2)}`, 150, yPos, { width: 66.77, align: 'right' });
  
  yPos += Math.max(nombreHeight, 10) + 2;
  
  // Precio unitario debajo del nombre (más pequeño)
  doc.fontSize(7).fillColor('#666');
  doc.text(`$${p.precio.toFixed(2)} c/u`, 45, yPos, { width: 100, align: 'left' });
  doc.fillColor('#000');
  doc.fontSize(8);
  
  yPos += 12;
});

// ===== LÍNEA SEPARADORA =====
yPos += 5;
doc.moveTo(10, yPos).lineTo(216.77, yPos).stroke();
yPos += 8;

// ===== TOTALES =====
const cantidadArticulos = productos.reduce((acc, p) => acc + p.cantidad, 0);

doc.fontSize(8).font('Helvetica');
doc.text(`Cant. Artículos:`, 10, yPos, { width: 120, align: 'left' });
doc.text(cantidadArticulos.toString(), 130, yPos, { width: 86.77, align: 'right' });
yPos += 12;

doc.text(`Subtotal:`, 10, yPos, { width: 120, align: 'left' });
doc.text(`$${subtotal.toFixed(2)}`, 130, yPos, { width: 86.77, align: 'right' });
yPos += 12;

doc.text(`Descuento:`, 10, yPos, { width: 120, align: 'left' });
doc.text(`$0.00`, 130, yPos, { width: 86.77, align: 'right' });
yPos += 15;

// ===== TOTAL DESTACADO =====
doc.fontSize(10).font('Helvetica-Bold');
doc.text(`TOTAL:`, 10, yPos, { width: 120, align: 'left' });
doc.text(`$${total.toFixed(2)}`, 130, yPos, { width: 86.77, align: 'right' });
yPos += 20;

// ===== FORMA DE PAGO DETALLADA =====
doc.moveTo(10, yPos).lineTo(216.77, yPos).stroke();
yPos += 8;

doc.fontSize(8).font('Helvetica-Bold');
doc.text('Forma de Pago:', 10, yPos, { width: anchoTicket, align: 'left' });
yPos += 12;

doc.fontSize(8).font('Helvetica');

const montoEfectivo = (formaPago === 'Efectivo') ? total : 0;
const montoTarjeta = (formaPago === 'Tarjeta') ? total : 0;
const montoDebito = (formaPago === 'Debito') ? total : 0;

if (montoEfectivo > 0) {
  doc.text(`Efectivo:`, 10, yPos, { width: 120, align: 'left' });
  doc.text(`$${montoEfectivo.toFixed(2)}`, 130, yPos, { width: 86.77, align: 'right' });
  yPos += 12;
}

if (montoTarjeta > 0) {
  doc.text(`Tarjeta:`, 10, yPos, { width: 120, align: 'left' });
  doc.text(`$${montoTarjeta.toFixed(2)}`, 130, yPos, { width: 86.77, align: 'right' });
  yPos += 12;
}

if (montoDebito > 0) {
  doc.text(`Débito:`, 10, yPos, { width: 120, align: 'left' });
  doc.text(`$${montoDebito.toFixed(2)}`, 130, yPos, { width: 86.77, align: 'right' });
  yPos += 12;
}

yPos += 10;

// ===== PIE DE PÁGINA =====
doc.moveTo(10, yPos).lineTo(216.77, yPos).stroke();
yPos += 10;

doc.fontSize(7).font('Helvetica').text('¡Gracias por su compra!', 10, yPos, { 
  width: anchoTicket, 
  align: 'center' 
});
yPos += 10;

doc.fontSize(6).text('Este comprobante no es válido como factura', 10, yPos, { 
  width: anchoTicket, 
  align: 'center' 
});

doc.end();
  } catch (err) {
    console.error("Error al procesar venta:", err);
    res.status(500).json({ success: false, message: "Error al generar venta", error: err.message });
  }
});


// ============================
// 🔹 Rutas Reportes
// ============================

app.get("/reportes", async (req, res) => {
  try {
    const { fecha } = req.query;
    let filtro = {};
    if (fecha) {
      // Ajustar a horario local del servidor
      const partes = fecha.split('-');
      const year = parseInt(partes[0], 10);
      const month = parseInt(partes[1], 10) - 1;
      const day = parseInt(partes[2], 10);
      const desde = new Date(year, month, day, 0, 0, 0, 0);
      const hasta = new Date(year, month, day, 23, 59, 59, 999);
      filtro.fecha = { $gte: desde, $lte: hasta };
    }

    // 🔹 OPTIMIZACIÓN: Hacer UNA sola consulta combinada usando Promise.all
    const [ventas, pagos] = await Promise.all([
      Venta.find(filtro).sort({ fecha: -1 }).lean(),
      Pago.find(filtro).sort({ fecha: -1 }).lean()
    ]);

    // Mapear pagos a formato de venta, evitando duplicados
    const ventasIds = new Set();
    const ventasFacturas = new Set();
    
    ventas.forEach(v => {
      ventasIds.add(String(v._id));
      if (v.factura) ventasFacturas.add(v.factura);
    });

    const pagosComoVentas = pagos
      .filter(p => {
        if (p.ventaId && ventasIds.has(String(p.ventaId))) return false;
        if (p.ventaFactura && ventasFacturas.has(p.ventaFactura)) return false;
        return true;
      })
      .map(p => ({
        _id: `pago_${p._id}`,
        productos: [{
          codigo: `pago_${p._id}`,
          nombre: `pago deuda/${p.clienteNombre}`,
          precio: Number(p.montoPagado || 0),
          cantidad: 1
        }],
        total: Number(p.montoPagado || 0),
        formaPago: p.formaPago || 'Efectivo',
        descuentoPorcentaje: 0,
        descuentoMonto: 0,
        tipo: 'pago_deuda',
        fecha: p.fecha,
        factura: null
      }));

    // Combinar y ordenar por fecha descendente
    const combinados = [...ventas, ...pagosComoVentas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    res.json(combinados);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener reportes', message: err.message });
  }
});// ============================
// 🔹 RUTA OPTIMIZADA: Obtener datos combinados en una sola consulta
// ============================

app.get("/dashboard-datos", async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const filtro = {};
    
    if (desde && hasta) {
      filtro.fecha = { $gte: new Date(desde), $lte: new Date(hasta) };
    }

    // 🔹 OPTIMIZACIÓN: Hacer UNA sola consulta combinada usando Promise.all
    // para obtener: ventas, pagos, gastos, clientes y productos con bajo stock
    const [ventas, pagos, gastos, clientes, productosBajoStock] = await Promise.all([
      Venta.find(filtro).lean(),
      Pago.find(filtro).lean(),
      Gasto.find(filtro).lean(),
      Cliente.find().select('nombre deuda').lean(),
      Producto.find({ stock: { $lte: 5 } }).select('nombre codigo stock').lean()
    ]);

    // Calcular totales
    const totalVentas = ventas.reduce((sum, v) => sum + (v.total || 0), 0);
    const totalPagos = pagos.reduce((sum, p) => sum + (p.montoPagado || 0), 0);
    const totalGastos = gastos.reduce((sum, g) => sum + (g.monto || 0), 0);
    const totalDeuda = clientes.reduce((sum, c) => sum + (c.deuda || 0), 0);

    res.json({
      ventas: {
        cantidad: ventas.length,
        total: totalVentas
      },
      pagos: {
        cantidad: pagos.length,
        total: totalPagos
      },
      gastos: {
        cantidad: gastos.length,
        total: totalGastos
      },
      deudas: {
        cantidad: clientes.length,
        total: totalDeuda
      },
      productosBajoStock: productosBajoStock.length,
      beneficio: totalVentas + totalPagos - totalGastos
    });
  } catch (err) {
    console.error('Error al obtener datos del dashboard:', err);
    res.status(500).json({ error: 'Error al obtener datos del dashboard', message: err.message });
  }
});

// ============================
// 🔹 Rutas Clientes/Deudas
// ============================

// Obtener todos los clientes
app.get("/clientes", async (req, res) => {
  try {
    const clientes = await Cliente.find();
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ message: "Error al obtener clientes", error: err.message });
  }
});

// Crear nuevo cliente
app.post("/clientes", async (req, res) => {
  try {
    const { nombre, dni, deuda, productosDeuda } = req.body;
    
    // Validar que no exista un cliente con el mismo DNI
    const existente = await Cliente.findOne({ dni });
    if (existente) {
      return res.status(400).json({ message: "Ya existe un cliente con ese DNI" });
    }

    const cliente = new Cliente({ 
      nombre, 
      dni,
      deuda: Number(deuda) || 0,
      productosDeuda: Array.isArray(productosDeuda) ? productosDeuda : []
    });
    
    await cliente.save();
    res.status(201).json(cliente);
  } catch (err) {
    res.status(500).json({ message: "Error al crear cliente", error: err.message });
  }
});

// ESTA ES LA CORRECCIÓN (CORRECTO)
app.put("/clientes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { deuda, productosDeuda } = req.body;

    const cliente = await Cliente.findById(id);
    if (!cliente) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    if (deuda !== undefined) cliente.deuda = Number(deuda);

    // --- INICIO DE LA CORRECCIÓN ---
    // Si vienen productosDeuda (al asignar deuda), CONCATENARLOS a los existentes
    if (productosDeuda !== undefined && Array.isArray(productosDeuda) && productosDeuda.length > 0) {
      // Asegurarse de que el array original exista
      if (!cliente.productosDeuda) {
        cliente.productosDeuda = [];
      }
      // Concatenar los nuevos productos a la lista de deuda existente
      cliente.productosDeuda = cliente.productosDeuda.concat(productosDeuda); // <-- ✅ ESTA ES LA SOLUCIÓN
    }
    // --- FIN DE LA CORRECCIÓN ---

    await cliente.save();

    res.json(cliente);
  } catch (err) {
    res.status(500).json({ message: "Error al actualizar deuda", error: err.message });
  }
});

// ============================
// 🔹 Ruta para registrar pagos (¡NUEVA!)
// ============================
app.post("/pagos", async (req, res) => {
  try {
    const { 
      clienteId, 
      clienteNombre, 
      montoPagado, 
      formaPago, 
      deudaPrevia, 
      deudaRestante 
    } = req.body;

    // Aceptar opcionalmente referencias a la venta (ventaId / ventaFactura) para evitar duplicados
    const { ventaId, ventaFactura } = req.body || {};

    const nuevoPago = new Pago({
      clienteId,
      clienteNombre,
      montoPagado,
      formaPago,
      ventaId: ventaId || undefined,
      ventaFactura: ventaFactura || undefined,
      fecha: new Date(), // Usar la fecha del servidor para consistencia
      deudaPrevia,
      deudaRestante
    });

    await nuevoPago.save();
    // Enviar respuesta 201 (Created) con el pago guardado
    res.status(201).json(nuevoPago); 

  } catch (err) {
    console.error("Error al registrar el pago:", err);
    res.status(500).json({ message: "Error al registrar el pago", error: err.message });
  }
});

// ============================
// 🔹 Ruta para generar factura de pago (¡NUEVA!)
// ============================
app.post("/pagos/factura", async (req, res) => {
  const { pago } = req.body;

  try {
    const fileName = `pago_${Date.now()}.pdf`;
    const doc = new PDFDocument({ 
      size: [226.77, 841.89],
      margins: { top: 10, bottom: 10, left: 10, right: 10 }
    });

    const filePath = `./facturas/${fileName}`;
    if (!fs.existsSync("./facturas")) fs.mkdirSync("./facturas");
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const anchoTicket = 206.77;
    let yPos = 10;

    // ===== ENCABEZADO =====
    doc.fontSize(12).font('Helvetica-Bold').text('Ron Wood', 10, yPos, { 
      width: anchoTicket, 
      align: 'center' 
    });
    yPos += 15;

    doc.fontSize(8).font('Helvetica').text('Felix de Olazabal 1464', 10, yPos, { 
      width: anchoTicket, 
      align: 'center' 
    });
    yPos += 12;

    // ===== TIPO DE COMPROBANTE =====
    doc.fontSize(10).font('Helvetica-Bold').text('COMPROBANTE DE PAGO', 10, yPos, { 
      width: anchoTicket, 
      align: 'center' 
    });
    yPos += 12;

    doc.fontSize(7).font('Helvetica').text('Comprobante No Válido como Factura', 10, yPos, { 
      width: anchoTicket, 
      align: 'center' 
    });
    yPos += 15;

    // ===== LÍNEA SEPARADORA =====
    doc.moveTo(10, yPos).lineTo(216.77, yPos).stroke();
    yPos += 8;

    // ===== DATOS DEL PAGO =====
    const numeroRecibo = `P${Date.now().toString().substring(0, 7)}`;
    const fechaActual = new Date().toLocaleDateString('es-AR');
    const horaActual = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    doc.fontSize(8).font('Helvetica');
    doc.text(`Fecha: ${fechaActual}  Hora: ${horaActual}`, 10, yPos, { width: anchoTicket });
    yPos += 12;

    doc.text(`Nº: ${numeroRecibo}`, 10, yPos, { width: anchoTicket });
    yPos += 12;

    doc.text(`Cliente: ${pago.clienteNombre}`, 10, yPos, { width: anchoTicket });
    yPos += 12;

    doc.text(`DNI: ${pago.dni || 'No especificado'}`, 10, yPos, { width: anchoTicket });
    yPos += 15;

    // ===== LÍNEA SEPARADORA =====
    doc.moveTo(10, yPos).lineTo(216.77, yPos).stroke();
    yPos += 8;

    // ===== DETALLES DEL PAGO =====
    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('DETALLES DEL PAGO', 10, yPos, { width: anchoTicket, align: 'center' });
    yPos += 15;

    doc.fontSize(8).font('Helvetica');
    doc.text('Deuda anterior:', 10, yPos, { width: 120 });
    doc.text(`$${pago.deudaPrevia.toFixed(2)}`, 130, yPos, { width: 86.77, align: 'right' });
    yPos += 12;

    doc.text('Monto pagado:', 10, yPos, { width: 120 });
    doc.text(`$${pago.montoPagado.toFixed(2)}`, 130, yPos, { width: 86.77, align: 'right' });
    yPos += 12;

    doc.text('Deuda restante:', 10, yPos, { width: 120 });
    doc.text(`$${pago.deudaRestante.toFixed(2)}`, 130, yPos, { width: 86.77, align: 'right' });
    yPos += 15;

    // ===== FORMA DE PAGO =====
    doc.moveTo(10, yPos).lineTo(216.77, yPos).stroke();
    yPos += 8;

    doc.fontSize(8).font('Helvetica-Bold');
    doc.text('Forma de Pago:', 10, yPos, { width: anchoTicket });
    yPos += 12;

    doc.fontSize(8).font('Helvetica');
    doc.text(`${pago.formaPago}:`, 10, yPos, { width: 120 });
    doc.text(`$${pago.montoPagado.toFixed(2)}`, 130, yPos, { width: 86.77, align: 'right' });
    yPos += 20;

    // ===== PIE DE PÁGINA =====
    doc.moveTo(10, yPos).lineTo(216.77, yPos).stroke();
    yPos += 10;

    doc.fontSize(7).font('Helvetica').text('¡Gracias por su pago!', 10, yPos, { 
      width: anchoTicket, 
      align: 'center' 
    });

    doc.end();

    res.json({ 
      success: true, 
      factura: fileName 
    });

  } catch (err) {
    console.error("Error al generar factura de pago:", err);
    res.status(500).json({ success: false, message: "Error al generar factura" });
  }
});


// ============================
// 🔹 Iniciar servidor
// ============================

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// backend: ruta /reportes/graficos
app.get("/reportes/graficos", async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const filtro = {};
    if (desde && hasta) {
      filtro.fecha = { $gte: new Date(desde), $lte: new Date(hasta) };
    }

    // 🔹 OPTIMIZACIÓN: Hacer UNA sola consulta combinada usando Promise.all
    const [ventas, pagos] = await Promise.all([
      Venta.find(filtro).sort({ fecha: 1 }).lean(),
      Pago.find(filtro).sort({ fecha: 1 }).lean()
    ]);

    // Mapear pagos a formato de venta, evitando duplicados
    const ventasIds = new Set();
    const ventasFacturas = new Set();
    
    ventas.forEach(v => {
      ventasIds.add(String(v._id));
      if (v.factura) ventasFacturas.add(v.factura);
    });

    const pagosComoVentas = pagos
      .filter(p => {
        if (p.ventaId && ventasIds.has(String(p.ventaId))) return false;
        if (p.ventaFactura && ventasFacturas.has(p.ventaFactura)) return false;
        return true;
      })
      .map(p => ({
        _id: `pago_${p._id}`,
        productos: [{
          codigo: `pago_${p._id}`,
          nombre: `pago deuda/${p.clienteNombre}`,
          precio: Number(p.montoPagado || 0),
          cantidad: 1
        }],
        total: Number(p.montoPagado || 0),
        formaPago: p.formaPago || 'Efectivo',
        descuentoPorcentaje: 0,
        descuentoMonto: 0,
        tipo: 'pago_deuda',
        fecha: p.fecha,
        factura: null
      }));

    const todos = [...ventas, ...pagosComoVentas].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    res.json(todos);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener ventas para gráficos', message: err.message });
  }
});// ============================
// 🔹 Rutas Gastos
// ============================

// Crear gasto
app.post("/gastos", async (req, res) => {
  try {
    const { fecha, monto, descripcion } = req.body;
    if (!monto) return res.status(400).json({ success: false, message: 'Monto requerido' });
    const g = new Gasto({ fecha: fecha ? new Date(fecha) : new Date(), monto: Number(monto), descripcion });
    await g.save();
    res.status(201).json(g);
  } catch (err) {
    console.error('Error al crear gasto:', err);
    res.status(500).json({ success: false, message: 'Error al crear gasto' });
  }
});

// Obtener gastos (opcionalmente por rango)
app.get('/gastos', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const filtro = {};
    if (desde || hasta) {
      filtro.fecha = {};
      if (desde) filtro.fecha.$gte = new Date(desde);
      if (hasta) filtro.fecha.$lte = new Date(hasta);
    }
    const gastos = await Gasto.find(filtro).sort({ fecha: 1 });
    res.json(gastos);
  } catch (err) {
    console.error('Error al obtener gastos:', err);
    res.status(500).json({ success: false, message: 'Error al obtener gastos' });
  }
});

// Eliminar gastos por fecha (query param fecha=YYYY-MM-DD) — elimina todos los gastos de ese día
app.delete('/gastos', async (req, res) => {
  try {
    const { fecha } = req.query;
    if (!fecha) return res.status(400).json({ success: false, message: 'Parámetro fecha requerido' });
    const partes = fecha.split('-');
    const year = Number(partes[0]);
    const month = Number(partes[1]) - 1;
    const day = Number(partes[2]);
    const desde = new Date(year, month, day, 0, 0, 0, 0);
    const hasta = new Date(year, month, day, 23, 59, 59, 999);
    const result = await Gasto.deleteMany({ fecha: { $gte: desde, $lte: hasta } });
    res.json({ success: true, deleted: result.deletedCount });
  } catch (err) {
    console.error('Error eliminando gastos:', err);
    res.status(500).json({ success: false, message: 'Error eliminando gastos' });
  }
});

app.post("/productos/aumentar-linea", async (req, res) => {
  try {
    const { lineaId, porcentaje } = req.body;
    
    if (!lineaId || porcentaje === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: "lineaId y porcentaje son requeridos" 
      });
    }

    const pct = Number(porcentaje);
    if (isNaN(pct)) {
      return res.status(400).json({ 
        success: false, 
        message: "Porcentaje debe ser un número válido" 
      });
    }

    // Buscar productos de esa línea
    const productos = await Producto.find({ lineaId: lineaId });

    if (productos.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "No se encontraron productos en esa línea" 
      });
    }

    let modificados = 0;

    for (const producto of productos) {
      // Aplicar aumento sobre el precio actual
      const precioActual = Number(producto.precio) || 0;
      const nuevoPrecio = precioActual * (1 + pct / 100);
      
      producto.precio = Number(nuevoPrecio.toFixed(2));
      
      // Recalcular ganancia si hay precioCompra
      if (!isNaN(Number(producto.precioCompra))) {
        producto.ganancia = producto.precio - Number(producto.precioCompra);
      }

      await producto.save();
      modificados++;
    }

    res.json({ 
      success: true, 
      message: `${pct > 0 ? 'Aumento' : 'Reducción'} del ${Math.abs(pct)}% aplicado`, 
      modificados 
    });

  } catch (err) {
    console.error('Error aplicando cambio de precios:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Error al aplicar cambio de precios', 
      error: err.message 
    });
  }
});

app.get("/ventas", async (req, res) => {
  try {
    const { fecha } = req.query;
    
    let query = {};
    
    if (fecha) {
      const inicioDelDia = new Date(fecha);
      inicioDelDia.setHours(0, 0, 0, 0);
      
      const finDelDia = new Date(fecha);
      finDelDia.setHours(23, 59, 59, 999);
      
      query.fecha = {
        $gte: inicioDelDia,
        $lte: finDelDia
      };
    }

    const ventas = await Venta.find(query);
    
    // Validar estructura de datos
    const ventasValidas = ventas.map((venta) => ({
      _id: venta._id,
      fecha: venta.fecha,
      productos: venta.productos.map((p) => ({
        codigo: p.codigo,
        nombre: p.nombre,
        cantidad: p.cantidad,
        precio: p.precio,
        total: p.precio * p.cantidad
      })),
      total: venta.total,
      iva: venta.iva
    }));

    res.json(ventasValidas);
  } catch (error) {
    console.error("Error al obtener ventas:", error);
    res.status(500).json({ message: "Error al obtener ventas", error: error.message });
  }
});
// 1. Importar las dependencias necesarias
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// 2. Configuración inicial
const app = express();
const PORT = 3000; 
const MONGO_URI = 'mongodb://localhost:27017/portal-gamer'; 

// 3. Middlewares
app.use(cors()); // Habilita CORS para permitir peticiones desde front-end
app.use(express.json()); // Permite al servidor entender JSON

// 4. Conexión a la base de datos MongoDB
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Conectado a MongoDB'))
    .catch(err => console.error('❌ Error al conectar a MongoDB:', err));

// 5. Definir el Esquema y Modelo de Mongoose
// El esquema le dice a Mongoose cómo se estructuran los documentos en la colección.
const juegoSchema = new mongoose.Schema({
    productId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    image: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true }
}, { collection: 'juegos' }); // Especificamos la colección existente
const usuarioSchema = new mongoose.Schema({
    nombre: {         // <-- LÍNEA NUEVA
        type: String,   // <-- LÍNEA NUEVA
        required: true, // <-- LÍNEA NUEVA
        trim: true      // <-- LÍNEA NUEVA
    },                  // <-- LÍNEA NUEVA
    email: { 
        type: String, 
        required: true, 
        unique: true, 
        lowercase: true,
        trim: true
    },
    password: { 
        type: String, 
        required: true 
    }
});
const Usuario = mongoose.model('Usuario', usuarioSchema);
const Juego = mongoose.model('Juego', juegoSchema);
// 6. Definir las rutas (los endpoints de las API)
// un endpoint en /api/juegos que devolverá todos los juegos
app.get('/api/juegos', async (req, res) => {
    try {
        const juegos = await Juego.find(); // Busca todos los documentos en la colección de juegos
        res.json(juegos); // Responde con los juegos en formato JSON
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener los juegos', error });
    }
});
// ... justo después de tu ruta app.get('/api/juegos', ...)

// 6.1. Ruta para registrar un nuevo usuario
app.post('/api/auth/register', async (req, res) => {
    try {
        // Obtenemos nombre, email y password del cuerpo de la petición
        const { nombre, email, password } = req.body;

        // Verificamos si el email ya está en uso
        const usuarioExistente = await Usuario.findOne({ email: email });
        if (usuarioExistente) {
            // Si ya existe, devolvemos un error de "Conflicto" o "Petición incorrecta"
            return res.status(400).json({ message: 'El email ya está registrado.' });
        }

        // Si el email es nuevo, encriptamos la contraseña
        const salt = await bcrypt.genSalt(10); // Genera una "sal" para la encriptación
        const hashedPassword = await bcrypt.hash(password, salt); // Crea la contraseña encriptada

        // Creamos una nueva instancia del usuario con la contraseña encriptada
        const nuevoUsuario = new Usuario({
            nombre,
            email,
            password: hashedPassword
        });

        // Guardamos el nuevo usuario en la base de datos
        await nuevoUsuario.save();

        // Responde al front-end con un mensaje de éxito
        res.status(201).json({ message: 'Usuario registrado exitosamente.' });

    } catch (error) {
        // Si algo sale mal, envia un error genérico
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor al registrar el usuario.' });
    }
});

// 6.2. Ruta para iniciar sesión de un usuario
app.post('/api/auth/login', async (req, res) => {
    try {
        // Obtenemos el email y la password del cuerpo de la petición
        const { email, password } = req.body;

        // Buscamos al usuario en la base de datos por su email
        const usuario = await Usuario.findOne({ email });

        // Si no encontramos al usuario, significa que las credenciales son incorrectas
        if (!usuario) {
            return res.status(400).json({ message: 'Credenciales inválidas.' });
        }

        // Si encontramos al usuario, comparamos la contraseña que nos envió
        // con la contraseña encriptada que tenemos en la base de datos.
        const esPasswordCorrecto = await bcrypt.compare(password, usuario.password);

        // Si las contraseñas no coinciden, las credenciales son incorrectas
        if (!esPasswordCorrecto) {
            return res.status(400).json({ message: 'Credenciales inválidas.' });
        }

        // Si las credenciales son correctas, creamos un "payload" para el token.
        // El payload es información que queremos guardar dentro del token.
        const payload = {
            usuario: {
                id: usuario.id // Guardamos el ID del usuario para saber quién es
            }
        };

        // Firmamos el token. El token es como una llave temporal que le damos al usuario
        // para que pueda acceder a partes protegidas de nuestra aplicación.
        jwt.sign(
            payload,
            'palabraSecreta123', // Esta es la "firma secreta". En un proyecto real, debe ser más compleja y guardarse de forma segura.
            { expiresIn: 3600 }, // El token será válido por 1 hora (3600 segundos)
            (error, token) => {
                if (error) throw error;
                // Enviamos el token generado de vuelta al front-end
                res.json({ token });
            }
        );

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
document.addEventListener('DOMContentLoaded', function() {
    const productGrid = document.querySelector('.product-grid');
    const modal = document.getElementById('product-modal');
    const closeModalBtn = document.querySelector('.modal-close-btn');
    
    // --- Lógica del carrusel
    const carouselSlide = document.querySelector('.carousel-slide');
    if (carouselSlide) {
        const productCards = carouselSlide.querySelectorAll('.product-card');
        if (productCards.length > 0) {
            const itemsPerView = 3;
            const totalGroups = Math.ceil(productCards.length / itemsPerView);
            let currentGroup = 0;

            function slideToGroup(groupIndex) {
                const carouselContainer = document.querySelector('.carousel-container');
                const moveAmount = carouselContainer.offsetWidth * groupIndex;
                carouselSlide.style.transform = `translateX(-${moveAmount}px)`;
            }

            setInterval(() => {
                currentGroup = (currentGroup + 1) % totalGroups;
                slideToGroup(currentGroup);
            }, 5000);
        }
    }
    
    // Almacenará los datos de los juegos una vez que los traigamos de la API
    let productsData = {};

    // Función para mostrar los juegos en la página de productos (juegos.html)
    function renderizarJuegos(juegos) {
        if (!productGrid) return; 
        productGrid.innerHTML = ''; 

        juegos.forEach((juego, index) => {
            // Guardamos los datos completos del juego para usarlos en el modal
            productsData[juego.productId] = juego;

            // Creamos la tarjeta del producto
            const card = document.createElement('article');
            card.className = 'product-card';
            card.dataset.productId = juego.productId;
            card.style.animationDelay = `${index * 0.1}s`;
            
            card.innerHTML = `
                <img src="${juego.image}" alt="Imagen de ${juego.title}">
                <h3>${juego.title}</h3>
                <p>Precio: $${juego.price}</p>
                <button class="view-product-btn">Ver Producto</button>
                <button>Agregar al Carrito</button>`;
            productGrid.appendChild(card);
        });
    }

    // Función para obtener los datos de los juegos desde nuestro back-end
    async function cargarJuegos() {
        // Solo intentamos cargar juegos si estamos en la página de productos
        if (!productGrid) return;

        try {
            // Pedimos los datos a nuestro servidor back-end
            const response = await fetch('http://localhost:3000/api/juegos');
            if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
            }
            const juegos = await response.json();
            renderizarJuegos(juegos); // Usamos los datos para crear las tarjetas
        } catch (error) {
            console.error("No se pudieron cargar los juegos:", error);
            productGrid.innerHTML = '<p>Error al cargar los juegos. Asegúrate de que el servidor back-end esté funcionando.</p>';
        }
    }
    
    // --- Lógica del Modal (adaptada para funcionar con datos dinámicos) ---
    function openModal(productId) {
        const product = productsData[productId];
        if (!product) {
            console.error("Producto no encontrado:", productId);
            return;
        }

        modal.querySelector('#modal-product-image').src = product.image;
        modal.querySelector('#modal-product-title').textContent = product.title;
        modal.querySelector('#modal-product-description').textContent = product.description;
        modal.querySelector('#modal-product-price').textContent = `Precio: $${product.price}`;
        
        modal.classList.add('visible');
    }

    function closeModal() {
        modal.classList.remove('visible');
    }

    // Añadimos un único Event Listener al contenedor de productos
    if (productGrid) {
        productGrid.addEventListener('click', function(event) {
            const viewBtn = event.target.closest('.view-product-btn');
            if (viewBtn) {
                const productCard = viewBtn.closest('.product-card');
                const productId = productCard.dataset.productId;
                openModal(productId);
            }
        });
    }

    // Listeners para cerrar el modal (solo si el modal existe en la página)
    if(modal) {
        closeModalBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeModal();
            }
        });
    }
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async function(event) {
            // Prevenimos que el formulario se envíe de la forma tradicional
            event.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const errorMessageElement = document.getElementById('error-message');
            errorMessageElement.textContent = ''; // Limpiamos errores anteriores

            try {
                // Hacemos la petición POST a nuestro endpoint de login en el back-end
                const response = await fetch('http://localhost:3000/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    // Si el servidor respondió con un error (ej. 400), lo mostramos
                    throw new Error(data.message || 'Error al iniciar sesión.');
                }

                // Si el login fue exitoso, guardamos el token
                localStorage.setItem('token', data.token);
                
                // Redirigimos al usuario a la página de inicio
                alert('¡Inicio de sesión exitoso!');
                window.location.href = 'index.html';

            } catch (error) {
                // Mostramos el mensaje de error en la página
                errorMessageElement.textContent = error.message;
            }
        });
    }
    if (registerForm) {
        registerForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            const nombre = document.getElementById('nombre').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const errorMessageElement = document.getElementById('error-message');
            errorMessageElement.textContent = '';

            try {
                const response = await fetch('http://localhost:3000/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ nombre, email, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Error al registrar la cuenta.');
                }

                alert('¡Cuenta creada exitosamente! Ahora puedes iniciar sesión.');
                window.location.href = 'login.html'; // Redirige al login

            } catch (error) {
                errorMessageElement.textContent = error.message;
            }
        });
    }
    // Iniciamos la carga de juegos al cargar la página
    cargarJuegos();
});
const API = "http://localhost:8080/api";

let products = [];
let cart = [];
let orders = [];

const productsGrid = document.getElementById("productsGrid");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");

const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");
const summaryCount = document.getElementById("summaryCount");

const productMessage = document.getElementById("productMessage");
const checkoutMessage = document.getElementById("checkoutMessage");

const ordersList = document.getElementById("ordersList");

// Format Indian currency
function money(amount) {
    return Number(amount).toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    });
}

// Safely display text in HTML
function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// API request helper
async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API}${endpoint}`, options);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || "Request failed");
    }

    return data;
}

// Load products using Java backend
async function loadProducts() {
    productsGrid.innerHTML = "<p>Loading products...</p>";

    const params = new URLSearchParams();

    params.set("search", searchInput.value.trim());
    params.set("sort", sortSelect.value);

    try {
        products = await apiRequest(
            `/products?${params.toString()}`
        );

        renderProducts();
        productMessage.textContent = "";

    } catch (error) {
        productsGrid.innerHTML =
            "<p>Could not load products. Start the Java backend first.</p>";

        productMessage.textContent = error.message;
        productMessage.className = "message error";
    }
}

// Render products
function renderProducts() {
    document.getElementById("productCount").textContent =
        `${products.length} products`;

    if (products.length === 0) {
        productsGrid.innerHTML =
            "<p>No matching products found.</p>";
        return;
    }

    productsGrid.innerHTML = products.map(product => `
        <article class="product-card">
            <div class="product-emoji">
                ${escapeHTML(product.emoji)}
            </div>

            <p class="product-category">
                ${escapeHTML(product.category)}
            </p>

            <h3>${escapeHTML(product.name)}</h3>

            <div class="product-bottom">
                <span class="price">${money(product.price)}</span>

                <button
                    class="add-btn"
                    data-add="${product.id}">
                    + Add
                </button>
            </div>
        </article>
    `).join("");
}

// Add a product to cart
async function addToCart(id) {
    try {
        const body = new URLSearchParams({
            id: String(id),
            quantity: "1"
        });

        await apiRequest("/cart", {
            method: "POST",
            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded;charset=UTF-8"
            },
            body: body.toString()
        });

        await updateCart();

        productMessage.textContent = "Product added to cart!";
        productMessage.className = "message success";

    } catch (error) {
        productMessage.textContent = error.message;
        productMessage.className = "message error";
    }
}

// Load cart from backend
async function updateCart() {
    try {
        const data = await apiRequest("/cart");

        cart = data.items || [];

        renderCart(data);

    } catch (error) {
        cartItems.innerHTML =
            "<p>Unable to load cart. Check Java backend.</p>";
    }
}

// Render cart
function renderCart(data) {
    const count = cart.reduce(
        (sum, item) => sum + Number(item.quantity), 0
    );

    cartCount.textContent = count;
    summaryCount.textContent = count;
    cartTotal.textContent = money(data.total || 0);

    if (cart.length === 0) {
        cartItems.innerHTML = "<p>Your cart is empty.</p>";
        return;
    }

    cartItems.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-emoji">
                ${escapeHTML(item.emoji)}
            </div>

            <div>
                <h3>${escapeHTML(item.name)}</h3>
                <small>${money(item.price)} each</small>

                <div class="quantity-controls">
                    <button
                        data-change="${item.id}"
                        data-amount="-1"
                        aria-label="Decrease quantity">−</button>

                    <strong>${item.quantity}</strong>

                    <button
                        data-change="${item.id}"
                        data-amount="1"
                        aria-label="Increase quantity">+</button>

                    <button
                        class="remove-btn"
                        data-remove="${item.id}"
                        aria-label="Remove item">×</button>
                </div>
            </div>

            <div class="item-subtotal">
                ${money(item.subtotal)}
            </div>
        </div>
    `).join("");
}

// Change quantity
async function changeQuantity(id, amount) {
    try {
        if (amount === 1) {
            await addToCart(id);
            return;
        }

        const body = new URLSearchParams({
            id: String(id),
            action: "decrease"
        });

        await apiRequest("/cart", {
            method: "DELETE",
            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded;charset=UTF-8"
            },
            body: body.toString()
        });

        await updateCart();

    } catch (error) {
        checkoutMessage.textContent = error.message;
        checkoutMessage.className = "message error";
    }
}

// Remove item from cart
async function removeFromCart(id) {
    try {
        const body = new URLSearchParams({
            id: String(id),
            action: "remove"
        });

        await apiRequest("/cart", {
            method: "DELETE",
            headers: {
                "Content-Type":
                    "application/x-www-form-urlencoded;charset=UTF-8"
            },
            body: body.toString()
        });

        await updateCart();

    } catch (error) {
        checkoutMessage.textContent = error.message;
        checkoutMessage.className = "message error";
    }
}

// Checkout
async function checkout() {
    checkoutMessage.textContent = "";

    if (cart.length === 0) {
        checkoutMessage.textContent =
            "Please add a product before checkout.";

        checkoutMessage.className = "message error";
        return;
    }

    const button = document.getElementById("checkoutBtn");
    button.disabled = true;
    button.textContent = "Processing...";

    try {
        const result = await apiRequest("/checkout", {
            method: "POST"
        });

        checkoutMessage.textContent =
            `Order #${result.order.id} placed successfully!`;

        checkoutMessage.className = "message success";

        await updateCart();
        await loadOrders();

        document.getElementById("orders").scrollIntoView({
            behavior: "smooth"
        });

    } catch (error) {
        checkoutMessage.textContent = error.message;
        checkoutMessage.className = "message error";

    } finally {
        button.disabled = false;
        button.textContent = "Place Order";
    }
}

// Order history
async function loadOrders() {
    try {
        orders = await apiRequest("/orders");
        renderOrders();

    } catch (error) {
        ordersList.innerHTML =
            "<p>Could not load order history.</p>";
    }
}

// Render order history
function renderOrders() {
    if (orders.length === 0) {
        ordersList.innerHTML =
            "<p>No orders yet. Place your first order!</p>";
        return;
    }

    ordersList.innerHTML = orders.map(order => `
        <article class="order-card">
            <div>
                <h3>Order #${order.id}</h3>

                <p>
                    ${escapeHTML(
                        new Date(order.time).toLocaleString()
                    )}
                </p>

                <p>${escapeHTML(order.items)}</p>
            </div>

            <div class="order-price">
                ${money(order.total)}
            </div>
        </article>
    `).join("");
}

// ArrayList visualizer
function visualizeArrayList() {
    const view = document.getElementById("arrayView");

    if (products.length === 0) {
        view.textContent = "No products available.";
        return;
    }

    view.innerHTML = products.map((product, index) => `
        <span class="ds-node">
            [${index}] ${escapeHTML(product.name)}
        </span>
    `).join("");
}

// Linked List visualizer
async function visualizeLinkedList() {
    const view = document.getElementById("linkedView");

    try {
        const data = await apiRequest("/cart");

        if (!data.items || data.items.length === 0) {
            view.textContent = "Cart empty. Add a product first.";
            return;
        }

        view.innerHTML = data.items.map((item, index) => `
            <span class="ds-node">
                ${escapeHTML(item.name)} × ${item.quantity}
            </span>
            ${index < data.items.length - 1
                ? '<span class="arrow"> → </span>'
                : '<span class="arrow"> → NULL</span>'}
        `).join("");

    } catch (error) {
        view.textContent = error.message;
    }
}

// Queue visualizer
async function visualizeQueue() {
    const view = document.getElementById("queueView");

    try {
        const data = await apiRequest("/orders");

        if (data.length === 0) {
            view.textContent = "No orders available yet.";
            return;
        }

        view.innerHTML = `
            <p><strong>Order History (latest first)</strong></p>
            <p>Orders are processed in FIFO order.</p>
            ${[...data].reverse().map(order => `
                <span class="ds-node">
                    Order #${order.id}
                </span>
            `).join('<span class="arrow"> → </span>')}
        `;

    } catch (error) {
        view.textContent = error.message;
    }
}

// Event listeners
productsGrid.addEventListener("click", event => {
    const button = event.target.closest("[data-add]");

    if (button) {
        addToCart(Number(button.dataset.add));
    }
});

cartItems.addEventListener("click", event => {
    const changeButton = event.target.closest("[data-change]");
    const removeButton = event.target.closest("[data-remove]");

    if (changeButton) {
        changeQuantity(
            Number(changeButton.dataset.change),
            Number(changeButton.dataset.amount)
        );
    }

    if (removeButton) {
        removeFromCart(Number(removeButton.dataset.remove));
    }
});

searchInput.addEventListener("input", loadProducts);
sortSelect.addEventListener("change", loadProducts);

document.getElementById("checkoutBtn")
    .addEventListener("click", checkout);

document.getElementById("refreshOrders")
    .addEventListener("click", loadOrders);

document.getElementById("showArray")
    .addEventListener("click", visualizeArrayList);

document.getElementById("showLinkedList")
    .addEventListener("click", visualizeLinkedList);

document.getElementById("showQueue")
    .addEventListener("click", visualizeQueue);

// Start application
async function startApp() {
    await loadProducts();
    await updateCart();
    await loadOrders();
}

startApp();
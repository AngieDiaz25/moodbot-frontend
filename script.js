// Configuración de la API
const API_URL = 'https://moodbot-production.up.railway.app';

// Elementos del DOM
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const chatMessages = document.getElementById('chatMessages');
const loadingMessage = document.getElementById('loadingMessage');
const welcomeMessage = document.getElementById('welcomeMessage');
const charCount = document.getElementById('charCount');

// Estado de la aplicación
let isProcessing = false;
let conversationHistory = [];

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    checkAPIHealth();
    setupEventListeners();
    autoResizeTextarea();
});

// Event Listeners
function setupEventListeners() {
    // Input de texto
    userInput.addEventListener('input', () => {
        updateCharCount();
        autoResizeTextarea();
        toggleSendButton();
    });

    // Enter para enviar (sin Shift)
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendButton.disabled) {
                sendMessage();
            }
        }
    });

    // Focus inicial en el input
    userInput.focus();
}

// Verificar salud de la API
async function checkAPIHealth() {
    const statusIndicator = document.getElementById('apiStatus');
    const statusText = document.getElementById('apiStatusText');
    
    try {
        const response = await fetch(`${API_URL}/health`, { 
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.status === 'healthy' && data.models_loaded) {
                statusIndicator.textContent = '●';
                statusIndicator.style.color = '#059669';
                statusText.textContent = 'API conectada';
                console.log('✅ API health check successful:', data);
            } else {
                statusIndicator.textContent = '●';
                statusIndicator.style.color = '#d97706';
                statusText.textContent = 'API parcialmente disponible';
            }
        } else {
            throw new Error('API no responde correctamente');
        }
    } catch (error) {
        console.error('❌ API health check failed:', error);
        statusIndicator.textContent = '●';
        statusIndicator.style.color = '#dc2626';
        statusText.textContent = 'API no disponible';
        
        showErrorNotification(
            'La API no está disponible en este momento. Esto puede deberse a que el servicio está iniciándose (puede tomar 30-60 segundos en la primera carga).'
        );
    }
}

// Enviar mensaje
async function sendMessage() {
    const text = userInput.value.trim();
    
    if (!text || isProcessing) {
        return;
    }

    // Ocultar mensaje de bienvenida si es el primer mensaje
    if (welcomeMessage && conversationHistory.length === 0) {
        welcomeMessage.style.display = 'none';
    }

    // Añadir mensaje del usuario al chat
    addUserMessage(text);

    // Limpiar input
    userInput.value = '';
    updateCharCount();
    autoResizeTextarea();
    toggleSendButton();

    // Marcar como procesando
    isProcessing = true;
    showLoading();

    try {
        // Hacer petición a la API
        const response = await fetch(`${API_URL}/predict`, { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: text })
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('✅ Prediction received:', data);

        // Añadir respuesta del bot
        hideLoading();
        addBotMessage(data);

        // Guardar en historial
        conversationHistory.push({
            user: text,
            bot: data,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error en la predicción:', error);
        hideLoading();
        addErrorMessage(error.message);
    } finally {
        isProcessing = false;
        userInput.focus();
    }
}

// Añadir mensaje del usuario al chat
function addUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'user-message';
    messageDiv.innerHTML = `
        <div class="user-avatar">TÚ</div>
        <div class="message-bubble">
            <div class="message-text">${escapeHtml(text)}</div>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

// Añadir respuesta del bot al chat
function addBotMessage(data) {
    // Adaptar al formato de la API
    const predictionLabel = data.prediction.label;
    const confidence = data.prediction.confidence;
    const message = data.response;
    
    // Mapear etiquetas en español a clases CSS
    const classMapping = {
        'Neutro': 'neutral',
        'Ansiedad': 'anxiety',
        'Depresion': 'depression',
        'Depresión': 'depression'
    };
    
    // Usar símbolo simple en lugar de emojis
    const symbolMapping = {
        'Neutro': '●',
        'Ansiedad': '●',
        'Depresion': '●',
        'Depresión': '●'
    };
    
    const predictionClass = classMapping[predictionLabel] || 'neutral';
    const symbol = symbolMapping[predictionLabel] || '●';
    
    // Color del símbolo según la categoría
    let symbolColor = '';
    if (predictionClass === 'neutral') symbolColor = 'color: #059669;';
    if (predictionClass === 'anxiety') symbolColor = 'color: #d97706;';
    if (predictionClass === 'depression') symbolColor = 'color: #dc2626;';

    const messageDiv = document.createElement('div');
    messageDiv.className = 'bot-message';
    messageDiv.innerHTML = `
        <div class="bot-avatar">MB</div>
        <div class="message-bubble">
            <div class="message-text">${escapeHtml(message)}</div>
            <div class="result-card ${predictionClass}">
                <h3>
                    <span style="${symbolColor} font-size: 18px;">${symbol}</span> ${predictionLabel}
                    <span class="confidence-badge">${(confidence * 100).toFixed(1)}%</span>
                </h3>
                <p class="result-message">Estado emocional detectado con alta confianza.</p>
            </div>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

// Añadir mensaje de error al chat
function addErrorMessage(errorText) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'bot-message';
    messageDiv.innerHTML = `
        <div class="bot-avatar">MB</div>
        <div class="message-bubble">
            <div class="message-text">
                <strong>Lo siento, hubo un error al procesar tu mensaje.</strong><br><br>
                ${escapeHtml(errorText)}<br><br>
                Por favor, intenta de nuevo en unos momentos.
            </div>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

// Mostrar indicador de carga
function showLoading() {
    loadingMessage.style.display = 'flex';
    scrollToBottom();
}

// Ocultar indicador de carga
function hideLoading() {
    loadingMessage.style.display = 'none';
}

// Actualizar contador de caracteres
function updateCharCount() {
    const count = userInput.value.length;
    charCount.textContent = `${count}/1000`;
    
    if (count > 900) {
        charCount.style.color = '#dc2626';
    } else if (count > 700) {
        charCount.style.color = '#d97706';
    } else {
        charCount.style.color = '#64748b';
    }
}

// Toggle del botón de enviar
function toggleSendButton() {
    const hasText = userInput.value.trim().length > 0;
    sendButton.disabled = !hasText || isProcessing;
}

// Auto-resize del textarea
function autoResizeTextarea() {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
}

// Scroll al final del chat
function scrollToBottom() {
    const chatContainer = document.querySelector(".chat-container");
    setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 100);
}
function scrollToBottom() {
    const chatContainer = document.querySelector(".chat-container");
    setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 100);
}
function scrollToBottom() {
    const chatContainer = document.querySelector(".chat-container");
    setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 100);
}
function scrollToBottom() {
    const chatContainer = document.querySelector(".chat-container");
    setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 100);
}
function scrollToBottom() {
    const chatContainer = document.querySelector(".chat-container");
    setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 100);
}

// Escape HTML para prevenir XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}

// Mostrar notificación de error
function showErrorNotification(message) {
    let notification = document.getElementById('errorNotification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'errorNotification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #dc2626, #b91c1c);
            color: white;
            padding: 16px 20px;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
            max-width: 400px;
            z-index: 2000;
            animation: slideInRight 0.4s ease-out;
            font-size: 13px;
            line-height: 1.5;
        `;
        document.body.appendChild(notification);
    }
    
    notification.innerHTML = `
        <strong>● Aviso</strong><br>
        ${message}
        <button onclick="this.parentElement.remove()" style="
            position: absolute;
            top: 8px;
            right: 8px;
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
        ">×</button>
    `;
    
    setTimeout(() => {
        if (notification) {
            notification.style.animation = 'slideOutRight 0.4s ease-out';
            setTimeout(() => notification.remove(), 400);
        }
    }, 10000);
}

// Añadir animaciones CSS para notificaciones
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Log de inicio
console.log('MoodBot inicializado - Versión Profesional');
console.log('API URL:', API_URL);
console.log('Versión: 1.0.0'); 

// ===== SCANIFY APP.JS =====
// Global utilities and functions

// ===== LOCALSTORAGE UTILITIES =====

/**
 * Save a document to LocalStorage
 */
function saveDocument(nameOrDocument, imageData, fileType = 'JPG') {
    const documents = getDocuments();
    const now = Date.now();

    const document = (nameOrDocument && typeof nameOrDocument === 'object')
        ? {
            id: nameOrDocument.id || ('doc_' + now),
            name: nameOrDocument.name || 'Scanned Document',
            imageData: nameOrDocument.imageData || '',
            fileType: nameOrDocument.fileType || 'JPG',
            createdAt: nameOrDocument.createdAt || now,
            updatedAt: now
        }
        : {
            id: 'doc_' + now,
            name: nameOrDocument || 'Scanned Document',
            imageData: imageData || '',
            fileType: fileType || 'JPG',
            createdAt: now,
            updatedAt: now
        };

    documents.unshift(document);

    try {
        localStorage.setItem('scanify-documents', JSON.stringify(documents));
        return document;
    } catch (error) {
        console.error('[Scanify] Storage error:', error);
        return null;
    }
}

/**
 * Get all documents from LocalStorage
 */
function getDocuments() {
    const stored = localStorage.getItem('scanify-documents');
    return stored ? JSON.parse(stored) : [];
}

/**
 * Get a single document by ID
 */
function getDocumentById(id) {
    const documents = getDocuments();
    return documents.find(doc => doc.id === id);
}

/**
 * Update a document
 */
function updateDocument(id, updates) {
    const documents = getDocuments();
    const index = documents.findIndex(doc => doc.id === id);
    
    if (index !== -1) {
        documents[index] = {
            ...documents[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        localStorage.setItem('scanify-documents', JSON.stringify(documents));
        return documents[index];
    }
    
    return null;
}

/**
 * Delete a document by ID
 */
function deleteDocument(id) {
    const documents = getDocuments();
    const filtered = documents.filter(doc => doc.id !== id);
    localStorage.setItem('scanify-documents', JSON.stringify(filtered));
}

/**
 * Delete all documents
 */
function clearAllDocuments() {
    localStorage.setItem('scanify-documents', JSON.stringify([]));
}

/**
 * Search documents by name
 */
function searchDocuments(query) {
    const documents = getDocuments();
    return documents.filter(doc => 
        doc.name.toLowerCase().includes(query.toLowerCase())
    );
}

// ===== THEME MANAGEMENT =====

/**
 * Get current theme
 */
function getTheme() {
    const saved = localStorage.getItem('scanify-theme');
    if (saved) return saved;
    
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    
    return 'light';
}

/**
 * Initialize theme on page load
 */
function initializeTheme() {
    const theme = getTheme();
    document.documentElement.setAttribute('data-theme', theme);
}

// Initialize theme immediately
initializeTheme();

// ===== TOAST NOTIFICATIONS =====

/**
 * Show a toast notification
 */
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// ===== MODAL HELPERS =====

/**
 * Show a modal by ID
 */
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
}

/**
 * Hide a modal by ID
 */
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

// ===== DATE FORMATTING =====

/**
 * Format date to readable string
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
}

// ===== IMAGE UTILITIES =====

/**
 * Convert image file to base64
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Load image from file
 */
function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Resize image to fit max dimensions
 */
function resizeImage(canvas, maxWidth = 1200, maxHeight = 1200) {
    if (canvas.width <= maxWidth && canvas.height <= maxHeight) {
        return canvas;
    }
    
    const ratio = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
    
    const newCanvas = document.createElement('canvas');
    newCanvas.width = canvas.width * ratio;
    newCanvas.height = canvas.height * ratio;
    
    const ctx = newCanvas.getContext('2d');
    ctx.drawImage(canvas, 0, 0, newCanvas.width, newCanvas.height);
    
    return newCanvas;
}

/**
 * Compress image on canvas
 */
function compressCanvas(canvas, quality = 0.8) {
    return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Download a file
 */
function downloadFile(data, filename) {
    const link = document.createElement('a');
    link.href = data;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Get file size in KB
 */
function getDataURLFileSize(dataURL) {
    const base64String = dataURL.split(',')[1];
    const binaryString = atob(base64String);
    return (binaryString.length / 1024).toFixed(2);
}

// ===== SAMPLE DATA =====

/**
 * Create sample documents on first launch
 */
function createSampleDocuments() {
    const hasVisited = localStorage.getItem('scanify-visited');
    if (hasVisited) return;
    
    const sampleDocs = [
        {
            id: '1001',
            name: 'Lecture Notes - Week 1',
            imageData: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 300%22%3E%3Crect fill=%22%23fff%22 width=%22400%22 height=%22300%22/%3E%3Crect fill=%22%234338CA%22 y=%2220%22 width=%22400%22 height=%2260%22/%3E%3Ctext x=%2220%22 y=%2255%22 font-size=%2224%22 font-weight=%22bold%22 fill=%22%23fff%22%3ELecture Notes%3C/text%3E%3Cline x1=%2220%22 y1=%22100%22 x2=%22380%22 y2=%22100%22 stroke=%22%23ccc%22 stroke-width=%222%22/%3E%3Ctext x=%2220%22 y=%22130%22 font-size=%2214%22 fill=%22%23333%22%3E1. Introduction to Web Development%3C/text%3E%3Ctext x=%2220%22 y=%22155%22 font-size=%2214%22 fill=%22%23333%22%3E2. HTML5 and Semantic Markup%3C/text%3E%3Ctext x=%2220%22 y=%22180%22 font-size=%2214%22 fill=%22%23333%22%3E3. CSS3 Styling Techniques%3C/text%3E%3Ctext x=%2220%22 y=%22205%22 font-size=%2214%22 fill=%22%23333%22%3E4. JavaScript Fundamentals%3C/text%3E%3C/svg%3E',
            fileType: 'JPG',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: '1002',
            name: 'Assignment 1',
            imageData: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 300%22%3E%3Crect fill=%22%23f0f4ff%22 width=%22400%22 height=%22300%22/%3E%3Crect fill=%224338CA%22 y=%2220%22 width=%22400%22 height=%2260%22/%3E%3Ctext x=%2220%22 y=%2255%22 font-size=%2224%22 font-weight=%22bold%22 fill=%22%23fff%22%3EAssignment 1%3C/text%3E%3Ctext x=%2220%22 y=%22120%22 font-size=%2216%22 fill=%22%23333%22%3EWeb Technology Project%3C/text%3E%3Ctext x=%2220%22 y=%22150%22 font-size=%2214%22 fill=%22%23666%22%3ECreate a responsive website%3C/text%3E%3Ctext x=%2220%22 y=%22180%22 font-size=%2214%22 fill=%22%23666%22%3EDue: Next Friday%3C/text%3E%3C/svg%3E',
            fileType: 'JPG',
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
            id: '1003',
            name: 'Exam Study Guide',
            imageData: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 300%22%3E%3Crect fill=%22%23fff9e6%22 width=%22400%22 height=%22300%22/%3E%3Crect fill=%22%23F59E0B%22 y=%2220%22 width=%22400%22 height=%2260%22/%3E%3Ctext x=%2220%22 y=%2255%22 font-size=%2224%22 font-weight=%22bold%22 fill=%22%23fff%22%3EStudy Guide%3C/text%3E%3Ctext x=%2220%22 y=%22120%22 font-size=%2216%22 fill=%22%23333%22%3EMidterm Exam Topics%3C/text%3E%3Ctext x=%2220%22 y=%22150%22 font-size=%2214%22 fill=%22%23666%22%3E- HTML Structure%3C/text%3E%3Ctext x=%2220%22 y=%22175%22 font-size=%2214%22 fill=%22%23666%22%3E- CSS Flexbox & Grid%3C/text%3E%3Ctext x=%2220%22 y=%22200%22 font-size=%2214%22 fill=%22%23666%22%3E- JavaScript ES6%3C/text%3E%3C/svg%3E',
            fileType: 'JPG',
            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
        }
    ];
    
    localStorage.setItem('scanify-documents', JSON.stringify(sampleDocs));
    localStorage.setItem('scanify-visited', 'true');
}

// Create sample documents on first visit
createSampleDocuments();

// ===== PAGE NAVIGATION HELPERS =====

/**
 * Update active navigation item
 */
function updateActiveNav(pageId) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const activeItem = document.querySelector(`[data-page="${pageId}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
    }
}

// ===== GENERAL FUNCTIONS =====

/**
 * Rename a document
 */
function renameDocument(id, newName) {
    updateDocument(id, { name: newName });
}

/**
 * Delete document with confirmation
 */
function deleteDocumentWithConfirm(id) {
    if (confirm('Are you sure you want to delete this document?')) {
        deleteDocument(id);
        showToast('Document deleted');
        // Reload the page to update the UI
        location.reload();
    }
}

/**
 * Download a document
 */
function downloadDocument(id) {
    const doc = getDocumentById(id);
    if (doc) {
        const filename = `${doc.name}.${doc.fileType.toLowerCase()}`;
        downloadFile(doc.imageData, filename);
        showToast('Document downloaded');
    }
}

/**
 * Go to scanner page
 */
function goToScanner() {
    window.location.href = 'scanner.html';
}

// ===== PAGE LOAD INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme
    initializeTheme();
    
    // Set up modal close on background click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                modal.classList.remove('active');
            }
        });
    });
});

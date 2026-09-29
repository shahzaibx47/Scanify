// ===== SCANIFY DOCUMENTS.JS =====
// Document management, search, and display functionality

let currentPreviewDoc = null;
let currentRenameDocId = null;

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', () => {
    loadDocuments();
});

// ===== LOAD AND DISPLAY DOCUMENTS =====

/**
 * Load and display all documents
 */
function loadDocuments() {
    const container = document.getElementById('documentsGrid');
    const emptyState = document.getElementById('emptyState');
    const documents = getDocuments();
    
    container.innerHTML = '';
    
    if (documents.length === 0) {
        emptyState.style.display = 'flex';
        return;
    }
    
    emptyState.style.display = 'none';
    
    // Sort by date (newest first)
    documents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    documents.forEach(doc => {
        const card = createDocumentCardElement(doc);
        container.appendChild(card);
    });
}

/**
 * Create document card element
 */
function createDocumentCardElement(doc) {
    const card = document.createElement('div');
    card.className = 'document-card';
    
    const dateStr = new Date(doc.createdAt).toLocaleDateString();
    
    card.innerHTML = `
        <div class="card-image">
            <img src="${doc.imageData}" alt="${doc.name}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Crect fill=%22%23ddd%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%22 y=%2250%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23666%22%3EJPG%3C/text%3E%3C/svg%3E'">
        </div>
        <div class="card-content">
            <h3>${doc.name}</h3>
            <p class="card-date">${dateStr}</p>
            <div class="card-actions">
                <button class="btn-icon" title="Preview" onclick="openPreview('${doc.id}')">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-icon" title="Download" onclick="downloadDocument('${doc.id}')">
                    <i class="fas fa-download"></i>
                </button>
                <button class="btn-icon" title="Rename" onclick="openRenameModal('${doc.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon" title="Delete" onclick="openDeleteConfirm('${doc.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
    
    return card;
}

// ===== SEARCH FUNCTIONALITY =====

/**
 * Search documents by name
 */
function searchDocuments() {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput.value.trim();
    
    const container = document.getElementById('documentsGrid');
    const emptyState = document.getElementById('emptyState');
    const noResults = document.getElementById('noSearchResults');
    
    container.innerHTML = '';
    
    if (!query) {
        // Show all documents
        emptyState.style.display = 'none';
        noResults.style.display = 'none';
        loadDocuments();
        return;
    }
    
    const results = searchDocuments(query);
    
    if (results.length === 0) {
        emptyState.style.display = 'none';
        noResults.style.display = 'flex';
        return;
    }
    
    emptyState.style.display = 'none';
    noResults.style.display = 'none';
    
    results.forEach(doc => {
        const card = createDocumentCardElement(doc);
        container.appendChild(card);
    });
}

// ===== PREVIEW FUNCTIONALITY =====

/**
 * Open document preview
 */
function openPreview(docId) {
    const doc = getDocumentById(docId);
    if (!doc) return;
    
    currentPreviewDoc = doc;
    
    const modal = document.getElementById('previewModal');
    const title = document.getElementById('previewTitle');
    const image = document.getElementById('previewImage');
    
    title.textContent = doc.name;
    image.src = doc.imageData;
    
    modal.style.display = 'flex';
}

/**
 * Close preview modal
 */
function closePreviewModal() {
    document.getElementById('previewModal').style.display = 'none';
    currentPreviewDoc = null;
}

/**
 * Download from preview
 */
function downloadCurrentDocument() {
    if (currentPreviewDoc) {
        downloadDocument(currentPreviewDoc.id);
    }
}

// ===== RENAME FUNCTIONALITY =====

/**
 * Open rename modal
 */
function openRenameModal(docId) {
    const doc = getDocumentById(docId);
    if (!doc) return;
    
    currentRenameDocId = docId;
    
    const modal = document.getElementById('renameModal');
    const input = document.getElementById('renameName');
    
    input.value = doc.name;
    modal.style.display = 'flex';
    input.focus();
    input.select();
}

/**
 * Close rename modal
 */
function closeRenameModal() {
    document.getElementById('renameModal').style.display = 'none';
    currentRenameDocId = null;
}

/**
 * Confirm rename
 */
function confirmRename() {
    const newName = document.getElementById('renameName').value.trim();
    
    if (!newName) {
        showToast('Please enter a document name');
        return;
    }
    
    if (currentRenameDocId) {
        updateDocument(currentRenameDocId, { name: newName });
        closeRenameModal();
        loadDocuments();
        showToast('Document renamed successfully');
    }
}

// Handle Enter key in rename input
document.addEventListener('DOMContentLoaded', () => {
    const renameInput = document.getElementById('renameName');
    if (renameInput) {
        renameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                confirmRename();
            }
        });
    }
});

// ===== DELETE FUNCTIONALITY =====

/**
 * Open delete confirmation
 */
function openDeleteConfirm(docId) {
    const doc = getDocumentById(docId);
    if (!doc) return;
    
    if (confirm(`Delete "${doc.name}"? This cannot be undone.`)) {
        deleteDocument(docId);
        loadDocuments();
        showToast('Document deleted');
    }
}

// ===== KEYBOARD SHORTCUTS =====

document.addEventListener('keydown', (e) => {
    // Close modals with Escape
    if (e.key === 'Escape') {
        const previewModal = document.getElementById('previewModal');
        const renameModal = document.getElementById('renameModal');
        
        if (previewModal && previewModal.style.display === 'flex') {
            closePreviewModal();
        }
        if (renameModal && renameModal.style.display === 'flex') {
            closeRenameModal();
        }
    }
});

/* =========================================================
   Scanify — Documents Page Script
   File: js/documents.js
   Handles: List, Search, Preview, Rename, Delete, Download
   ========================================================= */

(function () {
    'use strict';

    /* ---------- Constants ---------- */
    const SEARCH_DEBOUNCE_MS = 200;

    /* ---------- State ---------- */
    const state = {
        allDocuments:       [],
        filteredDocuments:  [],
        previewDoc:         null,
        renameDocId:        null,
        deleteDocId:        null,
        searchQuery:        '',
        searchTimer:        null
    };

    /* =========================================================
       UTILITIES
       ========================================================= */

    function $(id) { return document.getElementById(id); }

    function toast(msg, type) {
        if (typeof window.showToast === 'function') {
            window.showToast(msg, type);
        } else {
            console.log(`[${type || 'info'}] ${msg}`);
        }
    }

    /** Safe text formatter for date */
    function formatDate(value) {
        if (!value) return '—';
        try {
            const d = typeof value === 'number' ? new Date(value) : new Date(value);
            if (isNaN(d.getTime())) return '—';
            return d.toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric'
            });
        } catch {
            return '—';
        }
    }

    /** Escape HTML — extra safety layer */
    function escapeHTML(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /** Build a safe placeholder data-URL */
    function placeholderImage(fileType) {
        const label = escapeHTML((fileType || 'FILE').toUpperCase());
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
            <rect fill="#e5e7eb" width="100" height="100"/>
            <text x="50" y="50" text-anchor="middle" dy=".3em" fill="#6b7280"
                  font-family="sans-serif" font-size="14">${label}</text>
        </svg>`;
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    /** Modal helpers (HTML uses `hidden` attribute) */
    function openModal(id) {
        const modal = $(id);
        if (!modal) return;
        modal.hidden = false;
        document.body.style.overflow = 'hidden';
    }

    function closeModal(id) {
        const modal = $(id);
        if (!modal) return;
        modal.hidden = true;
        document.body.style.overflow = '';
    }

    /* =========================================================
       DATA LOADING
       ========================================================= */

    function loadAllDocuments() {
        // Prefer app.js helper
        const docs = (typeof window.getDocuments === 'function')
            ? window.getDocuments()
            : readDocumentsFallback();

        // Sort newest first WITHOUT mutating the source
        state.allDocuments = [...docs].sort((a, b) => {
            const ta = new Date(a.createdAt).getTime() || 0;
            const tb = new Date(b.createdAt).getTime() || 0;
            return tb - ta;
        });
        state.filteredDocuments = state.allDocuments;
    }

    function readDocumentsFallback() {
        try {
            return JSON.parse(localStorage.getItem('scanify_docs') || '[]');
        } catch {
            return [];
        }
    }

    /* =========================================================
       RENDERING
       ========================================================= */

    function renderDocuments() {
        const container  = $('documentsGrid');
        const emptyState = $('emptyState');
        const noResults  = $('noSearchResults');
        if (!container) return;

        const list = state.filteredDocuments;
        const hasAny = state.allDocuments.length > 0;
        const hasQuery = state.searchQuery.length > 0;

        // Set aria-busy while rendering
        container.setAttribute('aria-busy', 'true');

        // Clear and rebuild
        container.innerHTML = '';

        // Toggle empty states
        if (list.length === 0) {
            if (hasQuery && hasAny) {
                if (emptyState) emptyState.hidden = true;
                if (noResults)  noResults.hidden  = false;
            } else {
                if (emptyState) emptyState.hidden = false;
                if (noResults)  noResults.hidden  = true;
            }
            container.setAttribute('aria-busy', 'false');
            return;
        }

        if (emptyState) emptyState.hidden = true;
        if (noResults)  noResults.hidden  = true;

        const fragment = document.createDocumentFragment();
        list.forEach(doc => fragment.appendChild(createDocumentCard(doc)));
        container.appendChild(fragment);

        container.setAttribute('aria-busy', 'false');
    }

    /** Safe card creation — no innerHTML with user data */
    function createDocumentCard(doc) {
        const card = document.createElement('article');
        card.className = 'document-card';
        card.dataset.docId = doc.id;

        /* ---- Image ---- */
        const imageWrap = document.createElement('div');
        imageWrap.className = 'card-image';

        const img = document.createElement('img');
        img.src = doc.imageData || placeholderImage(doc.fileType);
        img.alt = doc.name ? `${doc.name} preview` : 'Scanned document';
        img.loading = 'lazy';
        img.onerror = () => {
            img.onerror = null;
            img.src = placeholderImage(doc.fileType);
        };
        imageWrap.appendChild(img);

        /* ---- Content ---- */
        const content = document.createElement('div');
        content.className = 'card-content';

        const title = document.createElement('h3');
        title.textContent = doc.name || 'Untitled';
        title.title = doc.name || 'Untitled';

        const date = document.createElement('p');
        date.className = 'card-date';
        date.textContent = formatDate(doc.createdAt);

        /* ---- Actions ---- */
        const actions = document.createElement('div');
        actions.className = 'card-actions';

        actions.appendChild(makeIconButton({
            action: 'preview-document',
            title:  'Preview',
            label:  `Preview ${doc.name || 'document'}`,
            icon:   'fa-eye',
            docId:  doc.id
        }));

        actions.appendChild(makeIconButton({
            action: 'download-document',
            title:  'Download',
            label:  `Download ${doc.name || 'document'}`,
            icon:   'fa-download',
            docId:  doc.id
        }));

        actions.appendChild(makeIconButton({
            action: 'rename-document',
            title:  'Rename',
            label:  `Rename ${doc.name || 'document'}`,
            icon:   'fa-edit',
            docId:  doc.id
        }));

        actions.appendChild(makeIconButton({
            action: 'delete-document',
            title:  'Delete',
            label:  `Delete ${doc.name || 'document'}`,
            icon:   'fa-trash',
            docId:  doc.id,
            extraClass: 'btn-icon--danger'
        }));

        content.append(title, date, actions);
        card.append(imageWrap, content);

        return card;
    }

    function makeIconButton({ action, title, label, icon, docId, extraClass }) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-icon' + (extraClass ? ' ' + extraClass : '');
        btn.title = title;
        btn.setAttribute('aria-label', label);
        btn.dataset.action = action;
        btn.dataset.docId = docId;

        const i = document.createElement('i');
        i.className = `fas ${icon}`;
        i.setAttribute('aria-hidden', 'true');
        btn.appendChild(i);

        return btn;
    }

    /* =========================================================
       SEARCH
       ========================================================= */

    function performSearch(query) {
        state.searchQuery = query;

        if (!query) {
            state.filteredDocuments = state.allDocuments;
        } else {
            const q = query.toLowerCase();
            state.filteredDocuments = state.allDocuments.filter(doc =>
                (doc.name || '').toLowerCase().includes(q) ||
                (doc.fileType || '').toLowerCase().includes(q)
            );
        }

        renderDocuments();
    }

    function handleSearchInput(event) {
        const value = event.target.value;
        const clearBtn = $('clearSearchBtn');

        // Toggle clear button visibility immediately
        if (clearBtn) clearBtn.hidden = value.length === 0;

        // Debounce actual filtering
        if (state.searchTimer) clearTimeout(state.searchTimer);
        state.searchTimer = setTimeout(() => {
            performSearch(value.trim());
        }, SEARCH_DEBOUNCE_MS);
    }

    function clearSearch() {
        const input = $('searchInput');
        if (input) input.value = '';
        const clearBtn = $('clearSearchBtn');
        if (clearBtn) clearBtn.hidden = true;
        performSearch('');
        if (input) input.focus();
    }

    /* =========================================================
       PREVIEW
       ========================================================= */

    function openPreview(docId) {
        const doc = findDocById(docId);
        if (!doc) {
            toast('Document not found.', 'error');
            return;
        }

        state.previewDoc = doc;

        const title = $('previewTitle');
        const image = $('previewImage');

        if (title) title.textContent = doc.name || 'Document Preview';
        if (image) {
            image.src = doc.imageData || placeholderImage(doc.fileType);
            image.alt = doc.name ? `${doc.name} preview` : 'Document preview';
            image.onerror = () => {
                image.onerror = null;
                image.src = placeholderImage(doc.fileType);
            };
        }

        openModal('previewModal');
    }

    function closePreviewModal() {
        closeModal('previewModal');
        state.previewDoc = null;

        // Clear src to free memory
        const image = $('previewImage');
        if (image) image.removeAttribute('src');
    }

    function downloadCurrentDocument() {
        if (!state.previewDoc) return;
        downloadDocumentById(state.previewDoc.id);
    }

    /* =========================================================
       DOWNLOAD
       ========================================================= */

    function downloadDocumentById(docId) {
        const doc = findDocById(docId);
        if (!doc) {
            toast('Document not found.', 'error');
            return;
        }

        // Prefer app.js helper
        if (typeof window.downloadDocument === 'function') {
            window.downloadDocument(docId);
            return;
        }

        // Fallback
        try {
            const safeName = (doc.name || 'document')
                .replace(/[^\w\s-]/g, '')
                .trim()
                .replace(/\s+/g, '-') || 'document';

            const a = document.createElement('a');
            a.href = doc.imageData;
            a.download = `${safeName}.jpg`;
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            toast('Document downloaded', 'success');
        } catch (err) {
            console.error(err);
            toast('Failed to download document.', 'error');
        }
    }

    /* =========================================================
       RENAME
       ========================================================= */

    function openRenameModal(docId) {
        const doc = findDocById(docId);
        if (!doc) {
            toast('Document not found.', 'error');
            return;
        }

        state.renameDocId = docId;

        const input = $('renameName');
        if (input) {
            input.value = doc.name || '';
        }

        openModal('renameModal');

        // Focus and select after modal is visible
        if (input) {
            setTimeout(() => {
                input.focus();
                input.select();
            }, 50);
        }
    }

    function closeRenameModal() {
        closeModal('renameModal');
        state.renameDocId = null;
        const input = $('renameName');
        if (input) input.value = '';
    }

    function confirmRename(event) {
        if (event) event.preventDefault();

        const input = $('renameName');
        const newName = input ? input.value.trim() : '';

        if (!newName) {
            toast('Please enter a document name', 'error');
            if (input) input.focus();
            return;
        }

        if (!state.renameDocId) return;

        const doc = findDocById(state.renameDocId);
        if (!doc) {
            toast('Document not found.', 'error');
            closeRenameModal();
            return;
        }

        // Check name actually changed
        if (doc.name === newName) {
            closeRenameModal();
            return;
        }

        // Prefer app.js update
        let updated = false;
        if (typeof window.updateDocument === 'function') {
            updated = window.updateDocument(state.renameDocId, { name: newName });
        } else {
            updated = updateDocumentFallback(state.renameDocId, { name: newName });
        }

        if (!updated) {
            toast('Failed to rename document.', 'error');
            return;
        }

        closeRenameModal();
        loadAllDocuments();
        // Re-apply current search filter
        performSearch(state.searchQuery);
        toast('Document renamed successfully', 'success');
    }

    function updateDocumentFallback(docId, updates) {
        try {
            const stored = readDocumentsFallback();
            const idx = stored.findIndex(d => d.id === docId);
            if (idx === -1) return false;
            stored[idx] = { ...stored[idx], ...updates };
            localStorage.setItem('scanify_docs', JSON.stringify(stored));
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    }

    /* =========================================================
       DELETE
       ========================================================= */

    function openDeleteConfirm(docId) {
        const doc = findDocById(docId);
        if (!doc) {
            toast('Document not found.', 'error');
            return;
        }

        state.deleteDocId = docId;

        const nameEl = $('deleteDocName');
        if (nameEl) nameEl.textContent = doc.name || 'this document';

        openModal('deleteModal');
    }

    function closeDeleteModal() {
        closeModal('deleteModal');
        state.deleteDocId = null;
    }

    function confirmDelete() {
        if (!state.deleteDocId) return;

        let deleted = false;
        if (typeof window.deleteDocument === 'function') {
            deleted = window.deleteDocument(state.deleteDocId) !== false;
        } else {
            deleted = deleteDocumentFallback(state.deleteDocId);
        }

        if (!deleted) {
            toast('Failed to delete document.', 'error');
            return;
        }

        closeDeleteModal();
        loadAllDocuments();
        performSearch(state.searchQuery);
        toast('Document deleted', 'success');
    }

    function deleteDocumentFallback(docId) {
        try {
            const stored = readDocumentsFallback();
            const filtered = stored.filter(d => d.id !== docId);
            if (filtered.length === stored.length) return false;
            localStorage.setItem('scanify_docs', JSON.stringify(filtered));
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    }

    /* =========================================================
       HELPERS
       ========================================================= */

    function findDocById(docId) {
        // Prefer app.js helper
        if (typeof window.getDocumentById === 'function') {
            const d = window.getDocumentById(docId);
            if (d) return d;
        }
        return state.allDocuments.find(d => d.id === docId) || null;
    }

    /* =========================================================
       EVENT DELEGATION
       ========================================================= */

    function handleClick(event) {
        /* ---- Action buttons ---- */
        const actionEl = event.target.closest('[data-action]');
        if (actionEl) {
            const action = actionEl.dataset.action;
            const docId  = actionEl.dataset.docId;

            switch (action) {
                case 'preview-document':  openPreview(docId);       return;
                case 'download-document': downloadDocumentById(docId); return;
                case 'rename-document':   openRenameModal(docId);   return;
                case 'delete-document':   openDeleteConfirm(docId); return;
                case 'clear-search':      clearSearch();            return;
                case 'reset-search':      clearSearch();            return;
                case 'go-to-scanner':
                    window.location.href = 'scanner.html';
                    return;
            }
        }

        /* ---- Modal closers ---- */
        const closer = event.target.closest('[data-close-modal]');
        if (closer) {
            const which = closer.dataset.closeModal;
            if (which === 'preview') closePreviewModal();
            if (which === 'rename')  closeRenameModal();
            if (which === 'delete')  closeDeleteModal();
        }
    }

    function handleInput(event) {
        const t = event.target;
        if (t.id === 'searchInput') {
            handleSearchInput(event);
        }
    }

    function handleSubmit(event) {
        if (event.target.id === 'renameForm') {
            event.preventDefault();
            confirmRename(event);
        }
    }

    function handleKeydown(event) {
        if (event.key !== 'Escape') return;

        const preview = $('previewModal');
        const rename  = $('renameModal');
        const del     = $('deleteModal');

        if (preview && !preview.hidden) closePreviewModal();
        if (rename  && !rename.hidden)  closeRenameModal();
        if (del     && !del.hidden)     closeDeleteModal();
    }

    /* =========================================================
       INIT
       ========================================================= */

    function init() {
        loadAllDocuments();
        renderDocuments();

        document.addEventListener('click',   handleClick);
        document.addEventListener('input',   handleInput);
        document.addEventListener('submit',  handleSubmit);
        document.addEventListener('keydown', handleKeydown);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
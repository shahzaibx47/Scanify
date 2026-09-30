/* =========================================================
   Scanify — Tools Page Script
   File: js/tools.js
   Handles: Image Compression, Image → PDF, Merge Images
   ========================================================= */

(function () {
    'use strict';

    /* ---------- Constants ---------- */
    const MAX_FILE_SIZE_MB   = 20;
    const MAX_FILE_SIZE      = MAX_FILE_SIZE_MB * 1024 * 1024;
    const ACCEPTED_TYPES     = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
    const DEFAULT_QUALITY    = 80;
    const A4_MARGIN_MM       = 10;

    /* ---------- State ---------- */
    const state = {
        compression: {
            image: null,
            originalDataURL: null,
            quality: DEFAULT_QUALITY
        },
        pdf:   { images: [] },
        merge: { images: [] }
    };

    /* =========================================================
       UTILITIES
       ========================================================= */

    /** Safely show a toast if app.js provides one */
    function toast(msg) {
        if (typeof window.showToast === 'function') {
            window.showToast(msg);
        } else {
            console.log('[Toast]', msg);
        }
    }

    /** Validate file type + size */
    function isValidImage(file) {
        if (!file) return { ok: false, reason: 'No file selected.' };
        if (!ACCEPTED_TYPES.includes(file.type)) {
            return { ok: false, reason: `"${file.name}" is not a supported image.` };
        }
        if (file.size > MAX_FILE_SIZE) {
            return { ok: false, reason: `"${file.name}" exceeds ${MAX_FILE_SIZE_MB} MB.` };
        }
        return { ok: true };
    }

    /** Read a file as Data URL (Promise) */
    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = () => resolve(reader.result);
            reader.onerror = () => reject(new Error(`Failed to read "${file.name}".`));
            reader.readAsDataURL(file);
        });
    }

    /** Load an Image element (Promise) */
    function loadImageElement(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload  = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to decode image.'));
            img.src = src;
        });
    }

    /** Convert file → loaded HTMLImageElement + dataURL (Promise) */
    async function fileToImage(file) {
        const dataURL = await readFileAsDataURL(file);
        const img     = await loadImageElement(dataURL);
        return { src: dataURL, img, name: file.name };
    }

    /** Get approximate size (KB) from a data URL */
    function getDataURLFileSize(dataURL) {
        // base64 length → bytes: (len * 3) / 4, minus padding
        const base64 = dataURL.split(',')[1] || '';
        const padding = (base64.match(/=+$/) || [''])[0].length;
        const bytes = (base64.length * 3) / 4 - padding;
        return (bytes / 1024).toFixed(2);
    }

    /** Safely download a data URL or blob URL */
    function triggerDownload(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Revoke object URLs after a tick
        if (url.startsWith('blob:')) {
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    }

    /** Focus trap helper for modals */
    function focusFirst(container) {
        const focusable = container.querySelector(
            'button:not([disabled]):not([hidden]), [href], input:not([hidden]), select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable) focusable.focus();
    }

    /** Modal open/close helpers */
    function openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.hidden = false;
        document.body.style.overflow = 'hidden';
        focusFirst(modal);
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.hidden = true;
        document.body.style.overflow = '';
    }

    /* =========================================================
       COMPRESSION TOOL
       ========================================================= */

    function openCompressionTool() {
        resetCompressionState();
        openModal('compressionModal');
    }

    function closeCompressionModal() {
        closeModal('compressionModal');
        resetCompressionState();
    }

    function resetCompressionState() {
        state.compression.image = null;
        state.compression.originalDataURL = null;
        state.compression.quality = DEFAULT_QUALITY;

        const input = document.getElementById('compressionInput');
        if (input) input.value = '';

        const controls  = document.getElementById('compressionControls');
        const preview   = document.getElementById('compressionPreview');
        const downloadBtn = document.getElementById('downloadCompressionBtn');
        const slider    = document.getElementById('qualitySlider');

        if (controls)   controls.hidden = true;
        if (preview)    preview.hidden = true;
        if (downloadBtn) downloadBtn.hidden = true;
        if (slider)     slider.value = String(DEFAULT_QUALITY);

        const qv = document.getElementById('qualityValue');
        if (qv) qv.textContent = DEFAULT_QUALITY + '%';
    }

    async function loadCompressionImage(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        const check = isValidImage(file);
        if (!check.ok) {
            toast(check.reason);
            event.target.value = '';
            return;
        }

        try {
            const { img } = await fileToImage(file);
            state.compression.image = img;
            state.compression.quality = DEFAULT_QUALITY;
            showCompressionPreview();
            toast('Image loaded');
        } catch (err) {
            console.error(err);
            toast('Failed to load image.');
        }
    }

    function showCompressionPreview() {
        const img = state.compression.image;
        if (!img) return;

        const controls    = document.getElementById('compressionControls');
        const preview     = document.getElementById('compressionPreview');
        const canvas      = document.getElementById('compressionCanvas');
        const downloadBtn = document.getElementById('downloadCompressionBtn');
        const originalSpan = document.getElementById('originalSize');

        // Draw original at full quality to measure "original" size
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        state.compression.originalDataURL = canvas.toDataURL('image/jpeg', 1.0);
        if (originalSpan) {
            originalSpan.textContent = getDataURLFileSize(state.compression.originalDataURL) + ' KB';
        }

        if (controls)    controls.hidden = false;
        if (preview)     preview.hidden = false;
        if (downloadBtn) downloadBtn.hidden = false;

        applyCompressionQuality(state.compression.quality);
    }

    function updateCompressionQuality(value) {
        const q = Math.max(10, Math.min(100, parseInt(value, 10) || DEFAULT_QUALITY));
        state.compression.quality = q;
        applyCompressionQuality(q);
    }

    function applyCompressionQuality(quality) {
        const img = state.compression.image;
        if (!img) return;

        const canvas = document.getElementById('compressionCanvas');
        const ctx = canvas.getContext('2d');

        // Redraw original
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        // Measure compressed size
        const compressedURL = canvas.toDataURL('image/jpeg', quality / 100);
        const span = document.getElementById('compressedSize');
        if (span) span.textContent = getDataURLFileSize(compressedURL) + ' KB';

        // Update UI labels
        const qv = document.getElementById('qualityValue');
        if (qv) qv.textContent = quality + '%';

        const slider = document.getElementById('qualitySlider');
        if (slider) slider.setAttribute('aria-valuenow', String(quality));
    }

    function downloadCompressed() {
        const img = state.compression.image;
        if (!img) {
            toast('No image loaded.');
            return;
        }

        try {
            const canvas = document.getElementById('compressionCanvas');
            const dataURL = canvas.toDataURL('image/jpeg', state.compression.quality / 100);

            // Convert to blob for better download handling
            const byteString = atob(dataURL.split(',')[1]);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
            const blob = new Blob([ab], { type: 'image/jpeg' });
            const url  = URL.createObjectURL(blob);

            triggerDownload(url, `scanify-compressed-${Date.now()}.jpg`);
            closeCompressionModal();
            toast('Compressed image downloaded');
        } catch (err) {
            console.error(err);
            toast('Failed to download image.');
        }
    }

    /* =========================================================
       IMAGE → PDF TOOL
       ========================================================= */

    function openImageToPdfTool() {
        state.pdf.images = [];
        openModal('imageToPdfModal');
    }

    function closeImageToPdfModal() {
        closeModal('imageToPdfModal');
        resetPdfState();
    }

    function resetPdfState() {
        state.pdf.images = [];
        const input = document.getElementById('pdfInput');
        if (input) input.value = '';
        const preview = document.getElementById('pdfPreview');
        if (preview) preview.hidden = true;
        const list = document.getElementById('pdfImageList');
        if (list) list.innerHTML = '';
        const btn = document.getElementById('generatePdfBtn');
        if (btn) btn.hidden = true;
    }

    async function loadPdfImages(event) {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) return;

        // Validate all
        const invalid = files.map(isValidImage).find(r => !r.ok);
        if (invalid) {
            toast(invalid.reason);
            event.target.value = '';
            return;
        }

        try {
            const loaded = await Promise.all(files.map(fileToImage));
            state.pdf.images = loaded;
            showPdfPreview();
        } catch (err) {
            console.error(err);
            toast('Failed to load one or more images.');
        }
    }

    function showPdfPreview() {
        const preview = document.getElementById('pdfPreview');
        const list    = document.getElementById('pdfImageList');
        const btn     = document.getElementById('generatePdfBtn');
        if (!list) return;

        // Build preview safely (no innerHTML with user data)
        list.innerHTML = '';
        state.pdf.images.forEach((item, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'image-item';

            const img = document.createElement('img');
            img.src = item.src;
            img.alt = `Selected image ${index + 1}`;
            img.loading = 'lazy';

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'remove-btn';
            removeBtn.title = 'Remove';
            removeBtn.setAttribute('aria-label', `Remove image ${index + 1}`);
            removeBtn.dataset.action = 'remove-pdf-image';
            removeBtn.dataset.index = String(index);
            removeBtn.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';

            wrapper.append(img, removeBtn);
            list.appendChild(wrapper);
        });

        if (preview) preview.hidden = state.pdf.images.length === 0;
        if (btn)     btn.hidden     = state.pdf.images.length === 0;
    }

    function removePdfImage(index) {
        if (index < 0 || index >= state.pdf.images.length) return;
        state.pdf.images.splice(index, 1);
        showPdfPreview();
    }

    async function generatePdf() {
        if (state.pdf.images.length === 0) {
            toast('Please select at least one image.');
            return;
        }

        if (!window.jspdf || !window.jspdf.jsPDF) {
            toast('PDF library not loaded. Please refresh the page.');
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

            const pageWidth  = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            state.pdf.images.forEach((item, index) => {
                if (index > 0) doc.addPage();

                // Choose best format
                const fmt = item.src.startsWith('data:image/png') ? 'PNG' : 'JPEG';

                // Fit to page with margins, preserve aspect ratio
                const maxW = pageWidth  - A4_MARGIN_MM * 2;
                const maxH = pageHeight - A4_MARGIN_MM * 2;
                const ratio = Math.min(maxW / item.img.naturalWidth, maxH / item.img.naturalHeight);
                const drawW = item.img.naturalWidth  * ratio;
                const drawH = item.img.naturalHeight * ratio;
                const x = (pageWidth  - drawW) / 2;
                const y = (pageHeight - drawH) / 2;

                doc.addImage(item.src, fmt, x, y, drawW, drawH, undefined, 'FAST');
            });

            doc.save(`scanify-${Date.now()}.pdf`);
            closeImageToPdfModal();
            toast('PDF generated and downloaded');
        } catch (err) {
            console.error(err);
            toast('Failed to generate PDF.');
        }
    }

    /* =========================================================
       MERGE IMAGES TOOL
       ========================================================= */

    function openMergeTool() {
        state.merge.images = [];
        openModal('mergeModal');
    }

    function closeMergeModal() {
        closeModal('mergeModal');
        resetMergeState();
    }

    function resetMergeState() {
        state.merge.images = [];
        const input = document.getElementById('mergeInput');
        if (input) input.value = '';
        const preview = document.getElementById('mergePreview');
        if (preview) preview.hidden = true;
        const list = document.getElementById('mergeImageList');
        if (list) list.innerHTML = '';
        const btn = document.getElementById('mergeImagesBtn');
        if (btn) btn.hidden = true;
    }

    async function loadMergeImages(event) {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) return;

        const invalid = files.map(isValidImage).find(r => !r.ok);
        if (invalid) {
            toast(invalid.reason);
            event.target.value = '';
            return;
        }

        try {
            const loaded = await Promise.all(files.map(fileToImage));
            state.merge.images = loaded;
            showMergePreview();
        } catch (err) {
            console.error(err);
            toast('Failed to load one or more images.');
        }
    }

    function showMergePreview() {
        const preview = document.getElementById('mergePreview');
        const list    = document.getElementById('mergeImageList');
        const btn     = document.getElementById('mergeImagesBtn');
        if (!list) return;

        list.innerHTML = '';
        state.merge.images.forEach((item, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'image-item';

            const img = document.createElement('img');
            img.src = item.src;
            img.alt = `Image ${index + 1}`;
            img.loading = 'lazy';

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'remove-btn';
            removeBtn.title = 'Remove';
            removeBtn.setAttribute('aria-label', `Remove image ${index + 1}`);
            removeBtn.dataset.action = 'remove-merge-image';
            removeBtn.dataset.index = String(index);
            removeBtn.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';

            wrapper.append(img, removeBtn);
            list.appendChild(wrapper);
        });

        if (preview) preview.hidden = state.merge.images.length === 0;
        // Merge needs at least 2 images
        if (btn) btn.hidden = state.merge.images.length < 2;
    }

    function removeMergeImage(index) {
        if (index < 0 || index >= state.merge.images.length) return;
        state.merge.images.splice(index, 1);
        showMergePreview();
    }

    function mergeImages() {
        if (state.merge.images.length < 2) {
            toast('Please select at least 2 images.');
            return;
        }

        try {
            const targetWidth = Math.max(...state.merge.images.map(i => i.img.naturalWidth));

            // Calculate total height after scaling each to targetWidth
            let totalHeight = 0;
            const scaled = state.merge.images.map(item => {
                const scale = targetWidth / item.img.naturalWidth;
                const w = targetWidth;
                const h = Math.round(item.img.naturalHeight * scale);
                totalHeight += h;
                return { img: item.img, w, h };
            });

            const canvas = document.createElement('canvas');
            canvas.width  = targetWidth;
            canvas.height = totalHeight;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            let y = 0;
            scaled.forEach(({ img, w, h }) => {
                ctx.drawImage(img, 0, y, w, h);
                y += h;
            });

            // Convert to blob for efficient download
            canvas.toBlob((blob) => {
                if (!blob) {
                    toast('Failed to create merged image.');
                    return;
                }
                const url = URL.createObjectURL(blob);
                triggerDownload(url, `scanify-merged-${Date.now()}.jpg`);
                closeMergeModal();
                toast('Images merged and downloaded');
            }, 'image/jpeg', 0.95);
        } catch (err) {
            console.error(err);
            toast('Failed to merge images.');
        }
    }

    /* =========================================================
       EVENT DELEGATION
       ========================================================= */

    function handleClick(event) {
        // data-action buttons
        const actionEl = event.target.closest('[data-action]');
        if (actionEl) {
            const action = actionEl.dataset.action;

            // index-based actions (remove)
            if (action === 'remove-pdf-image') {
                removePdfImage(parseInt(actionEl.dataset.index, 10));
                return;
            }
            if (action === 'remove-merge-image') {
                removeMergeImage(parseInt(actionEl.dataset.index, 10));
                return;
            }

            switch (action) {
                case 'go-to-scanner':
                    window.location.href = 'scanner.html';
                    return;
                case 'open-compression-tool':
                    openCompressionTool();
                    return;
                case 'open-image-to-pdf-tool':
                    openImageToPdfTool();
                    return;
                case 'open-merge-tool':
                    openMergeTool();
                    return;
                case 'download-compressed':
                    downloadCompressed();
                    return;
                case 'generate-pdf':
                    generatePdf();
                    return;
                case 'merge-images':
                    mergeImages();
                    return;
            }
        }

        // data-close-modal
        const closer = event.target.closest('[data-close-modal]');
        if (closer) {
            const which = closer.dataset.closeModal;
            if (which === 'compression')  closeCompressionModal();
            if (which === 'image-to-pdf') closeImageToPdfModal();
            if (which === 'merge')        closeMergeModal();
        }
    }

    function handleInput(event) {
        const t = event.target;

        if (t.id === 'compressionInput') {
            loadCompressionImage(event);
        } else if (t.id === 'pdfInput') {
            loadPdfImages(event);
        } else if (t.id === 'mergeInput') {
            loadMergeImages(event);
        } else if (t.id === 'qualitySlider') {
            // live update on input event
            updateCompressionQuality(t.value);
        }
    }

    function handleChange(event) {
        // Fallback for browsers where 'input' may not fire on file inputs
        const t = event.target;
        if (t.type === 'file' &&
            (t.id === 'compressionInput' || t.id === 'pdfInput' || t.id === 'mergeInput')) {
            // 'input' already handled it in modern browsers; this is a safety net
            // (avoid double handling by checking if already loaded)
        }
    }

    function handleKeydown(event) {
        if (event.key === 'Escape') {
            if (!document.getElementById('compressionModal')?.hidden) closeCompressionModal();
            if (!document.getElementById('imageToPdfModal')?.hidden)  closeImageToPdfModal();
            if (!document.getElementById('mergeModal')?.hidden)       closeMergeModal();
        }
    }

    /* =========================================================
       INIT
       ========================================================= */

    function init() {
        document.addEventListener('click',   handleClick);
        document.addEventListener('input',   handleInput);
        document.addEventListener('change',  handleChange);
        document.addEventListener('keydown', handleKeydown);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
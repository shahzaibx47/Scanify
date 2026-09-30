/* =========================================================
   Scanify — Scanner Page Script
   File: js/scanner.js
   Handles: Camera, File Upload, Canvas editing, Filters,
            Crop, Rotate, Save to storage
   ========================================================= */

(function () {
    'use strict';

    /* ---------- Constants ---------- */
    const MAX_FILE_SIZE_MB   = 25;
    const MAX_FILE_SIZE      = MAX_FILE_SIZE_MB * 1024 * 1024;
    const ACCEPTED_TYPES     = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
    const JPEG_EXPORT_QUALITY = 0.90;
    const CROP_MIN_SIZE      = 20;   // in pixels

    /* ---------- State ---------- */
    const state = {
        currentImage:  null,   // ImageData (edited)
        originalImage: null,   // ImageData (for non-destructive edits)
        currentFilter: 'original',
        mediaStream:   null,
        crop: {
            active: false,
            startX: 0,
            startY: 0,
            endX:   0,
            endY:   0,
            listeners: null
        }
    };

    /* =========================================================
       UTILITIES
       ========================================================= */

    function toast(msg, type) {
        if (typeof window.showToast === 'function') {
            window.showToast(msg, type);
        } else {
            console.log(`[${type || 'info'}] ${msg}`);
        }
    }

    function $(id) { return document.getElementById(id); }

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

    function setSection(name) {
        // name: 'options' | 'camera' | 'editor'
        const map = {
            options: $('scanOptions'),
            camera:  $('cameraSection'),
            editor:  $('editorSection'),
            error:   $('cameraError')
        };

        Object.entries(map).forEach(([key, el]) => {
            if (!el) return;
            el.hidden = key !== name;
        });
    }
    async function openCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            toast('Camera is not supported on this device or browser', 'error');
            return;
        }

        let stream = null;

        try {
            // Attempt 1: Prefer back camera with modest resolution
            // (lower resolution = better mobile compatibility)
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        width:  { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                    audio: false
                });
            } catch (err1) {
                console.warn('Back camera with constraints failed, trying simpler:', err1);

                // Attempt 2: Any camera, no constraints
                stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false
                });
            }

            const video = $('cameraPreview');
            if (!video) {
                stream.getTracks().forEach(t => t.stop());
                return;
            }

            state.mediaStream = stream;
            video.srcObject = stream;
            video.setAttribute('playsinline', 'true'); // iOS Safari
            video.muted = true;

            setSection('camera');

            // Try to play (may throw if not allowed by browser policy)
            try {
                await video.play();
            } catch (playErr) {
                console.warn('video.play() failed:', playErr);
            }

            // Wait for video to be ready (has dimensions)
            await waitForVideoReady(video);

            toast('Camera active', 'info');

        } catch (error) {
            console.error('Camera access error:', error);

            // Clean up stream if it was opened
            if (stream) {
                stream.getTracks().forEach(t => t.stop());
                stream = null;
            }
            state.mediaStream = null;

            const errText = $('cameraErrorText');
            if (errText) {
                let msg = 'Unable to access camera. Please check permissions.';
                switch (error.name) {
                    case 'NotAllowedError':
                    case 'PermissionDeniedError':
                        msg = 'Camera permission denied. Tap the lock icon in the address bar and allow camera.';
                        break;
                    case 'NotFoundError':
                    case 'DevicesNotFoundError':
                        msg = 'No camera found on this device.';
                        break;
                    case 'NotReadableError':
                    case 'TrackStartError':
                        msg = 'Camera is busy in another app. Close other apps and try again.';
                        break;
                    case 'OverconstrainedError':
                        msg = 'Camera does not support requested settings.';
                        break;
                    case 'SecurityError':
                        msg = 'Camera blocked. Make sure the page is served over HTTPS.';
                        break;
                }
                errText.textContent = msg;
            }
            setSection('error');
            toast('Unable to access camera.', 'error');
 }
}

    /* =========================================================
       FILE UPLOAD
       ========================================================= */

    function loadImage(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        const check = isValidImage(file);
        if (!check.ok) {
            toast(check.reason, 'error');
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = $('editorCanvas');
                const ctx = canvas.getContext('2d');
                canvas.width  = img.naturalWidth;
                canvas.height = img.naturalHeight;
                ctx.drawImage(img, 0, 0);

                state.originalImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
                state.currentImage  = ctx.getImageData(0, 0, canvas.width, canvas.height);

                setSection('editor');
                toast('Document image loaded', 'success');
            };
            img.onerror = () => {
                toast('Failed to decode image file.', 'error');
            };
            img.src = e.target.result;
        };
        reader.onerror = () => toast('Failed to read file.', 'error');
        reader.readAsDataURL(file);
    }

    /* =========================================================
       EDITING: ROTATE / FILTERS / RESET
       ========================================================= */

    function rotateImage() {
        const canvas = $('editorCanvas');
        if (!canvas || !state.originalImage) return;

        const ctx = canvas.getContext('2d');
        const tmp = document.createElement('canvas');
        tmp.width  = canvas.height;
        tmp.height = canvas.width;

        const tmpCtx = tmp.getContext('2d');
        tmpCtx.translate(tmp.width, 0);
        tmpCtx.rotate(Math.PI / 2);
        tmpCtx.drawImage(canvas, 0, 0);

        canvas.width  = tmp.width;
        canvas.height = tmp.height;
        ctx.drawImage(tmp, 0, 0);

        state.originalImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
        state.currentImage  = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Reset filter select because rotation is now the new base
        const filterSel = $('filterSelect');
        if (filterSel) filterSel.value = 'original';
        state.currentFilter = 'original';

        toast('Image rotated 90°', 'info');
    }

    function applyFilter(filterType) {
        state.currentFilter = filterType;
        const canvas = $('editorCanvas');
        if (!canvas || !state.originalImage) return;

        const ctx = canvas.getContext('2d');
        // Always restore original before applying a new filter
        ctx.putImageData(state.originalImage, 0, 0);

        if (filterType === 'original') {
            state.currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
            return;
        }

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        switch (filterType) {
            case 'grayscale': applyGrayscale(data); break;
            case 'bw':        applyBlackAndWhite(data); break;
            case 'sepia':     applySepia(data); break;
            case 'brightness':applyBrightness(data); break;
            case 'magic':     applyMagicEnhance(data); break;
        }

        ctx.putImageData(imageData, 0, 0);
        state.currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    function applyGrayscale(data) {
        for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            data[i] = data[i + 1] = data[i + 2] = gray;
        }
    }

    function applyBlackAndWhite(data) {
        for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            const bw = gray > 128 ? 255 : 0;
            data[i] = data[i + 1] = data[i + 2] = bw;
        }
    }

    function applySepia(data) {
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            data[i]     = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
            data[i + 1] = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
            data[i + 2] = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
        }
    }

    function applyBrightness(data) {
        const boost = 1.20;
        for (let i = 0; i < data.length; i += 4) {
            data[i]     = Math.min(255, data[i]     * boost);
            data[i + 1] = Math.min(255, data[i + 1] * boost);
            data[i + 2] = Math.min(255, data[i + 2] * boost);
        }
    }

    function applyMagicEnhance(data) {
        const contrast = 1.4;
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i], g = data[i + 1], b = data[i + 2];

            r = factor * (r - 128) + 128;
            g = factor * (g - 128) + 128;
            b = factor * (b - 128) + 128;

            if (r > 160 && g > 160 && b > 160) {
                r = Math.min(255, r * 1.15);
                g = Math.min(255, g * 1.15);
                b = Math.min(255, b * 1.15);
            }

            data[i]     = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.min(255, Math.max(0, b));
        }
    }

    function resetImage() {
        const canvas = $('editorCanvas');
        if (!canvas || !state.originalImage) return;

        const ctx = canvas.getContext('2d');
        ctx.putImageData(state.originalImage, 0, 0);
        state.currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const filterSel = $('filterSelect');
        if (filterSel) filterSel.value = 'original';
        state.currentFilter = 'original';

        toast('Image reset to original', 'info');
    }

    /* =========================================================
       CROP ENGINE
       ========================================================= */

    function enableCrop() {
        const canvas = $('editorCanvas');
        const cropCanvas = $('cropCanvas');
        if (!canvas || !cropCanvas) return;

        cropCanvas.width  = canvas.width;
        cropCanvas.height = canvas.height;
        cropCanvas.getContext('2d').drawImage(canvas, 0, 0);

        setCropModal(true);
        setupCropSelection(cropCanvas);
    }

    function setCropModal(open) {
        const modal = $('cropModal');
        if (!modal) return;
        modal.hidden = !open;
        document.body.style.overflow = open ? 'hidden' : '';
    }

    function setupCropSelection(canvas) {
        // Reset crop coords
        state.crop.startX = state.crop.startY = 0;
        state.crop.endX   = state.crop.endY   = 0;
        state.crop.active = false;

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: (clientX - rect.left) * scaleX,
                y: (clientY - rect.top)  * scaleY
            };
        };

        const onStart = (e) => {
            e.preventDefault();
            state.crop.active = true;
            const pos = getPos(e);
            state.crop.startX = pos.x;
            state.crop.startY = pos.y;
            state.crop.endX = pos.x;
            state.crop.endY = pos.y;
        };

        const onMove = (e) => {
            if (!state.crop.active) return;
            e.preventDefault();
            const pos = getPos(e);
            state.crop.endX = pos.x;
            state.crop.endY = pos.y;
            redrawCropOverlay(canvas);
        };

        const onEnd = () => { state.crop.active = false; };

        // Use addEventListener so we can remove them later
        const opts = { passive: false };
        canvas.addEventListener('mousedown', onStart, opts);
        canvas.addEventListener('mousemove', onMove, opts);
        canvas.addEventListener('mouseup',   onEnd, opts);
        canvas.addEventListener('mouseleave', onEnd, opts);

        canvas.addEventListener('touchstart', onStart, opts);
        canvas.addEventListener('touchmove',  onMove, opts);
        canvas.addEventListener('touchend',   onEnd, opts);

        // Save listeners so we can remove them in cleanup
        state.crop.listeners = { canvas, onStart, onMove, onEnd, opts };
    }

    function redrawCropOverlay(canvas) {
        const mainCanvas = $('editorCanvas');
        if (!mainCanvas) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(mainCanvas, 0, 0);

        const x = Math.min(state.crop.startX, state.crop.endX);
        const y = Math.min(state.crop.startY, state.crop.endY);
        const w = Math.abs(state.crop.endX - state.crop.startX);
        const h = Math.abs(state.crop.endY - state.crop.startY);

        // Dim outside area
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.clearRect(x, y, w, h);
        ctx.drawImage(mainCanvas, x, y, w, h, x, y, w, h);

        // Dashed border
        ctx.strokeStyle = '#2563EB';
        ctx.lineWidth = 4;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(x, y, w, h);
        ctx.restore();
    }

    function applyCrop() {
        const canvas = $('editorCanvas');
        const cropCanvas = $('cropCanvas');
        if (!canvas || !cropCanvas) return;

        const x = Math.min(state.crop.startX, state.crop.endX);
        const y = Math.min(state.crop.startY, state.crop.endY);
        const w = Math.abs(state.crop.endX - state.crop.startX);
        const h = Math.abs(state.crop.endY - state.crop.startY);

        if (w < CROP_MIN_SIZE || h < CROP_MIN_SIZE) {
            toast('Selection area too small', 'error');
            return;
        }

        try {
            const cropCtx = cropCanvas.getContext('2d');
            const croppedData = cropCtx.getImageData(
                Math.round(x), Math.round(y),
                Math.round(w), Math.round(h)
            );

            canvas.width  = Math.round(w);
            canvas.height = Math.round(h);
            canvas.getContext('2d').putImageData(croppedData, 0, 0);

            state.originalImage = canvas.getContext('2d')
                .getImageData(0, 0, canvas.width, canvas.height);
            state.currentImage = state.originalImage;

            // Reset filter since crop is new base
            const filterSel = $('filterSelect');
            if (filterSel) filterSel.value = 'original';
            state.currentFilter = 'original';

            closeCropModal();
            toast('Crop applied successfully', 'success');
        } catch (err) {
            console.error(err);
            toast('Crop failed. Please try again.', 'error');
        }
    }

    function closeCropModal() {
        // Remove crop listeners
        const l = state.crop.listeners;
        if (l) {
            l.canvas.removeEventListener('mousedown', l.onStart);
            l.canvas.removeEventListener('mousemove', l.onMove);
            l.canvas.removeEventListener('mouseup',   l.onEnd);
            l.canvas.removeEventListener('mouseleave',l.onEnd);
            l.canvas.removeEventListener('touchstart', l.onStart);
            l.canvas.removeEventListener('touchmove',  l.onMove);
            l.canvas.removeEventListener('touchend',   l.onEnd);
            state.crop.listeners = null;
        }
        state.crop.active = false;
        setCropModal(false);
    }

    /* =========================================================
       SAVE DOCUMENT
       ========================================================= */

    function openSaveModal() {
        const modal = $('saveModal');
        if (!modal) return;
        modal.hidden = false;
        document.body.style.overflow = 'hidden';

        const input = $('docName');
        if (input) {
            input.value = '';
            setTimeout(() => input.focus(), 50);
        }
    }

    function closeSaveModal() {
        const modal = $('saveModal');
        if (!modal) return;
        modal.hidden = true;
        document.body.style.overflow = '';
    }

    /**
     * Save handler — matches the schema used by documents.js and index.html:
     *   { id, name, createdAt, imageData, fileType }
     */
    function confirmSave() {
        const nameInput = $('docName');
        const docName = nameInput ? nameInput.value.trim() : '';

        if (!docName) {
            toast('Please enter a document name', 'error');
            if (nameInput) nameInput.focus();
            return;
        }

        const canvas = $('editorCanvas');
        if (!canvas) return;

        let imageDataUrl;
        try {
            imageDataUrl = canvas.toDataURL('image/jpeg', JPEG_EXPORT_QUALITY);
        } catch (err) {
            console.error(err);
            toast('Failed to export image.', 'error');
            return;
        }

        const doc = {
            id:         'doc_' + Date.now(),
            name:       docName,                       // ← matches documents.html
            createdAt:  Date.now(),                    // ← matches documents.html
            imageData:  imageDataUrl,                  // ← matches documents.html
            fileType:   'JPG'                          // ← matches documents.html
        };

        // Prefer app.js save function if available
        let saved = false;
        if (typeof window.saveDocument === 'function') {
            saved = window.saveDocument(doc);
        } else {
            saved = saveDocumentFallback(doc);
        }

        if (!saved) {
            toast('Storage full! Clear old scans.', 'error');
            return;
        }

        closeSaveModal();
        toast(`"${docName}" saved in Documents!`, 'success');

        setTimeout(() => {
            if (nameInput) nameInput.value = '';
            backToOptions();
        }, 800);
    }

    /** Fallback if app.js is not available */
    function saveDocumentFallback(doc) {
        try {
            const stored = JSON.parse(localStorage.getItem('scanify_docs') || '[]');
            stored.unshift(doc);
            localStorage.setItem('scanify_docs', JSON.stringify(stored));
            return true;
        } catch (err) {
            console.error('Storage error:', err);
            return false;
        }
    }

    function backToOptions() {
        setSection('options');

        const filterSel = $('filterSelect');
        if (filterSel) filterSel.value = 'original';

        state.currentFilter = 'original';
        state.currentImage = null;
        state.originalImage = null;
    }

    /* =========================================================
       EVENT DELEGATION
       ========================================================= */

    function handleClick(event) {
        // data-action buttons
        const actionEl = event.target.closest('[data-action]');
        if (actionEl) {
            const action = actionEl.dataset.action;
            switch (action) {
                case 'show-scan-options':     setSection('options'); return;
                case 'open-camera':           openCamera();          return;
                case 'trigger-file-input':    $('fileInput')?.click(); return;
                case 'capture-photo':         capturePhoto();        return;
                case 'stop-camera':           stopCamera(); setSection('options'); return;
                case 'enable-crop':           enableCrop();          return;
                case 'rotate-image':          rotateImage();         return;
                case 'reset-image':           resetImage();          return;
                case 'save-document':         openSaveModal();       return;
                case 'back-to-options':       backToOptions();       return;
                case 'apply-crop':            applyCrop();           return;
            }
        }

        // data-close-modal
        const closer = event.target.closest('[data-close-modal]');
        if (closer) {
            if (closer.dataset.closeModal === 'crop') closeCropModal();
            if (closer.dataset.closeModal === 'save') closeSaveModal();
        }
    }

    function handleInput(event) {
        const t = event.target;

        if (t.id === 'filterSelect') {
            applyFilter(t.value);
        }
    }

    function handleChange(event) {
        const t = event.target;
        if (t.id === 'fileInput') {
            loadImage(event);
        }
    }

    function handleSubmit(event) {
        if (event.target.id === 'saveForm') {
            event.preventDefault();
            confirmSave();
        }
    }

    function handleKeydown(event) {
        if (event.key === 'Escape') {
            const cropModal = $('cropModal');
            const saveModal = $('saveModal');
            if (cropModal && !cropModal.hidden) closeCropModal();
            if (saveModal && !saveModal.hidden) closeSaveModal();
        }
    }

    /** Release camera on page unload */
    function handleBeforeUnload() {
        stopCamera();
    }

    /* =========================================================
       INIT
       ========================================================= */

    function init() {
        document.addEventListener('click',   handleClick);
        document.addEventListener('input',   handleInput);
        document.addEventListener('change',  handleChange);
        document.addEventListener('submit',  handleSubmit);
        document.addEventListener('keydown', handleKeydown);
        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('pagehide',     handleBeforeUnload);

        setSection('options');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
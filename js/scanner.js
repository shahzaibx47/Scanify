// ===== SCANIFY SCANNER.JS =====
// Camera, image loading, and editing functionality

let currentImage = null;
let originalImage = null;
let currentFilter = 'original';
let isCropping = false;
let cropStartX = 0;
let cropStartY = 0;
let cropEndX = 0;
let cropEndY = 0;

// ===== INITIALIZATION =====

document.addEventListener('DOMContentLoaded', () => {
    initScanner();
});

function initScanner() {
    const scanOptions = document.getElementById('scanOptions');
    if (scanOptions) {
        scanOptions.style.display = 'flex';
    }
}

// ===== CAMERA FUNCTIONS =====

/**
 * Open device camera
 */
function openCamera() {
    const video = document.getElementById('cameraPreview');
    const cameraSection = document.getElementById('cameraSection');
    const scanOptions = document.getElementById('scanOptions');
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Camera is not supported on this device');
        return;
    }
    
    navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' },
        audio: false
    }).then(stream => {
        scanOptions.style.display = 'none';
        cameraSection.style.display = 'flex';
        video.srcObject = stream;
    }).catch(error => {
        showToast('Unable to access camera. Please check permissions.');
        console.error('Camera error:', error);
    });
}

/**
 * Capture photo from camera
 */
function capturePhoto() {
    const video = document.getElementById('cameraPreview');
    const canvas = document.getElementById('editorCanvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0);
    
    // Store original for reset
    originalImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
    currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Stop camera
    stopCamera();
    
    // Show editor
    document.getElementById('editorSection').style.display = 'block';
}

/**
 * Stop camera and close camera section
 */
function stopCamera() {
    const video = document.getElementById('cameraPreview');
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
    document.getElementById('cameraSection').style.display = 'none';
}

// ===== FILE UPLOAD FUNCTIONS =====

/**
 * Load image from file input
 */
function loadImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.getElementById('editorCanvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas size
            canvas.width = img.width;
            canvas.height = img.height;
            
            // Draw image
            ctx.drawImage(img, 0, 0);
            
            // Store original
            originalImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
            currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Show editor
            document.getElementById('scanOptions').style.display = 'none';
            document.getElementById('editorSection').style.display = 'block';
            document.getElementById('cameraSection').style.display = 'none';
            
            showToast('Image loaded successfully');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ===== IMAGE EDITING FUNCTIONS =====

/**
 * Rotate image 90 degrees clockwise
 */
function rotateImage() {
    const canvas = document.getElementById('editorCanvas');
    const ctx = canvas.getContext('2d');
    
    // Create new canvas with swapped dimensions
    const newCanvas = document.createElement('canvas');
    newCanvas.width = canvas.height;
    newCanvas.height = canvas.width;
    const newCtx = newCanvas.getContext('2d');
    
    // Rotate and draw
    newCtx.translate(newCanvas.width, 0);
    newCtx.rotate(Math.PI / 2);
    newCtx.drawImage(canvas, 0, 0);
    
    // Update main canvas
    canvas.width = newCanvas.width;
    canvas.height = newCanvas.height;
    ctx.drawImage(newCanvas, 0, 0);
    
    currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
    showToast('Image rotated');
}

/**
 * Apply filter to image
 */
function applyFilter(filterType) {
    currentFilter = filterType;
    const canvas = document.getElementById('editorCanvas');
    const ctx = canvas.getContext('2d');
    
    // Reset to original
    if (originalImage) {
        ctx.putImageData(originalImage, 0, 0);
    }
    
    if (filterType === 'original') {
        currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return;
    }
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    if (filterType === 'grayscale') {
        applyGrayscale(data);
    } else if (filterType === 'bw') {
        applyBlackAndWhite(data);
    }
    
    ctx.putImageData(imageData, 0, 0);
    currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * Apply grayscale filter
 */
function applyGrayscale(data) {
    for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
    }
}

/**
 * Apply black and white filter
 */
function applyBlackAndWhite(data) {
    for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        const bw = gray > 128 ? 255 : 0;
        data[i] = bw;
        data[i + 1] = bw;
        data[i + 2] = bw;
    }
}

/**
 * Reset image to original
 */
function resetImage() {
    const canvas = document.getElementById('editorCanvas');
    const ctx = canvas.getContext('2d');
    const filterSelect = document.getElementById('filterSelect');
    
    if (originalImage) {
        ctx.putImageData(originalImage, 0, 0);
        currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
        filterSelect.value = 'original';
        currentFilter = 'original';
        showToast('Image reset to original');
    }
}

/**
 * Enable crop mode
 */
function enableCrop() {
    const canvas = document.getElementById('editorCanvas');
    const cropCanvas = document.getElementById('cropCanvas');
    const cropModal = document.getElementById('cropModal');
    
    // Copy current canvas to crop canvas
    const ctx = canvas.getContext('2d');
    const cropCtx = cropCanvas.getContext('2d');
    
    cropCanvas.width = canvas.width;
    cropCanvas.height = canvas.height;
    cropCtx.drawImage(canvas, 0, 0);
    
    // Show crop modal
    cropModal.style.display = 'flex';
    
    // Add crop selection functionality
    setupCropSelection(cropCanvas);
}

/**
 * Setup crop selection on canvas
 */
function setupCropSelection(canvas) {
    const rect = canvas.getBoundingClientRect();
    isCropping = true;
    
    canvas.addEventListener('mousedown', (e) => {
        cropStartX = e.clientX - rect.left;
        cropStartY = e.clientY - rect.top;
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (isCropping) {
            cropEndX = e.clientX - rect.left;
            cropEndY = e.clientY - rect.top;
            
            // Redraw with selection rectangle
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(canvas, 0, 0);
            
            ctx.strokeStyle = '#4338CA';
            ctx.lineWidth = 2;
            ctx.strokeRect(
                Math.min(cropStartX, cropEndX),
                Math.min(cropStartY, cropEndY),
                Math.abs(cropEndX - cropStartX),
                Math.abs(cropEndY - cropStartY)
            );
        }
    });
    
    canvas.addEventListener('mouseup', () => {
        isCropping = false;
    });
}

/**
 * Apply crop to image
 */
function applyCrop() {
    const canvas = document.getElementById('editorCanvas');
    const cropCanvas = document.getElementById('cropCanvas');
    const cropCtx = cropCanvas.getContext('2d');
    
    const x = Math.min(cropStartX, cropEndX);
    const y = Math.min(cropStartY, cropEndY);
    const width = Math.abs(cropEndX - cropStartX);
    const height = Math.abs(cropEndY - cropStartY);
    
    if (width < 10 || height < 10) {
        showToast('Please select a larger area');
        return;
    }
    
    // Get cropped image data
    const imageData = cropCtx.getImageData(x, y, width, height);
    
    // Update main canvas
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    
    currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
    originalImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    closeCropModal();
    showToast('Image cropped successfully');
}

/**
 * Close crop modal
 */
function closeCropModal() {
    document.getElementById('cropModal').style.display = 'none';
    isCropping = false;
}

// ===== SAVE FUNCTIONS =====

/**
 * Save document
 */
function saveDocument() {
    const saveModal = document.getElementById('saveModal');
    saveModal.style.display = 'flex';
}

/**
 * Confirm and save document
 */
function confirmSave() {
    const docName = document.getElementById('docName').value.trim();
    
    if (!docName) {
        showToast('Please enter a document name');
        return;
    }
    
    const canvas = document.getElementById('editorCanvas');
    const imageData = canvas.toDataURL('image/jpeg', 0.95);
    
    // Save to localStorage
    const doc = saveDocument(docName, imageData, 'JPG');
    
    closeSaveModal();
    showToast(`Document "${docName}" saved successfully`);
    
    // Reset form
    setTimeout(() => {
        backToOptions();
        document.getElementById('docName').value = '';
    }, 1000);
}

/**
 * Close save modal
 */
function closeSaveModal() {
    document.getElementById('saveModal').style.display = 'none';
}

/**
 * Go back to scan options
 */
function backToOptions() {
    document.getElementById('scanOptions').style.display = 'flex';
    document.getElementById('editorSection').style.display = 'none';
    document.getElementById('cameraSection').style.display = 'none';
    document.getElementById('filterSelect').value = 'original';
    
    currentFilter = 'original';
    currentImage = null;
    originalImage = null;
}

/**
 * Show scan options modal
 */
function showScanOptions() {
    const scanOptions = document.getElementById('scanOptions');
    const editorSection = document.getElementById('editorSection');
    
    if (editorSection.style.display !== 'none') {
        // Currently in editor, go back
        backToOptions();
    } else {
        // Show options if hidden
        scanOptions.style.display = 'flex';
    }
}

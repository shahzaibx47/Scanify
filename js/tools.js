// ===== SCANIFY TOOLS.JS =====
// Image compression, PDF generation, and image merging tools

let compressionImage = null;
let pdfImages = [];
let mergeImages = [];

// ===== COMPRESSION TOOL =====

/**
 * Open image compression tool
 */
function openCompressionTool() {
    const modal = document.getElementById('compressionModal');
    modal.style.display = 'flex';
    compressionImage = null;
}

/**
 * Close compression tool
 */
function closeCompressionModal() {
    document.getElementById('compressionModal').style.display = 'none';
    compressionImage = null;
}

/**
 * Load image for compression
 */
function loadCompressionImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            compressionImage = img;
            showCompressionPreview();
            showToast('Image loaded');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

/**
 * Show compression preview
 */
function showCompressionPreview() {
    const controls = document.getElementById('compressionControls');
    const preview = document.getElementById('compressionPreview');
    const canvas = document.getElementById('compressionCanvas');
    const originalSizeSpan = document.getElementById('originalSize');
    const downloadBtn = document.getElementById('downloadCompressionBtn');
    
    controls.style.display = 'block';
    preview.style.display = 'block';
    downloadBtn.style.display = 'block';
    
    // Draw original image
    canvas.width = compressionImage.width;
    canvas.height = compressionImage.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(compressionImage, 0, 0);
    
    // Show original size
    const originalDataURL = canvas.toDataURL('image/jpeg', 1.0);
    const originalSize = getDataURLFileSize(originalDataURL);
    originalSizeSpan.textContent = originalSize + ' KB';
    
    updateCompressionQuality(80);
}

/**
 * Update compression quality
 */
function updateCompressionQuality(value) {
    const canvas = document.getElementById('compressionCanvas');
    const qualityValue = document.getElementById('qualityValue');
    const compressedSizeSpan = document.getElementById('compressedSize');
    
    qualityValue.textContent = value + '%';
    
    // Redraw with new quality
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(compressionImage, 0, 0);
    
    // Get compressed size
    const quality = value / 100;
    const compressedDataURL = canvas.toDataURL('image/jpeg', quality);
    const compressedSize = getDataURLFileSize(compressedDataURL);
    compressedSizeSpan.textContent = compressedSize + ' KB';
}

/**
 * Download compressed image
 */
function downloadCompressed() {
    const canvas = document.getElementById('compressionCanvas');
    const qualitySlider = document.getElementById('qualitySlider');
    const quality = qualitySlider.value / 100;
    
    const compressedDataURL = canvas.toDataURL('image/jpeg', quality);
    downloadFile(compressedDataURL, 'compressed-image.jpg');
    
    closeCompressionModal();
    showToast('Compressed image downloaded');
}

// ===== IMAGE TO PDF TOOL =====

/**
 * Open image to PDF tool
 */
function openImageToPdfTool() {
    const modal = document.getElementById('imageToPdfModal');
    modal.style.display = 'flex';
    pdfImages = [];
}

/**
 * Close image to PDF tool
 */
function closeImageToPdfModal() {
    document.getElementById('imageToPdfModal').style.display = 'none';
    pdfImages = [];
}

/**
 * Load images for PDF conversion
 */
function loadPdfImages(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    pdfImages = [];
    
    Array.from(files).forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                pdfImages.push({
                    src: e.target.result,
                    name: file.name,
                    img: img
                });
                
                if (index === files.length - 1) {
                    showPdfPreview();
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Show PDF preview
 */
function showPdfPreview() {
    const preview = document.getElementById('pdfPreview');
    const imageList = document.getElementById('pdfImageList');
    const generateBtn = document.getElementById('generatePdfBtn');
    
    imageList.innerHTML = '';
    
    pdfImages.forEach((image, index) => {
        const div = document.createElement('div');
        div.className = 'image-item';
        div.innerHTML = `
            <img src="${image.src}" alt="Image ${index + 1}">
            <button class="remove-btn" onclick="removePdfImage(${index})" title="Remove">
                <i class="fas fa-times"></i>
            </button>
        `;
        imageList.appendChild(div);
    });
    
    preview.style.display = 'block';
    generateBtn.style.display = pdfImages.length > 0 ? 'block' : 'none';
}

/**
 * Remove image from PDF list
 */
function removePdfImage(index) {
    pdfImages.splice(index, 1);
    showPdfPreview();
}

/**
 * Generate PDF from images
 */
function generatePdf() {
    if (pdfImages.length === 0) {
        showToast('Please select at least one image');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });
    
    pdfImages.forEach((image, index) => {
        if (index > 0) {
            doc.addPage();
        }
        
        // Calculate dimensions to fit A4 page
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const imgWidth = pageWidth - 20; // 10mm margin on each side
        const imgHeight = (image.img.height / image.img.width) * imgWidth;
        
        let y = 10;
        if (imgHeight > pageHeight - 20) {
            // Scale down if too large
            const scale = (pageHeight - 20) / imgHeight;
            doc.addImage(image.src, 'JPEG', 10, y, imgWidth * scale, imgHeight * scale);
        } else {
            doc.addImage(image.src, 'JPEG', 10, y, imgWidth, imgHeight);
        }
    });
    
    doc.save('document.pdf');
    closeImageToPdfModal();
    showToast('PDF generated and downloaded');
}

// ===== MERGE IMAGES TOOL =====

/**
 * Open merge images tool
 */
function openMergeTool() {
    const modal = document.getElementById('mergeModal');
    modal.style.display = 'flex';
    mergeImages = [];
}

/**
 * Close merge tool
 */
function closeMergeModal() {
    document.getElementById('mergeModal').style.display = 'none';
    mergeImages = [];
}

/**
 * Load images for merging
 */
function loadMergeImages(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    mergeImages = [];
    
    Array.from(files).forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                mergeImages.push({
                    src: e.target.result,
                    name: file.name,
                    img: img
                });
                
                if (index === files.length - 1) {
                    showMergePreview();
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Show merge preview
 */
function showMergePreview() {
    const preview = document.getElementById('mergePreview');
    const imageList = document.getElementById('mergeImageList');
    const mergeBtn = document.getElementById('mergeImagesBtn');
    
    imageList.innerHTML = '';
    
    mergeImages.forEach((image, index) => {
        const div = document.createElement('div');
        div.className = 'image-item';
        div.innerHTML = `
            <img src="${image.src}" alt="Image ${index + 1}">
            <button class="remove-btn" onclick="removeMergeImage(${index})" title="Remove">
                <i class="fas fa-times"></i>
            </button>
        `;
        imageList.appendChild(div);
    });
    
    preview.style.display = 'block';
    mergeBtn.style.display = mergeImages.length > 1 ? 'block' : 'none';
    
    if (mergeImages.length < 2) {
        mergeBtn.style.display = 'none';
    }
}

/**
 * Remove image from merge list
 */
function removeMergeImage(index) {
    mergeImages.splice(index, 1);
    showMergePreview();
}

/**
 * Merge images into one
 */
function mergImages() {
    if (mergeImages.length < 2) {
        showToast('Please select at least 2 images');
        return;
    }
    
    // Calculate total dimensions (stacked vertically)
    let totalWidth = 0;
    let totalHeight = 0;
    
    mergeImages.forEach(image => {
        totalWidth = Math.max(totalWidth, image.img.width);
        totalHeight += image.img.height;
    });
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = totalWidth;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');
    
    // Draw images
    let currentY = 0;
    mergeImages.forEach(image => {
        // Scale image to match total width if needed
        const scale = totalWidth / image.img.width;
        const scaledHeight = image.img.height * scale;
        
        ctx.drawImage(image.img, 0, currentY, totalWidth, scaledHeight);
        currentY += scaledHeight;
    });
    
    // Download merged image
    const dataURL = canvas.toDataURL('image/jpeg', 0.95);
    downloadFile(dataURL, 'merged-image.jpg');
    
    closeMergeModal();
    showToast('Images merged and downloaded');
}

// ===== HELPER FUNCTIONS =====

/**
 * Go to scanner page
 */
function goToScanner() {
    window.location.href = 'scanner.html';
}

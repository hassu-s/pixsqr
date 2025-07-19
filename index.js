const imageUpload = document.getElementById('imageUpload');
const uploadedImage = document.getElementById('uploadedImage');
const cropFrame = document.getElementById('cropFrame');
const imageContainer = document.getElementById('imageContainer');
const cropButton = document.getElementById('cropButton');
const placeholderText = document.getElementById('placeholderText');
const messageArea = document.getElementById('messageArea');
const imageGridHorizontal = document.getElementById('imageGridHorizontal');
const imageGridVertical = document.getElementById('imageGridVertical');

let currentImage = null;
let imageNaturalWidth = 0;
let imageNaturalHeight = 0;

let isDragging = false;
let isResizing = false;
let activeHandle = null;
let startX, startY;
let startCropX, startCropY, startCropWidth, startCropHeight;
let fixedOppositeX, fixedOppositeY;

let displayedImageInfo = {
    width: 0,
    height: 0,
    x: 0,
    y: 0
};

let currentCropPixels = { x: 0, y: 0, width: 0, height: 0 };

let ctrlKeyPressed = false;
let shiftKeyPressed = false;
let dragDirection = null;

let initialCenterXRelative = 0;
let initialCenterYRelative = 0;

window.addEventListener('keydown', (e) => {
    if (e.key === 'Control') ctrlKeyPressed = true;
    if (e.key === 'Shift') {
        shiftKeyPressed = true;
        if (isDragging && currentImage && !uploadedImage.classList.contains('hidden')) {
            imageGridHorizontal.style.left = `${displayedImageInfo.x}px`;
            imageGridHorizontal.style.top = `${displayedImageInfo.y + displayedImageInfo.height / 2}px`;
            imageGridHorizontal.style.width = `${displayedImageInfo.width}px`;
            imageGridHorizontal.classList.remove('hidden');

            imageGridVertical.style.left = `${displayedImageInfo.x + displayedImageInfo.width / 2}px`;
            imageGridVertical.style.top = `${displayedImageInfo.y}px`;
            imageGridVertical.style.height = `${displayedImageInfo.height}px`;
            imageGridVertical.classList.remove('hidden');
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Control') ctrlKeyPressed = false;
    if (e.key === 'Shift') {
        shiftKeyPressed = false;
        imageGridHorizontal.classList.add('hidden');
        imageGridVertical.classList.add('hidden');
        dragDirection = null;
    }
});

document.addEventListener('mousemove', handleGlobalMouseMove);
document.addEventListener('mouseup', handleGlobalMouseUp);
document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
document.addEventListener('touchend', handleGlobalTouchEnd);

imageContainer.addEventListener('mousedown', startInteraction);
imageContainer.addEventListener('touchstart', startInteraction);

imageUpload.addEventListener('change', handleImageUpload);
cropButton.addEventListener('click', handleCropAndDownload);

function handleGlobalMouseMove(e) {
    if (isDragging) {
        doDrag(e);
    } else if (isResizing) {
        doResize(e);
    }
}

function handleGlobalMouseUp(e) {
    if (isDragging) {
        endDrag();
    } else if (isResizing) {
        endResize();
    }
}

function handleGlobalTouchMove(e) {
    if (isDragging) {
        doDrag(e);
    } else if (isResizing) {
        doResize(e);
    }
}

function handleGlobalTouchEnd(e) {
    if (isDragging) {
        endDrag();
    } else if (isResizing) {
        endResize();
    }
}

function startInteraction(e) {
    e.preventDefault();

    isDragging = false;
    isResizing = false;
    activeHandle = null;
    dragDirection = null;

    const target = e.target;

    if (target === cropFrame) {
        isDragging = true;
        cropFrame.classList.add('dragging');
        const coords = getEventCoords(e);
        startX = coords.x;
        startY = coords.y;
        startCropX = parseFloat(cropFrame.dataset.x);
        startCropY = parseFloat(cropFrame.dataset.y);

        if (shiftKeyPressed && currentImage && !uploadedImage.classList.contains('hidden')) {
            imageGridHorizontal.style.left = `${displayedImageInfo.x}px`;
            imageGridHorizontal.style.top = `${displayedImageInfo.y + displayedImageInfo.height / 2}px`;
            imageGridHorizontal.style.width = `${displayedImageInfo.width}px`;
            imageGridHorizontal.classList.remove('hidden');

            imageGridVertical.style.left = `${displayedImageInfo.x + displayedImageInfo.width / 2}px`;
            imageGridVertical.style.top = `${displayedImageInfo.y}px`;
            imageGridVertical.style.height = `${displayedImageInfo.height}px`;
            imageGridVertical.classList.remove('hidden');
        }

    } else if (target.classList.contains('resize-handle')) {
        isResizing = true;
        activeHandle = target;
        const coords = getEventCoords(e);
        startX = coords.x;
        startY = coords.y;
        startCropX = parseFloat(cropFrame.dataset.x);
        startCropY = parseFloat(cropFrame.dataset.y);
        startCropWidth = parseFloat(cropFrame.dataset.width);
        startCropHeight = parseFloat(cropFrame.dataset.height);

        switch (activeHandle.className) {
            case 'resize-handle top-left':
                fixedOppositeX = startCropX + startCropWidth;
                fixedOppositeY = startCropY + startCropHeight;
                break;
            case 'resize-handle top-right':
                fixedOppositeX = startCropX;
                fixedOppositeY = startCropY + startCropHeight;
                break;
            case 'resize-handle bottom-left':
                fixedOppositeX = startCropX + startCropWidth;
                fixedOppositeY = startCropY;
                break;
            case 'resize-handle bottom-right':
                fixedOppositeX = startCropX;
                fixedOppositeY = startCropY;
                break;
        }

        if (ctrlKeyPressed) {
            initialCenterXRelative = (startCropX + startCropWidth / 2);
            initialCenterYRelative = (startCropY + startCropHeight / 2);
        }

    } else {
        return;
    }
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    if (!file.type.startsWith('image/')) {
        showMessage('画像ファイルを選択してください。', 'error');
        return;
    }

    showMessage('');

    const reader = new FileReader();
    reader.onload = (e) => {
        uploadedImage.src = e.target.result;
        uploadedImage.classList.remove('hidden');
        placeholderText.classList.add('hidden');
        cropButton.classList.add('hidden');

        currentImage = new Image();
        currentImage.onload = () => {
            imageNaturalWidth = currentImage.naturalWidth;
            imageNaturalHeight = currentImage.naturalHeight;
            currentCropPixels = { x: 0, y: 0, width: 0, height: 0 };
            initializeCropFrame();
            cropButton.classList.remove('hidden');
        };
        currentImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function initializeCropFrame() {
    const containerRect = imageContainer.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    const aspectRatio = imageNaturalWidth / imageNaturalHeight;

    let imgDisplayWidth, imgDisplayHeight;

    if (containerWidth / containerHeight > aspectRatio) {
        imgDisplayHeight = containerHeight;
        imgDisplayWidth = containerHeight * aspectRatio;
    } else {
        imgDisplayWidth = containerWidth;
        imgDisplayHeight = containerWidth / aspectRatio;
    }

    imgDisplayWidth = Math.min(imgDisplayWidth, imageNaturalWidth);
    imgDisplayHeight = Math.min(imgDisplayHeight, imageNaturalHeight);

    displayedImageInfo.width = imgDisplayWidth;
    displayedImageInfo.height = imgDisplayHeight;
    displayedImageInfo.x = (containerWidth - imgDisplayWidth) / 2;
    displayedImageInfo.y = (containerHeight - imgDisplayHeight) / 2;

    uploadedImage.style.width = `${imgDisplayWidth}px`;
    uploadedImage.style.height = `${imgDisplayHeight}px`;
    uploadedImage.style.left = `${displayedImageInfo.x}px`;
    uploadedImage.style.top = `${displayedImageInfo.y}px`;
    uploadedImage.style.position = 'absolute';

    let targetCropX, targetCropY, targetCropWidth, targetCropHeight;
    const minAllowedSize = 50;

    if (currentCropPixels.width > 0 && currentCropPixels.height > 0) {
        const scaleX = imageNaturalWidth / displayedImageInfo.width;
        const scaleY = imageNaturalHeight / displayedImageInfo.height;

        targetCropWidth = currentCropPixels.width / scaleX;
        targetCropHeight = currentCropPixels.height / scaleY;
        targetCropX = (currentCropPixels.x / scaleX) + displayedImageInfo.x;
        targetCropY = (currentCropPixels.y / scaleY) + displayedImageInfo.y;

        const imgRightInContainer = displayedImageInfo.x + displayedImageInfo.width;
        const imgBottomInContainer = displayedImageInfo.y + displayedImageInfo.height;

        targetCropWidth = Math.min(targetCropWidth, imgRightInContainer - targetCropX, imgBottomInContainer - targetCropY);
        targetCropHeight = targetCropWidth;

        if (targetCropWidth < minAllowedSize) {
            targetCropWidth = minAllowedSize;
            targetCropHeight = minAllowedSize;
        }

        targetCropX = Math.max(displayedImageInfo.x, targetCropX);
        targetCropX = Math.min(imgRightInContainer - targetCropWidth, targetCropX);
        targetCropY = Math.max(displayedImageInfo.y, targetCropY);
        targetCropY = Math.min(imgBottomInContainer - targetCropHeight, targetCropY);

    } else {
        const initialSize = Math.min(displayedImageInfo.width, displayedImageInfo.height) / 2;
        targetCropX = displayedImageInfo.x + (displayedImageInfo.width - initialSize) / 2;
        targetCropY = displayedImageInfo.y + (displayedImageInfo.height - initialSize) / 2;
        targetCropWidth = initialSize;
        targetCropHeight = initialSize;
    }

    cropFrame.style.width = `${targetCropWidth}px`;
    cropFrame.style.height = `${targetCropHeight}px`;
    cropFrame.style.left = `${targetCropX}px`;
    cropFrame.style.top = `${targetCropY}px`;
    cropFrame.classList.remove('hidden');

    cropFrame.dataset.x = targetCropX;
    cropFrame.dataset.y = targetCropY;
    cropFrame.dataset.width = targetCropWidth;
    cropFrame.dataset.height = targetCropHeight;

    updateCurrentCropPixels();
}

function getEventCoords(e) {
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
}

function doDrag(e) {
    if (!isDragging) return;
    e.preventDefault();

    const coords = getEventCoords(e);
    let dx = coords.x - startX;
    let dy = coords.y - startY;

    if (shiftKeyPressed) {
        if (dragDirection === null) {
            if (Math.abs(dx) > Math.abs(dy)) {
                dragDirection = 'horizontal';
            } else {
                dragDirection = 'vertical';
            }
        }

        if (dragDirection === 'horizontal') {
            dy = 0;
        } else {
            dx = 0;
        }
    } else {
        dragDirection = null;
    }

    let newX = startCropX + dx;
    let newY = startCropY + dy;
    const cropWidth = parseFloat(cropFrame.dataset.width);
    const cropHeight = parseFloat(cropFrame.dataset.height);

    newX = Math.max(displayedImageInfo.x, newX);
    newX = Math.min(displayedImageInfo.x + displayedImageInfo.width - cropWidth, newX);
    newY = Math.max(displayedImageInfo.y, newY);
    newY = Math.min(displayedImageInfo.y + displayedImageInfo.height - cropHeight, newY);

    cropFrame.style.left = `${newX}px`;
    cropFrame.style.top = `${newY}px`;
    cropFrame.dataset.x = newX;
    cropFrame.dataset.y = newY;
}

function endDrag() {
    isDragging = false;
    cropFrame.classList.remove('dragging');
    imageGridHorizontal.classList.add('hidden');
    imageGridVertical.classList.add('hidden');
    dragDirection = null;
    updateCurrentCropPixels();
}

function doResize(e) {
    if (!isResizing || !activeHandle) return;
    e.preventDefault();

    const coords = getEventCoords(e);
    const containerRect = imageContainer.getBoundingClientRect();
    const currentMouseXRelative = coords.x - containerRect.left;
    const currentMouseYRelative = coords.y - containerRect.top;

    let newWidth, newHeight, newX, newY;
    const minSize = 50;

    const imgLeftInContainer = displayedImageInfo.x;
    const imgTopInContainer = displayedImageInfo.y;
    const imgRightInContainer = displayedImageInfo.x + displayedImageInfo.width;
    const imgBottomInContainer = displayedImageInfo.y + displayedImageInfo.height;

    if (ctrlKeyPressed) {
        let newHalfSize = Math.max(
            Math.abs(currentMouseXRelative - initialCenterXRelative),
            Math.abs(currentMouseYRelative - initialCenterYRelative)
        );

        const maxHalfSizeX = Math.min(initialCenterXRelative - imgLeftInContainer, imgRightInContainer - initialCenterXRelative);
        const maxHalfSizeY = Math.min(initialCenterYRelative - imgTopInContainer, imgBottomInContainer - initialCenterYRelative);
        const maxHalfSize = Math.min(maxHalfSizeX, maxHalfSizeY);

        newHalfSize = Math.min(newHalfSize, maxHalfSize);
        newHalfSize = Math.max(newHalfSize, minSize / 2);

        newWidth = 2 * newHalfSize;
        newHeight = 2 * newHalfSize;

        newX = initialCenterXRelative - newHalfSize;
        newY = initialCenterYRelative - newHalfSize;

    } else {
        switch (activeHandle.className) {
            case 'resize-handle top-left':
                newWidth = fixedOppositeX - currentMouseXRelative;
                newHeight = fixedOppositeY - currentMouseYRelative;
                break;
            case 'resize-handle top-right':
                newWidth = currentMouseXRelative - fixedOppositeX;
                newHeight = fixedOppositeY - currentMouseYRelative;
                break;
            case 'resize-handle bottom-left':
                newWidth = fixedOppositeX - currentMouseXRelative;
                newHeight = currentMouseYRelative - fixedOppositeY;
                break;
            case 'resize-handle bottom-right':
                newWidth = currentMouseXRelative - fixedOppositeX;
                newHeight = currentMouseYRelative - fixedOppositeY;
                break;
        }

        let size = Math.max(newWidth, newHeight);
        size = Math.max(size, minSize);

        let tempNewX, tempNewY;
        switch (activeHandle.className) {
            case 'resize-handle top-left':
                tempNewX = fixedOppositeX - size;
                tempNewY = fixedOppositeY - size;
                break;
            case 'resize-handle top-right':
                tempNewX = fixedOppositeX;
                tempNewY = fixedOppositeY - size;
                break;
            case 'resize-handle bottom-left':
                tempNewX = fixedOppositeX - size;
                tempNewY = fixedOppositeY;
                break;
            case 'resize-handle bottom-right':
                tempNewX = fixedOppositeX;
                tempNewY = fixedOppositeY;
                break;
        }

        const maxPossibleSizeX = (activeHandle.className.includes('left')) ? fixedOppositeX - imgLeftInContainer : imgRightInContainer - fixedOppositeX;
        const maxPossibleSizeY = (activeHandle.className.includes('top')) ? fixedOppositeY - imgTopInContainer : imgBottomInContainer - fixedOppositeY;

        let maxAllowedSize = Math.min(maxPossibleSizeX, maxPossibleSizeY);
        maxAllowedSize = Math.max(maxAllowedSize, minSize);

        size = Math.min(size, maxAllowedSize);
        size = Math.max(size, minSize);

        newWidth = size;
        newHeight = size;

        switch (activeHandle.className) {
            case 'resize-handle top-left':
                newX = fixedOppositeX - newWidth;
                newY = fixedOppositeY - newHeight;
                break;
            case 'resize-handle top-right':
                newX = fixedOppositeX;
                newY = fixedOppositeY - newHeight;
                break;
            case 'resize-handle bottom-left':
                newX = fixedOppositeX - newWidth;
                newY = fixedOppositeY;
                break;
            case 'resize-handle bottom-right':
                newX = fixedOppositeX;
                newY = fixedOppositeY;
                break;
        }
    }

    newX = Math.max(imgLeftInContainer, newX);
    newX = Math.min(imgRightInContainer - newWidth, newX);
    newY = Math.max(imgTopInContainer, newY);
    newY = Math.min(imgBottomInContainer - newHeight, newY);

    cropFrame.style.width = `${newWidth}px`;
    cropFrame.style.height = `${newHeight}px`;
    cropFrame.style.left = `${newX}px`;
    cropFrame.style.top = `${newY}px`;

    cropFrame.dataset.x = newX;
    cropFrame.dataset.y = newY;
    cropFrame.dataset.width = newWidth;
    cropFrame.dataset.height = newHeight;
}

function endResize() {
    isResizing = false;
    activeHandle = null;
    updateCurrentCropPixels();
}

function handleCropAndDownload() {
    if (!currentImage) {
        showMessage('Please upload an image.', 'warning');
        return;
    }

    const imgDisplayWidth = displayedImageInfo.width;
    const imgDisplayHeight = displayedImageInfo.height;
    const imgLeftInContainer = displayedImageInfo.x;
    const imgTopInContainer = displayedImageInfo.y;

    const cropXInDisplay = parseFloat(cropFrame.dataset.x) - imgLeftInContainer;
    const cropYInDisplay = parseFloat(cropFrame.dataset.y) - imgTopInContainer;
    const cropWidthInDisplay = parseFloat(cropFrame.dataset.width);
    const cropHeightInDisplay = parseFloat(cropFrame.dataset.height);

    const scaleX = imageNaturalWidth / imgDisplayWidth;
    const scaleY = imageNaturalHeight / imgDisplayHeight;

    const sourceX = Math.round(cropXInDisplay * scaleX);
    const sourceY = Math.round(cropYInDisplay * scaleY);
    const sourceWidth = Math.round(cropWidthInDisplay * scaleX);
    const sourceHeight = Math.round(cropHeightInDisplay * scaleY);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = sourceWidth;
    canvas.height = sourceHeight;

    ctx.drawImage(
        currentImage,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        sourceWidth,
        sourceHeight
    );

    const dataURL = canvas.toDataURL('image/png');

    const randomFileName = Math.random().toString(36).substring(2, 7).toUpperCase() + '.png';

    const a = document.createElement('a');
    a.href = dataURL;
    a.download = randomFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function showMessage(message, type = 'info') {
    messageArea.textContent = message;
    messageArea.className = 'message-area';
    if (type === 'error') {
        messageArea.classList.add('error');
    } else if (type === 'success') {
        messageArea.classList.add('success');
    } else {
        messageArea.classList.add('info');
    }
}

function updateCurrentCropPixels() {
    if (!currentImage || uploadedImage.classList.contains('hidden')) {
        currentCropPixels = { x: 0, y: 0, width: 0, height: 0 };
        return;
    }

    const imgDisplayWidth = displayedImageInfo.width;
    const imgDisplayHeight = displayedImageInfo.height;
    const imgLeftInContainer = displayedImageInfo.x;
    const imgTopInContainer = displayedImageInfo.y;

    const cropXInDisplay = parseFloat(cropFrame.dataset.x) - imgLeftInContainer;
    const cropYInDisplay = parseFloat(cropFrame.dataset.y) - imgTopInContainer;
    const cropWidthInDisplay = parseFloat(cropFrame.dataset.width);
    const cropHeightInDisplay = parseFloat(cropFrame.dataset.height);

    const scaleX = imageNaturalWidth / imgDisplayWidth;
    const scaleY = imageNaturalHeight / imgDisplayHeight;

    currentCropPixels.x = Math.round(cropXInDisplay * scaleX);
    currentCropPixels.y = Math.round(cropYInDisplay * scaleY);
    currentCropPixels.width = Math.round(cropWidthInDisplay * scaleX);
    currentCropPixels.height = Math.round(cropHeightInDisplay * scaleY);
}

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (currentImage && !uploadedImage.classList.contains('hidden')) {
            initializeCropFrame();
        }
    }, 100);
});

window.addEventListener('orientationchange', () => {
    if (currentImage && !uploadedImage.classList.contains('hidden')) {
        initializeCropFrame();
    }
});

let scrollTimeout;
window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        if (currentImage && !uploadedImage.classList.contains('hidden')) {
            initializeCropFrame();
        }
    }, 100);
});

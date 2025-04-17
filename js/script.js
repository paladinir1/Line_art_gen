
let IMG_SIZE = 500;
let MAX_LINES; // Removed initial assignment
let N_PINS = 36 * 8;
let MIN_LOOP = 20;
let MIN_DISTANCE = 20;
let LINE_WEIGHT = 20;
let FILENAME = "";
let SCALE = 20;
let HOOP_DIAMETER = 0.625;

let img;

// set up element variables
let imgElement = document.getElementById("imageSrc")
let inputElement = document.getElementById("fileInput");
inputElement.addEventListener("change", (e) => {
    imgElement.src = URL.createObjectURL(e.target.files[0]);
}, false);
var ctx = document.getElementById("canvasOutput").getContext("2d");
var ctx2 = document.getElementById("canvasOutput2").getContext("2d");
var ctx3 = document.getElementById("canvasOutput3").getContext("2d");
let status = document.getElementById("status");
let drawStatus = document.getElementById("drawStatus");
let showPins = document.getElementById("showPins");
let pinsOutput = document.getElementById("pinsOutput");
let incrementalDrawing = document.getElementById("incrementalDrawing");
let incrementalCurrentStep = document.getElementById("incrementalCurrentStep");
let numberOfPins = document.getElementById("numberOfPins");
let numberOfLines = document.getElementById("numberOfLines");
let lineWeight = document.getElementById("lineWeight");

let length;
var R = {};

//pre initilization
let pin_coords;
let center;
let radius;

let line_cache_y;
let line_cache_x;
let line_cache_length;
let line_cache_weight;

//line variables
let error;
let img_result;
let result;
let line_mask;

let line_sequence;
let pin;
let thread_length;
let last_pins;

let listenForKeys = false;


//*******************************
//      Line Generation
//*******************************

imgElement.onload = function () {
    listenForKeys = false;
    showStep(1);
    showPins.classList.add('hidden');
    incrementalDrawing.classList.add('hidden');
    // Take uploaded picture, square up and put on canvas
    base_image = new Image();
    base_image.src = imgElement.src;
    ctx.canvas.width = IMG_SIZE;
    ctx.canvas.height = IMG_SIZE;
    ctx2.canvas.weight = IMG_SIZE * 2;
    ctx2.canvas.height = IMG_SIZE * 2;
    ctx.clearRect(0, 0, IMG_SIZE, IMG_SIZE);

    var selectedWidth = base_image.width;
    var selectedHeight = base_image.height;
    var xOffset = 0;
    var yOffset = 0;
    // square crop  center of picture
    if (base_image.height > base_image.width) {
        selectedWidth = base_image.width;
        selectedHeight = base_image.width;
        yOffset = Math.floor((base_image.height - base_image.width) / 2);
    } else if (base_image.width > base_image.height) {
        selectedWidth = base_image.height;
        selectedHeight = base_image.height;
        xOffset = Math.floor((base_image.width - base_image.height) / 2)
    }

    ctx.drawImage(base_image, xOffset, yOffset, selectedWidth, selectedHeight, 0, 0, IMG_SIZE, IMG_SIZE);
    length = IMG_SIZE;

    // make grayscale by averaging the RGB channels.
    // extract out the R channel because that's all we need and push graysacle image onto canvas
    var imgPixels = ctx.getImageData(0, 0, IMG_SIZE, IMG_SIZE);
    R = img_result = nj.ones([IMG_SIZE, IMG_SIZE]).multiply(0xff);
    var rdata = [];
    for (var y = 0; y < imgPixels.height; y++) {
        for (var x = 0; x < imgPixels.width; x++) {
            var i = (y * 4) * imgPixels.width + x * 4;
            var avg = (imgPixels.data[i] + imgPixels.data[i + 1] + imgPixels.data[i + 2]) / 3;
            imgPixels.data[i] = avg;
            imgPixels.data[i + 1] = avg;
            imgPixels.data[i + 2] = avg;
            rdata.push(avg);
        }
    }
    R.selection.data = rdata;
    ctx.putImageData(imgPixels, 0, 0, 0, 0, IMG_SIZE, IMG_SIZE);

    //circle crop canvas
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.arc(IMG_SIZE / 2, IMG_SIZE / 2, IMG_SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();

    // start processing
    NonBlockingCalculatePins();

    // Center the canvasOutput2
    const canvas = document.getElementById("canvasOutput2");

    if (canvas) { // Ensure the canvas exists before applying styles
        canvas.style.position = "absolute";
        canvas.style.left = "50%";
        canvas.style.top = "50%";
        canvas.style.transform = "translate(-50%, -50%)"; // Centers correctly
    }

}

function NonBlockingCalculatePins() {
    // set up necessary variables
    console.log("Calculating pins...");
    status.textContent = "Calculating pins...";
    pin_coords = [];
    center = length / 2;
    radius = length / 2 - 1 / 2
    let i = 0;

    (function codeBlock() {
        if (i < N_PINS) {
            angle = 2 * Math.PI * i / N_PINS;
            pin_coords.push([Math.floor(center + radius * Math.cos(angle)),
            Math.floor(center + radius * Math.sin(angle))]);
            i++;
            setTimeout(codeBlock, 0);
        } else {
            console.log('Done Calculating pins');
            status.textContent = "Done Calculating pins";
            showStep(2);
            NonBlockingPrecalculateLines();
        }
    })();
}

function NonBlockingPrecalculateLines() {
    // set up necessary variables
    console.log("Precalculating all lines...");
    status.textContent = "Precalculating all lines...";
    line_cache_y = Array.apply(null, { length: (N_PINS * N_PINS) });
    line_cache_x = Array.apply(null, { length: (N_PINS * N_PINS) });
    line_cache_length = Array.apply(null, { length: (N_PINS * N_PINS) }).map(Function.call, function () { return 0; });
    line_cache_weight = Array.apply(null, { length: (N_PINS * N_PINS) }).map(Function.call, function () { return 1; });
    let a = 0;

    (function codeBlock() {
        if (a < N_PINS) {
            for (b = a + MIN_DISTANCE; b < N_PINS; b++) {
                x0 = pin_coords[a][0];
                y0 = pin_coords[a][1];

                x1 = pin_coords[b][0];
                y1 = pin_coords[b][1];

                d = Math.floor(Number(Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0))));
                xs = linspace(x0, x1, d);
                ys = linspace(y0, y1, d);

                line_cache_y[b * N_PINS + a] = ys;
                line_cache_y[a * N_PINS + b] = ys;
                line_cache_x[b * N_PINS + a] = xs;
                line_cache_x[a * N_PINS + b] = xs;
                line_cache_length[b * N_PINS + a] = d;
                line_cache_length[a * N_PINS + b] = d;
            }
            a++;
            setTimeout(codeBlock, 0);
        } else {
            console.log('Done Precalculating Lines');
            status.textContent = "Done Precalculating Lines";
            NonBlockingLineCalculator();
            showStep(3);
        }
    })();
}



function NonBlockingLineCalculator() {
    // set up necessary variables
    console.log("Drawing Lines...");
    status.textContent = "Drawing Lines...";
    error = nj.ones([IMG_SIZE, IMG_SIZE]).multiply(0xff).subtract(nj.uint8(R.selection.data).reshape(IMG_SIZE, IMG_SIZE));
    img_result = nj.ones([IMG_SIZE, IMG_SIZE]).multiply(0xff);
    result = nj.ones([IMG_SIZE * SCALE, IMG_SIZE * SCALE]).multiply(0xff);
    result = new cv.matFromArray(IMG_SIZE * SCALE, IMG_SIZE * SCALE, cv.CV_8UC1, result.selection.data);
    line_mask = nj.zeros([IMG_SIZE, IMG_SIZE], 'float64');

    // REMOVED: This line because we are using CSS to hide the caption.
    // document.querySelector("#step3 .caption").classList.remove("hidden-caption");

    line_sequence = [];
    pin = 0;
    line_sequence.push(pin);
    thread_length = 0;
    last_pins = [];
    let l = 0;

    (function codeBlock() {
        if (l < MAX_LINES) {
            if (l % 10 == 0) {
                draw();
            }

            max_err = -1;
            best_pin = -1;

            for (offset = MIN_DISTANCE; offset < N_PINS - MIN_DISTANCE; offset++) {
                test_pin = (pin + offset) % N_PINS;
                if (last_pins.includes(test_pin)) {
                    continue;
                } else {

                    xs = line_cache_x[test_pin * N_PINS + pin];
                    ys = line_cache_y[test_pin * N_PINS + pin];

                    line_err = getLineErr(error, ys, xs) * line_cache_weight[test_pin * N_PINS + pin];

                    if (line_err > max_err) {
                        max_err = line_err;
                        best_pin = test_pin;
                    }
                }
            }

            line_sequence.push(best_pin);

            xs = line_cache_x[best_pin * N_PINS + pin];
            ys = line_cache_y[best_pin * N_PINS + pin];
            weight = LINE_WEIGHT * line_cache_weight[best_pin * N_PINS + pin];

            line_mask = nj.zeros([IMG_SIZE, IMG_SIZE], 'float64');
            line_mask = setLine(line_mask, ys, xs, weight);
            error = subtractArrays(error, line_mask);

            p = new cv.Point(pin_coords[pin][0] * SCALE, pin_coords[pin][1] * SCALE);
            p2 = new cv.Point(pin_coords[best_pin][0] * SCALE, pin_coords[best_pin][1] * SCALE);
            cv.line(result, p, p2, new cv.Scalar(0, 0, 0), 2, cv.LINE_AA, 0);

            x0 = pin_coords[pin][0];
            y0 = pin_coords[pin][1];

            x1 = pin_coords[best_pin][0];
            y1 = pin_coords[best_pin][1];

            dist = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
            thread_length += HOOP_DIAMETER / length * dist;

            last_pins.push(best_pin);
            if (last_pins.length > 20) {
                last_pins.shift();
            }
            pin = best_pin;

            // update status with line count and percentage on the same line
            drawStatus.textContent = l + " Lines | " + Math.round((l / MAX_LINES) * 100) + "%";

            l++;
            setTimeout(codeBlock, 0);
        } else {
            console.log('Done Drawing Lines');
            Finalize();
        }
    })();
}

function draw() {
    let dsize = new cv.Size(IMG_SIZE * 2, IMG_SIZE * 2);
    let dst = new cv.Mat();
    cv.resize(result, dst, dsize, 0, 0, cv.INTER_AREA);
    cv.imshow('canvasOutput2', dst);
    dst.delete();
}



function getLineErr(arr, coords1, coords2) {
    let result = new Uint8Array(coords1.length);
    for (i = 0; i < coords1.length; i++) {
        result[i] = arr.get(coords1[i], coords2[i]);
    }
    return getSum(result);
}

function setLine(arr, coords1, coords2, line) {
    for (i = 0; i < coords1.length; i++) {
        arr.set(coords1[i], coords2[i], line);
    }
    return arr;
}

function compareMul(arr1, arr2) {
    let result = new Uint8Array(arr1.length);
    for (i = 0; i < arr1.length; i++) {
        result[i] = (arr1[i] < arr2[i]) * 254 + 1;
    }
    return result;
}

function compareAbsdiff(arr1, arr2) {
    let rsult = new Uint8Array(arr1.length);
    for (i = 0; i < arr1.length; i++) {
        rsult[i] = (arr1[i] * arr2[i]);
    }
    return rsult;
}

function subtractArrays(arr1, arr2) {
    for (i = 0; i < arr1.selection.data.length; i++) {
        arr1.selection.data[i] = arr1.selection.data[i] - arr2.selection.data[i]
        if (arr1.selection.data[i] < 0) {
            arr1.selection.data[i] = 0;
        } else if (arr1.selection.data[i] > 255) {
            arr1.selection.data[i] = 255;
        }
    }
    return arr1;
}

function subtractArraysSimple(arr1, arr2) {
    for (i = 0; i < arr1.length; i++) {
        arr1[i] = arr1[i] - arr2[i];
    }
    return arr1;
}

function getSum(arr) {
    let v = 0;
    for (i = 0; i < arr.length; i++) {
        v = v + arr[i];
    }
    return v;
}

function makeArr(startValue, stopValue, cardinality) {
    var arr = [];
    var currValue = startValue;
    var step = (stopValue - startValue) / (cardinality - 1);
    for (var i = 0; i < cardinality; i++) {
        arr.push(Math.round(currValue + (step * i)));
    }
    return arr;
}

function AddRGB(arr1, arr2, arr3) {
    for (i = 0; i < arr1.data.length; i++) {
        var avg = (arr1.data[i] + arr2.data[i] + arr3.data[i]);
        arr1.data[i] = avg;
    }
    return arr1;
}

function linspace(a, b, n) {
    if (typeof n === "") n = Math.max(Math.round(b - a) + 1, 1);
    if (n < 2) { return n === 1 ? [a] : []; }
    var i, ret = Array(n);
    n--;
    for (i = n; i >= 0; i--) { ret[i] = Math.floor((i * b + (n - i) * a) / n); }
    return ret;
}

function showStep(id) {
    let step1 = document.getElementById("step1");
    let step2 = document.getElementById("step2");
    let step3 = document.getElementById("step3");

    switch (id) {
        case 1:
            step1.classList.remove('hidden');
            step2.classList.add('hidden');
            step3.classList.add('hidden');
            break;
        case 2:
            step1.classList.add('hidden');
            step2.classList.remove('hidden');
            step3.classList.add('hidden');
            break;
        case 3:
            step1.classList.add('hidden');
            step2.classList.add('hidden');
            step3.classList.remove('hidden');
            break;
        default:
            break;
    }
}


//********************************
//      Creation Assistant
//********************************


var pointIndex = 0;
var lastStepImage;

function startCreating() {
    window.speechSynthesis.getVoices();
    incrementalDrawing.classList.remove('hidden');

    base_image2 = new Image();
    ctx3.canvas.width = IMG_SIZE * 2;
    ctx3.canvas.height = IMG_SIZE * 2;
    ctx3.clearRect(0, 0, IMG_SIZE * 2, IMG_SIZE * 2);
    ctx3.drawImage(base_image2, 0, 0, IMG_SIZE * 2, IMG_SIZE * 2);

    line_sequence = pinsOutput.value.split(",").map(V => { return parseInt(V) });

    window.scrollTo({ top: 5000, left: 0, behavior: 'smooth' });

    incrementalCurrentStep.textContent = "";
    pointIndex = 0;
    if (pin_coords == null) {
        CalculatePins();
    }
    nextStep();
    listenForKeys = true;
}

function startDrawing() {
    incrementalDrawing.classList.remove('hidden');
    listenForKeys = false;

    base_image2 = new Image();
    ctx3.canvas.width = IMG_SIZE * 2;
    ctx3.canvas.height = IMG_SIZE * 2;
    ctx3.clearRect(0, 0, IMG_SIZE * 2, IMG_SIZE * 2);
    ctx3.drawImage(base_image2, 0, 0, IMG_SIZE * 2, IMG_SIZE * 2);

    line_sequence = pinsOutput.value.split(",").map(V => { return parseInt(V) });

    window.scrollTo({ top: 5000, left: 0, behavior: 'smooth' });

    incrementalCurrentStep.textContent = "";
    pointIndex = 0;
    if (pin_coords == null) {
        CalculatePins();
    }

    let j = 0;
    (function codeBlock() {
        if (j < MAX_LINES - 1) {
            //incrementalCurrentStep.textContent = "Current Line: " + (pointIndex + 1) + " |  Pin " + line_sequence[pointIndex] + " to " + line_sequence[pointIndex + 1];
            pointIndex++;
            ctx3.beginPath();
            ctx3.moveTo(pin_coords[line_sequence[pointIndex - 1]][0] * 2, pin_coords[line_sequence[pointIndex - 1]][1] * 2);
            ctx3.lineTo(pin_coords[line_sequence[pointIndex]][0] * 2, pin_coords[line_sequence[pointIndex]][1] * 2);
            ctx3.strokeStyle = "black";
            ctx3.lineWidth = 0.3;
            ctx3.stroke();
            j++;
            setTimeout(codeBlock, 0);
        } else {
        }
    })();
}

function nextStep() {
    if (pointIndex > MAX_LINES - 1) { return; }
    incrementalCurrentStep.textContent = "Current Line: " + (pointIndex + 1) + " |  Pin " + line_sequence[pointIndex] + " to " + line_sequence[pointIndex + 1];

    if (pointIndex > 0) {
        //ctx3.clearRect(0,0, IMG_SIZE * 2, IMG_SIZE * 2);
        ctx3.putImageData(lastStepImage, 0, 0);
        ctx3.beginPath();
        ctx3.moveTo(pin_coords[line_sequence[pointIndex - 1]][0] * 2, pin_coords[line_sequence[pointIndex - 1]][1] * 2);
        ctx3.lineTo(pin_coords[line_sequence[pointIndex]][0] * 2, pin_coords[line_sequence[pointIndex]][1] * 2);
        ctx3.strokeStyle = "black";
        ctx3.lineWidth = 0.3;
        ctx3.stroke();
    }

    lastStepImage = ctx3.getImageData(0, 0, IMG_SIZE * 2, IMG_SIZE * 2);

    pointIndex++;
    ctx3.beginPath();
    ctx3.moveTo(pin_coords[line_sequence[pointIndex - 1]][0] * 2, pin_coords[line_sequence[pointIndex - 1]][1] * 2);
    ctx3.lineTo(pin_coords[line_sequence[pointIndex]][0] * 2, pin_coords[line_sequence[pointIndex]][1] * 2);
    ctx3.strokeStyle = "#FF0000";
    ctx3.lineWidth = 1;
    ctx3.stroke();

    //window.speechSynthesis.speak(new SpeechSynthesisUtterance(line_sequence[pointIndex + 1]));
}

function lastStep() {
    if (pointIndex < 2) { return; }
    pointIndex--;
    pointIndex--;
    ctx3.clearRect(0, 0, IMG_SIZE * 2, IMG_SIZE * 2);
    incrementalCurrentStep.textContent = "Current Line: " + (pointIndex + 1) + " |  Pin " + line_sequence[pointIndex] + " to " + line_sequence[pointIndex + 1];

    for (i = 0; i < pointIndex; i++) {
        ctx3.beginPath();
        ctx3.moveTo(pin_coords[line_sequence[i]][0] * 2, pin_coords[line_sequence[i]][1] * 2);
        ctx3.lineTo(pin_coords[line_sequence[i + 1]][0] * 2, pin_coords[line_sequence[i + 1]][1] * 2);
        ctx3.strokeStyle = "black";
        ctx3.lineWidth = 0.3;
        ctx3.stroke();
    }
    lastStepImage = ctx3.getImageData(0, 0, IMG_SIZE * 2, IMG_SIZE * 2);
    pointIndex++;
    ctx3.beginPath();
    ctx3.moveTo(pin_coords[line_sequence[pointIndex - 1]][0] * 2, pin_coords[line_sequence[pointIndex - 1]][1] * 2);
    ctx3.lineTo(pin_coords[line_sequence[pointIndex]][0] * 2, pin_coords[line_sequence[pointIndex]][1] * 2);
    ctx3.strokeStyle = "#FF0000";
    ctx3.lineWidth = 1;
    ctx3.stroke();
}

function CalculatePins() {
    console.log("Calculating pins...");
    pin_coords = [];
    center = IMG_SIZE / 2;
    radius = IMG_SIZE / 2 - 1 / 2

    for (i = 0; i < N_PINS; i++) {
        angle = 2 * Math.PI * i / N_PINS;
        pin_coords.push([Math.floor(center + radius * Math.cos(angle)),
        Math.floor(center + radius * Math.sin(angle))]);
    }
}

function onHasSteps() {
    step1.classList.add('hidden');
    step2.classList.add('hidden');
    step3.classList.add('hidden');
    showPins.classList.remove('hidden');
    window.scrollTo({ top: 5000, left: 0, behavior: 'smooth' });
}

document.body.onkeydown = function (e) {
    if (!listenForKeys) { return; }
    if (e.keyCode == 32) { // space bar
        nextStep();
    } else if (e.keyCode == 39) { //right key
        nextStep();
    } else if (e.keyCode == 37) { //left key
        lastStep();
    }
}
function onOpenCvReady() {
    // Remove the "Generator is ready." message
    setTimeout(function () {
        document.getElementById('status').innerHTML = ''; // Empty string
    }, 1000);

    numberOfPins.value = N_PINS;
    numberOfPins.addEventListener("keyup", function (event) {
        N_PINS = parseInt(event.target.value);
    });

    // Removed the lines that set numberOfLines.value
    // let numberOfLines = document.getElementById("numberOfLines");
    // if (numberOfLines.value === '' || numberOfLines.value === numberOfLines.dataset.placeholder) {
    //     MAX_LINES = 4000;
    //     numberOfLines.value = MAX_LINES;
    // }

    numberOfLines.addEventListener("keyup", function (event) {
        MAX_LINES = parseInt(event.target.value);
    });

    lineWeight.value = LINE_WEIGHT;
    lineWeight.addEventListener("keyup", function (event) {
        LINE_WEIGHT = parseInt(event.target.value);
    });
}

function generatePinsPdf() {
    const pinsText = document.getElementById('pinsOutput').textContent;
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    const pinsArray = pinsText.split(',');
    const arrowSymbol = '->';

    let data = [];
    let row = [];

    for (let i = 0; i < pinsArray.length; i++) {
        const cleanedNumber = pinsArray[i].replace(/[^0-9]/g, '').trim();

        row.push(cleanedNumber);

        if (i < pinsArray.length - 1) {
            row.push(arrowSymbol);
        }

        if (row.length >= 30) {
            data.push(row);
            row = [];
        }
    }

    if (row.length > 0) {
        data.push(row);
    }

    pdf.autoTable({
        body: data,
        styles: {
            fontSize: 8,
            cellPadding: 0.2,
            overflow: 'linebreak'
        },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 'auto' },
        }
    });

    pdf.save('pins.pdf');
    return false;
}
function Finalize() {
let dsize = new cv.Size(IMG_SIZE * 2, IMG_SIZE * 2);
let dst = new cv.Mat();
cv.resize(result, dst, dsize, 0, 0, cv.INTER_AREA);

console.log("complete");
drawStatus.textContent = MAX_LINES + " Lines | 100%";

cv.imshow('canvasOutput2', dst);
console.log(line_sequence);
status.textContent = "Complete";

// Wrap numbers in <span> elements with data-index
let pinsHTML = line_sequence.map((num, index) => `<span data-index="${index}">${num}</span>`).join(',');
document.getElementById('pinsOutput').innerHTML = pinsHTML;

showPins.classList.remove('hidden');

// Make the navigation controls visible
document.getElementById('navigation-controls').classList.remove('hidden');

// Get the elements for the circle display and pins output
let circleDisplay = document.getElementById("circle-display");
let pinsOutput = document.getElementById("pinsOutput");
let nextButton = document.getElementById("next-button");
let prevButton = document.getElementById("prev-button");
let nextText = document.getElementById("next-text");
let prevText = document.getElementById("prev-text");

// Parse the coordinate numbers from pinsOutput
let coordinateNumbers = pinsOutput.textContent.split(",").map(Number);

// Initialize the current index
let currentCoordinateIndex = 0;

// Function to update the circle display
function updateCircleDisplay() {
const circleDisplay = document.getElementById('circle-display');

// Don't override "Done!" if already shown
if (circleDisplay.textContent === "Done!") return;

// Otherwise, show the current pin number
if (currentCoordinateIndex >= 0 && currentCoordinateIndex < coordinateNumbers.length) {
    circleDisplay.textContent = coordinateNumbers[currentCoordinateIndex];
} else if (coordinateNumbers.length > 0) {
    circleDisplay.textContent = "✓";
} else {
    circleDisplay.textContent = "-";
}
}

// Function to update the button visibility
function updateButtonVisibility() {
    prevButton.disabled = currentCoordinateIndex === 0;
    nextButton.disabled = currentCoordinateIndex === coordinateNumbers.length - 1;
}

// Function to handle "Next" button click
function handleNextClick() {
if (currentCoordinateIndex < coordinateNumbers.length - 1) {
    strikethroughCoordinate(currentCoordinateIndex);
    currentCoordinateIndex++;
    updateCircleDisplay();
    updateButtonVisibility();
    checkIfAllDone(); // ✅ Check if all are done
}
}

// Function to handle "Previous" button click
function handlePrevClick() {
if (currentCoordinateIndex > 0) {
    removeStrikethroughCoordinate(currentCoordinateIndex - 1);
    currentCoordinateIndex--;
    updateCircleDisplay();
    updateButtonVisibility();
}
}

function checkIfAllDone() {
console.group("[DEBUG] checkIfAllDone()");
const spans = pinsOutput.querySelectorAll("span");
let unstruckCount = 0;

spans.forEach(span => {
    if (!window.getComputedStyle(span).textDecorationLine.includes("line-through")) {
        unstruckCount++;
    }
});

console.log("Unstruck pins remaining:", unstruckCount);

if (unstruckCount === 0) {
    console.log("ALL PINS COMPLETE! Triggering celebration...");
    celebrateCompletion();
}
console.groupEnd();
}

// NEW: Bulletproof celebrateCompletion()
function celebrateCompletion() {
// 1. Visual feedback
const circleDisplay = document.getElementById('circle-display');
circleDisplay.textContent = "Done!";
circleDisplay.style.cssText = `
    color: #4CAF50 !important;
    font-size: 1.5rem !important;
    font-weight: bold !important;
`;

// 2. Create precision canvas
const canvas = document.createElement('canvas');
canvas.style.position = 'fixed';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.width = '100vw';
canvas.style.height = '100vh';
canvas.style.pointerEvents = 'none';
canvas.style.zIndex = '9999';
document.body.appendChild(canvas);

// 3. Custom physics configuration
const physics = {
    gravity: 0.2,            // Slower fall (default: 0.1)
    friction: 0.98,          // Less air resistance (default: 0.99)
    terminalVelocity: 6,      // Max fall speed (default: 3)
    drift: 0.3               // Horizontal sway
};

// 4. Fine-tuned explosions
try {
    // Main explosion (lower screen)
    confetti({
        particleCount: 180,
        spread: 85,
        startVelocity: 35,
        ticks: 120,           // Longer lifespan
        origin: { 
            y: 0.7,          // 70% from top
            x: 0.5 
        },
        colors: ['#ff0000', '#00ff00', '#0000ff'],
        scalar: 1.2,
        decay: 0.94,          // Faster fade-out
        disableForReducedMotion: true,
        physics: physics     // Custom physics
    }, { canvas });

    // Side explosions
    [0.3, 0.7].forEach((xPos, i) => {
        setTimeout(() => {
            confetti({
                particleCount: 100,
                angle: xPos < 0.5 ? 60 : 120,
                spread: 75,
                startVelocity: 30,
                ticks: 100,
                origin: { 
                    y: 0.65, // Slightly higher than main
                    x: xPos 
                },
                decay: 0.92,  // Quicker fade than main burst
                physics: physics
            }, { canvas });
        }, 400 * (i + 1));
    });

    // Ground-level fade control
    const fadeCanvas = document.createElement('div');
    fadeCanvas.style.position = 'fixed';
    fadeCanvas.style.bottom = '0';
    fadeCanvas.style.left = '0';
    fadeCanvas.style.width = '100%';
    fadeCanvas.style.height = '30%'; // Disappearance zone height
    fadeCanvas.style.background = 'linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)';
    fadeCanvas.style.pointerEvents = 'none';
    fadeCanvas.style.zIndex = '10000';
    document.body.appendChild(fadeCanvas);

} catch (e) {
    console.error("Confetti error:", e);
    // Fallback animation
    circleDisplay.style.animation = 'celebrate 2s infinite';
    const style = document.createElement('style');
    style.textContent = `
        @keyframes celebrate {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.9; }
            100% { transform: scale(1); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}

// 5. Cleanup
setTimeout(() => {
    canvas?.parentNode?.removeChild(canvas);
    document.querySelectorAll('.confetti-fade').forEach(el => el.remove());
}, 8000);
}



// Function to strikethrough the current number in pinsOutput
function strikethroughCoordinate(index) {
let spans = pinsOutput.querySelectorAll("span");
if (spans[index]) {
    spans[index].style.textDecoration = "line-through";
    spans[index].style.textDecorationColor = "white"; // Set the color to white
}
}

// Function to remove the strikethrough
function removeStrikethroughCoordinate(index) {
let spans = pinsOutput.querySelectorAll("span");
if (spans[index]) {
    spans[index].style.textDecoration = "";
    spans[index].style.textDecorationColor = ""; // Remove the color
}
}

// Function to hide the text
function hideText() {
nextText.style.visibility = "hidden";
prevText.style.visibility = "hidden";
// Remove event listeners so this only runs once
nextButton.removeEventListener("click", hideText);
prevButton.removeEventListener("click", hideText);
pinsOutput.removeEventListener("click", hideText);
}

// Attach event listeners to hide the text
nextButton.addEventListener("click", hideText);
prevButton.addEventListener("click", hideText);
pinsOutput.addEventListener("click", hideText);

// Attach event listeners for the buttons
nextButton.addEventListener("click", handleNextClick);
prevButton.addEventListener("click", handlePrevClick);

// Initial update
updateCircleDisplay();
updateButtonVisibility();

 // Event listener for clicks on spans in pinsOutput (REVISED)
pinsOutput.addEventListener("click", function (event) {
if (event.target.tagName === "SPAN") {
    let spans = pinsOutput.querySelectorAll("span");
    let clickedIndex = Array.from(spans).indexOf(event.target); // Get index of the clicked span

    // --- Robust Toggle Logic ---
    let style = window.getComputedStyle(event.target).textDecorationLine; // Get computed style reliably
    let isCurrentlyStruck = style.includes("line-through");

    if (isCurrentlyStruck) {
        // If it IS struck, remove strikethrough
        event.target.style.textDecoration = "";
        event.target.style.textDecorationColor = ""; // Clear color too
    } else {
        // If it's NOT struck, add strikethrough
        event.target.style.textDecoration = "line-through";
        event.target.style.textDecorationColor = "white"; // Set your desired color
    }
    // --- End Toggle Logic ---

    // --- NEW: Immediately check if all are done after each strike ---
    console.log("[DEBUG] Pin", clickedIndex, "toggled. Checking completion...");
    checkIfAllDone(); // <-- THIS IS THE CRITICAL ADDITION

    // --- Find First Unchecked Index (using computed style) ---
    let firstUncheckedIndex = -1;
    for (let i = 0; i < spans.length; i++) {
        // Check computed style for reliability
        let spanStyle = window.getComputedStyle(spans[i]).textDecorationLine;
        if (!spanStyle.includes("line-through")) {
            firstUncheckedIndex = i;
            break; // Found the first unstruck item
        }
    }
    // --- End Find First Unchecked ---

    // --- Update global index and display ---
    if (firstUncheckedIndex !== -1) {
        // If we found an unstruck item, set the global index to it
        currentCoordinateIndex = firstUncheckedIndex;
    } else {
        // All items are checked - trigger celebration explicitly
        currentCoordinateIndex = coordinateNumbers.length;
        console.log("[DEBUG] All pins completed via click handler");
        celebrateCompletion(); // <-- SECONDARY TRIGGER POINT
    }

    // Now update the circle and buttons based on the potentially new currentCoordinateIndex
    updateCircleDisplay();
    updateButtonVisibility();
    // --- End Update ---
}
});

dst.delete(); result.delete();
window.scrollTo({ top: 5000, left: 0, behavior: 'smooth' });
}

document.getElementById('downloadPinsPdf').addEventListener('click', generatePinsPdf);



